import { useState } from 'react'
import { Zap, CreditCard, Key, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react'

const BYOK_PROVIDERS = [
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
  { id: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-...' },
  { id: 'anthropic', label: 'Anthropic (via OR)', placeholder: 'sk-ant-...' },
]

export default function TierSettings({ tier, paymentMode, provider, userApiKey, onTierChange, onPaymentModeChange, onByokProviderChange, onByokKeyChange }) {
  const [expanded, setExpanded] = useState(false)
  const [showKey, setShowKey] = useState(false)

  const currentProvider = BYOK_PROVIDERS.find(p => p.id === provider) || BYOK_PROVIDERS[0]

  return (
    <div className="tier-settings">
      {/* Tier toggle row */}
      <button className="tier-expand-btn" onClick={() => setExpanded(p => !p)}>
        <div className="tier-expand-left">
          {tier === 'free' ? <Zap size={13} className="icon-accent" /> : paymentMode === 'byok' ? <Key size={13} className="icon-success" /> : <CreditCard size={13} className="icon-accent" />}
          <span className="tier-label">
            {tier === 'free' ? 'Free tier' : paymentMode === 'byok' ? 'BYOK' : 'Platform'}
          </span>
        </div>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div className="tier-expand-panel slide-up">
          {/* Tier selector */}
          <div className="settings-row">
            <span className="settings-label">Tier</span>
            <div className="seg-control">
              <button
                className={`seg-btn ${tier === 'free' ? 'seg-btn-active' : ''}`}
                onClick={() => onTierChange('free')}
              >
                <Zap size={11} />
                Free
              </button>
              <button
                className={`seg-btn ${tier === 'paid' ? 'seg-btn-active' : ''}`}
                onClick={() => onTierChange('paid')}
              >
                <CreditCard size={11} />
                Paid
              </button>
            </div>
          </div>

          {/* Payment mode (paid only) */}
          {tier === 'paid' && (
            <div className="settings-row">
              <span className="settings-label">Mode</span>
              <div className="seg-control">
                <button
                  className={`seg-btn ${paymentMode === 'platform' ? 'seg-btn-active' : ''}`}
                  onClick={() => onPaymentModeChange('platform')}
                >
                  Platform
                </button>
                <button
                  className={`seg-btn ${paymentMode === 'byok' ? 'seg-btn-active' : ''}`}
                  onClick={() => onPaymentModeChange('byok')}
                >
                  BYOK
                </button>
              </div>
            </div>
          )}

          {/* BYOK settings */}
          {tier === 'paid' && paymentMode === 'byok' && (
            <>
              <div className="settings-row">
                <span className="settings-label">Provider</span>
                <select
                  value={provider || 'openai'}
                  onChange={e => onByokProviderChange(e.target.value)}
                  className="settings-select"
                >
                  {BYOK_PROVIDERS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="settings-key-row">
                <div className="settings-key-wrap">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={userApiKey}
                    onChange={e => onByokKeyChange(e.target.value)}
                    placeholder={currentProvider.placeholder}
                    className="settings-key-input"
                  />
                  <button onClick={() => setShowKey(p => !p)} className="settings-key-toggle">
                    {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
                <p className="settings-key-hint">Stored locally. Never sent to our servers.</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
