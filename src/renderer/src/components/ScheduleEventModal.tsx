import { useState, useEffect } from 'react'
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Bell,
  Plus,
  Trash2,
  FileText,
  Tag
} from 'lucide-react'
import {
  ScheduleCategory,
  SCHEDULE_CATEGORIES,
  ScheduleEvent,
  EventReminder
} from '../types'

interface ScheduleEventModalProps {
  isOpen: boolean
  onClose: () => void
  initialEvent?: ScheduleEvent | null
  onSave: (
    event: Partial<ScheduleEvent>,
    reminders?: Array<{ trigger_offset_minutes: number; all_day_delivery_time?: string }>
  ) => Promise<void>
}

const REMINDER_PRESETS = [
  { label: 'At event time', minutes: 0 },
  { label: '10 minutes before', minutes: 10 },
  { label: '30 minutes before', minutes: 30 },
  { label: '1 hour before', minutes: 60 },
  { label: '2 hours before', minutes: 120 },
  { label: '1 day before', minutes: 1440 },
  { label: '2 days before', minutes: 2880 },
  { label: '1 week before', minutes: 10080 }
]

export function ScheduleEventModal({
  isOpen,
  onClose,
  initialEvent,
  onSave
}: ScheduleEventModalProps) {
  if (!isOpen) return null

  const isEditing = Boolean(initialEvent && initialEvent.id)
  const todayStr = new Date().toISOString().slice(0, 10)

  const [title, setTitle] = useState(initialEvent?.title || '')
  const [description, setDescription] = useState(initialEvent?.description || '')
  const [category, setCategory] = useState<ScheduleCategory>(initialEvent?.category || 'Academic Calendar')
  const [startDate, setStartDate] = useState(initialEvent?.start_date || todayStr)
  const [startTime, setStartTime] = useState(initialEvent?.start_time || '')
  const [endDate, setEndDate] = useState(initialEvent?.end_date || initialEvent?.start_date || todayStr)
  const [endTime, setEndTime] = useState(initialEvent?.end_time || '')
  const [isAllDay, setIsAllDay] = useState(initialEvent ? Boolean(initialEvent.is_all_day) : true)
  const [location, setLocation] = useState(initialEvent?.location || '')
  const [reminders, setReminders] = useState<Array<{ trigger_offset_minutes: number; all_day_delivery_time?: string }>>(() => {
    if (initialEvent?.reminders && initialEvent.reminders.length > 0) {
      return initialEvent.reminders.map(r => ({
        trigger_offset_minutes: r.trigger_offset_minutes,
        all_day_delivery_time: r.all_day_delivery_time || '08:00'
      }))
    }
    return [{ trigger_offset_minutes: 10, all_day_delivery_time: '08:00' }]
  })
  const [allDayTime, setAllDayTime] = useState('08:00')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (initialEvent) {
      setTitle(initialEvent.title || '')
      setDescription(initialEvent.description || '')
      setCategory(initialEvent.category || 'Academic Calendar')
      setStartDate(initialEvent.start_date || todayStr)
      setStartTime(initialEvent.start_time || '')
      setEndDate(initialEvent.end_date || initialEvent.start_date || todayStr)
      setEndTime(initialEvent.end_time || '')
      setIsAllDay(Boolean(initialEvent.is_all_day))
      setLocation(initialEvent.location || '')
      if (initialEvent.reminders && initialEvent.reminders.length > 0) {
        setReminders(
          initialEvent.reminders.map(r => ({
            trigger_offset_minutes: r.trigger_offset_minutes,
            all_day_delivery_time: r.all_day_delivery_time || '08:00'
          }))
        )
      }
    }
  }, [initialEvent])

  function handleAddReminder(offsetMinutes: number = 60) {
    setReminders(prev => [...prev, { trigger_offset_minutes: offsetMinutes, all_day_delivery_time: allDayTime }])
  }

  function handleRemoveReminder(idx: number) {
    setReminders(prev => prev.filter((_, i) => i !== idx))
  }

  function handleUpdateReminderOffset(idx: number, offset: number) {
    setReminders(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], trigger_offset_minutes: offset }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setErrorMsg('Event title is required.')
      return
    }
    if (!startDate) {
      setErrorMsg('Start date is required.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')

    try {
      await onSave(
        {
          title: title.trim(),
          description: description.trim() || null,
          category,
          start_date: startDate,
          start_time: isAllDay ? null : (startTime || null),
          end_date: endDate || startDate,
          end_time: isAllDay ? null : (endTime || null),
          is_all_day: isAllDay ? 1 : 0,
          location: location.trim() || null
        },
        reminders.map(r => ({
          trigger_offset_minutes: r.trigger_offset_minutes,
          all_day_delivery_time: allDayTime
        }))
      )
      onClose()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-container" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={18} color="var(--accent-cyan)" />
            <h2 className="modal-title">{isEditing ? 'Edit Schedule Event' : 'New Schedule Event'}</h2>
          </div>
          <button type="button" className="icon-btn-subtle" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {errorMsg && (
            <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--priority-high-text)', borderRadius: 6, fontSize: 12 }}>
              {errorMsg}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="form-label">Event Title</label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Continuous Assessment Tests, Staff Meeting, Hackathon"
              autoFocus
              required
            />
          </div>

          {/* Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Category</label>
              <select
                className="form-input"
                value={category}
                onChange={e => setCategory(e.target.value as ScheduleCategory)}
              >
                {SCHEDULE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Location / Room</label>
              <input
                type="text"
                className="form-input"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Lab 2, Hall A, Online"
              />
            </div>
          </div>

          {/* Dates & Times */}
          <div style={{ background: 'var(--bg-card-subtle)', padding: '12px', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Date & Time</span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={e => setIsAllDay(e.target.checked)}
                />
                <span>All-Day Event</span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isAllDay ? '1fr 1fr' : '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Start Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>End Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {!isAllDay && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Start Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>End Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Reminders Section */}
          <div style={{ background: 'var(--bg-card-subtle)', padding: '12px', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
                <Bell size={13} color="var(--accent-purple)" />
                <span>Persistent Reminders</span>
              </div>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={() => handleAddReminder(60)}
              >
                <Plus size={11} /> Add Reminder
              </button>
            </div>

            {isAllDay && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                <span>Notify at:</span>
                <input
                  type="time"
                  value={allDayTime}
                  onChange={e => setAllDayTime(e.target.value)}
                  className="inline-date-input"
                  style={{ fontSize: 11 }}
                />
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>on scheduled reminder day</span>
              </div>
            )}

            {reminders.length === 0 ? (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No reminders configured for this event.
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {reminders.map((r, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select
                      className="form-input"
                      style={{ fontSize: 11.5, padding: '4px 8px' }}
                      value={r.trigger_offset_minutes}
                      onChange={e => handleUpdateReminderOffset(idx, parseInt(e.target.value, 10))}
                    >
                      {REMINDER_PRESETS.map(p => (
                        <option key={p.minutes} value={p.minutes}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="icon-btn-subtle danger"
                      onClick={() => handleRemoveReminder(idx)}
                      title="Remove reminder"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="form-label">Notes & Description</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Additional details, agenda, instructions, or meeting links..."
            />
          </div>

          {/* Source Provenance if available */}
          {initialEvent?.source_document_name && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '6px 10px', borderRadius: 6 }}>
              <FileText size={11} style={{ display: 'inline', marginRight: 4 }} />
              <span>Imported from: <strong>{initialEvent.source_document_name}</strong></span>
              {initialEvent.source_excerpt && (
                <div style={{ marginTop: 2, fontStyle: 'italic', fontSize: 10.5 }}>
                  Excerpt: “{initialEvent.source_excerpt}”
                </div>
              )}
            </div>
          )}

          <div className="modal-footer" style={{ padding: 0, marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn-secondary-pill" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary-pill" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (isEditing ? 'Update Event' : 'Create Event')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

