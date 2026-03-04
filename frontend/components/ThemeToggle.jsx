'use client'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export default function ThemeToggle() {
    const { theme, toggle } = useTheme()
    const isDark = theme === 'dark'

    return (
        <button
            onClick={toggle}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
                position: 'fixed',
                top: 16,
                right: 20,
                zIndex: 1000,
                width: 40,
                height: 40,
                borderRadius: 10,
                border: '1px solid var(--border-accent)',
                background: 'var(--bg-elevated)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.08)'
                e.currentTarget.style.boxShadow = '0 4px 20px var(--accent-glow)'
                e.currentTarget.style.borderColor = 'var(--accent)'
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)'
                e.currentTarget.style.borderColor = 'var(--border-accent)'
            }}
        >
            <div style={{
                transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s',
                transform: isDark ? 'rotate(0deg)' : 'rotate(180deg)',
            }}>
                {isDark
                    ? <Sun size={17} color="var(--accent)" strokeWidth={2} />
                    : <Moon size={17} color="var(--accent)" strokeWidth={2} />
                }
            </div>
        </button>
    )
}