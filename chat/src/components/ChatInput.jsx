import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'

export default function ChatInput({ onSend, loading }) {
  const [input, setInput] = useState('')
  const textareaRef = useRef(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
    }
  }, [input])

  function handleSubmit() {
    const val = input.trim()
    if (!val || loading) return
    onSend(val)
    setInput('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
      <div className="max-w-3xl mx-auto flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 bg-[#121212] border border-[#1a1a1a] rounded-xl px-4 py-2.5 text-sm text-[#e0e0e0] placeholder-[#555] resize-none focus:outline-none focus:border-[#333] transition-colors max-h-40"
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || loading}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-[#d97757] hover:bg-[#e68a6a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
