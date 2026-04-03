'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  MessageSquare, BarChart2, Users, ScrollText, HelpCircle,
  Bot, Zap, Sun, Moon
} from 'lucide-react'
import { useTheme } from './ThemeProvider'

const NAV = [
  { href: '/chat', icon: MessageSquare, label: 'Chat', short: 'Chat' },
  { href: '/analytics', icon: BarChart2, label: 'Analytics', short: 'Stats' },
  { href: '/directory', icon: Users, label: 'Directory', short: 'People' },
  { href: '/audit', icon: ScrollText, label: 'Audit Log', short: 'Audit' },
  { href: '/help', icon: HelpCircle, label: 'Help', short: 'Help' },
]

export default function Sidebar() {
  const path = usePathname()
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <aside className="sidebar">

      {/* Desktop: logo */}
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
        {NAV.map(({ href, icon: Icon, label, short }) => {
          const active = path.startsWith(href)
          return (
            <Link key={href} href={href} className={`nav-item${active ? ' active' : ''}`}>
              <Icon size={18} strokeWidth={active ? 2.5 : 2} style={{ flexShrink: 0 }} />
              <span className="nav-label">{label}</span>
              <span className="nav-label-short">{short}</span>
            </Link>
          )
        })}
      </nav>

      {/* Mobile only: theme toggle tab */}
      <button className="sidebar-theme-tab" onClick={toggle} title="Toggle theme">
        {isDark
          ? <Sun size={18} strokeWidth={2} color="var(--accent)" />
          : <Moon size={18} strokeWidth={2} color="var(--accent)" />
        }
        <span>{isDark ? 'Light' : 'Dark'}</span>
      </button>

      {/* Desktop: status badge */}
      <div className="status-badge">
        <div className="status-badge-header">
          <Zap size={14} color="var(--accent)" className="status-zap" />
          <span className="status-badge-title">SYSTEM ACTIVE</span>
        </div>
        <div className="status-badge-body">
          API: <span className="status-badge-link">railway.app</span><br />
          LLM: <span className="status-badge-link">llama3.2:3b</span>
        </div>
      </div>

    </aside>
  )
}