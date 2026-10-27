import { useState, useMemo } from 'react'
import {
  Plus,
  Check,
  MoreHorizontal,
  Edit2,
  Trash2,
  Clock
} from 'lucide-react'
import { Task, toDateKey } from '../types'
import { TaskModal } from './TaskModal'

interface TasksViewProps {
  tasks: Task[]
  today: Date
  onToggleTask: (task: Task) => void
  onDeleteTask: (id: number) => void
  onRefreshTasks: () => Promise<void>
  onShowMessage: (msg: string) => void
}

type FilterTab = 'all' | 'today' | 'tomorrow' | 'upcoming' | 'completed'

export function TasksView({
  tasks,
  today,
  onToggleTask,
  onDeleteTask,
  onRefreshTasks,
  onShowMessage
}: TasksViewProps) {
  const [filter, setFilter] = useState<FilterTab>('today')
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null)

  const todayKey = toDateKey(today)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const tomorrowKey = toDateKey(tomorrow)

  const in7Days = new Date(today)
  in7Days.setDate(today.getDate() + 7)
  const in7DaysKey = toDateKey(in7Days)

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filter === 'completed') return t.completed === 1
      if (filter === 'today') return t.due_date === todayKey || t.due_date === null
      if (filter === 'tomorrow') return t.due_date === tomorrowKey
      if (filter === 'upcoming') {
        return !t.completed && t.due_date && t.due_date >= todayKey && t.due_date <= in7DaysKey
      }
      return true
    })
  }, [tasks, filter, todayKey, tomorrowKey, in7DaysKey])

  async function handleSaveTask(data: any) {
    if (editingTask) {
      await window.hello11824.updateTask(editingTask.id, data)
      onShowMessage(`Updated "${data.title}"`)
    } else {
      await window.hello11824.addTask(data)
      onShowMessage(`Added "${data.title}"`)
    }
    await onRefreshTasks()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Header */}
      <div className="view-top-header">
        <h2 className="view-page-title">Tasks</h2>
        <button
          className="btn-primary-pill"
          onClick={() => {
            setEditingTask(null)
            setShowTaskModal(true)
          }}
        >
          <Plus size={13} /> Add Task
        </button>
      </div>

      {/* Filter Pills */}
      <div className="day-pills-row">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'today', label: 'Today' },
            { id: 'tomorrow', label: 'Tomorrow' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'completed', label: 'Completed' }
          ] as const
        ).map(tab => (
          <button
            key={tab.id}
            className={`day-pill-btn ${filter === tab.id ? 'active' : ''}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tasks Table */}
      <div className="data-table-container">
        {filteredTasks.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No tasks found in this view. Click "Add Task" to create one!
          </div>
        ) : (
          filteredTasks.map(t => {
            const priorityClass = t.priority === 'high' ? 'high' : t.priority === 'low' ? 'low' : 'medium'
            const priorityLabel = t.priority === 'high' ? 'High' : t.priority === 'low' ? 'Low' : 'Medium'
            const timeText = t.due_time ? `Today ${t.due_time}` : t.due_date ? t.due_date : 'Today'
            const isMenuOpen = activeMenuId === t.id

            return (
              <div
                key={t.id}
                className="table-row"
                style={{
                  gridTemplateColumns: 'auto 1fr auto auto 36px',
                  gap: 12,
                  position: 'relative'
                }}
              >
                {/* Checkbox */}
                <button
                  className={`task-checkbox-btn ${t.completed ? 'checked' : ''}`}
                  onClick={() => onToggleTask(t)}
                  aria-label={t.completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {t.completed ? <Check size={12} strokeWidth={3} /> : null}
                </button>

                {/* Title */}
                <span
                  style={{
                    color: t.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: t.completed ? 'line-through' : 'none',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {t.title}
                </span>

                {/* Priority & Duration Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifySelf: 'end' }}>
                  {t.estimated_minutes ? (
                    <span
                      className="duration-badge-pill"
                      title={`Estimated time: ${t.estimated_minutes} minutes`}
                    >
                      <Clock size={10} /> {t.estimated_minutes}m
                    </span>
                  ) : null}
                  <span className={`priority-badge-pill ${priorityClass}`}>
                    {priorityLabel}
                  </span>
                </div>

                {/* Due Time */}
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', justifySelf: 'end', minWidth: 80, textAlign: 'right' }}>
                  {timeText}
                </span>

                {/* 3-dots Menu Button */}
                <div style={{ position: 'relative', justifySelf: 'end' }}>
                  <button
                    className="win-btn"
                    style={{ width: 24, height: 24 }}
                    onClick={() => setActiveMenuId(isMenuOpen ? null : t.id)}
                  >
                    <MoreHorizontal size={14} color="var(--text-muted)" />
                  </button>

                  {isMenuOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 26,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-card)',
                        borderRadius: 8,
                        padding: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        zIndex: 30,
                        minWidth: 100,
                        boxShadow: 'var(--shadow-card)'
                      }}
                    >
                      <button
                        className="sidebar-nav-item"
                        style={{ padding: '5px 8px', fontSize: 11.5 }}
                        onClick={() => {
                          setActiveMenuId(null)
                          setEditingTask(t)
                          setShowTaskModal(true)
                        }}
                      >
                        <Edit2 size={11} /> Edit
                      </button>
                      <button
                        className="sidebar-nav-item"
                        style={{ padding: '5px 8px', fontSize: 11.5, color: 'var(--priority-high-text)' }}
                        onClick={() => {
                          setActiveMenuId(null)
                          onDeleteTask(t.id)
                        }}
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Task Modal */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        task={editingTask}
        defaultDate={todayKey}
        onSave={handleSaveTask}
      />
    </div>
  )
}
