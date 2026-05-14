import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getBalance } from './api'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [userId, setUserId] = useState(() => localStorage.getItem('aestrist_userId') || null)
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)

  const refreshBalance = useCallback(async () => {
    if (!userId) return
    try {
      const data = await getBalance(userId)
      setBalance(data.balance)
      setTransactions(data.transactions || [])
    } catch {
      // silently fail — user may not have balance yet
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
      loading,
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
