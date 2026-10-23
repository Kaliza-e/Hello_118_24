import { useState, useEffect } from 'react'
import { X, Calendar, Clock, Tag, Flag } from 'lucide-react'
import { Task, toDateKey } from '../types'

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
  }) => Promise<void>
}

export function TaskModal({ isOpen, onClose, task, defaultDate, onSave }: TaskModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
      setDueDate(task.due_date || '')
      setDueTime(task.due_time || '')
      setPriority(task.priority || 'normal')
      setCategory(task.category || '')
    } else {
      setTitle('')
      setDescription('')
      setDueDate(defaultDate || toDateKey(new Date()))
      setDueTime('')
      setPriority('normal')
      setCategory('')
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
        category: category.trim() || undefined
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
            <div className="input-group">
              <label className="input-label">Task Title *</label>
              <input
                autoFocus
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
