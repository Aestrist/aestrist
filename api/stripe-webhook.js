import Stripe from 'stripe';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Vercel disables body parsing for webhook routes — we need the raw body.
// Set this export to tell Vercel not to parse the body.
export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ error: 'Stripe is not configured' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-04-10',
  });

  let event;

  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];

    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, userCredit, ourCut } = session.metadata || {};

    if (!userId || !userCredit) {
      console.error('Missing metadata in checkout session:', session.id);
      return res.status(400).json({ error: 'Missing metadata' });
    }

    const credit = parseFloat(userCredit);
    if (isNaN(credit) || credit <= 0) {
      console.error('Invalid userCredit value:', userCredit);
      return res.status(400).json({ error: 'Invalid credit amount' });
    }

    try {
      const balanceKey = `user:${userId}:balance`;
      const txKey = `user:${userId}:transactions`;

      // Atomically increment balance
      const rawBalance = await redis.get(balanceKey);
      const currentBalance = parseFloat(rawBalance || '0');
      const newBalance = (currentBalance + credit).toFixed(6);
      await redis.set(balanceKey, newBalance);

      // Record transaction
      const tx = JSON.stringify({
        type: 'credit',
        amount: credit.toFixed(6),
        ourCut: parseFloat(ourCut || '0').toFixed(6),
        stripeSessionId: session.id,
        description: 'Top-up via Stripe',
        timestamp: new Date().toISOString(),
      });
      await redis.lpush(txKey, tx);

      console.log(`Credited $${credit} to user ${userId}. New balance: $${newBalance}`);
    } catch (err) {
      console.error('Redis error processing payment:', err);
      return res.status(500).json({ error: 'Failed to update balance' });
    }
  }

  // Acknowledge all other event types silently
  return res.status(200).json({ received: true });
}
