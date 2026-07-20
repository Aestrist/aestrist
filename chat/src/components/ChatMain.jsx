import { PanelLeft, AlertCircle, X } from 'lucide-react'
import { useChat } from '../lib/store'
import ChatMessages from './ChatMessages'
import ChatInput from './ChatInput'
import BalanceDisplay from './BalanceDisplay'

export default function ChatMain({ sidebarOpen, onToggleSidebar, tier, paymentMode, model, streaming, error, onSend, onCancel, onClearError }) {
  const { activeChat } = useChat()
  const messages = activeChat?.messages || []

  return (
    <main className={`chat-main ${sidebarOpen ? 'chat-main-shifted' : ''}`}>
      {/* Top bar */}
      <header className="chat-topbar">
        <div className="chat-topbar-left">
          {!sidebarOpen && (
            <button onClick={onToggleSidebar} className="icon-btn" title="Open sidebar">
              <PanelLeft size={16} />
            </button>
          )}
          <span className="chat-topbar-title">
            {activeChat?.title || 'New Chat'}
          </span>
        </div>
        <div className="chat-topbar-right">
          <BalanceDisplay tier={tier} paymentMode={paymentMode} />
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          <AlertCircle size={14} />
          <span>{error}</span>
          <button onClick={onClearError} className="icon-btn-xs"><X size={12} /></button>
        </div>
      )}

      {/* Messages */}
      <ChatMessages messages={messages} streaming={streaming} />

      {/* Input */}
      <ChatInput onSend={onSend} onCancel={onCancel} loading={streaming} />
    </main>
  )
}
