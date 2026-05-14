import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

const FREE_MODELS = [
  { id: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
  { id: 'mistralai/mistral-7b-instruct-v0.3', label: 'Mistral 7B' },
]

const PAID_MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' },
  { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', provider: 'anthropic' },
]

export default function ModelSelector({ tier, model, provider, onSelect }) {
  const [open, setOpen] = useState(false)
  const models = tier === 'free' ? FREE_MODELS : PAID_MODELS
  const current = models.find(m => m.id === model && (tier === 'free' || m.provider === provider)) || models[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-[#888] hover:text-[#bbb] hover:bg-[#121212] transition-colors border border-transparent hover:border-[#1a1a1a]"
      >
        <span>{current.label}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-48 bg-[#121212] border border-[#1a1a1a] rounded-xl shadow-2xl p-1 z-40 slide-up">
            {models.map(m => (
              <button
                key={`${m.provider || 'free'}-${m.id}`}
                onClick={() => {
                  onSelect(m.id, m.provider || null)
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                  m.id === model && (tier === 'free' || m.provider === provider)
                    ? 'bg-[#1a1a1a] text-[#e0e0e0]'
                    : 'text-[#777] hover:text-[#bbb] hover:bg-[#1a1a1a]'
                }`}
              >
                <span>{m.label}</span>
                {m.provider && (
                  <span className="ml-2 text-[10px] text-[#555] uppercase">{m.provider}</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
