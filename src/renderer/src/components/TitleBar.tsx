import { useState, useEffect } from 'react'
import {
  Pin,
  Minus,
  Square,
  Copy,
  X,
  Maximize2,
  PictureInPicture2,
  Sun,
  Moon,
  Sparkles
} from 'lucide-react'

interface TitleBarProps {
  pinned: boolean
  onTogglePin: () => void
  widgetMode: 'compact' | 'standard'
  onToggleMode: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

export function TitleBar({
  pinned,
  onTogglePin,
  widgetMode,
  onToggleMode,
  theme,
  onToggleTheme
}: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [freeRemindersActive, setFreeRemindersActive] = useState(true)

  useEffect(() => {
    window.hello11824?.isMaximized?.().then(max => {
      setIsMaximized(Boolean(max))
    })

    const unsub = window.hello11824?.onMaximizeChanged?.(max => {
      setIsMaximized(max)
    })

    const checkReminders = () => {
      window.hello11824?.getAllSettings?.().then(s => {
        if (s) {
          const notif = s.notifications_enabled !== 'false'
          const freeRem = s.free_period_reminders_enabled !== 'false'
          setFreeRemindersActive(notif && freeRem)
        }
      })
    }
    checkReminders()
    const interval = setInterval(checkReminders, 8_000)

    return () => {
      unsub?.()
      clearInterval(interval)
    }
  }, [])

  async function handleMaximizeToggle() {
    const next = await window.hello11824.maximize()
    setIsMaximized(Boolean(next))
  }

  const isCompact = widgetMode === 'compact'

  return (
    <header className="titlebar">
      <div className="brand">
        <img src="/icon.png" alt="Hello 118:24 logo" className="brand-logo-img" />
        <div className="brand-title">
          <span className="brand-script">Hello</span>
          <span className="brand-number">118:24</span>
        </div>

        {freeRemindersActive && (
          <span
            className="titlebar-reminder-badge"
            title="Smart Free Time Reminders are active"
          >
            <Sparkles size={10} color="var(--accent-cyan)" />
            <span className="indicator-live-dot" />
          </span>
        )}
      </div>

      <div className="window-controls">
        {/* Dark / Light Theme Toggle */}
        <button
          type="button"
          className="win-btn"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
        </button>

        {/* Always on top toggle */}
        <button
          type="button"
          className={`win-btn ${pinned ? 'active' : ''}`}
          title={pinned ? 'Unpin (Disable always-on-top)' : 'Pin (Keep floating window always-on-top)'}
          onClick={onTogglePin}
        >
          <Pin size={12} style={{ transform: pinned ? 'none' : 'rotate(45deg)' }} />
        </button>

        {/* Switch between Widget Mode and Full Application Mode */}
        <button
          type="button"
          className="win-btn"
          title={isCompact ? 'Expand to Full Application' : 'Switch to Compact Floating Widget'}
          onClick={onToggleMode}
        >
          {isCompact ? <Maximize2 size={12} /> : <PictureInPicture2 size={12} />}
        </button>

        {/* Minimize */}
        <button
          type="button"
          className="win-btn"
          title="Minimize window"
          onClick={() => window.hello11824.minimize()}
        >
          <Minus size={13} />
        </button>

        {/* Maximize / Restore (active in Full Application Mode) */}
        {!isCompact && (
          <button
            type="button"
            className="win-btn"
            title={isMaximized ? 'Restore down' : 'Maximize window'}
            onClick={handleMaximizeToggle}
          >
            {isMaximized ? <Copy size={11} /> : <Square size={11} />}
          </button>
        )}

        {/* Close (Hide to Tray) */}
        <button
          type="button"
          className="win-btn close"
          title="Close to system tray"
          onClick={() => window.hello11824.hide()}
        >
          <X size={14} />
        </button>
      </div>
    </header>
  )
}
