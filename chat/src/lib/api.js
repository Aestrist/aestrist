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

export async function getBalance(userId) {
  return get(`/api/balance?userId=${encodeURIComponent(userId)}`)
}

export async function createCheckout(userId, amount) {
  return post('/api/stripe-checkout', { userId, amount })
}

export async function fetchModels() {
  return get('/api/models')
}

/**
 * Stream a chat completion. Returns a ReadableStream of SSE events.
 * onDelta(text) — called for each incremental token
 * onDone() — called when stream ends
 * onError(msg) — called on error
 */
export async function streamMessage({ message, model, tier, userId, provider, paymentMode, userApiKey, history, signal }, { onDelta, onDone, onError }) {
  let response
  try {
    response = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, model, tier, userId, provider, paymentMode, userApiKey, history }),
      signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError') {
      onError('cancelled')
      return
    }
    onError(err.message || 'Network error')
    return
  }

  if (!response.ok) {
    try {
      const data = await response.json()
      onError(data.error || `Request failed (${response.status})`)
    } catch {
      onError(`Request failed (${response.status})`)
    }
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        if (trimmed === 'data: [DONE]') {
          onDone()
          return
        }
        if (!trimmed.startsWith('data: ')) continue

        const jsonStr = trimmed.slice(6)
        try {
          const parsed = JSON.parse(jsonStr)
          if (parsed.error) {
            onError(parsed.error)
            return
          }
          if (parsed.delta) {
            onDelta(parsed.delta)
          }
        } catch {
          // skip malformed
        }
      }
    }
    onDone()
  } catch (err) {
    if (err?.name === 'AbortError') {
      onError('cancelled')
      return
    }
    onError(err.message || 'Stream error')
  } finally {
    try { reader.releaseLock() } catch {}
  }
}
