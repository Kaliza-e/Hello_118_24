import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { ClassItem, WEEKDAYS } from '../types'

interface ClassModalProps {
  isOpen: boolean
  onClose: () => void
  classItem?: ClassItem | null
  defaultWeekday?: number
  onSave: (classData: {
    title: string
    weekday: number
    startTime: string
    endTime?: string
    room?: string
    notes?: string
    color?: string
  }) => Promise<void>
}

export function ClassModal({ isOpen, onClose, classItem, defaultWeekday = 1, onSave }: ClassModalProps) {
  const [title, setTitle] = useState('')
  const [weekday, setWeekday] = useState(defaultWeekday)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [room, setRoom] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (classItem) {
      setTitle(classItem.title || '')
      setWeekday(classItem.weekday)
      setStartTime(classItem.start_time || '09:00')
      setEndTime(classItem.end_time || '')
      setRoom(classItem.room || '')
      setNotes(classItem.notes || '')
    } else {
      setTitle('')
      setWeekday(defaultWeekday)
      setStartTime('09:00')
      setEndTime('10:00')
      setRoom('')
      setNotes('')
    }
  }, [classItem, defaultWeekday, isOpen])

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !startTime) return

    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        weekday,
        startTime,
        endTime: endTime || undefined,
        room: room.trim() || undefined,
        notes: notes.trim() || undefined
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{classItem ? 'Edit Class' : 'Add Recurring Class'}</h3>
          <button className="win-btn" onClick={onClose} aria-label="Close modal">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="input-group">
              <label className="input-label">Subject / Class Name *</label>
              <input
                autoFocus
                className="input-field"
                placeholder="e.g. Advanced Calculus, CS 101, Chemistry"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={160}
                required
              />
            </div>

            <div className="form-grid-2">
              <div className="input-group">
                <label className="input-label">Day of Week</label>
                <select
                  className="select-field"
                  value={weekday}
                  onChange={e => setWeekday(Number(e.target.value))}
                >
                  {WEEKDAYS.map((day, idx) => (
                    <option key={day} value={idx}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Room / Location</label>
                <input
                  className="input-field"
                  placeholder="e.g. Room 302, Lab B, Hall 4"
                  value={room}
                  onChange={e => setRoom(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="input-group">
                <label className="input-label">Start Time *</label>
                <input
                  type="time"
                  className="input-field"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">End Time</label>
                <input
                  type="time"
                  className="input-field"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Instructor / Notes</label>
              <input
                className="input-field"
                placeholder="e.g. Prof. Davis, Bring lab coat"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !title.trim()}>
              {saving ? 'Saving…' : classItem ? 'Update Class' : 'Save Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
