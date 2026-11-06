import { useState, useMemo, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Sparkles,
  Clock,
  Play,
  BarChart2,
  CheckCircle2,
  Target
} from 'lucide-react'
import { Task, ClassItem, WEEKDAYS, SHORT_DAYS, toDateKey, WeeklyStudyStats } from '../types'
import { WeeklyReflectionModal } from './WeeklyReflectionModal'

interface WeeklyOverviewProps {
  today: Date
  classes: ClassItem[]
  tasks: Task[]
  onNavigatePlan: () => void
  onOpenTaskModal: () => void
  onOpenFocusTimer?: (task: Task) => void
  onScheduleTask?: (task: Task) => void
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
  onOpenTaskModal,
  onOpenFocusTimer,
  onScheduleTask
}: WeeklyOverviewProps) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [studyStats, setStudyStats] = useState<WeeklyStudyStats | null>(null)
  const [isReflectionModalOpen, setIsReflectionModalOpen] = useState(false)

  // Calculate 7 days for the selected week starting from Monday
  const { days, rangeLabel, mondayKey, sundayKey } = useMemo(() => {
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
      const scheduledTasks = tasks.filter(t => t.scheduled_date === dKey)

      list.push({
        date: d,
        dateKey: dKey,
        dayIdx: dIdx,
        shortName: SHORT_DAYS[dIdx],
        classes: dayClasses,
        tasks: dayTasks,
        scheduledTasks
      })
    }

    return {
      days: list,
      rangeLabel: `${monStr} – ${sunStr}`,
      mondayKey: toDateKey(monday),
      sundayKey: toDateKey(sunday)
    }
  }, [today, classes, tasks, weekOffset])

  // Fetch weekly study stats for planned vs actual and daily study time
  useEffect(() => {
    let cancelled = false
    window.hello11824
      ?.getWeeklyStudyStats?.(mondayKey, sundayKey)
      .then(stats => {
        if (!cancelled && stats) {
          setStudyStats(stats)
        }
      })
      .catch(err => {
        console.error('Failed to load study stats:', err)
      })

    return () => {
      cancelled = true
    }
  }, [mondayKey, sundayKey, tasks])

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

  // Max daily study seconds for chart scaling
  const maxStudySeconds = useMemo(() => {
    if (!studyStats?.dailyStudiedSeconds) return 3600
    const vals = Object.values(studyStats.dailyStudiedSeconds)
    const max = Math.max(...vals, 0)
    return Math.max(max, 3600) // at least 1h scale
  }, [studyStats])

  const actualMinutes = studyStats?.actualMinutes ?? Math.round((studyStats?.totalStudiedSeconds || 0) / 60)
  const plannedMinutes = studyStats?.plannedMinutes || 0
  const adherencePercent = plannedMinutes > 0 ? Math.min(100, Math.round((actualMinutes / plannedMinutes) * 100)) : (actualMinutes > 0 ? 100 : 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Header */}
      <div className="view-top-header">
        <h2 className="view-page-title">Weekly Overview</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="btn-primary-pill"
            style={{ background: 'var(--accent-purple-btn)', fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => setIsReflectionModalOpen(true)}
            title="View weekly study reflection, subject breakdown, and encouraging badges"
          >
            <Sparkles size={11} /> Reflection Report
          </button>
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

      {/* 7-Day Timeline Grid (Classes & Scheduled Tasks) */}
      <div
        className="app-card"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 8,
          minHeight: 190,
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
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: d.dateKey === toDateKey(today) ? 'var(--accent-purple)' : 'var(--text-secondary)'
              }}
            >
              {d.shortName}
            </span>

            {/* Vertical Dot Timeline for Classes */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                alignItems: 'center',
                flex: 1,
                paddingTop: 4,
                width: '100%'
              }}
            >
              {d.classes.length === 0 ? (
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', marginTop: 8 }} />
              ) : (
                d.classes.map((c, i) => (
                  <div
                    key={c.id || i}
                    title={`${c.start_time} - ${c.title}${c.room ? ` (Room: ${c.room})` : ''}`}
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

              {/* Scheduled Tasks for this Day */}
              {d.scheduledTasks.length > 0 && (
                <div
                  style={{
                    marginTop: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    width: '100%',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontSize: 8, color: 'var(--accent-purple)', fontWeight: 600 }}>TASKS</span>
                  {d.scheduledTasks.map(st => (
                    <div
                      key={st.id}
                      onClick={() => onOpenFocusTimer?.(st)}
                      title={`Scheduled: ${st.scheduled_time || 'Anytime'} - ${st.title} (Click to focus)`}
                      style={{
                        fontSize: 9.5,
                        padding: '2px 4px',
                        borderRadius: 4,
                        background: st.completed ? 'var(--bg-card-inner)' : 'var(--accent-purple-bg)',
                        border: '1px solid var(--border-focus)',
                        color: st.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                        textAlign: 'center',
                        width: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer'
                      }}
                    >
                      {st.scheduled_time ? `${st.scheduled_time} ` : ''}{st.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Phase 2: Time Studied Per Day & Planned vs Actual Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Time Studied Per Day Bar Chart */}
        <div className="app-card" style={{ padding: 12, gap: 10, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="section-sublabel" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <BarChart2 size={13} color="var(--accent-purple)" /> Time Studied Per Day
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-purple)' }}>
              {Math.floor(actualMinutes / 60)}h {actualMinutes % 60}m total
            </span>
          </div>

          {/* Daily Bar Chart */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, alignItems: 'flex-end', height: 80, paddingTop: 8 }}>
            {days.map(d => {
              const sec = studyStats?.dailyStudiedSeconds?.[d.dateKey] || 0
              const mins = Math.round(sec / 60)
              const heightPercent = maxStudySeconds > 0 ? Math.max(8, Math.round((sec / maxStudySeconds) * 100)) : 8

              return (
                <div key={d.dateKey} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                  <div
                    title={`${d.shortName}: ${mins} min studied`}
                    style={{
                      width: '75%',
                      height: `${heightPercent}%`,
                      background: sec > 0 ? 'var(--accent-purple-btn)' : 'var(--border-subtle)',
                      borderRadius: '3px 3px 0 0',
                      transition: 'height 0.3s ease'
                    }}
                  />
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{d.shortName}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Planned vs Actual Metrics */}
        <div className="app-card" style={{ padding: 12, gap: 10, display: 'flex', flexDirection: 'column' }}>
          <span className="section-sublabel" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Target size={13} color="var(--accent-purple)" /> Planned vs Actual Study
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 2 }}>
            <div style={{ background: 'var(--bg-card-inner)', padding: '8px 10px', borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Planned</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {Math.floor(plannedMinutes / 60)}h {plannedMinutes % 60}m
              </div>
            </div>

            <div style={{ background: 'var(--bg-card-inner)', padding: '8px 10px', borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Actual Studied</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-cyan)' }}>
                {Math.floor(actualMinutes / 60)}h {actualMinutes % 60}m
              </div>
            </div>
          </div>

          {/* Adherence progress bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-secondary)' }}>
              <span>Plan Progress</span>
              <span style={{ fontWeight: 600, color: 'var(--accent-purple)' }}>{adherencePercent}%</span>
            </div>
            <div className="tasks-progress-bar" style={{ height: 6 }}>
              <div className="tasks-progress-fill" style={{ width: `${adherencePercent}%`, background: 'var(--accent-purple-btn)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom 3 Summary Cards */}
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

      {/* Weekly Reflection Report Modal */}
      <WeeklyReflectionModal
        isOpen={isReflectionModalOpen}
        onClose={() => setIsReflectionModalOpen(false)}
        startDate={mondayKey}
        endDate={sundayKey}
      />
    </div>
  )
}
