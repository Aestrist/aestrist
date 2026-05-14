const BASE = import.meta.env.VITE_API_URL || ''

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export async function auth(displayName) {
  return post('/api/auth', { displayName })
}

export async function sendMessage({ message, model, tier, userId, provider, paymentMode, userApiKey }) {
  return post('/api/chat', { message, model, tier, userId, provider, paymentMode, userApiKey })
}

export async function getBalance(userId) {
  return get(`/api/balance?userId=${encodeURIComponent(userId)}`)
}

export async function createCheckout(userId, amount) {
  return post('/api/stripe-checkout', { userId, amount })
}
