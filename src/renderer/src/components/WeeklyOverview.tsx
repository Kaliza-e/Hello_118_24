import { useState, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Sparkles
} from 'lucide-react'
import { Task, ClassItem, WEEKDAYS, SHORT_DAYS, toDateKey } from '../types'

interface WeeklyOverviewProps {
  today: Date
  classes: ClassItem[]
  tasks: Task[]
  onNavigatePlan: () => void
  onOpenTaskModal: () => void
}

const DOT_COLORS = [
  'var(--dot-cyan)',
  'var(--dot-pink)',
  'var(--dot-blue)',
  'var(--dot-orange)',
  'var(--dot-purple)',
  'var(--dot-green)'
]

export function WeeklyOverview({
  today,
  classes,
  tasks,
  onNavigatePlan,
  onOpenTaskModal
}: WeeklyOverviewProps) {
  const [weekOffset, setWeekOffset] = useState(0)

  // Calculate 7 days for the selected week starting from Monday
  const { days, rangeLabel } = useMemo(() => {
    const currentDay = today.getDay()
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay
    const monday = new Date(today)
    monday.setDate(today.getDate() + diffToMonday + weekOffset * 7)

    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    const monStr = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const sunStr = sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    const list = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dIdx = d.getDay()
      const dKey = toDateKey(d)

      const dayClasses = classes
        .filter(c => c.weekday === dIdx)
        .sort((a, b) => a.start_time.localeCompare(b.start_time))

      const dayTasks = tasks.filter(t => t.due_date === dKey)

      list.push({
        date: d,
        dateKey: dKey,
        dayIdx: dIdx,
        shortName: SHORT_DAYS[dIdx],
        classes: dayClasses,
        tasks: dayTasks
      })
    }

    return { days: list, rangeLabel: `${monStr} – ${sunStr}` }
  }, [today, classes, tasks, weekOffset])

  // Incomplete tasks this week
  const incompleteTasksThisWeek = useMemo(() => {
    const weekDates = new Set(days.map(d => d.dateKey))
    return tasks.filter(t => !t.completed && t.due_date && weekDates.has(t.due_date)).length
  }, [days, tasks])

  const totalIncompleteTasks = useMemo(() => {
    return tasks.filter(t => !t.completed).length
  }, [tasks])

  // Upcoming deadlines (next active tasks)
  const upcomingDeadlines = useMemo(() => {
    const todayKey = toDateKey(today)
    return tasks
      .filter(t => !t.completed && t.due_date && t.due_date >= todayKey)
      .slice(0, 3)
  }, [tasks, today])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Header */}
      <div className="view-top-header">
        <h2 className="view-page-title">Weekly Overview</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
            {rangeLabel}
          </span>
          <div style={{ display: 'flex', gap: 2 }}>
            <button
              className="win-btn"
              style={{ width: 22, height: 22 }}
              onClick={() => setWeekOffset(v => v - 1)}
              title="Previous Week"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              className="win-btn"
              style={{ width: 22, height: 22 }}
              onClick={() => setWeekOffset(v => v + 1)}
              title="Next Week"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* 7-Day Dot Timeline Grid (Panel 4) */}
      <div
        className="app-card"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 8,
          minHeight: 180,
          padding: 14
        }}
      >
        {days.map((d, colIdx) => (
          <div
            key={d.dateKey}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              borderRight: colIdx < 6 ? '1px solid var(--border-subtle)' : 'none',
              paddingRight: colIdx < 6 ? 8 : 0
            }}
          >
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {d.shortName}
            </span>

            {/* Vertical Dot Timeline */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
                alignItems: 'center',
                flex: 1,
                paddingTop: 8
              }}
            >
              {d.classes.length === 0 ? (
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', marginTop: 12 }} />
              ) : (
                d.classes.map((c, i) => (
                  <div
                    key={c.id || i}
                    title={`${c.start_time} - ${c.title}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      cursor: 'pointer'
                    }}
                  >
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: DOT_COLORS[i % DOT_COLORS.length]
                      }}
                    />
                    <span style={{ fontSize: 8.5, color: 'var(--text-muted)' }}>
                      {c.start_time.slice(0, 2)}h
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom 3 Summary Cards Matching Panel 4 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {/* Card 1: Upcoming Deadlines */}
        <div className="app-card" style={{ padding: 12, gap: 8 }}>
          <span className="section-sublabel" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Upcoming Deadlines
          </span>

          {upcomingDeadlines.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No upcoming deadlines.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcomingDeadlines.map(t => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 11.5
                  }}
                >
                  <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
                    {t.title}
                  </span>
                  <span style={{ color: 'var(--priority-high-text)', fontSize: 10.5 }}>
                    {t.due_date ? t.due_date.slice(5) : 'Soon'} &gt;
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 2: Incomplete Tasks */}
        <div className="app-card" style={{ padding: 12, gap: 4 }}>
          <span className="section-sublabel" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Incomplete Tasks
          </span>

          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
            {totalIncompleteTasks} tasks
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {incompleteTasksThisWeek} this week
          </span>
        </div>

        {/* Card 3: Quick Actions */}
        <div className="app-card" style={{ padding: 12, gap: 8 }}>
          <span className="section-sublabel" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Quick Actions
          </span>

          <button
            className="btn-pill-action"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={onNavigatePlan}
          >
            <Calendar size={12} /> Plan Tomorrow
          </button>

          <button
            className="btn-pill-action"
            style={{ width: '100%', justifyContent: 'center', background: 'var(--btn-hover-bg)', color: 'var(--text-primary)' }}
            onClick={onOpenTaskModal}
          >
            <Plus size={12} /> Add Task
          </button>
        </div>
      </div>
    </div>
  )
}
