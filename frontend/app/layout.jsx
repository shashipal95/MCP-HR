'use client'
import './globals.css'
import Sidebar from '../components/Sidebar'
import ThemeToggle from '../components/ThemeToggle'
import { ThemeProvider } from '../components/ThemeProvider'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <div className="mesh-bg" />
          <ThemeToggle />
          <div className="app-container">
            <Sidebar />
            <main className="main-content">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}