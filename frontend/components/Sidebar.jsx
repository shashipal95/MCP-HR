'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  MessageSquare, BarChart2, Users, ScrollText, HelpCircle,
  Bot, Zap
} from 'lucide-react'

const NAV = [
  { href: '/chat', icon: MessageSquare, label: 'Chat' },
  { href: '/analytics', icon: BarChart2, label: 'Analytics' },
  { href: '/directory', icon: Users, label: 'Directory' },
  { href: '/audit', icon: ScrollText, label: 'Audit Log' },
  { href: '/help', icon: HelpCircle, label: 'Help' },
]

export default function Sidebar() {
  const path = usePathname()

  return (
    <aside style={{
      width: 220, minWidth: 220,
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      padding: '20px 12px', gap: 4,
    }}>
      {/* Logo */}
      <div style={{ padding: '8px 14px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36,
          background: 'linear-gradient(135deg, var(--accent), var(--accent-dim))',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Bot size={20} color="#050d1a" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.1 }}>HR Agent</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>MCP • Powered by Ollama</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = path.startsWith(href)
          return (
            <Link key={href} href={href} className={`nav-item${active ? ' active' : ''}`}>
              <Icon size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
              {label}
            </Link>
          )
        })}
      </nav>


      {/* Status */}
      <div style={{ marginTop: 6, padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Zap size={12} color="var(--accent)" />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-syne)', letterSpacing: '0.05em' }}>BACKEND</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          API: <span style={{ color: 'var(--text-secondary)' }}>localhost:8000</span><br />
          LLM: <span style={{ color: 'var(--text-secondary)' }}>llama3.2:3b</span>
        </div>
      </div>
    </aside>
  )
}