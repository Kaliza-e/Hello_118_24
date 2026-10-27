import { useState, useEffect } from 'react'
import { X, Clock, AlertCircle } from 'lucide-react'
import { SubjectItem, WEEKDAYS } from '../types'

export interface SubjectModalProps {
  isOpen: boolean
  onClose: () => void
  subjectItem?: SubjectItem | null
  classItem?: SubjectItem | null
  defaultWeekday?: number
  availableDays?: number[]
  onSave: (subjectData: {
    title: string
    weekday: number
    startTime: string
    endTime?: string
    room?: string
    notes?: string
    color?: string
  }) => Promise<void> | void
}

export function SubjectModal({
  isOpen,
  onClose,
  subjectItem,
  classItem,
  defaultWeekday = 1,
  availableDays,
  onSave
}: SubjectModalProps) {
  const activeItem = subjectItem ?? classItem
  const [title, setTitle] = useState('')
  const [weekday, setWeekday] = useState(defaultWeekday)
  const [startTime, setStartTime] = useState('08:30')
  const [endTime, setEndTime] = useState('09:20')
  const [room, setRoom] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (activeItem) {
      setTitle(activeItem.title || '')
      setWeekday(activeItem.weekday !== undefined ? activeItem.weekday : defaultWeekday)
      setStartTime(activeItem.start_time || '08:30')
      setEndTime(activeItem.end_time || '')
      setRoom(activeItem.room || '')
      setNotes(activeItem.notes || '')
    } else {
      setTitle('')
      setWeekday(defaultWeekday)
      setStartTime('08:30')
      setEndTime('09:20')
      setRoom('')
      setNotes('')
    }
    setErrorMessage(null)
  }, [activeItem, defaultWeekday, isOpen])

  if (!isOpen) return null

  const daysToRender = availableDays && availableDays.length > 0 ? availableDays : [1, 2, 3, 4, 5, 6, 0]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setErrorMessage('Please enter a subject name.')
      return
    }

    if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
      setErrorMessage('Please provide a valid start time (HH:mm).')
      return
    }

    if (endTime && /^\d{2}:\d{2}$/.test(endTime)) {
      const [sH, sM] = startTime.split(':').map(Number)
      const [eH, eM] = endTime.split(':').map(Number)
      if (eH * 60 + eM <= sH * 60 + sM) {
        setErrorMessage('End time must be after start time.')
        return
      }
    }

    setSaving(true)
    try {
      await onSave({
        title: trimmedTitle,
        weekday,
        startTime,
        endTime: endTime || undefined,
        room: room.trim() || undefined,
        notes: notes.trim() || undefined
      })
      onClose()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 460 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">
            {activeItem ? 'Edit Subject' : '+ Add Subject'}
          </h3>
          <button className="win-btn" onClick={onClose} aria-label="Close modal">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ gap: 14 }}>
            {errorMessage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--priority-high-bg)',
                  border: '1px solid var(--priority-high-text)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--priority-high-text)',
                  fontSize: 12
                }}
              >
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Subject Name *</label>
              <input
                autoFocus
                className="input-field"
                placeholder="e.g. Physics, Maths, Mobile, DEVOPS"
                value={title}
                onChange={e => {
                  setTitle(e.target.value)
                  if (errorMessage) setErrorMessage(null)
                }}
                maxLength={160}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Day *</label>
              <select
                className="select-field"
                value={weekday}
                onChange={e => setWeekday(Number(e.target.value))}
              >
                {daysToRender.map(idx => (
                  <option key={idx} value={idx}>
                    {WEEKDAYS[idx]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grid-2">
              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} color="var(--accent-purple)" /> Start Time *
                </label>
                <input
                  type="time"
                  className="input-field"
                  value={startTime}
                  onChange={e => {
                    setStartTime(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} color="var(--accent-purple)" /> End Time *
                </label>
                <input
                  type="time"
                  className="input-field"
                  value={endTime}
                  onChange={e => {
                    setEndTime(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="input-group">
                <label className="input-label">Room / Hall</label>
                <input
                  className="input-field"
                  placeholder="e.g. Lab 2, Room 302"
                  value={room}
                  onChange={e => setRoom(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Instructor / Note</label>
                <input
                  className="input-field"
                  placeholder="e.g. Dr. Eric, Louis M."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="btn-secondary-pill"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary-pill"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
