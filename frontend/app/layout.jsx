'use client'
import './globals.css'
import Sidebar from '../components/Sidebar'
import { ThemeProvider } from '../components/ThemeProvider'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <div className="mesh-bg" />
          <div style={{ display: 'flex', height: '100vh', position: 'relative', zIndex: 1 }}>
            <Sidebar />
            <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}