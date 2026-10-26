import { useState, useEffect, useCallback } from 'react'
import {
  Sparkles,
  Clock,
  CheckCircle2,
  ExternalLink,
  BellOff,
  X,
  Plus
} from 'lucide-react'
import type { Task, FreeTimeSuggestion } from '../types'

interface FreeTimeBannerProps {
  today: Date
  isCompact?: boolean
  onOpenTask?: (task: Task) => void
  onOpenCreateTask?: () => void
  onRefreshTasks: () => Promise<void>
  onShowMessage: (msg: string) => void
}

export function FreeTimeBanner({
  today,
  isCompact = false,
  onOpenTask,
  onOpenCreateTask,
  onRefreshTasks,
  onShowMessage
}: FreeTimeBannerProps) {
  const [suggestion, setSuggestion] = useState<FreeTimeSuggestion | null>(null)
  const [loadingAction, setLoadingAction] = useState(false)

  const fetchSuggestion = useCallback(async () => {
    try {
      if (!window.hello11824?.getFreeTimeSuggestion) return
      const res = await window.hello11824.getFreeTimeSuggestion()
      setSuggestion(res)
    } catch (err) {
      console.error('Failed to get free-time suggestion:', err)
    }
  }, [])

  useEffect(() => {
    fetchSuggestion()
    // Poll every 25 seconds for smooth time tracking
    const interval = setInterval(fetchSuggestion, 25_000)
    return () => clearInterval(interval)
  }, [fetchSuggestion, today])

  if (!suggestion || !suggestion.hasFreeTime || suggestion.isSnoozed) {
    return null
  }

  const { freeMinutes, freeUntil, nextEventTitle, slotKey, suggestedTask } = suggestion

  async function handleCompleteTask() {
    if (!suggestedTask) return
    setLoadingAction(true)
    try {
      await window.hello11824.completeSuggestedTask(suggestedTask.id)
      onShowMessage(`Completed "${suggestedTask.title}"! Great job making use of free time.`)
      await onRefreshTasks()
      await fetchSuggestion()
    } catch (err) {
      onShowMessage(`Failed to complete task: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoadingAction(false)
    }
  }

  async function handleSnooze() {
    setLoadingAction(true)
    try {
      await window.hello11824.snoozeFreeTimeReminder(15)
      setSuggestion(prev => (prev ? { ...prev, isSnoozed: true } : null))
      onShowMessage('Free time reminder snoozed for 15 minutes.')
    } finally {
      setLoadingAction(false)
    }
  }

  async function handleDismiss() {
    if (!slotKey) return
    setLoadingAction(true)
    try {
      await window.hello11824.dismissFreeTimeReminder(slotKey)
      setSuggestion(null)
      onShowMessage('Free time reminder dismissed for this period.')
    } finally {
      setLoadingAction(false)
    }
  }

  const priorityLabel =
    suggestedTask?.priority === 'high'
      ? 'High'
      : suggestedTask?.priority === 'low'
        ? 'Low'
        : 'Normal'
  const priorityClass =
    suggestedTask?.priority === 'high'
      ? 'high'
      : suggestedTask?.priority === 'low'
        ? 'low'
        : 'medium'

  // ================= COMPACT WIDGET VIEW =================
  if (isCompact) {
    return (
      <div className="compact-free-time-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="free-time-live-dot" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-purple)' }}>
              {freeMinutes}m Free
            </span>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
              until {freeUntil}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              type="button"
              className="win-btn-tiny"
              title="Snooze 15 minutes"
              onClick={handleSnooze}
              disabled={loadingAction}
            >
              <BellOff size={11} />
            </button>
            <button
              type="button"
              className="win-btn-tiny"
              title="Dismiss reminder"
              onClick={handleDismiss}
              disabled={loadingAction}
            >
              <X size={11} />
            </button>
          </div>
        </div>

        {suggestedTask ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title={suggestedTask.title}
            >
              💡 {suggestedTask.title}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="btn-tiny-action complete"
                onClick={handleCompleteTask}
                disabled={loadingAction}
                title="Mark task completed"
              >
                <CheckCircle2 size={11} /> Done
              </button>
              {onOpenTask && (
                <button
                  type="button"
                  className="btn-tiny-action"
                  onClick={() => onOpenTask(suggestedTask)}
                  title="Open task details"
                >
                  <ExternalLink size={10} /> Open
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Want to plan something?
            </span>
            {onOpenCreateTask && (
              <button
                type="button"
                className="btn-tiny-action"
                onClick={onOpenCreateTask}
              >
                <Plus size={10} /> Plan
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  // ================= FULL DASHBOARD VIEW =================
  return (
    <div className="free-time-banner">
      {/* Top Header Tag Row */}
      <div className="free-time-header">
        <div className="free-time-tag-badge">
          <span className="free-time-pulse-dot" />
          <Sparkles size={13} color="var(--accent-purple)" />
          <span>FREE TIME PROGRESS OPPORTUNITY</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="btn-free-time-tool"
            onClick={handleSnooze}
            disabled={loadingAction}
            title="Snooze reminder for 15 minutes"
          >
            <BellOff size={12} /> Snooze 15m
          </button>
          <button
            type="button"
            className="btn-free-time-tool close"
            onClick={handleDismiss}
            disabled={loadingAction}
            title="Dismiss reminder for this free period"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="free-time-body">
        <div className="free-time-lead">
          <span className="free-time-minutes-highlight">
            {freeMinutes} minutes free
          </span>{' '}
          until <strong>{freeUntil}</strong>
          {nextEventTitle ? (
            <span className="free-time-next-badge">Next: {nextEventTitle}</span>
          ) : null}
        </div>

        {suggestedTask ? (
          <div className="free-time-task-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <button
                type="button"
                className="task-checkbox-btn"
                onClick={handleCompleteTask}
                disabled={loadingAction}
                aria-label="Mark task completed"
                title="Mark completed"
              >
                <CheckCircle2 size={13} />
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {suggestedTask.title}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {suggestedTask.estimated_minutes ? (
                    <span className="duration-badge-pill">
                      <Clock size={10} /> {suggestedTask.estimated_minutes} min
                    </span>
                  ) : (
                    <span className="duration-badge-pill">
                      <Clock size={10} /> Fits available time
                    </span>
                  )}
                  <span className={`priority-badge-pill ${priorityClass}`}>
                    {priorityLabel} Priority
                  </span>
                  {suggestedTask.category && (
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                      • {suggestedTask.category}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                className="btn-primary-pill"
                style={{
                  padding: '6px 14px',
                  fontSize: 11.5,
                  background: 'var(--accent-purple-btn)',
                  color: 'var(--text-on-accent)',
                  fontWeight: 600
                }}
                onClick={handleCompleteTask}
                disabled={loadingAction}
              >
                <CheckCircle2 size={12} /> Mark Completed
              </button>

              {onOpenTask && (
                <button
                  type="button"
                  className="btn-secondary-pill"
                  style={{ padding: '6px 12px', fontSize: 11.5 }}
                  onClick={() => onOpenTask(suggestedTask)}
                >
                  <ExternalLink size={12} /> Open Task
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="free-time-empty-card">
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              No pending tasks fit this slot. Want to plan something for this time?
            </span>
            {onOpenCreateTask && (
              <button
                type="button"
                className="btn-pill-action"
                onClick={onOpenCreateTask}
                style={{ padding: '5px 12px', fontSize: 11.5 }}
              >
                <Plus size={12} /> Plan a Task
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
