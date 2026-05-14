import { useState, useRef, useEffect } from 'react'
import { Plus, MessageSquare, Trash2, PanelLeftClose, PanelLeft, Edit3, Check, X } from 'lucide-react'
import { useChat } from '../lib/store'
import ModelSelector from './ModelSelector'
import TierSettings from './TierSettings'
import AestristLogo from './AestristLogo'

export default function Sidebar({ open, onToggle, tier, paymentMode, model, provider, userApiKey, onTierChange, onPaymentModeChange, onModelSelect, onByokKeyChange, onByokProviderChange }) {
  const { chats, activeChatId, setActiveChatId, createChat, deleteChat, renameChat } = useChat()
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const editRef = useRef(null)

  useEffect(() => {
    if (editingId && editRef.current) editRef.current.focus()
  }, [editingId])

  function handleNew() {
    createChat({ model, tier })
  }

  function startEdit(chat, e) {
    e.stopPropagation()
    setEditingId(chat.id)
    setEditTitle(chat.title)
  }

  function commitEdit() {
    if (editTitle.trim()) renameChat(editingId, editTitle.trim())
    setEditingId(null)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function handleDelete(id, e) {
    e.stopPropagation()
    deleteChat(id)
  }

  // Group chats by recency
  const now = Date.now()
  const today = chats.filter(c => now - c.updatedAt < 86400000)
  const week = chats.filter(c => now - c.updatedAt >= 86400000 && now - c.updatedAt < 7 * 86400000)
  const older = chats.filter(c => now - c.updatedAt >= 7 * 86400000)

  return (
    <>
      {/* Overlay on mobile */}
      {open && (
        <div
          className="sidebar-overlay"
          onClick={onToggle}
        />
      )}

      <aside className={`sidebar ${open ? 'sidebar-open' : 'sidebar-closed'}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <AestristLogo size={22} />
            <span className="sidebar-brand-text">aestrist</span>
          </div>
          <button onClick={onToggle} className="icon-btn" title="Close sidebar">
            <PanelLeftClose size={16} />
          </button>
        </div>

        {/* New chat */}
        <div className="sidebar-new">
          <button onClick={handleNew} className="new-chat-btn">
            <Plus size={15} />
            New chat
          </button>
        </div>

        {/* Chat list */}
        <div className="sidebar-chats">
          {chats.length === 0 && (
            <p className="sidebar-empty">No chats yet. Start a conversation.</p>
          )}

          {today.length > 0 && (
            <ChatGroup label="Today" chats={today} activeChatId={activeChatId} editingId={editingId} editTitle={editTitle} editRef={editRef} setActiveChatId={setActiveChatId} startEdit={startEdit} commitEdit={commitEdit} cancelEdit={cancelEdit} setEditTitle={setEditTitle} handleDelete={handleDelete} />
          )}
          {week.length > 0 && (
            <ChatGroup label="This week" chats={week} activeChatId={activeChatId} editingId={editingId} editTitle={editTitle} editRef={editRef} setActiveChatId={setActiveChatId} startEdit={startEdit} commitEdit={commitEdit} cancelEdit={cancelEdit} setEditTitle={setEditTitle} handleDelete={handleDelete} />
          )}
          {older.length > 0 && (
            <ChatGroup label="Older" chats={older} activeChatId={activeChatId} editingId={editingId} editTitle={editTitle} editRef={editRef} setActiveChatId={setActiveChatId} startEdit={startEdit} commitEdit={commitEdit} cancelEdit={cancelEdit} setEditTitle={setEditTitle} handleDelete={handleDelete} />
          )}
        </div>

        {/* Bottom: model + tier settings */}
        <div className="sidebar-footer">
          <ModelSelector
            tier={tier}
            paymentMode={paymentMode}
            model={model}
            provider={provider}
            onSelect={onModelSelect}
          />
          <TierSettings
            tier={tier}
            paymentMode={paymentMode}
            provider={provider}
            userApiKey={userApiKey}
            onTierChange={onTierChange}
            onPaymentModeChange={onPaymentModeChange}
            onByokProviderChange={onByokProviderChange}
            onByokKeyChange={onByokKeyChange}
          />
        </div>
      </aside>
    </>
  )
}

function ChatGroup({ label, chats, activeChatId, editingId, editTitle, editRef, setActiveChatId, startEdit, commitEdit, cancelEdit, setEditTitle, handleDelete }) {
  return (
    <div className="chat-group">
      <p className="chat-group-label">{label}</p>
      {chats.map(chat => (
        <div
          key={chat.id}
          className={`chat-item ${chat.id === activeChatId ? 'chat-item-active' : ''}`}
          onClick={() => setActiveChatId(chat.id)}
        >
          <MessageSquare size={13} className="chat-item-icon" />

          {editingId === chat.id ? (
            <div className="chat-item-edit" onClick={e => e.stopPropagation()}>
              <input
                ref={editRef}
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit()
                  if (e.key === 'Escape') cancelEdit()
                }}
                className="chat-edit-input"
              />
              <button onClick={commitEdit} className="icon-btn-xs text-success"><Check size={11} /></button>
              <button onClick={cancelEdit} className="icon-btn-xs"><X size={11} /></button>
            </div>
          ) : (
            <>
              <span className="chat-item-title">{chat.title}</span>
              <div className="chat-item-actions">
                <button onClick={e => startEdit(chat, e)} className="icon-btn-xs" title="Rename"><Edit3 size={11} /></button>
                <button onClick={e => handleDelete(chat.id, e)} className="icon-btn-xs icon-btn-danger" title="Delete"><Trash2 size={11} /></button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
