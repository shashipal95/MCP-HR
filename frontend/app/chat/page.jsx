'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Trash2, Sparkles, Zap, Sun, Moon } from 'lucide-react'
import { useTheme } from '/components/ThemeProvider'

const SUGGESTIONS = [
  'How many employees are in the IT department?',
  'What is the leave policy?',
  'Show workforce summary',
  'Who are the top performers?',
]

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator({ status }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '4px 0' }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-card))',
        border: '1px solid var(--border-accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Bot size={14} color="var(--accent)" />
      </div>
      <div className="chat-bot" style={{ padding: '12px 16px', minWidth: 120 }}>
        {status ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={12} color="var(--accent)" style={{ animation: 'pulse 1s ease-in-out infinite' }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{status}</span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Single message bubble ─────────────────────────────────────────────────────
function Message({ role, text, streaming }) {
  const isUser = role === 'user'
  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 12,
      alignItems: 'flex-start',
      animation: 'slideUp 0.3s ease-out',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: isUser
          ? 'linear-gradient(135deg, var(--accent), var(--accent-dim))'
          : 'linear-gradient(135deg, var(--bg-elevated), var(--bg-card))',
        border: isUser ? 'none' : '1px solid var(--border-accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isUser
          ? <User size={14} color="#050d1a" strokeWidth={2.5} />
          : <Bot size={14} color="var(--accent)" />
        }
      </div>
      <div
        className={isUser ? 'chat-user' : 'chat-bot'}
        style={{
          padding: '10px 16px',
          maxWidth: '72%',
          fontSize: 14,
          lineHeight: 1.65,
          whiteSpace: 'pre-wrap',
          position: 'relative',
        }}
      >
        {text}
        {/* blinking cursor while streaming */}
        {streaming && (
          <span style={{
            display: 'inline-block',
            width: 2, height: '1em',
            background: 'var(--accent)',
            marginLeft: 2,
            verticalAlign: 'text-bottom',
            animation: 'blink 0.7s step-end infinite',
          }} />
        )}
      </div>
    </div>
  )
}

// ── Main chat page ────────────────────────────────────────────────────────────
export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)   // true while SSE is open
  const [status, setStatus] = useState('')      // "Querying HR database…"
  const [userId, setUserId] = useState('anonymous')
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)   // AbortController for current stream
  const botStartedRef = useRef(false)  // true once first token has been appended

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  async function sendMessage(text) {
    const q = (text || input).trim()
    if (!q || streaming) return
    setInput('')

    const userMsg = { role: 'user', text: q }
    setMessages(prev => [...prev, userMsg])
    setStreaming(true)
    setStatus('Querying HR database…')

    // Build history
    const allMsgs = [...messages, userMsg]
    const history = []
    for (let i = 0; i + 1 < allMsgs.length; i += 2) {
      if (allMsgs[i]?.role === 'user' && allMsgs[i + 1]?.role === 'bot') {
        history.push({ user: allMsgs[i].text, bot: allMsgs[i + 1].text })
      }
    }

    // Reset streaming state for this new exchange
    botStartedRef.current = false

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, history, user_id: userId }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errText = await res.text()
        let detail = errText
        try { detail = JSON.parse(errText).detail } catch { }
        setMessages(prev => [...prev, { role: 'bot', text: `⚠️ ${detail}`, _streaming: false }])
        return
      }

      // Read SSE stream
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()  // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue

          let event
          try { event = JSON.parse(raw) } catch { continue }

          if (event.type === 'status') {
            setStatus(event.data)
          } else if (event.type === 'token') {
            if (!botStartedRef.current) {
              // First token — append a new bot message (replaces typing indicator)
              botStartedRef.current = true
              setMessages(prev => [...prev, { role: 'bot', text: event.data, _streaming: true }])
            } else {
              // Subsequent tokens — always update the last message
              setMessages(prev => {
                const next = [...prev]
                const last = next.length - 1
                if (next[last]?.role === 'bot') {
                  next[last] = { ...next[last], text: next[last].text + event.data }
                }
                return next
              })
            }
          } else if (event.type === 'error') {
            if (!botStartedRef.current) {
              setMessages(prev => [...prev, { role: 'bot', text: `⚠️ ${event.data}`, _streaming: false }])
            } else {
              setMessages(prev => {
                const next = [...prev]
                const last = next.length - 1
                if (next[last]?.role === 'bot') next[last] = { ...next[last], text: `⚠️ ${event.data}`, _streaming: false }
                return next
              })
            }
          } else if (event.type === 'done') {
            setMessages(prev => {
              const next = [...prev]
              const last = next.length - 1
              if (next[last]?.role === 'bot') next[last] = { ...next[last], _streaming: false }
              return next
            })
          }
        }
      }

    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'bot', text: '⚠️ Cannot reach backend — is uvicorn running on port 8000?', _streaming: false }])
      }
    } finally {
      setStreaming(false)
      setStatus('')
      abortRef.current = null
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function stopStream() {
    abortRef.current?.abort()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        padding: '20px 28px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg-surface)',
      }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 20, margin: 0 }}>
            HR Chatbot
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Ask anything about employees, policies, or workforce stats
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            className="hr-input"
            placeholder="User ID"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            style={{ width: 130, fontSize: 12 }}
          />
          <button
            onClick={toggle}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.background = 'var(--accent-glow)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-elevated)' }}
          >
            <div style={{ transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1)', transform: isDark ? 'rotate(0deg)' : 'rotate(180deg)', display: 'flex' }}>
              {isDark ? <Sun size={15} color="var(--accent)" strokeWidth={2} /> : <Moon size={15} color="var(--accent)" strokeWidth={2} />}
            </div>
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => { stopStream(); setMessages([]) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 7,
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; e.currentTarget.style.color = '#f87171' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              <Trash2 size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {messages.length === 0 && !streaming && (
          <div className="page-enter" style={{ textAlign: 'center', marginTop: 60 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: 'linear-gradient(135deg, var(--accent-glow), var(--bg-elevated))',
              border: '1px solid var(--border-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Sparkles size={28} color="var(--accent)" />
            </div>
            <h2 style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 22, margin: '0 0 8px' }}>
              How can I help you today?
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 32px' }}>
              Ask me about employees, HR policies, org charts, or workforce analytics.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 560, margin: '0 auto' }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => sendMessage(s)} style={{
                  padding: '8px 14px', background: 'var(--bg-card)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <Message key={i} role={m.role} text={m.text} streaming={m._streaming} />
        ))}

        {/* Show typing indicator only while streaming and no bot message yet */}
        {streaming && (messages.length === 0 || messages[messages.length - 1]?.role === 'user') && (
          <TypingIndicator status={status} />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ padding: '16px 28px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-end',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '8px 8px 8px 16px', transition: 'border-color 0.2s',
        }}
          onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
          onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about an employee, department, policy, or workforce…"
            rows={1}
            disabled={streaming}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontFamily: 'var(--font-outfit)',
              fontSize: 14, resize: 'none', lineHeight: 1.5, paddingTop: 4,
              opacity: streaming ? 0.5 : 1,
            }}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
          {streaming ? (
            <button
              onClick={stopStream}
              style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                cursor: 'pointer', fontSize: 14, color: '#f87171',
              }}
              title="Stop generating"
            >
              ■
            </button>
          ) : (
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim()}
              className="btn-accent"
              style={{
                width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                opacity: !input.trim() ? 0.4 : 1,
                cursor: !input.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              <Send size={15} />
            </button>
          )}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          {streaming ? 'Generating response…' : 'Enter to send · Shift+Enter for new line'}
        </p>
      </div>

      {/* Blink keyframe */}
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  )
}