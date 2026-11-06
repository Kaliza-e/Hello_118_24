import { useState, useEffect, useMemo } from 'react'
import {
  GraduationCap,
  AlertTriangle,
  Clock,
  Sparkles,
  Calendar,
  ChevronRight,
  BookOpen
} from 'lucide-react'
import { ScheduleEvent, Task, toDateKey } from '../types'

interface ExamCountdownCardProps {
  today: Date
  tasks: Task[]
  onNavigateSchedules: () => void
  onOpenRevisionPlan?: (examSubject: string, examDate: string) => void
}

export function ExamCountdownCard({
  today,
  tasks,
  onNavigateSchedules,
  onOpenRevisionPlan
}: ExamCountdownCardProps) {
  const [exams, setExams] = useState<ScheduleEvent[]>([])
  const todayKey = toDateKey(today)

  useEffect(() => {
    window.hello11824
      ?.listScheduleEvents?.({ category: 'Exams', isCompleted: false })
      .then(list => {
        if (list) {
          const upcoming = list
            .filter(ev => (ev.end_date || ev.start_date) >= todayKey)
            .sort((a, b) => a.start_date.localeCompare(b.start_date))
          setExams(upcoming)
        }
      })
      .catch(console.error)
  }, [todayKey])

  // Next upcoming exam
  const nextExam = exams[0] || null

  const daysRemaining = useMemo(() => {
    if (!nextExam) return null
    const [y, m, d] = nextExam.start_date.split('-').map(Number)
    const examDate = new Date(y, m - 1, d)
    const todayNorm = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const diffMs = examDate.getTime() - todayNorm.getTime()
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
  }, [nextExam, today])

  // Workload Warning: detect if >= 3 deadlines cluster in any 3-day window over the next 14 days
  const clusterWarning = useMemo<{ hasCluster: boolean; count: number; dateRange: string }>(() => {
    const horizonEnd = new Date(today)
    horizonEnd.setDate(today.getDate() + 14)
    const horizonEndKey = toDateKey(horizonEnd)

    const dateCounts: Record<string, number> = {}

    // Count tasks
    for (const t of tasks) {
      if (!t.completed && t.due_date && t.due_date >= todayKey && t.due_date <= horizonEndKey) {
        dateCounts[t.due_date] = (dateCounts[t.due_date] || 0) + 1
      }
    }

    // Count exams
    for (const ex of exams) {
      if (ex.start_date >= todayKey && ex.start_date <= horizonEndKey) {
        dateCounts[ex.start_date] = (dateCounts[ex.start_date] || 0) + 1
      }
    }

    const sortedDates = Object.keys(dateCounts).sort()
    for (let i = 0; i < sortedDates.length; i++) {
      const baseD = new Date(sortedDates[i])
      const windowEnd = new Date(baseD)
      windowEnd.setDate(baseD.getDate() + 2) // 3-day rolling window
      const winEndKey = toDateKey(windowEnd)

      let totalInWindow = 0
      for (const d of sortedDates) {
        if (d >= sortedDates[i] && d <= winEndKey) {
          totalInWindow += dateCounts[d]
        }
      }

      if (totalInWindow >= 3) {
        return {
          hasCluster: true,
          count: totalInWindow,
          dateRange: `${sortedDates[i].slice(5)} to ${winEndKey.slice(5)}`
        }
      }
    }

    return { hasCluster: false, count: 0, dateRange: '' }
  }, [tasks, exams, todayKey, today])

  if (!nextExam && !clusterWarning.hasCluster) {
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Clustered Workload Warning Banner */}
      {clusterWarning.hasCluster && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'var(--text-primary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: 600, color: '#f59e0b' }}>
                Clustered Deadlines Ahead: {clusterWarning.count} deadlines ({clusterWarning.dateRange})
              </span>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>
                Spread your revision topics over the next few days to stay balanced.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-secondary-pill"
            style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}
            onClick={onNavigateSchedules}
          >
            View Schedules
          </button>
        </div>
      )}

      {/* Exam Countdown Card */}
      {nextExam && (
        <div
          className="app-card"
          style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.12) 0%, rgba(244, 63, 94, 0.08) 100%)',
            border: '1px solid rgba(124, 58, 237, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(244, 63, 94, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <GraduationCap size={18} color="#f43f5e" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nextExam.title}
                </span>
                <span
                  className="priority-badge-pill high"
                  style={{ fontSize: 10, padding: '2px 7px', background: '#f43f5e', color: '#fff' }}
                >
                  {daysRemaining === 0 ? 'Today!' : daysRemaining === 1 ? 'Tomorrow!' : `${daysRemaining} days left`}
                </span>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📅 {nextExam.start_date}</span>
                {nextExam.start_time && <span>⏰ {nextExam.start_time}</span>}
                {nextExam.location && <span>📍 {nextExam.location}</span>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {onOpenRevisionPlan && (
              <button
                type="button"
                className="btn-primary-pill"
                style={{
                  background: 'var(--accent-purple-btn)',
                  fontSize: 11,
                  padding: '5px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                onClick={() => onOpenRevisionPlan(nextExam.title, nextExam.start_date)}
                title="Create structured revision plan for this exam"
              >
                <Sparkles size={11} /> Auto Revision Plan
              </button>
            )}
            <button
              type="button"
              className="win-btn"
              onClick={onNavigateSchedules}
              title="Open Schedules"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

