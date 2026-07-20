// /api/models — polls NVIDIA NIM + OpenRouter for live model lists
// Each NIM model is verified with a lightweight health-check before being returned.
// Results are cached for 15 minutes since health-checks are expensive.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

let cache = { nim: null, openrouter: null, ts: 0 };
const TTL = 15 * 60 * 1000; // 15 minutes — longer because we health-check

// ── Public model IDs (never expose backend names to clients) ──────────
export const AEL_1_ID = 'ael-1';
export const AEL_1_PRO_ID = 'ael-1-pro';

// ── Model route table ────────────────────────────────────────────────
// The alias (ael-1 / ael-1-pro) is NEVER forwarded as a model ID.
export const MODEL_ROUTES = {
[AEL_1_ID]: [
{ provider: 'ael', model: 'qwen3.7-max' },
{ provider: 'ael', model: 'qwen3.7-plus' },
{ provider: 'nim', model: 'meta/llama-3.3-70b-instruct' },
],
[AEL_1_PRO_ID]: [
{ provider: 'ael', model: 'qwen3.8-max-preview' },
],
};

export function publicModelId(internalId) {
for (const [pub, routes] of Object.entries(MODEL_ROUTES)) {
if (routes.some(r => r.model === internalId)) return pub;
}
return null;
}

export function getAelModelId(rawModel) {
if (!rawModel) return null;
if (MODEL_ROUTES[AEL_1_ID]?.some(r => r.model === rawModel)) return rawModel;
if (MODEL_ROUTES[AEL_1_PRO_ID]?.some(r => r.model === rawModel)) return rawModel;
if (rawModel === AEL_1_ID) return MODEL_ROUTES[AEL_1_ID][0].model;
if (rawModel === AEL_1_PRO_ID) return MODEL_ROUTES[AEL_1_PRO_ID][0].model;
if (rawModel === 'Ael 1') return MODEL_ROUTES[AEL_1_ID][0].model;
if (rawModel === 'Ael 1 Pro') return MODEL_ROUTES[AEL_1_PRO_ID][0].model;
return rawModel;
}

export function isAelModel(rawModel) {
return rawModel === AEL_1_ID || rawModel === AEL_1_PRO_ID ||
rawModel === 'Ael 1' || rawModel === 'Ael 1 Pro' ||
!!publicModelId(rawModel);
}

// Fallback — models we know exist (will be filtered down if they fail)
const NIM_FALLBACK = [
  { id: 'meta/llama-3.3-70b-instruct', name: 'LLaMA 3.3 70B Instruct', provider: 'Meta' },
  { id: 'meta/llama-3.1-8b-instruct', name: 'LLaMA 3.1 8B Instruct', provider: 'Meta' },
  { id: 'mistralai/mistral-7b-instruct-v0.3', name: 'Mistral 7B Instruct', provider: 'Mistral' },
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B', provider: 'NVIDIA' },
  { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B', provider: 'Google' },
  { id: 'meta/llama-3.2-3b-instruct', name: 'LLaMA 3.2 3B Instruct', provider: 'Meta' },
];

const OPENROUTER_FALLBACK = [
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'Anthropic' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'Google' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini 1.5 Pro', provider: 'Google' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'LLaMA 3.3 70B', provider: 'Meta' },
  { id: 'mistralai/mistral-large', name: 'Mistral Large', provider: 'Mistral' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek' },
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', provider: 'Qwen' },
];

// ── NVIDIA NIM: fetch model list then health-check each one ───────────
async function fetchNimModels() {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return [];

  // 1. Fetch the catalog
  let candidates;
  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return NIM_FALLBACK;

    const data = await res.json();
    const seen = new Set();
    candidates = (data.data || [])
      .filter(m => m.id && !m.id.includes('embed') && !m.id.includes('rerank'))
      .filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      })
      .map(m => ({
        id: m.id,
        name: formatModelName(m.id.split('/')[1] || m.id),
        provider: formatProviderName(m.id.split('/')[0] || ''),
      }))
      .slice(0, 40);
  } catch {
    return NIM_FALLBACK;
  }

  if (candidates.length === 0) return NIM_FALLBACK;

  // 2. Health-check each model with a tiny request (parallel, 10s timeout)
  const results = await Promise.allSettled(
    candidates.map(m =>
      testNimModel(m, apiKey).then(ok => ok ? m : null)
    )
  );

  const working = results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);

  return working.length > 0 ? working : NIM_FALLBACK;
}

async function testNimModel(model, apiKey) {
  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model.id,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── OpenRouter models ─────────────────────────────────────────────────
async function fetchOpenRouterModels() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return OPENROUTER_FALLBACK;

    const data = await res.json();
    const models = (data.data || [])
      .filter(m => m.id && !m.id.includes(':free') && m.context_length >= 4096)
      .sort((a, b) => {
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
  // Just capitalize the first letter of the raw org name
  if (!org) return org;
  return org.charAt(0).toUpperCase() + org.slice(1);
}

// ── Handler ───────────────────────────────────────────────────────────
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

const aelModels = [
{ id: AEL_1_ID, name: 'Ael 1', provider: 'Ael', experimental: false },
{ id: AEL_1_PRO_ID, name: 'Ael 1 Pro', provider: 'Ael', experimental: true },
];
return res.status(200).json({
nim: cache.nim,
openrouter: cache.openrouter,
ael: aelModels,
ts: cache.ts,
});
}
