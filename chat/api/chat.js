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

// Cost constants (per token) — used only for platform credit deduction
const INPUT_COST_PER_TOKEN = 0.0001 / 1000;   // $0.0001 per 1K input tokens
const OUTPUT_COST_PER_TOKEN = 0.0004 / 1000;  // $0.0004 per 1K output tokens

function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

function estimateCost(inputText, outputText) {
  const inputTokens = estimateTokens(inputText);
  const outputTokens = estimateTokens(outputText);
  return inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN;
}

// ── Free tier: NVIDIA NIM ────────────────────────────────────────────
async function proxyFree(message, model) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error('NVIDIA_API_KEY is not configured');

  const selectedModel = model || 'meta/llama-3.3-70b-instruct';

  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: [{ role: 'user', content: message }],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`NVIDIA API error ${response.status}: ${err}`);
  }

  return response.json();
}

// ── Paid tier: Platform mode (OpenRouter with our key, deducts credits) ──
async function proxyPlatform(message, model, userId, provider) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured for platform mode');

  const selectedModel = model || 'openai/gpt-4o-mini';

  // Check user balance before proxying
  const balanceKey = `user:${userId}:balance`;
  const rawBalance = await redis.get(balanceKey);
  const balance = parseFloat(rawBalance || '0');

  const estimatedCost = estimateTokens(message) * INPUT_COST_PER_TOKEN + 500 * OUTPUT_COST_PER_TOKEN;
  if (balance < estimatedCost) {
    const err = new Error('Insufficient balance');
    err.statusCode = 402;
    throw err;
  }

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
      messages: [{ role: 'user', content: message }],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${err}`);
  }

  const data = await response.json();

  // Deduct cost from balance
  const outputText = data?.choices?.[0]?.message?.content || '';
  const cost = estimateCost(message, outputText);
  const newBalance = Math.max(0, balance - cost);
  await redis.set(balanceKey, newBalance.toFixed(6));

  // Log transaction
  const txKey = `user:${userId}:transactions`;
  const tx = JSON.stringify({
    type: 'debit',
    amount: cost.toFixed(6),
    description: `OpenRouter / ${selectedModel}`,
    timestamp: new Date().toISOString(),
  });
  await redis.lpush(txKey, tx);

  return data;
}

// ── Paid tier: BYOK mode (user brings their own key) ────────────────
async function proxyByok(message, model, userApiKey, provider) {
  if (!userApiKey) throw new Error('API key is required for BYOK mode');

  let baseUrl;
  const p = (provider || 'openai').toLowerCase();

  switch (p) {
    case 'anthropic':
      // Anthropic uses a different API format — we route through OpenAI-compatible
      // For now, support providers with OpenAI-compatible endpoints
      baseUrl = 'https://api.anthropic.com/v1';
      // Actually, Anthropic needs special handling. Let's default to OpenAI-like.
      // We'll use OpenRouter as the router for BYOK too, so the user gets
      // access to everything with one format.
      baseUrl = 'https://openrouter.ai/api/v1';
      break;
    case 'openrouter':
      baseUrl = 'https://openrouter.ai/api/v1';
      break;
    case 'openai':
    default:
      baseUrl = 'https://api.openai.com/v1';
      break;
  }

  const selectedModel = model || 'gpt-4o-mini';

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${userApiKey}`,
  };

  // Add OpenRouter-specific headers if using OpenRouter
  if (p === 'openrouter' || baseUrl.includes('openrouter')) {
    headers['HTTP-Referer'] = process.env.APP_URL || 'https://aestrist.vercel.app';
    headers['X-Title'] = 'Aestrist Chat';
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: selectedModel,
      messages: [{ role: 'user', content: message }],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${provider} API error ${response.status}: ${err}`);
  }

  return response.json();
}

// ── Main handler ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS_HEADERS).end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, model, tier, userId, provider, paymentMode, userApiKey } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required and must be a string' });
  }

  if (!tier || !['free', 'paid'].includes(tier)) {
    return res.status(400).json({ error: 'tier must be "free" or "paid"' });
  }

  try {
    let data;

    if (tier === 'free') {
      data = await proxyFree(message, model);
    } else {
      if (!userId) {
        return res.status(400).json({ error: 'userId is required for paid tier' });
      }

      // Determine payment mode: 'platform' (default) or 'byok'
      const mode = paymentMode || 'platform';

      if (mode === 'byok') {
        data = await proxyByok(message, model, userApiKey, provider);
      } else {
        data = await proxyPlatform(message, model, userId, provider);
      }
    }

    return res.status(200).json(data);
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || 'Internal server error' });
  }
}
