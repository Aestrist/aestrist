import { Redis } from '@upstash/redis';

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

// ── Free tier: NVIDIA NIM (streaming) ───────────────────────────────
async function streamFree(message, model, history, res) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return sseError(res, 'NVIDIA_API_KEY is not configured', 500);

  const selectedModel = model || 'meta/llama-3.3-70b-instruct';
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
