import { useEffect, useRef } from 'react'
import { Bot, User } from 'lucide-react'

function formatMessage(text) {
  if (!text) return ''
  // Simple markdown-like rendering — handle code blocks, bold, italic
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Newlines to <br>
    .replace(/\n/g, '<br>')
  return html
}

export default function ChatMessages({ messages, loading }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <Bot size={32} className="mx-auto mb-4 text-[#333]" />
          <p className="text-[#555] text-sm">Start a conversation. Choose free or paid tier to begin.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`message-enter flex gap-3 ${msg.role === 'user' ? '' : ''}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
              msg.role === 'user' ? 'bg-[#1a1a1a]' : 'bg-[#d97757]/10'
            }`}>
              {msg.role === 'user' ? <User size={14} className="text-[#777]" /> : <Bot size={14} className="text-[#d97757]" />}
            </div>
            <div className={`flex-1 chat-message ${
              msg.role === 'user' ? 'msg-user rounded-2xl px-4 py-3' : 'msg-assistant rounded-2xl px-4 py-3'
            }`}>
              {msg.role === 'assistant' && msg.model && (
                <p className="text-[10px] text-[#555] uppercase tracking-wider mb-1">{msg.model}</p>
              )}
              <div
                className="text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
              />
            </div>
          </div>
        ))}

        {loading && (
          <div className="message-enter flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-[#d97757]/10 flex items-center justify-center">
              <Bot size={14} className="text-[#d97757]" />
            </div>
            <div className="msg-assistant rounded-2xl px-4 py-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d97757] typing-dot" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#d97757] typing-dot" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#d97757] typing-dot" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
