import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search, RotateCw, Zap, CreditCard, Key } from 'lucide-react'
import { fetchModels } from '../lib/api'

// Fallbacks in case the API is entirely unreachable
const FREE_FALLBACK = [
  { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'Meta' },
  { id: 'mistralai/mistral-7b-instruct-v0.3', name: 'Mistral 7B', provider: 'Mistral' },
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B', provider: 'NVIDIA' },
]

const PLATFORM_FALLBACK = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'Google' },
]

const BYOK_OPENAI = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
]

const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes

export default function ModelSelector({ tier, paymentMode, model, provider, onSelect }) {
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState(null)     // latest polled data
  const [fetching, setFetching] = useState(false)  // true while a fetch is in-flight
  const [search, setSearch] = useState('')
  const lastFetchRef = useRef(0)
  const fetchingRef = useRef(false) // avoid racing
  const dropdownRef = useRef(null)
  const searchRef = useRef(null)
  const pollRef = useRef(null)

  // ── Poll loop ──────────────────────────────────────────────────────
  const doFetch = async (force) => {
    // Backend has a 10-minute TTL, so polling every 5 min is fine —
    // it'll get a fresh response roughly every other poll.
    if (fetchingRef.current) return
    fetchingRef.current = true
    setFetching(true)
    try {
      const data = await fetchModels()
      setModels(data)
      lastFetchRef.current = Date.now()
    } catch {
      // keep stale data if we have it, falls back to static lists
    } finally {
      fetchingRef.current = false
      setFetching(false)
    }
  }

  // Start polling on mount; stop on unmount
  useEffect(() => {
    doFetch() // immediate first fetch
    pollRef.current = setInterval(() => doFetch(), POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [])

  // Also re-fetch when tier or paymentMode changes (different model sets)
  useEffect(() => {
    doFetch(true)
  }, [tier, paymentMode])

  // ── Dropdown behaviour ─────────────────────────────────────────────
  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus()
    // If dropdown opens and data is stale (> 2 min), refresh in background
    if (open && Date.now() - lastFetchRef.current > 2 * 60 * 1000) {
      doFetch()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // ── Resolve the right model list for current tier/mode ─────────────
  function getModelList() {
    if (tier === 'free') return models?.nim || FREE_FALLBACK
    if (paymentMode === 'byok') {
      if (provider === 'openrouter') return models?.openrouter || PLATFORM_FALLBACK
      return BYOK_OPENAI
    }
    return models?.openrouter || PLATFORM_FALLBACK
  }

  const allModels = getModelList()
  const filtered = search
    ? allModels.filter(m =>
        m.name?.toLowerCase().includes(search.toLowerCase()) ||
        m.id?.toLowerCase().includes(search.toLowerCase()) ||
        m.provider?.toLowerCase().includes(search.toLowerCase())
      )
    : allModels

  const currentModel = allModels.find(m => m.id === model)
  const displayName = currentModel?.name || model?.split('/').pop() || 'Select model'
  const displayProvider = currentModel?.provider || ''

  // How long ago was the last successful fetch?
  const ago = lastFetchRef.current
    ? `${Math.round((Date.now() - lastFetchRef.current) / 1000 / 60)}m ago`
    : ''

  const TierIcon = tier === 'free' ? Zap : paymentMode === 'byok' ? Key : CreditCard

  return (
    <div className="model-selector" ref={dropdownRef}>
      <button
        onClick={() => setOpen(p => !p)}
        className="model-trigger"
        title="Select model"
      >
        <TierIcon size={12} className="model-tier-icon" />
        <div className="model-trigger-text">
          <span className="model-name">{displayName}</span>
          {displayProvider && <span className="model-provider">{displayProvider}</span>}
        </div>
        <ChevronDown size={12} className={`model-chevron ${open ? 'model-chevron-open' : ''}`} />
      </button>

      {open && (
        <div className="model-dropdown slide-up">
          {/* Search bar — shows spinner while fetching */}
          <div className="model-search-wrap">
            <Search size={12} className="model-search-icon" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search models..."
              className="model-search"
            />
            {fetching && <RotateCw size={12} className="spin" style={{ color: 'var(--cn-text-dim)' }} />}
          </div>

          {/* Model list — always shows latest polled data immediately */}
          <div className="model-list">
            {filtered.length === 0 && (
              <p className="model-empty">No models found</p>
            )}
            {filtered.map(m => (
              <button
                key={m.id}
                onClick={() => { onSelect(m.id, m.provider || provider); setOpen(false); setSearch('') }}
                className={`model-item ${m.id === model ? 'model-item-active' : ''}`}
              >
                <div className="model-item-info">
                  <span className="model-item-name">{m.name}</span>
                  {m.provider && <span className="model-item-provider">{m.provider}</span>}
                </div>
                {m.id === model && <span className="model-item-check">✓</span>}
              </button>
            ))}
          </div>

          {/* Footer — live poll indicator */}
          <div className="model-source">
            <span className="model-source-text">
              {tier === 'free' ? 'NVIDIA NIM' : 'OpenRouter'}
            </span>
            <span className="model-poll-status">
              {fetching ? (
                <>
                  <RotateCw size={9} className="spin" />
                  refreshing
                </>
              ) : ago ? (
                `updated ${ago}`
              ) : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
