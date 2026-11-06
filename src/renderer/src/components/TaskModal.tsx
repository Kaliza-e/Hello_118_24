import { useState, useEffect, useMemo } from 'react'
import { X, Calendar, Clock, Tag, Flag, Sparkles, Check, ArrowRight } from 'lucide-react'
import { Task, toDateKey } from '../types'
import { parseNaturalLanguageTask, ParsedTaskInput } from '../../../shared/nlParser'

interface TaskModalProps {
  isOpen: boolean
  onClose: () => void
  task?: Task | null
  defaultDate?: string
  onSave: (taskData: {
    title: string
    description?: string
    dueDate?: string
    dueTime?: string
    priority: 'low' | 'normal' | 'high'
    category?: string
    estimatedMinutes?: number | null
  }) => Promise<void>
}

export function TaskModal({ isOpen, onClose, task, defaultDate, onSave }: TaskModalProps) {
  const [nlInput, setNlInput] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [category, setCategory] = useState('')
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | ''>('')
  const [isCustomDuration, setIsCustomDuration] = useState(false)
  const [saving, setSaving] = useState(false)

  // Real-time parsed live preview of natural language entry
  const parsedNL = useMemo<ParsedTaskInput>(() => {
    return parseNaturalLanguageTask(nlInput)
  }, [nlInput])

  function applyParsedFields(parsed: ParsedTaskInput) {
    if (parsed.cleanTitle) setTitle(parsed.cleanTitle)
    if (parsed.dueDate) setDueDate(parsed.dueDate)
    if (parsed.dueTime) setDueTime(parsed.dueTime)
    if (parsed.priority) setPriority(parsed.priority)
    if (parsed.category) setCategory(parsed.category)
    if (parsed.estimatedMinutes) {
      setEstimatedMinutes(parsed.estimatedMinutes)
      setIsCustomDuration(![15, 25, 30, 45, 60, 90].includes(parsed.estimatedMinutes))
    }
  }

  useEffect(() => {
    if (task) {
      setNlInput('')
      setTitle(task.title || '')
      setDescription(task.description || '')
      setDueDate(task.due_date || '')
      setDueTime(task.due_time || '')
      setPriority(task.priority || 'normal')
      setCategory(task.category || '')
      const est = task.estimated_minutes ?? ''
      setEstimatedMinutes(est)
      setIsCustomDuration(est !== '' && ![15, 25, 30, 45, 60, 90].includes(Number(est)))
    } else {
      setNlInput('')
      setTitle('')
      setDescription('')
      setDueDate(defaultDate || toDateKey(new Date()))
      setDueTime('')
      setPriority('normal')
      setCategory('')
      setEstimatedMinutes('')
      setIsCustomDuration(false)
    }
  }, [task, defaultDate, isOpen])

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        dueTime: dueTime || undefined,
        priority,
        category: category.trim() || undefined,
        estimatedMinutes: estimatedMinutes === '' ? null : Number(estimatedMinutes)
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
          <h3 className="modal-title">{task ? 'Edit Task' : 'New Task'}</h3>
          <button className="win-btn" onClick={onClose} aria-label="Close modal">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Natural Language Quick Entry with Live Preview */}
            {!task && (
              <div
                style={{
                  background: 'var(--accent-purple-bg)',
                  border: '1px solid var(--border-focus)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginBottom: 10
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className="input-label" style={{ color: 'var(--accent-purple)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                    <Sparkles size={13} /> Natural-Language Quick Entry
                  </label>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    Type freely: title, date, time, priority
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder='e.g. "Submit docs tomorrow 5pm high ~45m #Project"'
                    value={nlInput}
                    onChange={e => {
                      setNlInput(e.target.value)
                      const parsed = parseNaturalLanguageTask(e.target.value)
                      if (parsed.cleanTitle) setTitle(parsed.cleanTitle)
                      if (parsed.dueDate) setDueDate(parsed.dueDate)
                      if (parsed.dueTime) setDueTime(parsed.dueTime)
                      if (parsed.priority) setPriority(parsed.priority)
                      if (parsed.category) setCategory(parsed.category)
                      if (parsed.estimatedMinutes) {
                        setEstimatedMinutes(parsed.estimatedMinutes)
                        setIsCustomDuration(![15, 25, 30, 45, 60, 90].includes(parsed.estimatedMinutes))
                      }
                    }}
                    style={{ background: 'var(--bg-card)' }}
                  />
                  {nlInput.trim() && (
                    <button
                      type="button"
                      className="btn-primary-pill"
                      style={{ padding: '0 10px', fontSize: 11, background: 'var(--accent-purple-btn)', flexShrink: 0 }}
                      onClick={() => applyParsedFields(parsedNL)}
                      title="Apply parsed fields"
                    >
                      <Check size={12} />
                    </button>
                  )}
                </div>

                {/* Live Preview of Parsed Fields */}
                {nlInput.trim() && parsedNL.hasParsedFields && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 10.5,
                      paddingTop: 4,
                      borderTop: '1px solid rgba(124, 58, 237, 0.2)'
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Parsed:</span>
                    {parsedNL.cleanTitle && (
                      <span className="priority-badge-pill" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                        Title: {parsedNL.cleanTitle}
                      </span>
                    )}
                    {parsedNL.dueDate && (
                      <span className="priority-badge-pill" style={{ background: 'var(--bg-card)', color: 'var(--accent-purple)' }}>
                        📅 {parsedNL.dueDate}
                      </span>
                    )}
                    {parsedNL.dueTime && (
                      <span className="priority-badge-pill" style={{ background: 'var(--bg-card)', color: 'var(--accent-cyan)' }}>
                        ⏰ {parsedNL.dueTime}
                      </span>
                    )}
                    {parsedNL.priority && (
                      <span className={`priority-badge-pill ${parsedNL.priority}`}>
                        {parsedNL.priority === 'high' ? 'High Priority' : parsedNL.priority === 'low' ? 'Low Priority' : 'Normal'}
                      </span>
                    )}
                    {parsedNL.estimatedMinutes && (
                      <span className="priority-badge-pill" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                        ⏱ {parsedNL.estimatedMinutes}m
                      </span>
                    )}
                    {parsedNL.category && (
                      <span className="priority-badge-pill" style={{ background: 'var(--bg-card)', color: 'var(--dot-pink)' }}>
                        #{parsedNL.category}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Task Title *</label>
              <input
                autoFocus={Boolean(task)}
                className="input-field"
                placeholder="What needs to get done?"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={240}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Description / Notes</label>
              <textarea
                className="textarea-field"
                placeholder="Additional instructions, requirements, or links..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="form-grid-2">
              <div className="input-group">
                <label className="input-label">Due Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Due Time</label>
                <input
                  type="time"
                  className="input-field"
                  value={dueTime}
                  onChange={e => setDueTime(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="input-group">
                <label className="input-label">Priority</label>
                <select
                  className="select-field"
                  value={priority}
                  onChange={e => setPriority(e.target.value as 'low' | 'normal' | 'high')}
                >
                  <option value="low">Low Priority</option>
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Category / Subject</label>
                <input
                  className="input-field"
                  placeholder="e.g. Math, Revision, Project"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                />
              </div>
            </div>

            {/* Smart Free Time Estimation */}
            <div className="input-group">
              <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Estimated Duration</span>
                <span style={{ fontSize: 10.5, color: 'var(--accent-purple)', fontWeight: 500 }}>
                  Used for smart free-time reminders
                </span>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: isCustomDuration ? '1fr 1fr' : '1fr', gap: 8 }}>
                <select
                  className="select-field"
                  value={isCustomDuration ? 'custom' : estimatedMinutes === '' ? '' : String(estimatedMinutes)}
                  onChange={e => {
                    const val = e.target.value
                    if (val === 'custom') {
                      setIsCustomDuration(true)
                      if (estimatedMinutes === '') setEstimatedMinutes(20)
                    } else if (val === '') {
                      setIsCustomDuration(false)
                      setEstimatedMinutes('')
                    } else {
                      setIsCustomDuration(false)
                      setEstimatedMinutes(Number(val))
                    }
                  }}
                >
                  <option value="">No estimate (auto-fit)</option>
                  <option value="15">15 minutes (Quick review / Flashcards)</option>
                  <option value="25">25 minutes (Pomodoro / Short exercise)</option>
                  <option value="30">30 minutes (Reading / Lab setup)</option>
                  <option value="45">45 minutes (Assignment draft / Practice)</option>
                  <option value="60">60 minutes (Deep study session)</option>
                  <option value="90">90 minutes (Full exam practice)</option>
                  <option value="custom">Custom duration...</option>
                </select>

                {isCustomDuration && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      min={5}
                      max={480}
                      step={5}
                      className="input-field"
                      placeholder="Minutes"
                      value={estimatedMinutes}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10)
                        setEstimatedMinutes(isNaN(val) ? '' : Math.max(1, val))
                      }}
                      style={{ width: '100%' }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>min</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !title.trim()}>
              {saving ? 'Saving…' : task ? 'Update Task' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
