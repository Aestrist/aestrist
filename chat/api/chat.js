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

async function proxyPaid(message, model, provider, userId) {
  // Resolve API key and endpoint by provider
  let apiKey, baseUrl;

  switch ((provider || 'openai').toLowerCase()) {
    case 'anthropic':
      apiKey = process.env.ANTHROPIC_API_KEY;
      baseUrl = 'https://api.anthropic.com/v1';
      break;
    case 'openai':
    default:
      apiKey = process.env.OPENAI_API_KEY;
      baseUrl = 'https://api.openai.com/v1';
      break;
  }

  if (!apiKey) throw new Error(`API key for provider "${provider}" is not configured`);

  // Check user balance before proxying
  const balanceKey = `user:${userId}:balance`;
  const rawBalance = await redis.get(balanceKey);
  const balance = parseFloat(rawBalance || '0');

  // Rough pre-flight cost estimate (assume ~500 output tokens)
  const estimatedCost = estimateTokens(message) * INPUT_COST_PER_TOKEN + 500 * OUTPUT_COST_PER_TOKEN;

  if (balance < estimatedCost) {
    const err = new Error('Insufficient balance');
    err.statusCode = 402;
    throw err;
  }

  const selectedModel = model || 'gpt-4o-mini';

  const response = await fetch(`${baseUrl}/chat/completions`, {
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
    throw new Error(`Provider API error ${response.status}: ${err}`);
  }

  const data = await response.json();

  // Extract response text for cost calculation
  const outputText = data?.choices?.[0]?.message?.content || '';
  const cost = estimateCost(message, outputText);

  // Deduct cost from balance atomically
  const newBalance = Math.max(0, balance - cost);
  await redis.set(balanceKey, newBalance.toFixed(6));

  // Log transaction
  const txKey = `user:${userId}:transactions`;
  const tx = JSON.stringify({
    type: 'debit',
    amount: cost.toFixed(6),
    description: `Chat (${provider || 'openai'} / ${selectedModel})`,
    timestamp: new Date().toISOString(),
  });
  await redis.lpush(txKey, tx);

  return data;
}

export default async function handler(req, res) {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS_HEADERS).end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, model, tier, userId, provider } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required and must be a string' });
  }

  if (!tier || !['free', 'paid'].includes(tier)) {
    return res.status(400).json({ error: 'tier must be "free" or "paid"' });
  }

  if (tier === 'paid' && !userId) {
    return res.status(400).json({ error: 'userId is required for paid tier' });
  }

  try {
    let data;

    if (tier === 'free') {
      data = await proxyFree(message, model);
    } else {
      data = await proxyPaid(message, model, provider, userId);
    }

    return res.status(200).json(data);
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || 'Internal server error' });
  }
}
