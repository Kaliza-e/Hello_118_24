import { useMemo } from 'react'
import {
  BookOpen,
  ChevronRight,
  Check,
  Plus
} from 'lucide-react'
import { Task, ClassItem, ActiveTab, toDateKey } from '../types'

interface TodayViewProps {
  today: Date
  classes: ClassItem[]
  tasks: Task[]
  onToggleTask: (task: Task) => void
  onNavigate: (tab: ActiveTab) => void
  onOpenTaskModal: () => void
  onOpenClassModal: () => void
}

const DOT_COLORS = [
  'var(--dot-cyan)',
  'var(--dot-pink)',
  'var(--dot-blue)',
  'var(--dot-orange)',
  'var(--dot-purple)',
  'var(--dot-green)'
]

export function TodayView({
  today,
  classes,
  tasks,
  onToggleTask,
  onNavigate,
  onOpenTaskModal,
  onOpenClassModal
}: TodayViewProps) {
  const todayKey = toDateKey(today)
  const todayWeekday = today.getDay()

  // Format date: "Tue, Apr 29, 2025"
  const formattedDate = useMemo(() => {
    return today.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }, [today])

  // Greeting by time of day
  const greeting = useMemo(() => {
    const hour = today.getHours()
    if (hour < 12) return 'Good morning, Friend! ☀️'
    if (hour < 17) return 'Good afternoon, Friend! ☀️'
    return 'Good evening, Friend! 🌙'
  }, [today])

  // Today's classes
  const todaysClasses = useMemo(() => {
    return classes
      .filter(c => c.weekday === todayWeekday)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [classes, todayWeekday])

  // Determine Next Class
  const nextClass = useMemo(() => {
    const nowMinutes = today.getHours() * 60 + today.getMinutes()
    for (const c of todaysClasses) {
      if (!c.start_time) continue
      const [sH, sM] = c.start_time.split(':').map(Number)
      const startMinutes = sH * 60 + sM
      let endMinutes = startMinutes + 60
      if (c.end_time && /^\d{2}:\d{2}$/.test(c.end_time)) {
        const [eH, eM] = c.end_time.split(':').map(Number)
        endMinutes = eH * 60 + eM
      }
      if (nowMinutes < endMinutes) {
        return c
      }
    }
    return todaysClasses[0] || null
  }, [todaysClasses, today])

  // Today's tasks (due today or unassigned date)
  const todaysTasks = useMemo(() => {
    return tasks.filter(t => t.due_date === todayKey || t.due_date === null)
  }, [tasks, todayKey])

  const completedCount = todaysTasks.filter(t => t.completed).length
  const progressPercent = todaysTasks.length > 0 ? (completedCount / todaysTasks.length) * 100 : 0

  return (
    <div className="widget-cards-grid">
      {/* ================= LEFT CARD: TODAY'S SCHEDULE ================= */}
      <div className="app-card">
        {/* Date and Greeting */}
        <div className="today-header-row">
          <span className="today-date-text">{formattedDate}</span>
          <span className="today-pill">Today</span>
        </div>

        <div className="today-greeting-text">{greeting}</div>

        {/* Next Class Box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="section-sublabel">Next Class</span>

          {nextClass ? (
            <div className="next-class-card" onClick={() => onNavigate('timetable')}>
              <div className="next-class-icon">
                <BookOpen size={16} />
              </div>

              <div className="next-class-info">
                <span className="next-class-title">{nextClass.title}</span>
                <span className="next-class-time">
                  {nextClass.start_time} {nextClass.end_time ? `– ${nextClass.end_time}` : ''}
                </span>
              </div>

              {nextClass.room && <span className="next-class-room">{nextClass.room}</span>}
              <ChevronRight size={15} color="var(--text-muted)" />
            </div>
          ) : (
            <div
              className="next-class-card"
              style={{ justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11.5 }}
              onClick={onOpenClassModal}
            >
              No upcoming classes today • Add Class
            </div>
          )}
        </div>

        {/* Today's Classes List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <span className="section-sublabel">Today's Classes</span>

          {todaysClasses.length === 0 ? (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
              No classes scheduled for today.
            </div>
          ) : (
            <div className="classes-mini-list">
              {todaysClasses.map((c, i) => (
                <div key={c.id || i} className="class-mini-row">
                  <span className="class-mini-time">{c.start_time}</span>
                  <span
                    className="class-dot"
                    style={{ background: DOT_COLORS[i % DOT_COLORS.length] }}
                  />
                  <span className="class-mini-subject">{c.title}</span>
                  {c.room && <span className="class-mini-room">{c.room}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================= RIGHT CARD: TODAY'S TASKS ================= */}
      <div className="app-card">
        {/* Header */}
        <div className="tasks-header-row">
          <div className="tasks-card-title" onClick={() => onNavigate('tasks')}>
            <span>Today's Tasks</span>
            <ChevronRight size={14} color="var(--text-muted)" />
          </div>
          <span className="tasks-count-text">
            {completedCount}/{todaysTasks.length} completed
          </span>
        </div>

        {/* Progress Bar */}
        <div className="tasks-progress-bar">
          <div className="tasks-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        {/* Tasks List */}
        {todaysTasks.length === 0 ? (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic', padding: '16px 0', textAlign: 'center' }}>
            No tasks scheduled for today. Click below to add one!
          </div>
        ) : (
          <div className="tasks-mini-list">
            {todaysTasks.slice(0, 6).map(t => {
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
                    <div className="task-item-submeta">
                      <span>Today</span>
                      <span>•</span>
                      <span className={`priority-badge-pill ${priorityClass}`}>{priorityLabel}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Bottom Actions */}
        <div className="tasks-bottom-row">
          <button className="btn-pill-action" onClick={onOpenTaskModal}>
            <Plus size={13} /> Add Task
          </button>
          <button className="link-action" onClick={() => onNavigate('tasks')}>
            View All
          </button>
        </div>
      </div>
    </div>
  )
}
