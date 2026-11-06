import { useState, useMemo } from 'react'
import { X, Calendar, Clock, Sparkles } from 'lucide-react'
import { Task, ClassItem, toDateKey } from '../types'

interface ScheduleTaskModalProps {
  isOpen: boolean
  onClose: () => void
  task: Task | null
  classes: ClassItem[]
  today: Date
  onSaveSchedule: (taskId: number, date: string, time?: string, durationMinutes?: number) => Promise<void>
}

export function ScheduleTaskModal({
  isOpen,
  onClose,
  task,
  classes,
  today,
  onSaveSchedule
}: ScheduleTaskModalProps) {
  const [scheduledDate, setScheduledDate] = useState(toDateKey(today))
  const [scheduledTime, setScheduledTime] = useState('14:00')
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [saving, setSaving] = useState(false)

  // Detect free gaps on the selected date's day of week
  const freeGaps = useMemo(() => {
    const [y, m, d] = scheduledDate.split('-').map(Number)
    const targetDate = new Date(y, m - 1, d)
    const weekday = targetDate.getDay()

    const dayClasses = classes
      .filter(c => c.weekday === weekday && c.start_time)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))

    const gaps: Array<{ start: string; end: string; duration: number }> = []

    for (let i = 0; i < dayClasses.length - 1; i++) {
      const current = dayClasses[i]
      const next = dayClasses[i + 1]

      if (current.end_time && next.start_time) {
        const [cH, cM] = current.end_time.split(':').map(Number)
        const [nH, nM] = next.start_time.split(':').map(Number)
        const gapMins = (nH * 60 + nM) - (cH * 60 + cM)

        if (gapMins >= 15) {
          gaps.push({
            start: current.end_time,
            end: next.start_time,
            duration: gapMins
          })
        }
      }
    }
    return gaps
  }, [classes, scheduledDate])

  if (!isOpen || !task) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!task) return
    setSaving(true)
    try {
      await onSaveSchedule(task.id, scheduledDate, scheduledTime || undefined, durationMinutes)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  function handleSelectGap(gap: { start: string; duration: number }) {
    setScheduledTime(gap.start)
    setDurationMinutes(Math.min(gap.duration, 60))
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 440 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={16} color="var(--accent-purple)" />
            <h3 className="modal-title">Schedule Task</h3>
          </div>
          <button className="win-btn" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ gap: 14 }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Task</span>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                {task.title}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
              <div className="input-group">
                <label className="input-label">Date *</label>
                <input
                  type="date"
                  className="input-field"
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Time Slot</label>
                <input
                  type="time"
                  className="input-field"
                  value={scheduledTime}
                  onChange={e => setScheduledTime(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Planned Study Duration</label>
              <select
                className="select-field"
                value={durationMinutes}
                onChange={e => setDurationMinutes(Number(e.target.value))}
              >
                <option value={15}>15 minutes (Quick review)</option>
                <option value={25}>25 minutes (1 Pomodoro)</option>
                <option value={30}>30 minutes (Standard)</option>
                <option value={45}>45 minutes (Deep study)</option>
                <option value={60}>60 minutes (1 Hour)</option>
                <option value={90}>90 minutes (1.5 Hours)</option>
              </select>
            </div>

            {/* Free Gaps between classes suggestions */}
            {freeGaps.length > 0 && (
              <div style={{ background: 'var(--bg-card-inner)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 11, fontWeight: 600, color: 'var(--accent-purple)' }}>
                  <Sparkles size={12} />
                  <span>Free Class Gaps on This Day:</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {freeGaps.map((g, i) => (
                    <button
                      key={i}
                      type="button"
                      className="btn-secondary-pill"
                      style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => handleSelectGap(g)}
                    >
                      {g.start} – {g.end} ({g.duration}m)
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button type="button" className="btn-secondary-pill" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary-pill" disabled={saving}>
                Save Schedule
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

