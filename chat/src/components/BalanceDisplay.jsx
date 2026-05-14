import { useState } from 'react'
import { Wallet, Plus, Key } from 'lucide-react'
import { useUser } from '../lib/store'
import StripeCheckout from './StripeCheckout'

export default function BalanceDisplay({ tier, paymentMode }) {
  const { balance } = useUser()
  const [showModal, setShowModal] = useState(false)

  if (tier === 'free') {
    return <span className="topbar-badge topbar-badge-free">Free</span>
  }

  if (paymentMode === 'byok') {
    return (
      <div className="topbar-byok">
        <Key size={12} />
        <span>BYOK</span>
      </div>
    )
  }

  return (
    <>
      <div className="topbar-balance">
        <Wallet size={13} />
        <span className="balance-amount">${balance.toFixed(2)}</span>
        <button onClick={() => setShowModal(true)} className="balance-add" title="Add credits">
          <Plus size={12} />
        </button>
      </div>
      {showModal && <StripeCheckout onClose={() => setShowModal(false)} />}
    </>
  )
}
