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
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Bot size={22} strokeWidth={2.5} />
        </div>
        <div>
          <div className="sidebar-brand-name">HR Agent</div>
          <div className="sidebar-brand-sub">MCP • Powered by AI</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = path.startsWith(href)
          return (
            <Link key={href} href={href} className={`nav-item${active ? ' active' : ''}`}>
              <Icon size={18} strokeWidth={active ? 2.5 : 2} style={{ flexShrink: 0 }} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Status */}
      <div className="status-badge">
        <div className="status-badge-header">
          <Zap size={14} color="var(--accent)" className="status-zap" />
          <span className="status-badge-title">SYSTEM ACTIVE</span>
        </div>
        <div className="status-badge-body">
          API: <span className="status-badge-link">localhost:8000</span><br />
          LLM: <span className="status-badge-link">llama3.2:3b</span>
        </div>
      </div>
    </aside>
  )
}