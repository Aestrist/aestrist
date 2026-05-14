import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS_HEADERS).end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.query || {};

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId query parameter is required' });
  }

  try {
    const balanceKey = `user:${userId}:balance`;
    const txKey = `user:${userId}:transactions`;

    // Fetch balance and last 50 transactions in parallel
    const [rawBalance, rawTransactions] = await Promise.all([
      redis.get(balanceKey),
      redis.lrange(txKey, 0, 49),
    ]);

    const balance = parseFloat(rawBalance || '0');

    // Parse transaction JSON strings
    const transactions = (rawTransactions || []).map((tx) => {
      try {
        return typeof tx === 'string' ? JSON.parse(tx) : tx;
      } catch {
        return { raw: tx };
      }
    });

    return res.status(200).json({
      userId,
      balance: parseFloat(balance.toFixed(6)),
      // credits is an alias for balance — useful for UI display
      credits: parseFloat(balance.toFixed(6)),
      transactions,
    });
  } catch (err) {
    console.error('Balance fetch error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch balance' });
  }
}
