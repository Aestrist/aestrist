import { useState } from 'react'
import { Coins } from 'lucide-react'
import { useUser } from '../lib/store'
import StripeCheckout from './StripeCheckout'

export default function BalanceDisplay({ tier }) {
  const { balance, transactions } = useUser()
  const [showModal, setShowModal] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  if (tier === 'free') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#555]">free tier</span>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1.5 text-xs text-[#888] hover:text-[#bbb] transition-colors"
        >
          <Coins size={14} />
          <span className="font-mono">${balance.toFixed(2)}</span>
        </button>
        <button
          onClick={() => setShowModal(true)}
          className="text-xs bg-[#d97757] hover:bg-[#e68a6a] text-white px-3 py-1.5 rounded-full transition-colors font-medium"
        >
          + Add Credits
        </button>
      </div>

      {/* Transaction history dropdown */}
      {showHistory && transactions.length > 0 && (
        <div className="absolute top-14 right-4 w-72 bg-[#121212] border border-[#1a1a1a] rounded-xl shadow-2xl p-3 slide-up z-50">
          <p className="text-xs text-[#555] uppercase tracking-wider mb-2">Transactions</p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {transactions.slice(0, 20).map((tx, i) => (
              <div key={i} className="flex justify-between items-center py-1.5 text-xs border-b border-[#1a1a1a] last:border-0">
                <div>
                  <span className={tx.type === 'credit' ? 'text-[#6b9e6b]' : 'text-[#c45a5a]'}>
                    {tx.type === 'credit' ? '+' : '-'}${parseFloat(tx.amount).toFixed(4)}
                  </span>
                  <p className="text-[#555] text-[10px] mt-0.5">{tx.description || tx.type}</p>
                </div>
                <span className="text-[#444] text-[10px]">{tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && <StripeCheckout onClose={() => setShowModal(false)} />}
    </>
  )
}
