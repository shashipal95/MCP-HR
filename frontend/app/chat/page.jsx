'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Trash2, Sparkles, Zap } from 'lucide-react'

const SUGGESTIONS = [
  'How many employees are in the IT department?',
  'What is the leave policy?',
  'Show workforce summary',
  'Who are the top performers?',
]

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator({ status }) {
  return (
    <div className="chat-message-row" style={{ margin: '4px 0' }}>
      <div className="chat-avatar bot">
        <Bot size={16} strokeWidth={2} />
      </div>
      <div className="chat-bubble chat-bot">
        {status ? (
          <div className="chat-status-wrapper">
            <Zap size={14} color="var(--accent)" className="animate-pulse" />
            <span className="chat-status-text">{status}</span>
          </div>
        ) : (
          <div className="chat-dot-wrapper">
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
    <div className={`chat-message-row ${isUser ? 'user' : ''}`}>
      <div className={`chat-avatar ${isUser ? 'user' : 'bot'}`}>
        {isUser
          ? <User size={16} strokeWidth={2.5} />
          : <Bot size={16} strokeWidth={2} />
        }
      </div>
      <div className={`chat-bubble ${isUser ? 'chat-user' : 'chat-bot'}`}>
        {text}
        {streaming && <span className="chat-token-stream" />}
      </div>
    </div>
  )
}

// ── Main chat page ────────────────────────────────────────────────────────────
export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [status, setStatus] = useState('')
  const [userId, setUserId] = useState('anonymous')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)
  const botStartedRef = useRef(false)

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

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

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
               botStartedRef.current = true
               setMessages(prev => [...prev, { role: 'bot', text: event.data, _streaming: true }])
            } else {
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
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div>
          <h1 className="page-title">HR Chat Assistant</h1>
          <p className="page-subtitle">
            Your premium AI copilot for workforce analytics & policy queries.
          </p>
        </div>
        <div className="flex-row gap-4">
          <input
            className="input-glass"
            placeholder="User ID"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            style={{ width: 140, padding: '10px 16px', fontSize: 14 }}
            title="Current User ID for audit/permissions"
          />
          {messages.length > 0 && (
            <button onClick={() => { stopStream(); setMessages([]) }} className="btn-icon">
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && !streaming && (
          <div className="chat-empty-state page-enter">
            <div className="chat-welcome-icon">
              <Sparkles size={36} color="var(--accent)" strokeWidth={1.5} />
            </div>
            <h2 className="chat-welcome-title">How can I help you today?</h2>
            <p className="chat-welcome-subtitle">
              Ask me about employees, policies, org charts, or deep analytics.
            </p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="glass-card glass-card-hover chat-suggestion-btn"
                >
                  <div className="chat-suggestion-text">{s}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <Message key={i} role={m.role} text={m.text} streaming={m._streaming} />
        ))}

        {streaming && (messages.length === 0 || messages[messages.length - 1]?.role === 'user') && (
          <TypingIndicator status={status} />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about anything..."
            rows={1}
            disabled={streaming}
            className={`chat-textarea ${streaming ? 'streaming' : ''}`}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
          {streaming ? (
            <button onClick={stopStream} className="chat-stop-btn" title="Stop generating">
              ■
            </button>
          ) : (
            <button 
              onClick={() => sendMessage()} 
              disabled={!input.trim()} 
              className={`btn-primary chat-send-btn ${!input.trim() ? 'disabled' : ''}`}
            >
              <Send size={20} strokeWidth={2.5} />
            </button>
          )}
        </div>
        <p className="chat-input-hint">
          {streaming ? 'Generating response...' : 'Enter to send · Shift+Enter for new line'}
        </p>
      </div>
    </div>
  )
}