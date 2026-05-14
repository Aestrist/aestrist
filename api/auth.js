import { randomUUID } from 'crypto';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS_HEADERS).end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { displayName } = req.body || {};

    // Generate a stable userId and a separate session token
    const userId = randomUUID();
    const token = randomUUID();

    return res.status(200).json({
      userId,
      token,
      displayName: displayName || null,
      createdAt: new Date().toISOString(),
      // Remind the client to persist these in localStorage
      note: 'Store userId and token in localStorage. userId is your permanent identity.',
    });
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create user' });
  }
}
