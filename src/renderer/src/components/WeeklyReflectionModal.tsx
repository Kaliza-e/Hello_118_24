import { useState, useEffect } from 'react'
import {
  X,
  Sparkles,
  Trophy,
  Flame,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Clock
} from 'lucide-react'
import { WeeklyReflectionReport, UserStreakAndBadges, toDateKey } from '../types'

interface WeeklyReflectionModalProps {
  isOpen: boolean
  onClose: () => void
  startDate: string
  endDate: string
}

export function WeeklyReflectionModal({
  isOpen,
  onClose,
  startDate,
  endDate
}: WeeklyReflectionModalProps) {
  if (!isOpen) return null

  const [report, setReport] = useState<WeeklyReflectionReport | null>(null)
  const [streakData, setStreakData] = useState<UserStreakAndBadges | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      window.hello11824?.getWeeklyReflectionReport?.(startDate, endDate),
      window.hello11824?.getUserStreakAndBadges?.()
    ])
      .then(([rep, str]) => {
        if (rep) setReport(rep)
        if (str) setStreakData(str)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [startDate, endDate])

  const maxSubjectSeconds = report?.subjectHours
    ? Math.max(...report.subjectHours.map(s => s.hours * 60 + s.minutes), 60)
    : 60

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ width: 560, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="var(--accent-purple)" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Weekly Reflection Report</span>
          </div>
          <button className="win-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
              Compiling your weekly reflection...
            </div>
          ) : report ? (
            <>
              {/* Summary Stats Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div style={{ background: 'var(--bg-card-inner)', padding: 10, borderRadius: 8 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Total Study Time</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-purple)', marginTop: 2 }}>
                    {Math.floor(report.totalStudyMinutes / 60)}h {report.totalStudyMinutes % 60}m
                  </div>
                </div>

                <div style={{ background: 'var(--bg-card-inner)', padding: 10, borderRadius: 8 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Tasks Done</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-cyan)', marginTop: 2 }}>
                    {report.totalTasksDone} completed
                  </div>
                </div>

                <div style={{ background: 'var(--bg-card-inner)', padding: 10, borderRadius: 8 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Streak</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--dot-orange)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Flame size={15} fill="var(--dot-orange)" />
                    <span>{streakData?.currentStreakDays || 1} Days</span>
                  </div>
                </div>
              </div>

              {/* Hours per Subject Breakdown */}
              <div style={{ background: 'var(--bg-card-inner)', padding: 12, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Hours Studied per Subject
                </span>

                {report.subjectHours.length === 0 ? (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                    No recorded study sessions during this week.
                  </span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {report.subjectHours.map(s => {
                      const totalM = s.hours * 60 + s.minutes
                      const percent = Math.min(100, Math.round((totalM / maxSubjectSeconds) * 100))

                      return (
                        <div key={s.subject} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{s.subject}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{s.hours}h {s.minutes}m</span>
                          </div>
                          <div className="tasks-progress-bar" style={{ height: 5 }}>
                            <div className="tasks-progress-fill" style={{ width: `${percent}%`, background: 'var(--accent-purple-btn)' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Best Day & Encouraging Suggestion */}
              <div style={{ background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(6, 182, 212, 0.08) 100%)', border: '1px solid rgba(124, 58, 237, 0.25)', padding: 12, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {report.bestDay && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--accent-purple)' }}>
                    <Trophy size={14} />
                    <span>Best Study Day: {report.bestDay.dayName} ({Math.floor(report.bestDay.minutes / 60)}h {report.bestDay.minutes % 60}m)</span>
                  </div>
                )}
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  💡 <strong>Coach Suggestion:</strong> {report.suggestion}
                </p>
              </div>

              {/* Gentle Badges Section (Never guilt-inducing) */}
              {streakData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Gentle Badges & Milestones
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                    {streakData.badges.map(b => (
                      <div
                        key={b.id}
                        style={{
                          background: b.unlocked ? 'var(--bg-card-inner)' : 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${b.unlocked ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
                          borderRadius: 8,
                          padding: '8px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          opacity: b.unlocked ? 1 : 0.45
                        }}
                      >
                        <span style={{ fontSize: 18 }}>{b.icon}</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: b.unlocked ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {b.title}
                          </span>
                          <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
                            {b.unlocked ? 'Unlocked' : 'In Progress'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 16px' }}>
          <button type="button" className="btn-primary-pill" onClick={onClose} style={{ background: 'var(--accent-purple-btn)' }}>
            Close Report
          </button>
        </div>
      </div>
    </div>
  )
}

