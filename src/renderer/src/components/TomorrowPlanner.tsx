import { useState, useEffect, useMemo } from 'react'
import {
  ChevronRight,
  Plus,
  Check,
  Save,
  Sunset
} from 'lucide-react'
import { Task, ClassItem, toDateKey } from '../types'
import { TaskModal } from './TaskModal'

interface TomorrowPlannerProps {
  today: Date
  classes: ClassItem[]
  tasks: Task[]
  onRefreshTasks: () => Promise<void>
  onToggleTask: (task: Task) => void
  onDeleteTask: (id: number) => void
  onShowMessage: (msg: string) => void
}

const DOT_COLORS = [
  'var(--dot-cyan)',
  'var(--dot-pink)',
  'var(--dot-blue)',
  'var(--dot-orange)',
  'var(--dot-purple)'
]

export function TomorrowPlanner({
  today,
  classes,
  tasks,
  onRefreshTasks,
  onToggleTask,
  onDeleteTask,
  onShowMessage
}: TomorrowPlannerProps) {
  const tomorrow = useMemo(() => {
    const d = new Date(today)
    d.setDate(today.getDate() + 1)
    return d
  }, [today])

  const tomorrowKey = toDateKey(tomorrow)
  const tomorrowWeekday = tomorrow.getDay()

  const formattedTomorrow = useMemo(() => {
    return tomorrow.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }, [tomorrow])

  const [notes, setNotes] = useState('')
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Load plan notes from SQLite
  useEffect(() => {
    window.hello11824.getDailyPlan(tomorrowKey).then(p => {
      if (p) setNotes(p.notes || '')
    })
  }, [tomorrowKey])

  // Tomorrow's classes
  const tomorrowsClasses = useMemo(() => {
    return classes
      .filter(c => c.weekday === tomorrowWeekday)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [classes, tomorrowWeekday])

  // Tomorrow's tasks
  const tomorrowsTasks = useMemo(() => {
    return tasks.filter(t => t.due_date === tomorrowKey)
  }, [tasks, tomorrowKey])

  // Top priorities (tasks due tomorrow marked high priority, or any active high priority tasks)
  const topPriorities = useMemo(() => {
    return tasks.filter(t => t.due_date === tomorrowKey && t.priority === 'high')
  }, [tasks, tomorrowKey])

  async function handleSavePlan() {
    setIsSaving(true)
    try {
      await window.hello11824.saveDailyPlan(tomorrowKey, { notes })
      onShowMessage('Tomorrow’s plan saved.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAddTask(data: any) {
    await window.hello11824.addTask({
      ...data,
      dueDate: tomorrowKey
    })
    await onRefreshTasks()
    onShowMessage(`Added task "${data.title}" for tomorrow.`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Header */}
      <div className="view-top-header">
        <h2 className="view-page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Tomorrow – {formattedTomorrow}</span>
          <Sunset size={16} color="var(--dot-orange)" />
        </h2>
      </div>

      {/* 2-Column Grid Matching Panel 3 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* ================= LEFT COLUMN ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Classes */}
          <div className="app-card">
            <span className="section-sublabel" style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>
              Classes
            </span>

            {tomorrowsClasses.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                No classes scheduled for tomorrow.
              </div>
            ) : (
              <div className="classes-mini-list">
                {tomorrowsClasses.map((c, i) => (
                  <div key={c.id || i} className="class-mini-row" style={{ padding: '4px 0' }}>
                    <span className="class-mini-time">{c.start_time}</span>
                    <span className="class-dot" style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} />
                    <span className="class-mini-subject">{c.title}</span>
                    {c.room && <span className="class-mini-room">{c.room}</span>}
                    <ChevronRight size={13} color="var(--text-muted)" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tasks */}
          <div className="app-card">
            <span className="section-sublabel" style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>
              Tasks
            </span>

            {tomorrowsTasks.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                No tasks due tomorrow.
              </div>
            ) : (
              <div className="tasks-mini-list">
                {tomorrowsTasks.map(t => {
                  const priorityClass = t.priority === 'high' ? 'high' : t.priority === 'low' ? 'low' : 'medium'
                  const priorityLabel = t.priority === 'high' ? 'High' : t.priority === 'low' ? 'Low' : 'Medium'

                  return (
                    <div key={t.id} className="task-mini-item">
                      <button
                        className={`task-checkbox-btn ${t.completed ? 'checked' : ''}`}
                        onClick={() => onToggleTask(t)}
                        aria-label={t.completed ? 'Mark incomplete' : 'Mark complete'}
                      >
                        {t.completed ? <Check size={12} strokeWidth={3} /> : null}
                      </button>

                      <div className="task-item-content">
                        <span className={`task-item-title ${t.completed ? 'strikethrough' : ''}`}>
                          {t.title}
                        </span>
                      </div>

                      <span className={`priority-badge-pill ${priorityClass}`}>
                        {priorityLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            <button
              className="btn-pill-action"
              style={{ alignSelf: 'flex-start', marginTop: 4 }}
              onClick={() => setShowTaskModal(true)}
            >
              <Plus size={13} /> Add Task
            </button>
          </div>
        </div>

        {/* ================= RIGHT COLUMN ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Top Priorities */}
          <div className="app-card">
            <span className="section-sublabel" style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>
              Top Priorities
            </span>

            {topPriorities.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                No high-priority tasks set for tomorrow. Add one below!
              </div>
            ) : (
              <div className="tasks-mini-list">
                {topPriorities.map(t => (
                  <div key={t.id} className="task-mini-item">
                    <button
                      className={`task-checkbox-btn ${t.completed ? 'checked' : ''}`}
                      onClick={() => onToggleTask(t)}
                    >
                      {t.completed ? <Check size={12} strokeWidth={3} /> : null}
                    </button>

                    <div className="task-item-content">
                      <span className={`task-item-title ${t.completed ? 'strikethrough' : ''}`}>
                        {t.title}
                      </span>
                    </div>

                    <span className="priority-badge-pill high">High</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="app-card" style={{ flex: 1 }}>
            <span className="section-sublabel" style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>
              Notes
            </span>

            <textarea
              className="textarea-field"
              style={{ flex: 1, minHeight: 90 }}
              placeholder="Add your notes for tomorrow..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />

            <button
              className="btn-primary-pill"
              style={{
                alignSelf: 'flex-end',
                background: 'var(--accent-purple-btn)',
                boxShadow: '0 2px 10px rgba(124, 58, 237, 0.35)',
                marginTop: 6
              }}
              onClick={handleSavePlan}
              disabled={isSaving}
            >
              <Save size={13} /> {isSaving ? 'Saving…' : 'Save Plan'}
            </button>
          </div>
        </div>
      </div>

      {/* Task Modal for Tomorrow */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        defaultDate={tomorrowKey}
        onSave={handleAddTask}
      />
    </div>
  )
}
