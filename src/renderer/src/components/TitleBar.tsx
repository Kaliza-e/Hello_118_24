import { Pin, Minus, Square, X, Sunset } from 'lucide-react'

interface TitleBarProps {
  pinned: boolean
  onTogglePin: () => void
  widgetMode: 'compact' | 'standard'
  onToggleMode: () => void
}

export function TitleBar({ pinned, onTogglePin, widgetMode, onToggleMode }: TitleBarProps) {
  return (
    <header className="titlebar">
      <div className="brand">
        <div className="brand-icon-box">
          <Sunset size={14} />
        </div>
        <div className="brand-title">
          <span className="brand-script">Hello</span>
          <span className="brand-number">118:24</span>
        </div>
      </div>

      <div className="window-controls">
        <button
          className={`win-btn ${pinned ? 'active' : ''}`}
          title={pinned ? 'Unpin always-on-top' : 'Pin always-on-top'}
          onClick={onTogglePin}
        >
          <Pin size={13} style={{ transform: 'rotate(45deg)' }} />
        </button>

        <button
          className="win-btn"
          title="Minimize"
          onClick={() => window.hello11824.minimize()}
        >
          <Minus size={14} />
        </button>

        <button
          className="win-btn"
          title={widgetMode === 'compact' ? 'Expand to Full Dashboard' : 'Compact Floating Widget'}
          onClick={onToggleMode}
        >
          <Square size={12} />
        </button>

        <button
          className="win-btn close"
          title="Hide to tray"
          onClick={() => window.hello11824.hide()}
        >
          <X size={14} />
        </button>
      </div>
    </header>
  )
}
