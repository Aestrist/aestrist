import { Sparkles } from 'lucide-react'
import BalanceDisplay from './BalanceDisplay'

export default function Header({ tier, onTierChange }) {
  return (
    <header className="h-14 border-b border-[#1a1a1a] flex items-center justify-between px-4 bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <Sparkles size={18} className="text-[#d97757]" />
        <span className="text-sm font-medium tracking-tight">aestrist chat</span>
        <span className="text-[10px] uppercase tracking-widest text-[#555] px-2 py-0.5 rounded-full border border-[#1a1a1a]">
          {tier === 'free' ? 'free' : 'paid'}
        </span>
      </div>
      <BalanceDisplay tier={tier} />
    </header>
  )
}
