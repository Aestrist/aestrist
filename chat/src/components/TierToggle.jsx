import { Zap } from 'lucide-react'

export default function TierToggle({ tier, onTierChange }) {
  return (
    <div className="flex items-center gap-2 p-1 rounded-xl bg-[#121212] border border-[#1a1a1a]">
      <button
        onClick={() => onTierChange('free')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          tier === 'free'
            ? 'bg-[#1a1a1a] text-[#e0e0e0] shadow-sm'
            : 'text-[#555] hover:text-[#888]'
        }`}
      >
        <Zap size={14} />
        Free
      </button>
      <button
        onClick={() => onTierChange('paid')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          tier === 'paid'
            ? 'bg-[#d97757] text-white shadow-sm'
            : 'text-[#555] hover:text-[#888]'
        }`}
      >
        <Zap size={14} />
        Paid
      </button>
    </div>
  )
}
