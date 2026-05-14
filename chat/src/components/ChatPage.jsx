import { useState, useEffect } from 'react'
import { useUser } from '../lib/store'
import { auth, sendMessage } from '../lib/api'
import Header from './Header'
import TierToggle from './TierToggle'
import ModelSelector from './ModelSelector'
import ChatMessages from './ChatMessages'
import ChatInput from './ChatInput'

const FREE_DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct'
const PAID_DEFAULT_MODEL = 'gpt-4o-mini'

export default function ChatPage() {
  const { userId, login, balance } = useUser()

  const [tier, setTier] = useState('free')
  const [model, setModel] = useState(FREE_DEFAULT_MODEL)
  const [provider, setProvider] = useState(null)
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
    if (newTier === 'free') {
      setModel(FREE_DEFAULT_MODEL)
      setProvider(null)
    } else {
      setModel(PAID_DEFAULT_MODEL)
      setProvider('openai')
    }
  }

  function handleModelSelect(newModel, newProvider) {
    setModel(newModel)
    if (newProvider) setProvider(newProvider)
  }

  async function handleSend(message) {
    if (!userId || !init) return

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

  return (
    <div className="h-dvh flex flex-col bg-[#0a0a0a]">
      <Header tier={tier} onTierChange={handleTierChange} />

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a1a1a] bg-[#0a0a0a]">
        <TierToggle tier={tier} onTierChange={handleTierChange} />
        <ModelSelector
          tier={tier}
          model={model}
          provider={provider}
          onSelect={handleModelSelect}
        />
      </div>

      {/* Insufficient balance warning */}
      {tier === 'paid' && balance <= 0 && userId && (
        <div className="px-4 py-2 bg-[#121212] border-b border-[#1a1a1a]">
          <p className="text-xs text-[#c45a5a] text-center">
            No credits — add funds to use paid models
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
