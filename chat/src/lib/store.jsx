import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { getBalance } from './api'
import { v4 as uuidv4 } from 'uuid'

const UserContext = createContext(null)
const ChatContext = createContext(null)

// ── Chat storage helpers ─────────────────────────────────────────────
const CHATS_KEY = 'aestrist_chats'
const ACTIVE_KEY = 'aestrist_active_chat'

function loadChats() {
  try {
    return JSON.parse(localStorage.getItem(CHATS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveChats(chats) {
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats))
}

// ── User Provider ────────────────────────────────────────────────────
export function UserProvider({ children }) {
  const [userId, setUserId] = useState(() => localStorage.getItem('aestrist_userId') || null)
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState([])

  const refreshBalance = useCallback(async () => {
    if (!userId) return
    try {
      const data = await getBalance(userId)
      setBalance(data.balance)
      setTransactions(data.transactions || [])
    } catch {
      // silently fail
    }
  }, [userId])

  const login = useCallback((id, displayName) => {
    localStorage.setItem('aestrist_userId', id)
    if (displayName) localStorage.setItem('aestrist_displayName', displayName)
    setUserId(id)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('aestrist_userId')
    localStorage.removeItem('aestrist_displayName')
    setUserId(null)
    setBalance(0)
    setTransactions([])
  }, [])

  useEffect(() => {
    if (userId) refreshBalance()
  }, [userId, refreshBalance])

  return (
    <UserContext.Provider value={{
      userId,
      balance,
      transactions,
      login,
      logout,
      refreshBalance,
      displayName: localStorage.getItem('aestrist_displayName'),
    }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within UserProvider')
  return ctx
}

// ── Chat Provider ────────────────────────────────────────────────────
export function ChatProvider({ children }) {
  const [chats, setChats] = useState(loadChats)
  const [activeChatId, setActiveChatId] = useState(() => {
    const stored = localStorage.getItem(ACTIVE_KEY)
    const loaded = loadChats()
    // Validate stored ID still exists
    if (stored && loaded.find(c => c.id === stored)) return stored
    return loaded[0]?.id || null
  })
  const chatsRef = useRef(chats)
  chatsRef.current = chats

  // Persist whenever chats change
  useEffect(() => {
    saveChats(chats)
  }, [chats])

  useEffect(() => {
    if (activeChatId) localStorage.setItem(ACTIVE_KEY, activeChatId)
  }, [activeChatId])

  const activeChat = chats.find(c => c.id === activeChatId) || null

  function createChat(opts = {}) {
    const id = uuidv4()
    const chat = {
      id,
      title: opts.title || 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: opts.model || null,
      tier: opts.tier || 'free',
      messages: [],
    }
    setChats(prev => [chat, ...prev])
    setActiveChatId(id)
    return id
  }

  function deleteChat(id) {
    setChats(prev => {
      const next = prev.filter(c => c.id !== id)
      if (activeChatId === id) {
        setActiveChatId(next[0]?.id || null)
      }
      return next
    })
  }

  function renameChat(id, title) {
    setChats(prev => prev.map(c => c.id === id ? { ...c, title, updatedAt: Date.now() } : c))
  }

  function addMessage(chatId, message) {
    setChats(prev => prev.map(c => {
      if (c.id !== chatId) return c
      const messages = [...c.messages, message]
      // Auto-title from first user message
      const title = c.title === 'New Chat' && message.role === 'user'
        ? message.content.slice(0, 40).trim() || 'New Chat'
        : c.title
      return { ...c, messages, title, updatedAt: Date.now() }
    }))
  }

  // patch can be a plain object OR a function (msg) => partialUpdate
  function updateLastMessage(chatId, patch) {
    setChats(prev => prev.map(c => {
      if (c.id !== chatId) return c
      const messages = [...c.messages]
      if (messages.length === 0) return c
      const last = messages[messages.length - 1]
      const applied = typeof patch === 'function' ? patch(last) : patch
      messages[messages.length - 1] = { ...last, ...applied }
      return { ...c, messages, updatedAt: Date.now() }
    }))
  }

  function clearChat(id) {
    setChats(prev => prev.map(c => c.id === id ? { ...c, messages: [], updatedAt: Date.now() } : c))
  }

  return (
    <ChatContext.Provider value={{
      chats,
      activeChatId,
      activeChat,
      setActiveChatId,
      createChat,
      deleteChat,
      renameChat,
      addMessage,
      updateLastMessage,
      clearChat,
    }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}
