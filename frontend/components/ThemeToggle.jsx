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
            className="theme-toggle"
        >
            <div className={`theme-toggle-icon ${isDark ? '' : 'rotated'}`}>
                {isDark
                    ? <Sun size={20} color="var(--accent)" strokeWidth={2} />
                    : <Moon size={20} color="var(--accent)" strokeWidth={2} />
                }
            </div>
        </button>
    )
}