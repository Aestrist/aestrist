import { useState } from 'react'
import { Key, Eye, EyeOff } from 'lucide-react'

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
  { id: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-...' },
  { id: 'anthropic', label: 'Anthropic (via OpenRouter)', placeholder: 'sk-ant-...' },
]

export default function ByokSettings({ provider, apiKey, onProviderChange, onApiKeyChange }) {
  const [showKey, setShowKey] = useState(false)
  const [localKey, setLocalKey] = useState(apiKey || '')

  const currentProvider = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0]

  function handleKeyChange(val) {
    setLocalKey(val)
    onApiKeyChange(val)
  }

  return (
    <div className="px-4 py-3 bg-[#121212] border-b border-[#1a1a1a]">
      <div className="max-w-3xl mx-auto flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Key size={12} className="text-[#d97757]" />
          <span className="text-[10px] uppercase tracking-wider text-[#555]">Bring Your Own Key</span>
        </div>

        <div className="flex gap-2">
          {/* Provider selector */}
          <select
            value={provider}
            onChange={e => onProviderChange(e.target.value)}
            className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-2.5 py-1.5 text-xs text-[#bbb] focus:outline-none focus:border-[#333]"
          >
            {PROVIDERS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>

          {/* API key input */}
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={localKey}
              onChange={e => handleKeyChange(e.target.value)}
              placeholder={currentProvider.placeholder}
              className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-1.5 pr-8 text-xs text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#333] font-mono"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#888]"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <p className="text-[10px] text-[#555]">
          Your key is stored locally and sent directly to the API. We never save it.
        </p>
      </div>
    </div>
  )
}
