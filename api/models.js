// /api/models — polls NVIDIA NIM + OpenRouter for live model lists
// Results are cached in-memory for 10 minutes to avoid hammering the APIs

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

let cache = { nim: null, openrouter: null, ts: 0 };
const TTL = 10 * 60 * 1000; // 10 minutes

// Models we always want available even if the API is down
const NIM_FALLBACK = [
  { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'Meta' },
  { id: 'meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', provider: 'Meta' },
  { id: 'mistralai/mistral-7b-instruct-v0.3', name: 'Mistral 7B', provider: 'Mistral' },
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B', provider: 'NVIDIA' },
  { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B', provider: 'Google' },
];

const OPENROUTER_FALLBACK = [
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'Anthropic' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'Google' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini 1.5 Pro', provider: 'Google' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'Meta' },
  { id: 'mistralai/mistral-large', name: 'Mistral Large', provider: 'Mistral' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek' },
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', provider: 'Qwen' },
];

async function fetchNimModels() {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return NIM_FALLBACK;

  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NIM_FALLBACK;

    const data = await res.json();
    const models = (data.data || [])
      .filter(m => m.id && !m.id.includes('embed') && !m.id.includes('rerank'))
      .map(m => {
        const parts = m.id.split('/');
        const org = parts[0] || '';
        const modelName = parts[1] || m.id;
        return {
          id: m.id,
          name: formatModelName(modelName),
          provider: formatProviderName(org),
        };
      })
      .slice(0, 40); // cap at 40

    return models.length > 0 ? models : NIM_FALLBACK;
  } catch {
    return NIM_FALLBACK;
  }
}

async function fetchOpenRouterModels() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return OPENROUTER_FALLBACK;

    const data = await res.json();
    const models = (data.data || [])
      .filter(m => m.id && !m.id.includes(':free') && m.context_length >= 4096)
      .sort((a, b) => {
        // Prefer well-known providers first
        const order = ['openai/', 'anthropic/', 'google/', 'meta-llama/', 'mistralai/', 'deepseek/'];
        const ai = order.findIndex(p => a.id.startsWith(p));
        const bi = order.findIndex(p => b.id.startsWith(p));
        if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        return a.id.localeCompare(b.id);
      })
      .map(m => {
        const parts = m.id.split('/');
        const org = parts[0] || '';
        return {
          id: m.id,
          name: m.name || formatModelName(parts[1] || m.id),
          provider: formatProviderName(org),
          context: m.context_length,
          pricing: m.pricing,
        };
      })
      .slice(0, 60);

    return models.length > 0 ? models : OPENROUTER_FALLBACK;
  } catch {
    return OPENROUTER_FALLBACK;
  }
}

function formatModelName(raw) {
  return raw
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bLlama\b/g, 'LLaMA')
    .replace(/\bGpt\b/g, 'GPT')
    .replace(/\b(\d+)B\b/gi, '$1B');
}

function formatProviderName(org) {
  const map = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    'meta-llama': 'Meta',
    meta: 'Meta',
    mistralai: 'Mistral',
    deepseek: 'DeepSeek',
    nvidia: 'NVIDIA',
    qwen: 'Qwen',
    cohere: 'Cohere',
    '01-ai': '01.AI',
  };
  return map[org.toLowerCase()] || org;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS_HEADERS).end();
  }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const now = Date.now();
  if (!cache.nim || !cache.openrouter || now - cache.ts > TTL) {
    const [nim, openrouter] = await Promise.all([
      fetchNimModels(),
      fetchOpenRouterModels(),
    ]);
    cache = { nim, openrouter, ts: now };
  }

  return res.status(200).json({
    nim: cache.nim,
    openrouter: cache.openrouter,
    cached: now - cache.ts < 1000, // true if this response was freshly fetched
    ts: cache.ts,
  });
}
