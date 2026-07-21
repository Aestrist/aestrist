// /api/debug — deployment verification endpoint
// I (Sisyphus) can fetch this via webfetch to verify the deployed code.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS_HEADERS).end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  const info = {
    ok: true,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    deployedAt: new Date().toISOString(),
    node: process.version,
    region: process.env.VERCEL_REGION || 'unknown',
    env: {
      upstashUrl: !!process.env.UPSTASH_REDIS_REST_URL,
      upstashToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      nvidiaKey: !!process.env.NVIDIA_API_KEY,
      openrouterKey: !!process.env.OPENROUTER_API_KEY,
      appUrl: !!process.env.APP_URL,
    },
    source: 'api/debug.js at 5eed88e',
  };

  // Test mode: perform a quick upstream fetch to verify AEL proxy works
  if (req.query?.test === 'ael') {
    try {
      const upstream = await fetch(
        'https://fantastic-semifreddo-52f872.netlify.app/v1/chat/completions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'qwen3.8-max-preview',
            messages: [{ role: 'user', content: 'Say hello in one word.' }],
            temperature: 0.1,
            max_tokens: 10,
            stream: false,
          }),
          signal: AbortSignal.timeout(10000),
        }
      );
      const data = await upstream.json();
      info.aelTest = {
        status: upstream.status,
        ok: upstream.ok,
        model: data?.model,
        choiceCount: data?.choices?.length,
        hasReasoning: !!data?.choices?.[0]?.message?.reasoning_content,
        preview: data?.choices?.[0]?.message?.content?.slice(0, 100),
      };
    } catch (err) {
      info.aelTest = { error: err.message };
    }
  }

  return res.status(200).json(info);
}
