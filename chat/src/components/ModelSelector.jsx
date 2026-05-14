import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

const FREE_MODELS = [
  { id: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', provider: null },
  { id: 'mistralai/mistral-7b-instruct-v0.3', label: 'Mistral 7B', provider: null },
]

const PLATFORM_MODELS = [
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' },
  { id: 'openai/gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'google/gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash', provider: 'google' },
  { id: 'mistralai/mistral-large', label: 'Mistral Large', provider: 'mistral' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', provider: 'meta' },
]

const BYOK_MODELS = {
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  ],
  openrouter: [
    { id: 'openai/gpt-4o', label: 'GPT-4o' },
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
    { id: 'google/gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash' },
    { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
  ],
}

export default function ModelSelector({ tier, paymentMode, model, provider, onSelect }) {
  const [open, setOpen] = useState(false)

  let models
  let current

  if (tier === 'free') {
    models = FREE_MODELS
    current = models.find(m => m.id === model) || models[0]
  } else if (paymentMode === 'byok') {
    models = BYOK_MODELS[provider] || BYOK_MODELS.openai
    current = models.find(m => m.id === model) || models[0]
  } else {
    models = PLATFORM_MODELS
    current = models.find(m => m.id === model) || models[0]
  }

  const label = current?.label || 'Select model'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-[#888] hover:text-[#bbb] hover:bg-[#121212] transition-colors border border-transparent hover:border-[#1a1a1a]"
      >
        <span>{label}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-56 bg-[#121212] border border-[#1a1a1a] rounded-xl shadow-2xl p-1 z-40 slide-up max-h-64 overflow-y-auto">
            {models.map(m => (
              <button
                key={`${m.provider || provider || 'model'}-${m.id}`}
                onClick={() => {
                  onSelect(m.id, m.provider || provider)
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                  m.id === model
                    ? 'bg-[#1a1a1a] text-[#e0e0e0]'
                    : 'text-[#777] hover:text-[#bbb] hover:bg-[#1a1a1a]'
                }`}
              >
                <span>{m.label}</span>
                {(m.provider && tier !== 'free') && (
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
