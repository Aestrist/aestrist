import { useState, useEffect } from 'react'
import { useUser } from '../lib/store'
import { auth, sendMessage } from '../lib/api'
import Header from './Header'
import TierToggle from './TierToggle'
import ModelSelector from './ModelSelector'
import ByokSettings from './ByokSettings'
import ChatMessages from './ChatMessages'
import ChatInput from './ChatInput'

const FREE_DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct'
const PLATFORM_DEFAULT_MODEL = 'openai/gpt-4o-mini'
const BYOK_DEFAULT_MODEL = 'gpt-4o-mini'

export default function ChatPage() {
  const { userId, login, balance } = useUser()

  const [tier, setTier] = useState('free')
  const [paymentMode, setPaymentMode] = useState('platform') // 'platform' | 'byok'
  const [model, setModel] = useState(FREE_DEFAULT_MODEL)
  const [provider, setProvider] = useState('openai')
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('aestrist_byok_key') || '')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [init, setInit] = useState(false)

  // Auto-login on mount
  useEffect(() => {
    if (!userId) {
      auth('').then(res => login(res.userId)).catch(() => {})
    }
    setInit(true)
  }, [])

  function handleTierChange(newTier) {
    setTier(newTier)
    setError('')
    if (newTier === 'free') {
      setModel(FREE_DEFAULT_MODEL)
      setProvider(null)
    } else if (paymentMode === 'byok') {
      setModel(BYOK_DEFAULT_MODEL)
      setProvider('openai')
    } else {
      setModel(PLATFORM_DEFAULT_MODEL)
      setProvider('openai')
    }
  }

  function handlePaymentModeChange(mode) {
    setPaymentMode(mode)
    setError('')
    if (mode === 'byok') {
      setModel(BYOK_DEFAULT_MODEL)
      setProvider('openai')
    } else {
      setModel(PLATFORM_DEFAULT_MODEL)
      setProvider('openai')
    }
  }

  function handleModelSelect(newModel, newProvider) {
    setModel(newModel)
    if (newProvider) setProvider(newProvider)
  }

  function handleByokProviderChange(newProvider) {
    setProvider(newProvider)
    // Reset model to first available for the new provider
    const firstModels = {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-5-sonnet-20241022',
      openrouter: 'openai/gpt-4o-mini',
    }
    setModel(firstModels[newProvider] || 'gpt-4o-mini')
  }

  function handleByokKeyChange(key) {
    setUserApiKey(key)
    localStorage.setItem('aestrist_byok_key', key)
  }

  async function handleSend(message) {
    if (!userId || !init) return

    if (tier === 'paid' && paymentMode === 'byok' && !userApiKey) {
      setError('Enter your API key in the settings below to use BYOK mode')
      return
    }

    setError('')
    setMessages(prev => [...prev, { role: 'user', content: message }])
    setLoading(true)

    try {
      const data = await sendMessage({
        message,
        model,
        tier,
        userId,
        provider,
        paymentMode,
        userApiKey: paymentMode === 'byok' ? userApiKey : undefined,
      })

      const content = data?.choices?.[0]?.message?.content || data?.content?.[0]?.text || JSON.stringify(data)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content,
        model: model,
        tier,
      }])
    } catch (err) {
      setError(err.message)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message}`,
        model: 'error',
      }])
    } finally {
      setLoading(false)
    }
  }

  const hasBalanceIssue = tier === 'paid' && paymentMode === 'platform' && balance <= 0 && userId
  const missingByokKey = tier === 'paid' && paymentMode === 'byok' && !userApiKey

  return (
    <div className="h-dvh flex flex-col bg-[#0a0a0a]">
      <Header tier={tier} paymentMode={paymentMode} onTierChange={handleTierChange} />

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="flex items-center gap-2">
          <TierToggle tier={tier} onTierChange={handleTierChange} />
          {tier === 'paid' && (
            <div className="flex bg-[#121212] rounded-lg border border-[#1a1a1a] p-0.5">
              <button
                onClick={() => handlePaymentModeChange('platform')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                  paymentMode === 'platform'
                    ? 'bg-[#1a1a1a] text-[#e0e0e0]'
                    : 'text-[#555] hover:text-[#888]'
                }`}
              >
                Platform
              </button>
              <button
                onClick={() => handlePaymentModeChange('byok')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                  paymentMode === 'byok'
                    ? 'bg-[#d97757] text-white'
                    : 'text-[#555] hover:text-[#888]'
                }`}
              >
                BYOK
              </button>
            </div>
          )}
        </div>
        <ModelSelector
          tier={tier}
          paymentMode={paymentMode}
          model={model}
          provider={provider}
          onSelect={handleModelSelect}
        />
      </div>

      {/* BYOK settings bar */}
      {tier === 'paid' && paymentMode === 'byok' && (
        <ByokSettings
          provider={provider}
          apiKey={userApiKey}
          onProviderChange={handleByokProviderChange}
          onApiKeyChange={handleByokKeyChange}
        />
      )}

      {/* Insufficient balance warning (platform mode only) */}
      {hasBalanceIssue && (
        <div className="px-4 py-2 bg-[#121212] border-b border-[#1a1a1a]">
          <p className="text-xs text-[#c45a5a] text-center">
            No credits — add funds to use platform models
          </p>
        </div>
      )}

      {/* Missing BYOK key warning */}
      {missingByokKey && (
        <div className="px-4 py-2 bg-[#121212] border-b border-[#1a1a1a]">
          <p className="text-xs text-[#d97757] text-center">
            Enter your API key above to use BYOK mode
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-[#1a0a0a] border-b border-[#3a1a1a]">
          <p className="text-xs text-[#c45a5a] text-center">{error}</p>
        </div>
      )}

      <ChatMessages messages={messages} loading={loading} />

      <ChatInput onSend={handleSend} loading={loading} />
    </div>
  )
}
