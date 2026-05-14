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
    if (numAmount < 5) {
      setError('Minimum is $5.00')
      return
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-6 slide-up mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-medium">Add Credits</h2>
          <button onClick={onClose} className="text-[#555] hover:text-[#888] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Amount presets */}
        <div className="flex gap-2 mb-4">
          {presets.map(p => (
            <button
              key={p}
              onClick={() => setAmount(String(p))}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                Math.abs(numAmount - p) < 0.01
                  ? 'bg-[#d97757] text-white'
                  : 'bg-[#121212] text-[#777] hover:text-[#bbb] border border-[#1a1a1a]'
              }`}
            >
              ${p}
            </button>
          ))}
        </div>

        {/* Custom amount */}
        <div className="mb-5">
          <label className="text-xs text-[#555] mb-1 block">Custom amount (USD)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555] text-sm">$</span>
            <input
              type="number"
              min="5"
              step="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full bg-[#121212] border border-[#1a1a1a] rounded-xl py-2.5 pl-7 pr-3 text-sm text-[#e0e0e0] focus:outline-none focus:border-[#d97757] transition-colors"
            />
          </div>
        </div>

        {/* Fee breakdown */}
        {numAmount >= 5 && (
          <div className="bg-[#121212] rounded-xl p-4 mb-5 space-y-2 text-xs">
            <div className="flex justify-between text-[#777]">
              <span>You pay</span>
              <span className="text-[#e0e0e0]">${numAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[#777]">
              <span>Stripe fee (2.9% + $0.30)</span>
              <span className="text-[#c45a5a]">-${stripeFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[#777]">
              <span>Aestrist platform (25%)</span>
              <span className="text-[#d97757]">-${ourCut.toFixed(2)}</span>
            </div>
            <div className="border-t border-[#1a1a1a] pt-2 flex justify-between text-sm font-medium">
              <span className="text-[#6b9e6b]">Your credits</span>
              <span className="text-[#6b9e6b]">${Math.max(0, userCredit).toFixed(2)}</span>
            </div>
          </div>
        )}

        {error && <p className="text-[#c45a5a] text-xs mb-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || numAmount < 5}
          className="w-full flex items-center justify-center gap-2 bg-[#d97757] hover:bg-[#e68a6a] disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-medium transition-colors"
        >
          <CreditCard size={16} />
          {loading ? 'Opening checkout...' : `Pay $${numAmount.toFixed(2)}`}
        </button>
      </div>
    </div>
  )
}
