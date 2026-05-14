import Stripe from 'stripe';

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

  const { userId, amount } = req.body || {};

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount < 5) {
    return res.status(400).json({ error: 'amount must be a number >= 5 (USD)' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe is not configured' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-04-10',
    });

    // Fee breakdown (all in USD, decimal)
    const stripeFee = parseFloat((parsedAmount * 0.029 + 0.30).toFixed(6));
    const netAfterStripe = parsedAmount - stripeFee;
    const ourCut = parseFloat((netAfterStripe * 0.25).toFixed(6));
    const userCredit = parseFloat((netAfterStripe - ourCut).toFixed(6));

    // Stripe expects amounts in cents (integer)
    const amountCents = Math.round(parsedAmount * 100);

    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Aestrist Chat Credits',
              description: `$${userCredit.toFixed(2)} in chat credits added to your account`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        ourCut: ourCut.toFixed(6),
        userCredit: userCredit.toFixed(6),
        stripeFee: stripeFee.toFixed(6),
        rawAmount: parsedAmount.toFixed(2),
      },
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/cancel`,
    });

    return res.status(200).json({
      url: session.url,
      sessionId: session.id,
      breakdown: {
        rawAmount: parsedAmount,
        stripeFee,
        ourCut,
        userCredit,
      },
    });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
}
