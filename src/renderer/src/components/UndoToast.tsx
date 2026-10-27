import { useEffect, useState } from 'react'
import { CheckCircle2, RotateCcw, X } from 'lucide-react'

interface UndoToastProps {
  message: string
  details?: string
  onUndo: () => void
  onDismiss: () => void
  durationMs?: number // Default: 60,000ms (60 seconds)
}

export function UndoToast({ 
  message,
  details,
  onUndo,
  onDismiss,
  durationMs = 60_000
}: UndoToastProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(Math.round(durationMs / 1000))

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss()
    }, durationMs)

    const interval = setInterval(() => {
      setSecondsRemaining(prev => Math.max(0, prev - 1))
    }, 1000)

    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [durationMs, onDismiss])

  return (
    <div
      className="undo-toast-banner"
      role="alert"
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-focus)',
        borderRadius: 12,
        padding: '10px 16px',
        boxShadow: 'var(--shadow-modal)',
        animation: 'slideUpToast 0.25s ease-out',
        maxWidth: '90vw'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--priority-low-text)' }}>
        <CheckCircle2 size={16} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
          {message}
        </span>
        {details && (
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {details}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onUndo}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--accent-purple)',
          color: 'var(--text-on-accent)',
          border: 'none',
          borderRadius: 8,
          padding: '5px 12px',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <RotateCcw size={12} strokeWidth={2.5} />
        <span>Undo</span>
        <span style={{ fontSize: 10.5, opacity: 0.85 }}>({secondsRemaining}s)</span>
      </button>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss undo notification"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          padding: 2
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
