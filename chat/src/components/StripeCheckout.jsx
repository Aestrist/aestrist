import { useState } from 'react'
import { X, CreditCard } from 'lucide-react'
import { useUser } from '../lib/store'
import { createCheckout } from '../lib/api'

export default function StripeCheckout({ onClose }) {
  const { userId } = useUser()
  const [amount, setAmount] = useState('10')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const numAmount = parseFloat(amount) || 0
  const stripeFee = numAmount >= 5 ? numAmount * 0.029 + 0.30 : 0
  const netAfterStripe = numAmount - stripeFee
  const ourCut = netAfterStripe * 0.25
  const userCredit = netAfterStripe - ourCut
  const presets = [5, 10, 20, 50]

  async function handleSubmit() {
    if (numAmount < 5) { setError('Minimum is $5.00'); return }
    setError('')
    setLoading(true)
    try {
      const { url } = await createCheckout(userId, numAmount)
      window.location.href = url
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="slide-up" style={{ width: '100%', maxWidth: 360, background: 'var(--cn-surface)', border: '1px solid var(--cn-border)', borderRadius: 'var(--cn-radius-xl)', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Add Credits</h2>
          <button onClick={onClose} className="icon-btn"><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {presets.map(p => (
            <button
              key={p}
              onClick={() => setAmount(String(p))}
              style={{
                flex: 1,
                padding: '6px 0',
                fontFamily: 'var(--cn-font)',
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 'var(--cn-radius)',
                border: '1px solid',
                cursor: 'pointer',
                transition: 'all var(--cn-transition)',
                background: Math.abs(numAmount - p) < 0.01 ? 'var(--cn-accent)' : 'var(--cn-surface-2)',
                color: Math.abs(numAmount - p) < 0.01 ? 'var(--cn-text)' : 'var(--cn-text-muted)',
                borderColor: Math.abs(numAmount - p) < 0.01 ? 'var(--cn-accent)' : 'var(--cn-border)',
              }}
            >${p}</button>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: 'var(--cn-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Custom amount (USD)</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--cn-text-dim)', fontSize: 13 }}>$</span>
            <input
              type="number"
              min="5"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="cn-input"
              style={{ paddingLeft: 24 }}
            />
          </div>
        </div>

        {numAmount >= 5 && (
          <div style={{ background: 'var(--cn-surface-2)', border: '1px solid var(--cn-border)', borderRadius: 'var(--cn-radius)', padding: '12px 14px', marginBottom: 16 }}>
            {[
              { label: 'You pay', val: `$${numAmount.toFixed(2)}`, color: 'var(--cn-text)' },
              { label: 'Stripe (2.9% + $0.30)', val: `-$${stripeFee.toFixed(2)}`, color: 'var(--cn-error-text)' },
              { label: 'Platform fee (25%)', val: `-$${ourCut.toFixed(2)}`, color: 'var(--cn-accent-text)' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: 'var(--cn-text-muted)' }}>{r.label}</span>
                <span style={{ color: r.color }}>{r.val}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--cn-border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
              <span style={{ color: 'var(--cn-success-text)' }}>Your credits</span>
              <span style={{ color: 'var(--cn-success-text)' }}>${Math.max(0, userCredit).toFixed(2)}</span>
            </div>
          </div>
        )}

        {error && <p style={{ fontSize: 12, color: 'var(--cn-error-text)', marginBottom: 12 }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || numAmount < 5}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            padding: '10px',
            fontFamily: 'var(--cn-font)',
            fontSize: 13,
            fontWeight: 500,
            background: 'var(--cn-accent)',
            border: 'none',
            borderRadius: 'var(--cn-radius)',
            color: 'var(--cn-text)',
            cursor: loading || numAmount < 5 ? 'not-allowed' : 'pointer',
            opacity: loading || numAmount < 5 ? 0.5 : 1,
            transition: 'all var(--cn-transition)',
          }}
        >
          <CreditCard size={15} />
          {loading ? 'Opening checkout...' : `Pay $${numAmount.toFixed(2)}`}
        </button>
      </div>
    </div>
  )
}
