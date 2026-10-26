import { AlertTriangle, Trash2, X } from 'lucide-react'

interface DeleteConfirmModalProps {
  isOpen: boolean
  title?: string
  subjectTitle: string
  timeRange?: string
  dayName?: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmModal({
  isOpen,
  title = 'Delete Subject',
  subjectTitle,
  timeRange,
  dayName,
  onConfirm,
  onCancel
}: DeleteConfirmModalProps) {
  if (!isOpen) return null

  const details = [timeRange, dayName ? `from ${dayName}` : ''].filter(Boolean).join(' ')

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal-content"
        style={{ maxWidth: 420, padding: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header" style={{ padding: '16px 20px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f87171'
              }}
            >
              <Trash2 size={16} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
          </div>
          <button className="win-btn" onClick={onCancel} aria-label="Close dialog">
            <X size={15} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '8px 20px 20px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Are you sure you want to delete{' '}
            <strong style={{ color: 'var(--text-primary)' }}>"{subjectTitle}"</strong>
            {details ? ` (${details})` : ''}?
          </p>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
            You can restore this item using the Undo action for 60 seconds after deletion.
          </p>
        </div>

        <div className="modal-footer" style={{ padding: '12px 20px 16px' }}>
          <button
            type="button"
            className="btn-secondary-pill"
            style={{ padding: '6px 16px' }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary-pill"
            style={{
              background: '#dc2626',
              boxShadow: '0 2px 10px rgba(220, 38, 38, 0.4)',
              padding: '6px 16px'
            }}
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
