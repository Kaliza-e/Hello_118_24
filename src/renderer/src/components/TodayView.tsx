import { useMemo } from 'react'
import {
  BookOpen,
  ChevronRight,
  Check,
  Plus,
  ExternalLink,
  Sparkles,
  Heart
} from 'lucide-react'
import { Task, ClassItem, ActiveTab, toDateKey } from '../types'
import { FreeTimeBanner } from './FreeTimeBanner'

interface TodayViewProps {
  today: Date
  classes: ClassItem[]
  tasks: Task[]
  isCompact?: boolean
  onToggleTask: (task: Task) => void
  onNavigate: (tab: ActiveTab) => void
  onOpenTaskModal: () => void
  onOpenClassModal: () => void
  onExpandApp?: () => void
  onOpenTaskDetails?: (task: Task) => void
  onRefreshTasks?: () => Promise<void>
  onShowMessage?: (msg: string) => void
}

const DOT_COLORS = [
  'var(--dot-blue)',
  'var(--dot-purple)',
  'var(--dot-orange)',
  'var(--dot-green)',
  'var(--dot-cyan)',
  'var(--dot-pink)'
]

export function TodayView({
  today,
  classes,
  tasks,
  isCompact = false,
  onToggleTask,
  onNavigate,
  onOpenTaskModal,
  onOpenClassModal,
  onExpandApp,
  onOpenTaskDetails,
  onRefreshTasks,
  onShowMessage
}: TodayViewProps) {
  const todayKey = toDateKey(today)
  const todayWeekday = today.getDay()

  // Format date: "Mon, Oct 26, 2026"
  const formattedDate = useMemo(() => {
    return today.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }, [today])

  // Current time: "10:24"
  const currentTimeString = useMemo(() => {
    const hours = String(today.getHours()).padStart(2, '0')
    const minutes = String(today.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }, [today])

  // Week number in year
  const weekNumber = useMemo(() => {
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1)
    const pastDaysOfYear = (today.getTime() - firstDayOfYear.getTime()) / 86400000
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
  }, [today])

  // Greeting by time of day
  const greeting = useMemo(() => {
    const hour = today.getHours()
    if (hour < 12) return 'Good morning, Friend! ☀️'
    if (hour < 17) return 'Good afternoon, Friend! ☀️'
    return 'Good evening, Friend! 🌙'
  }, [today])

  // Today's classes
  const todaysSubjects = useMemo(() => {
    return classes
      .filter(c => c.weekday === todayWeekday)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [classes, todayWeekday])

  // Determine Next Subject
  const nextSubject = useMemo(() => {
    const nowMinutes = today.getHours() * 60 + today.getMinutes()
    for (const c of todaysSubjects) {
      if (!c.start_time) continue
      const [sH, sM] = c.start_time.split(':').map(Number)
      const startMinutes = sH * 60 + sM
      let endMinutes = startMinutes + 50
      if (c.end_time && /^\d{2}:\d{2}$/.test(c.end_time)) {
        const [eH, eM] = c.end_time.split(':').map(Number)
        endMinutes = eH * 60 + eM
      }
      if (nowMinutes < endMinutes) {
        return c
      }
    }
    return todaysSubjects[0] || null
  }, [todaysSubjects, today])

  // Today's tasks (due today or unassigned date)
  const todaysTasks = useMemo(() => {
    return tasks.filter(t => t.due_date === todayKey || t.due_date === null)
  }, [tasks, todayKey])

  const completedCount = todaysTasks.filter(t => Boolean(t.completed)).length
  const progressPercent = todaysTasks.length > 0 ? (completedCount / todaysTasks.length) * 100 : 0

  // ================= COMPACT FLOATING WIDGET LAYOUT =================
  if (isCompact) {
    return (
      <div className="compact-widget-container">
        {/* Big Clock Header */}
        <div className="compact-clock-card">
          <div className="compact-time-display">{currentTimeString}</div>
          <div className="compact-date-sublabel">{formattedDate}</div>
        </div>

        {/* Smart Free-Time Suggestion Banner */}
        <FreeTimeBanner
          today={today}
          isCompact={true}
          onOpenTask={onOpenTaskDetails}
          onOpenCreateTask={onOpenTaskModal}
          onRefreshTasks={onRefreshTasks || (async () => {})}
          onShowMessage={onShowMessage || (() => {})}
        />

        {/* Next Class Box */}
        <div className="compact-section-box">
          <span className="section-sublabel">Next Class</span>
          {nextSubject ? (
            <div
              className="next-class-card"
              style={{ padding: '8px 12px' }}
              onClick={() => onNavigate('timetable')}
            >
              <div className="next-class-icon" style={{ width: 28, height: 28 }}>
                <BookOpen size={14} />
              </div>
              <div className="next-class-info">
                <span className="next-class-title">{nextSubject.title}</span>
                <span className="next-class-time">
                  {nextSubject.start_time} {nextSubject.end_time ? `– ${nextSubject.end_time}` : ''}
                  {nextSubject.room ? ` • ${nextSubject.room}` : ''}
                </span>
              </div>
              <ChevronRight size={14} color="var(--text-muted)" />
            </div>
          ) : (
            <div
              className="next-class-card empty"
              onClick={onOpenClassModal}
              style={{ cursor: 'pointer', padding: '8px 12px', fontSize: 11.5 }}
            >
              No more classes today • Add Subject
            </div>
          )}
        </div>

        {/* Today's Tasks Preview */}
        <div className="compact-section-box" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span className="section-sublabel">Today's Tasks</span>
            <span style={{ fontSize: 11, color: 'var(--accent-purple)', fontWeight: 600 }}>
              {completedCount}/{todaysTasks.length}
            </span>
          </div>

          <div className="tasks-mini-list" style={{ flex: 1, maxHeight: 150, overflowY: 'auto' }}>
            {todaysTasks.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0', textAlign: 'center' }}>
                All clear! No tasks for today.
              </div>
            ) : (
              todaysTasks.slice(0, 4).map(t => (
                <div key={t.id} className="task-mini-item" style={{ padding: '4px 0' }}>
                  <button
                    type="button"
                    className={`task-checkbox-btn ${t.completed ? 'checked' : ''}`}
                    onClick={() => onToggleTask(t)}
                    aria-label={t.completed ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {t.completed ? <Check size={11} strokeWidth={3} /> : null}
                  </button>

                  <div className="task-item-content">
                    <span className={`task-item-title ${t.completed ? 'strikethrough' : ''}`}>
                      {t.title}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Open App Action Button */}
        <button
          type="button"
          className="btn-primary-pill"
          style={{
            width: '100%',
            justifyContent: 'center',
            background: 'var(--accent-purple-btn)',
            color: 'var(--text-on-accent)',
            fontWeight: 700,
            padding: '8px 16px',
            fontSize: 12.5,
            marginTop: 4
          }}
          onClick={onExpandApp}
        >
          <ExternalLink size={13} /> Open App
        </button>
      </div>
    )
  }

  // ================= FULL APPLICATION DASHBOARD LAYOUT =================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Banner Row: Greeting + Inspiration Card */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, alignItems: 'stretch' }}>
        {/* Left: Greeting & Date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            {greeting}
          </h1>
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            {formattedDate} • Week {weekNumber}
          </span>
        </div>

        {/* Right: Motivation Card */}
        <div
          style={{
            background: 'var(--bg-quote)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>You're doing great!</span>
              <Sparkles size={13} color="var(--accent-purple)" />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
              Keep going, your goals are within reach.
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6, color: 'var(--accent-purple)' }}>
            <Heart size={14} fill="var(--accent-purple)" color="var(--accent-purple)" />
          </div>
        </div>
      </div>

      {/* Smart Free-Time Suggestion Banner */}
      <FreeTimeBanner
        today={today}
        isCompact={false}
        onOpenTask={onOpenTaskDetails}
        onOpenCreateTask={onOpenTaskModal}
        onRefreshTasks={onRefreshTasks || (async () => {})}
        onShowMessage={onShowMessage || (() => {})}
      />

      {/* Next Class Hero Card */}
      <div className="app-card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span className="section-sublabel">Next Class</span>
          <button
            type="button"
            className="link-action"
            onClick={() => onNavigate('timetable')}
            style={{ fontSize: 11 }}
          >
            Full Timetable &gt;
          </button>
        </div>

        {nextSubject ? (
          <div
            className="next-class-card"
            style={{ padding: '10px 14px' }}
            onClick={() => onNavigate('timetable')}
          >
            <div className="next-class-icon" style={{ width: 34, height: 34 }}>
              <BookOpen size={16} />
            </div>

            <div className="next-class-info" style={{ flex: 1 }}>
              <span className="next-class-title" style={{ fontSize: 14 }}>{nextSubject.title}</span>
              <span className="next-class-time" style={{ fontSize: 12 }}>
                {nextSubject.start_time} {nextSubject.end_time ? `– ${nextSubject.end_time}` : ''}
                {nextSubject.room ? ` • ${nextSubject.room}` : ''}
              </span>
            </div>

            <button
              type="button"
              className="btn-secondary-pill"
              style={{ padding: '4px 12px', fontSize: 11.5 }}
              onClick={e => {
                e.stopPropagation()
                onNavigate('timetable')
              }}
            >
              View
            </button>
          </div>
        ) : (
          <div
            className="next-class-card empty"
            style={{ cursor: 'pointer', padding: '14px', fontSize: 12 }}
            onClick={onOpenClassModal}
          >
            No upcoming classes scheduled for today • Click to add a subject
          </div>
        )}
      </div>

      {/* 2-Column Grid: Today's Schedule + Today's Tasks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* ================= LEFT COLUMN: TODAY'S SCHEDULE ================= */}
        <div className="app-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="section-sublabel" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Today's Schedule
            </span>
            <button
              type="button"
              className="link-action"
              onClick={() => onNavigate('timetable')}
            >
              View All
            </button>
          </div>

          {todaysSubjects.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px 0', textAlign: 'center' }}>
              No classes scheduled for today. Enjoy your day!
            </div>
          ) : (
            <div className="classes-mini-list" style={{ gap: 6 }}>
              {todaysSubjects.map((c, i) => (
                <div
                  key={c.id || i}
                  className="class-mini-row"
                  style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card-inner)' }}
                >
                  <span className="class-mini-time" style={{ width: 85, fontSize: 11.5 }}>
                    {c.start_time} {c.end_time ? `– ${c.end_time}` : ''}
                  </span>
                  <span
                    className="class-dot"
                    style={{ background: DOT_COLORS[i % DOT_COLORS.length] }}
                  />
                  <span className="class-mini-subject" style={{ fontSize: 12, fontWeight: 600 }}>
                    {c.title}
                  </span>
                  {c.room && (
                    <span className="class-mini-room" style={{ fontSize: 11 }}>
                      {c.room}
                    </span>
                  )}
                  <ChevronRight size={13} color="var(--text-muted)" style={{ marginLeft: 'auto' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ================= RIGHT COLUMN: TODAY'S TASKS ================= */}
        <div className="app-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="section-sublabel" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Today's Tasks
            </span>
            <span className="tasks-count-text">
              {completedCount}/{todaysTasks.length} completed
            </span>
          </div>

          {/* Progress bar */}
          <div className="tasks-progress-bar">
            <div className="tasks-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>

          {/* Tasks List */}
          {todaysTasks.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px 0', textAlign: 'center' }}>
              No tasks due today. Click "+ Add Task" to schedule something!
            </div>
          ) : (
            <div className="tasks-mini-list" style={{ gap: 6 }}>
              {todaysTasks.slice(0, 5).map(t => {
                const priorityClass = t.priority === 'high' ? 'high' : t.priority === 'low' ? 'low' : 'medium'
                const priorityLabel = t.priority === 'high' ? 'High' : t.priority === 'low' ? 'Low' : 'Medium'

                return (
                  <div
                    key={t.id}
                    className="task-mini-item"
                    style={{ padding: '6px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card-inner)' }}
                  >
                    <button
                      type="button"
                      className={`task-checkbox-btn ${t.completed ? 'checked' : ''}`}
                      onClick={() => onToggleTask(t)}
                      aria-label={t.completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {t.completed ? <Check size={11} strokeWidth={3} /> : null}
                    </button>

                    <div className="task-item-content">
                      <span className={`task-item-title ${t.completed ? 'strikethrough' : ''}`} style={{ fontSize: 12 }}>
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
          <div className="tasks-bottom-row" style={{ marginTop: 'auto', paddingTop: 6 }}>
            <button type="button" className="btn-pill-action" onClick={onOpenTaskModal}>
              <Plus size={13} /> Add Task
            </button>
            <button
              type="button"
              className="link-action"
              onClick={() => onNavigate('tasks')}
            >
              View All
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
