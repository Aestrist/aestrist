import { useState, useRef, useEffect } from 'react'
import { ArrowUp, Square } from 'lucide-react'

export default function ChatInput({ onSend, onCancel, loading }) {
  const [input, setInput] = useState('')
  const textareaRef = useRef(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [input])

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  function handleSubmit() {
    if (loading) {
      onCancel?.()
      return
    }
    const val = input.trim()
    if (!val) return
    onSend(val)
    setInput('')
    // Reset height
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="input-area">
      <div className="input-container">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message aestrist..."
          rows={1}
          className="chat-textarea"
          disabled={loading}
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() && !loading}
          className={`send-btn ${loading ? 'send-btn-stop' : ''}`}
          title={loading ? 'Stop generating' : 'Send message'}
        >
          {loading ? <Square size={14} fill="currentColor" /> : <ArrowUp size={16} />}
        </button>
      </div>
      <p className="input-hint">Press Enter to send, Shift+Enter for newline</p>
    </div>
  )
}
