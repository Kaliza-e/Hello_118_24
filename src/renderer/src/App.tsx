import { useEffect, useState, useCallback } from 'react'
import {
  CalendarDays,
  ListTodo,
  Sparkles,
  BarChart3,
  Settings as SettingsIcon,
  Home,
  X
} from 'lucide-react'
import { Task, ClassItem, ActiveTab, toDateKey } from './types'
import { TitleBar } from './components/TitleBar'
import { TodayView } from './components/TodayView'
import { TimetableManager } from './components/TimetableManager'
import { TasksView } from './components/TasksView'
import { TomorrowPlanner } from './components/TomorrowPlanner'
import { WeeklyOverview } from './components/WeeklyOverview'
import { SettingsView } from './components/SettingsView'
import { TaskModal } from './components/TaskModal'
import { SubjectModal } from './components/SubjectModal'

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('today')
  const [tasks, setTasks] = useState<Task[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [pinned, setPinned] = useState(true)
  const [widgetMode, setWidgetMode] = useState<'compact' | 'standard'>('compact')
  const [message, setMessage] = useState('')
  const [today, setToday] = useState(new Date())

  // Update notification state
  const [downloadedUpdateVersion, setDownloadedUpdateVersion] = useState<string | null>(null)
  const [dismissedUpdatePrompt, setDismissedUpdatePrompt] = useState(false)

  // Modals
  const [showGlobalTaskModal, setShowGlobalTaskModal] = useState(false)
  const [showGlobalClassModal, setShowGlobalClassModal] = useState(false)

  // Dynamic live clock ticker
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setToday(new Date())
    }, 30_000)
    return () => clearInterval(clockTimer)
  }, [])

  // Initial data loading from SQLite / API
  const loadData = useCallback(async () => {
    try {
      const api = window.hello11824
      if (!api) return

      const [tList, cList, pinSetting, modeSetting] = await Promise.all([
        api.listTasks(),
        api.listClasses(),
        api.getSetting('pinned'),
        api.getSetting('widget_mode')
      ])

      setTasks(tList || [])
      setClasses(cList || [])

      if (pinSetting !== null && pinSetting !== undefined) {
        setPinned(pinSetting !== 'false')
      }
      if (modeSetting === 'compact' || modeSetting === 'standard') {
        setWidgetMode(modeSetting)
      }
    } catch (err) {
      console.error('Failed to load data:', err)
      setMessage('Could not load saved data. Restart Hello 118:24 and try again.')
    }
  }, [])

  useEffect(() => {
    loadData()

    const unsubMode = window.hello11824?.onModeChanged?.(() => {
      setWidgetMode(prev => (prev === 'compact' ? 'standard' : 'compact'))
    })

    const unsubPin = window.hello11824?.onPinnedChanged?.((next: boolean) => {
      setPinned(next)
    })

    const unsubUpdate = window.hello11824?.onUpdateStatusChanged?.(status => {
      if (status.state === 'downloaded' && status.availableVersion) {
        setDownloadedUpdateVersion(status.availableVersion)
      }
    })

    // Check initial status on mount
    window.hello11824?.getUpdateStatus?.().then(status => {
      if (status?.state === 'downloaded' && status.availableVersion) {
        setDownloadedUpdateVersion(status.availableVersion)
      }
    })

    return () => {
      unsubMode?.()
      unsubPin?.()
      unsubUpdate?.()
    }
  }, [loadData])

  const refreshTasks = useCallback(async () => {
    const updated = await window.hello11824.listTasks()
    setTasks(updated)
  }, [])

  const refreshClasses = useCallback(async () => {
    const updated = await window.hello11824.listClasses()
    setClasses(updated)
  }, [])

  const handleTogglePin = useCallback(async () => {
    const next = !pinned
    setPinned(next)
    await window.hello11824.togglePin(next)
  }, [pinned])

  const handleToggleMode = useCallback(async () => {
    const next = widgetMode === 'compact' ? 'standard' : 'compact'
    setWidgetMode(next)
    await window.hello11824.setMode(next)
  }, [widgetMode])

  const handleToggleTask = useCallback(
    async (task: Task) => {
      await window.hello11824.toggleTask(task.id, !task.completed)
      await refreshTasks()
    },
    [refreshTasks]
  )

  const handleDeleteTask = useCallback(
    async (id: number) => {
      await window.hello11824.deleteTask(id)
      await refreshTasks()
      setMessage('Task deleted.')
    },
    [refreshTasks]
  )

  const handleCreateTask = useCallback(
    async (taskData: any) => {
      await window.hello11824.addTask(taskData)
      await refreshTasks()
      setMessage(`Added "${taskData.title}"`)
    },
    [refreshTasks]
  )

  const handleCreateClass = useCallback(
    async (classData: any) => {
      await window.hello11824.addClass(classData)
      await refreshClasses()
      setMessage(`Added "${classData.title}" to timetable.`)
    },
    [refreshClasses]
  )

  const showCompactTodayWidget = widgetMode === 'compact' && activeTab === 'today'

  return (
    <div className={`widget-window mode-${widgetMode}`}>
      {/* Titlebar */}
      <TitleBar
        pinned={pinned}
        onTogglePin={handleTogglePin}
        widgetMode={widgetMode}
        onToggleMode={handleToggleMode}
      />

      {/* Main Container: Either Compact 2-Card Layout or Sidebar Dashboard Layout */}
      {showCompactTodayWidget ? (
        // ================= COMPACT FLOATING WIDGET VIEW (Top of Screenshot) =================
        <div className="widget-body-compact">
          {message && (
            <div
              style={{
                background: 'rgba(37, 99, 235, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11.5,
                color: '#fff'
              }}
            >
              <span>{message}</span>
              <button
                onClick={() => setMessage('')}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Side-by-Side Cards (Today's Schedule + Today's Tasks) */}
          <TodayView
            today={today}
            classes={classes}
            tasks={tasks}
            onToggleTask={handleToggleTask}
            onNavigate={setActiveTab}
            onOpenTaskModal={() => setShowGlobalTaskModal(true)}
            onOpenClassModal={() => setShowGlobalClassModal(true)}
          />

          {/* Bottom Pill Navigation Bar */}
          <nav className="widget-bottom-nav">
            <div className="nav-pill-group">
              <button
                className="nav-pill-btn"
                onClick={() => setActiveTab('timetable')}
              >
                <CalendarDays size={13} /> Timetable
              </button>

              <button
                className="nav-pill-btn"
                onClick={() => setActiveTab('tasks')}
              >
                <ListTodo size={13} /> Tasks
              </button>

              <button
                className="nav-pill-btn"
                onClick={() => setActiveTab('plan')}
              >
                <Sparkles size={13} /> Tomorrow
              </button>

              <button
                className="nav-pill-btn"
                onClick={() => setActiveTab('weekly')}
              >
                <BarChart3 size={13} /> Weekly
              </button>
            </div>

            <button
              className="nav-settings-btn"
              title="Settings"
              onClick={() => setActiveTab('settings')}
            >
              <SettingsIcon size={14} />
            </button>
          </nav>
        </div>
      ) : (
        // ================= EXPANDED DASHBOARD VIEW (Panels 1 to 6 in Screenshot) =================
        <div className="dashboard-layout">
          {/* Left Sidebar */}
          <aside className="dashboard-sidebar">
            <button
              className={`sidebar-nav-item ${activeTab === 'today' ? 'active' : ''}`}
              onClick={() => setActiveTab('today')}
            >
              <Home size={14} /> Home
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'timetable' ? 'active' : ''}`}
              onClick={() => setActiveTab('timetable')}
            >
              <CalendarDays size={14} /> Timetable
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
              onClick={() => setActiveTab('tasks')}
            >
              <ListTodo size={14} /> Tasks
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'plan' ? 'active' : ''}`}
              onClick={() => setActiveTab('plan')}
            >
              <Sparkles size={14} /> Tomorrow
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'weekly' ? 'active' : ''}`}
              onClick={() => setActiveTab('weekly')}
            >
              <BarChart3 size={14} /> Weekly
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <SettingsIcon size={14} /> Settings
            </button>
          </aside>

          {/* Right Main Content */}
          <main className="dashboard-main-area">
            {message && (
              <div
                style={{
                  background: 'rgba(37, 99, 235, 0.2)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: '#fff'
                }}
              >
                <span>{message}</span>
                <button
                  onClick={() => setMessage('')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {/* Ambient Update Downloaded Banner */}
            {downloadedUpdateVersion && !dismissedUpdatePrompt && (
              <div className="update-ambient-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={15} color="var(--accent-cyan)" />
                  <span>
                    <strong>Hello 118:24 v{downloadedUpdateVersion}</strong> is downloaded and ready to install.
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    className="btn-update-primary"
                    style={{ padding: '4px 10px', fontSize: 11 }}
                    onClick={() => window.hello11824.quitAndInstallUpdate()}
                  >
                    Restart & Install
                  </button>
                  <button
                    type="button"
                    className="btn-update-secondary"
                    style={{ padding: '4px 8px', fontSize: 11 }}
                    onClick={() => setDismissedUpdatePrompt(true)}
                  >
                    Later
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'today' && (
              <TodayView
                today={today}
                classes={classes}
                tasks={tasks}
                onToggleTask={handleToggleTask}
                onNavigate={setActiveTab}
                onOpenTaskModal={() => setShowGlobalTaskModal(true)}
                onOpenClassModal={() => setShowGlobalClassModal(true)}
              />
            )}

            {activeTab === 'timetable' && (
              <TimetableManager
                classes={classes}
                onRefreshClasses={refreshClasses}
                onShowMessage={setMessage}
              />
            )}

            {activeTab === 'tasks' && (
              <TasksView
                tasks={tasks}
                today={today}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
                onRefreshTasks={refreshTasks}
                onShowMessage={setMessage}
              />
            )}

            {activeTab === 'plan' && (
              <TomorrowPlanner
                today={today}
                classes={classes}
                tasks={tasks}
                onRefreshTasks={refreshTasks}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
                onShowMessage={setMessage}
              />
            )}

            {activeTab === 'weekly' && (
              <WeeklyOverview
                today={today}
                classes={classes}
                tasks={tasks}
                onNavigatePlan={() => setActiveTab('plan')}
                onOpenTaskModal={() => setShowGlobalTaskModal(true)}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                pinned={pinned}
                onTogglePin={handleTogglePin}
                widgetMode={widgetMode}
                onToggleMode={handleToggleMode}
                onRefreshAll={async () => {
                  await Promise.all([refreshTasks(), refreshClasses()])
                }}
                onShowMessage={setMessage}
              />
            )}
          </main>
        </div>
      )}

      {/* Global Add Task Modal */}
      <TaskModal
        isOpen={showGlobalTaskModal}
        onClose={() => setShowGlobalTaskModal(false)}
        defaultDate={toDateKey(today)}
        onSave={handleCreateTask}
      />

      {/* Global Add Subject Modal */}
      <SubjectModal
        isOpen={showGlobalClassModal}
        onClose={() => setShowGlobalClassModal(false)}
        defaultWeekday={today.getDay()}
        onSave={handleCreateClass}
      />
    </div>
  )
}
