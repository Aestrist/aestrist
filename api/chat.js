import { Redis } from '@upstash/redis';
import { AEL_1_ID, AEL_1_PRO_ID, isAelModel, MODEL_ROUTES, publicModelId } from './models.js';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Cost constants (per token)
const INPUT_COST_PER_TOKEN = 0.0001 / 1000;
const OUTPUT_COST_PER_TOKEN = 0.0004 / 1000;

function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

function estimateCost(inputText, outputText) {
  return estimateTokens(inputText) * INPUT_COST_PER_TOKEN +
         estimateTokens(outputText) * OUTPUT_COST_PER_TOKEN;
}

// ── SSE helpers ──────────────────────────────────────────────────────
function startSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  res.flushHeaders();
}

function sseChunk(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sseDone(res) {
  res.write('data: [DONE]\n\n');
  res.end();
}

function sseError(res, message, status) {
  res.write(`data: ${JSON.stringify({ error: message, status })}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
}

// ── Provider implementations ────────────────────────────────────────

async function streamAelProvider(model, messages, res) {
const baseUrl = 'https://fantastic-semifreddo-52f872.netlify.app/v1/chat/completions';
const response = await fetch(baseUrl, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
model,
messages,
temperature: 0.7,
max_tokens: 2048,
stream: true,
}),
signal: AbortSignal.timeout(60000),
});
if (!response.ok) throw new Error(`Ael API ${response.status}`);
if (!response.body) throw new Error('No response body');
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let firstChunk = null;
let gotValidChunk = false;
try {
while (!gotValidChunk) {
const { done, value } = await reader.read();
if (done) break;
buffer += decoder.decode(value, { stream: true });
const lines = buffer.split('\n');
buffer = lines.pop() || '';
for (const line of lines) {
const trimmed = line.trim();
if (!trimmed || trimmed === 'data: [DONE]') continue;
if (!trimmed.startsWith('data: ')) continue;
try {
const parsed = JSON.parse(trimmed.slice(6));
if (parsed.error) continue;
if (parsed.choices?.[0]?.delta?.content !== undefined || parsed.choices?.[0]?.finish_reason) {
gotValidChunk = true;
firstChunk = parsed;
break;
}
} catch { continue; }
}
}
} catch {
reader.releaseLock();
throw new Error('Ael pre-flight read failed');
}
if (!gotValidChunk) {
reader.releaseLock();
throw new Error('Ael returned no valid content');
}
sseChunk(res, firstChunk);
try {
while (true) {
const { done, value } = await reader.read();
if (done) break;
buffer += decoder.decode(value, { stream: true });
const lines = buffer.split('\n');
buffer = lines.pop() || '';
for (const line of lines) {
const trimmed = line.trim();
if (!trimmed || trimmed === 'data: [DONE]') continue;
if (!trimmed.startsWith('data: ')) continue;
try {
const parsed = JSON.parse(trimmed.slice(6));
const delta = parsed?.choices?.[0]?.delta?.content;
if (delta) sseChunk(res, { delta });
} catch { /* ignore malformed */ }
}
}
} finally {
reader.releaseLock();
}
sseDone(res);
}

async function streamNimProvider(model, messages, res) {
const apiKey = process.env.NVIDIA_API_KEY;
if (!apiKey) throw new Error('NVIDIA_API_KEY not configured');
const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
method: 'POST',
headers: {
'Content-Type': 'application/json',
Authorization: `Bearer ${apiKey}`,
},
body: JSON.stringify({
model,
messages,
temperature: 0.7,
max_tokens: 2048,
stream: true,
}),
signal: AbortSignal.timeout(60000),
});
if (!response.ok) {
const err = await response.text();
throw new Error(`NVIDIA ${response.status}: ${err}`);
}
await pipeStream(response.body, res);
}

async function streamOpenRouterProvider(model, messages, userId, res) {
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');
const balanceKey = `user:${userId}:balance`;
const rawBalance = await redis.get(balanceKey);
const balance = parseFloat(rawBalance || '0');
const estimatedCost = estimateTokens(messages[messages.length - 1]?.content || '') * INPUT_COST_PER_TOKEN + 500 * OUTPUT_COST_PER_TOKEN;
if (balance < estimatedCost) throw new Error('Insufficient balance');
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
method: 'POST',
headers: {
'Content-Type': 'application/json',
Authorization: `Bearer ${apiKey}`,
'HTTP-Referer': process.env.APP_URL || 'https://aestrist.vercel.app',
'X-Title': 'Aestrist Chat',
},
body: JSON.stringify({
model,
messages,
temperature: 0.7,
max_tokens: 2048,
stream: true,
}),
signal: AbortSignal.timeout(60000),
});
if (!response.ok) {
const err = await response.text();
throw new Error(`OpenRouter ${response.status}: ${err}`);
}
const fullText = await pipeStream(response.body, res);
if (fullText && userId) {
const cost = estimateCost(messages[messages.length - 1]?.content || '', fullText);
const newBalance = Math.max(0, balance - cost);
redis.set(balanceKey, newBalance.toFixed(6)).catch(() => {});
const tx = JSON.stringify({
type: 'debit',
amount: cost.toFixed(6),
description: model,
timestamp: new Date().toISOString(),
});
redis.lpush(`user:${userId}:transactions`, tx).catch(() => {});
}
}

async function streamWithModel(message, rawModel, history, res, extra = {}) {
const publicId = isAelModel(rawModel)
? (rawModel === 'Ael 1 Pro' || rawModel === AEL_1_PRO_ID ? AEL_1_PRO_ID : AEL_1_ID)
: null;
if (!publicId) {
sseError(res, `Not an Ael alias: ${rawModel}`, 400);
return;
}
const routes = MODEL_ROUTES[publicId];
if (!routes) {
sseError(res, `No route table for model: ${rawModel}`, 500);
return;
}
const messages = buildMessages(history, message);
for (const route of routes) {
try {
switch (route.provider) {
case 'ael':
await streamAelProvider(route.model, messages, res);
break;
case 'nim':
await streamNimProvider(route.model, messages, res);
break;
case 'openrouter':
await streamOpenRouterProvider(route.model, messages, extra.userId, res);
break;
default:
continue;
}
return;
} catch {
continue;
}
}
sseError(res, `All providers failed for ${publicId}`, 502);
}

// ── Free tier: NVIDIA NIM (streaming) ───────────────────────────────
async function streamFree(message, model, history, res) {
const apiKey = process.env.NVIDIA_API_KEY;
if (!apiKey) return sseError(res, 'NVIDIA_API_KEY is not configured', 500);
const selectedModel = model || 'meta/llama-3.3-70b-instruct';
if (isAelModel(selectedModel)) {
return streamWithModel(message, selectedModel, history, res);
}
const messages = buildMessages(history, message);
const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: selectedModel,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return sseError(res, `NVIDIA API error ${response.status}: ${err}`, response.status);
  }

  await pipeStream(response.body, res);
}

// ── Paid tier: Platform (OpenRouter with our key) ────────────────────
async function streamPlatform(message, model, userId, history, res) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return sseError(res, 'OPENROUTER_API_KEY is not configured', 500);

const selectedModel = model || 'openai/gpt-4o-mini';

if (isAelModel(selectedModel)) {
return streamWithModel(message, selectedModel, history, res, { userId });
}

// Check balance
const balanceKey = `user:${userId}:balance`;
  const rawBalance = await redis.get(balanceKey);
  const balance = parseFloat(rawBalance || '0');
  const estimatedCost = estimateTokens(message) * INPUT_COST_PER_TOKEN + 500 * OUTPUT_COST_PER_TOKEN;

  if (balance < estimatedCost) {
    return sseError(res, 'Insufficient balance', 402);
  }

  const messages = buildMessages(history, message);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.APP_URL || 'https://aestrist.vercel.app',
      'X-Title': 'Aestrist Chat',
    },
    body: JSON.stringify({
      model: selectedModel,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return sseError(res, `OpenRouter error ${response.status}: ${err}`, response.status);
  }

  // Pipe stream and collect output for billing
  const fullText = await pipeStream(response.body, res);

  // Deduct cost asynchronously (fire and forget - don't block the response)
  if (fullText && userId) {
    const cost = estimateCost(message, fullText);
    const newBalance = Math.max(0, balance - cost);
    redis.set(balanceKey, newBalance.toFixed(6)).catch(() => {});
    const tx = JSON.stringify({
      type: 'debit',
      amount: cost.toFixed(6),
      description: `${selectedModel}`,
      timestamp: new Date().toISOString(),
    });
    redis.lpush(`user:${userId}:transactions`, tx).catch(() => {});
  }
}

// ── Paid tier: BYOK ──────────────────────────────────────────────────
async function streamByok(message, model, userApiKey, provider, history, res) {
  if (!userApiKey) return sseError(res, 'API key required for BYOK mode', 400);

  const p = (provider || 'openai').toLowerCase();
  let baseUrl;

  switch (p) {
    case 'openrouter':
    case 'anthropic':
      baseUrl = 'https://openrouter.ai/api/v1';
      break;
    case 'openai':
    default:
      baseUrl = 'https://api.openai.com/v1';
      break;
  }

  const selectedModel = model || 'gpt-4o-mini';
  const messages = buildMessages(history, message);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${userApiKey}`,
  };

  if (baseUrl.includes('openrouter')) {
    headers['HTTP-Referer'] = process.env.APP_URL || 'https://aestrist.vercel.app';
    headers['X-Title'] = 'Aestrist Chat';
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: selectedModel,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return sseError(res, `${provider} API error ${response.status}: ${err}`, response.status);
  }

  await pipeStream(response.body, res);
}

// ── Stream pipe: reads SSE from upstream and forwards to client ──────
async function pipeStream(body, res) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // last incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            sseChunk(res, { delta });
          }
        } catch {
          // Ignore malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  sseDone(res);
  return fullText;
}

