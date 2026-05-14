import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser, useChat } from '../lib/store'
import { auth, streamMessage } from '../lib/api'
import Sidebar from './Sidebar'
import ChatMain from './ChatMain'

export default function ChatPage() {
  const { userId, login } = useUser()
  const { activeChatId, activeChat, createChat, addMessage, updateLastMessage } = useChat()

  // Tier / payment mode — persisted per-session
  const [tier, setTier] = useState(() => localStorage.getItem('aestrist_tier') || 'free')
  const [paymentMode, setPaymentMode] = useState(() => localStorage.getItem('aestrist_payment_mode') || 'platform')
  const [model, setModel] = useState(() => localStorage.getItem('aestrist_model') || 'meta/llama-3.3-70b-instruct')
  const [provider, setProvider] = useState(() => localStorage.getItem('aestrist_provider') || null)
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('aestrist_byok_key') || '')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')

  // Auto-login on mount
  useEffect(() => {
    if (!userId) {
      auth('').then(res => login(res.userId)).catch(() => {})
    }
  }, [])

  // Persist settings
  useEffect(() => { localStorage.setItem('aestrist_tier', tier) }, [tier])
  useEffect(() => { localStorage.setItem('aestrist_payment_mode', paymentMode) }, [paymentMode])
  useEffect(() => { localStorage.setItem('aestrist_model', model) }, [model])
  useEffect(() => { if (provider) localStorage.setItem('aestrist_provider', provider) }, [provider])

  const handleTierChange = useCallback((newTier) => {
    setTier(newTier)
    setError('')
    if (newTier === 'free') {
      setModel('meta/llama-3.3-70b-instruct')
      setProvider(null)
    } else if (paymentMode === 'byok') {
      setModel('gpt-4o-mini')
      setProvider('openai')
    } else {
      setModel('openai/gpt-4o-mini')
      setProvider('openai')
    }
  }, [paymentMode])

  const handlePaymentModeChange = useCallback((mode) => {
    setPaymentMode(mode)
    setError('')
    if (mode === 'byok') {
      setModel('gpt-4o-mini')
      setProvider('openai')
    } else {
      setModel('openai/gpt-4o-mini')
      setProvider('openai')
    }
  }, [])

  const handleModelSelect = useCallback((newModel, newProvider) => {
    setModel(newModel)
    if (newProvider !== undefined) setProvider(newProvider)
  }, [])

  const handleByokKeyChange = useCallback((key) => {
    setUserApiKey(key)
    localStorage.setItem('aestrist_byok_key', key)
  }, [])

  const handleByokProviderChange = useCallback((newProvider) => {
    setProvider(newProvider)
    const defaults = {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-5-sonnet-20241022',
      openrouter: 'openai/gpt-4o-mini',
    }
    setModel(defaults[newProvider] || 'gpt-4o-mini')
  }, [])

  const handleSend = useCallback(async (message) => {
    if (!userId || streaming) return

    if (tier === 'paid' && paymentMode === 'byok' && !userApiKey) {
      setError('Enter your API key in Settings to use BYOK mode')
      return
    }

    setError('')

    // Create a new chat if none is active
    let chatId = activeChatId
    if (!chatId) {
      chatId = createChat({ model, tier })
    }

    const history = activeChat?.messages || []

    // Add user message
    addMessage(chatId, { role: 'user', content: message, id: Date.now() })

    // Add placeholder assistant message
    const assistantId = Date.now() + 1
    addMessage(chatId, {
      role: 'assistant',
      content: '',
      id: assistantId,
      model,
      tier,
      streaming: true,
    })

    setStreaming(true)

    await streamMessage(
      {
        message,
        model,
        tier,
        userId,
        provider,
        paymentMode,
        userApiKey: paymentMode === 'byok' ? userApiKey : undefined,
        history: history.map(m => ({ role: m.role, content: m.content })),
      },
      {
        onDelta(delta) {
          updateLastMessage(chatId, patch => ({
            content: (patch.content || '') + delta,
          }))
        },
        onDone() {
          updateLastMessage(chatId, { streaming: false })
          setStreaming(false)
        },
        onError(msg) {
          updateLastMessage(chatId, { content: `Error: ${msg}`, streaming: false, error: true })
          setError(msg)
          setStreaming(false)
        },
      }
    )
  }, [userId, streaming, tier, paymentMode, userApiKey, activeChatId, activeChat, model, provider, createChat, addMessage, updateLastMessage])

  return (
    <div className="app-shell">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(p => !p)}
        tier={tier}
        paymentMode={paymentMode}
        model={model}
        provider={provider}
        userApiKey={userApiKey}
        onTierChange={handleTierChange}
        onPaymentModeChange={handlePaymentModeChange}
        onModelSelect={handleModelSelect}
        onByokKeyChange={handleByokKeyChange}
        onByokProviderChange={handleByokProviderChange}
      />
      <ChatMain
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(p => !p)}
        tier={tier}
        paymentMode={paymentMode}
        model={model}
        streaming={streaming}
        error={error}
        onSend={handleSend}
        onClearError={() => setError('')}
      />
    </div>
  )
}
