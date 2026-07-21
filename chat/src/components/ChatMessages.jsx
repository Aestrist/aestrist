import { useEffect, useRef } from 'react'
import AestristLogo from './AestristLogo'

// Minimal markdown renderer — no dependencies
function renderMarkdown(text) {
  if (!text) return ''
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Fenced code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="code-block${lang ? ` lang-${lang}` : ''}"><code>${code.trimEnd()}</code></pre>`
    )
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // Bold
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    // Blockquote
    .replace(/^&gt; (.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>')
    // Unordered list items
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive li in ul
    .replace(/(<li>.*<\/li>\n?)+/g, s => `<ul class="md-list">${s}</ul>`)
    // Newlines to paragraphs (but not inside blocks)
    .replace(/\n{2,}/g, '</p><p class="md-p">')
    .replace(/\n/g, '<br>')

  return `<p class="md-p">${html}</p>`
}

export default function ChatMessages({ messages, streaming }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  if (messages.length === 0) {
    return (
      <div className="messages-empty">
        <div className="empty-state">
          <AestristLogo size={40} className="empty-logo" />
          <h2 className="empty-title">How can I help?</h2>
          <p className="empty-subtitle">Start a conversation with any AI model.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="messages-scroll">
      <div className="messages-inner">
        {messages.map((msg, i) => (
          <Message key={msg.id ?? i} msg={msg} />
        ))}
        {/* Spacer */}
        <div ref={bottomRef} style={{ height: 1 }} />
      </div>
    </div>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  const isStreaming = msg.streaming && !isUser

  if (isUser) {
    return (
      <div className="msg msg-user">
        <div className="msg-bubble msg-bubble-user">
          <p className="msg-text">{msg.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="msg msg-assistant">
      <div className="msg-avatar">
        <AestristLogo size={18} />
      </div>
      <div className="msg-body">
        {msg.model && (
          <span className="msg-model">{msg.model.split('/').pop()}</span>
        )}

        {/* Reasoning block — collapsible, shown when model emits reasoning_content */}
        {msg.reasoning && (
          <details className="reasoning-block" open={isStreaming}>
            <summary className="reasoning-summary">
              <span className="reasoning-dot" />
              {isStreaming && msg.reasoning ? 'Reasoning…' : 'Reasoned'}
            </summary>
            <div className="reasoning-content">{msg.reasoning}</div>
          </details>
        )}

        <div className="msg-content">
          {isStreaming && !msg.content && !msg.reasoning ? (
            <div className="typing-indicator">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          ) : (
            <div
              className="md-content"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
            />
          )}
          {isStreaming && msg.content && (
            <span className="cursor-blink" />
          )}
        </div>
      </div>
    </div>
  )
}