// ── Build message history for the API ───────────────────────────────
function buildMessages(history, newMessage) {
  const messages = (history || []).map(m => ({
    role: m.role,
    content: m.content,
  }));
  messages.push({ role: 'user', content: newMessage });
  return messages;
}

// ── Main handler ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS_HEADERS).end();
  }

  if (req.method !== 'POST') {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, model, tier, userId, provider, paymentMode, userApiKey, history } = req.body || {};

  if (!message || typeof message !== 'string') {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(400).json({ error: 'message is required and must be a string' });
  }

  if (!tier || !['free', 'paid'].includes(tier)) {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(400).json({ error: 'tier must be "free" or "paid"' });
  }

  // Start SSE
  startSSE(res);

  try {
    if (tier === 'free') {
      await streamFree(message, model, history, res);
    } else {
      if (!userId) {
        return sseError(res, 'userId is required for paid tier', 400);
      }
      const mode = paymentMode || 'platform';
      if (mode === 'byok') {
        await streamByok(message, model, userApiKey, provider, history, res);
      } else {
        await streamPlatform(message, model, userId, history, res);
      }
    }
  } catch (err) {
    // If headers not yet sent, send JSON; otherwise send SSE error
    if (!res.headersSent) {
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
    sseError(res, err.message || 'Internal server error', 500);
  }
}
