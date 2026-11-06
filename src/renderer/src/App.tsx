import { useEffect, useState, useCallback } from 'react'
import {
  CalendarDays,
  ListTodo,
  Sparkles,
  BarChart3,
  Settings as SettingsIcon,
  Home,
  X,
  Heart,
  CalendarCheck
} from 'lucide-react'
import { Task, ClassItem, ActiveTab, toDateKey } from './types'
import { TitleBar } from './components/TitleBar'
import { TodayView } from './components/TodayView'
import { TimetableManager } from './components/TimetableManager'
import { SchedulesView } from './components/SchedulesView'
import { TasksView } from './components/TasksView'
import { TomorrowPlanner } from './components/TomorrowPlanner'
import { WeeklyOverview } from './components/WeeklyOverview'
import { SettingsView } from './components/SettingsView'
import { TaskModal } from './components/TaskModal'
import { SubjectModal } from './components/SubjectModal'
import { FocusViewModal } from './components/FocusViewModal'
import { ScheduleTaskModal } from './components/ScheduleTaskModal'
import { ScheduleCreatorModal } from './components/ScheduleCreatorModal'

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('today')
  const [tasks, setTasks] = useState<Task[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [pinned, setPinned] = useState(true)
  const [widgetMode, setWidgetMode] = useState<'compact' | 'standard'>('compact')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [message, setMessage] = useState('')
  const [today, setToday] = useState(new Date())

  // Modals & Active Focus
  const [showGlobalTaskModal, setShowGlobalTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showGlobalClassModal, setShowGlobalClassModal] = useState(false)
  const [focusTask, setFocusTask] = useState<Task | null>(null)
  const [schedulingTask, setSchedulingTask] = useState<Task | null>(null)
  const [scheduleCreatorParams, setScheduleCreatorParams] = useState<{
    isOpen: boolean
    template?: 'study_plan' | 'exam_prep' | 'weekly_plan' | 'custom'
    subject?: string
    date?: string
  }>({ isOpen: false })

  // 60-Second Undo Toast State
  const [undoTask, setUndoTask] = useState<{
    task: Task
    timeSpentSeconds: number
    timerId: any
  } | null>(null)

  // Dynamic live clock ticker
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setToday(new Date())
    }, 15_000)
    return () => clearInterval(clockTimer)
  }, [])

  // Initial data loading from SQLite
  const loadData = useCallback(async () => {
    try {
      const api = window.hello11824
      if (!api) return

      const [tList, cList, pinSetting, modeSetting, themeSetting] = await Promise.all([
        api.listTasks(),
        api.listClasses(),
        api.getSetting('pinned'),
        api.getSetting('widget_mode'),
        api.getSetting('theme')
      ])

      setTasks(tList || [])
      setClasses(cList || [])

      if (pinSetting !== null && pinSetting !== undefined) {
        setPinned(pinSetting !== 'false')
      }
      if (modeSetting === 'compact' || modeSetting === 'standard') {
        setWidgetMode(modeSetting)
      }
      if (themeSetting === 'light' || themeSetting === 'dark') {
        setTheme(themeSetting)
        document.documentElement.setAttribute('data-theme', themeSetting)
      } else {
        document.documentElement.setAttribute('data-theme', 'dark')
      }
    } catch (err) {
      console.error('Failed to load data:', err)
      setMessage('Could not load saved data. Restart Hello 118:24 and try again.')
    }
  }, [])

  useEffect(() => {
    loadData()

    const unsubMode = window.hello11824?.onModeChanged?.((mode?: 'compact' | 'standard') => {
      if (mode) {
        setWidgetMode(mode)
      } else {
        setWidgetMode(prev => (prev === 'compact' ? 'standard' : 'compact'))
      }
    })

    const unsubPin = window.hello11824?.onPinnedChanged?.((next: boolean) => {
      setPinned(next)
    })

    return () => {
      unsubMode?.()
      unsubPin?.()
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

  const handleToggleTheme = useCallback(async () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    await window.hello11824.setSetting('theme', next)
  }, [theme])

  const handleSetTheme = useCallback(async (newTheme: 'dark' | 'light') => {
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    await window.hello11824.setSetting('theme', newTheme)
  }, [])

  const handleToggleTask = useCallback(
    async (task: Task) => {
      const nextCompleted = !Boolean(task.completed)
      await window.hello11824.toggleTask(task.id, nextCompleted)
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

  const handleOpenTaskForEdit = useCallback((task: Task) => {
    setEditingTask(task)
    setShowGlobalTaskModal(true)
  }, [])

  const handleSaveGlobalTask = useCallback(
    async (taskData: any) => {
      if (editingTask) {
        await window.hello11824.updateTask(editingTask.id, taskData)
        setMessage(`Updated "${taskData.title}"`)
      } else {
        await window.hello11824.addTask(taskData)
        setMessage(`Added "${taskData.title}"`)
      }
      setEditingTask(null)
      await refreshTasks()
    },
    [editingTask, refreshTasks]
  )

  const handleCreateClass = useCallback(
    async (classData: any) => {
      await window.hello11824.addClass(classData)
      await refreshClasses()
      setMessage(`Added "${classData.title}" to timetable.`)
    },
    [refreshClasses]
  )

  const handleScheduleTaskSave = useCallback(
    async (taskId: number, date: string, time?: string, durationMinutes?: number) => {
      await window.hello11824.scheduleTask(taskId, date, time, durationMinutes)
      setSchedulingTask(null)
      await refreshTasks()
      setMessage('Task scheduled into timetable slot.')
    },
    [refreshTasks]
  )

  const handleTaskCompleted = useCallback(
    async (task: Task, timeSpentSeconds: number) => {
      await refreshTasks()
      if (undoTask?.timerId) {
        clearTimeout(undoTask.timerId)
      }
      const timerId = setTimeout(() => {
        setUndoTask(null)
      }, 60_000)
      setUndoTask({ task, timeSpentSeconds, timerId })
      const mins = Math.round(timeSpentSeconds / 60)
      setMessage(`Completed "${task.title}" (${mins}m studied).`)
    },
    [refreshTasks, undoTask]
  )

  const handleUndoDone = useCallback(async () => {
    if (!undoTask) return
    if (undoTask.timerId) clearTimeout(undoTask.timerId)
    await window.hello11824.undoMarkTaskDone(undoTask.task.id)
    await refreshTasks()
    setMessage(`Restored "${undoTask.task.title}" to active tasks.`)
    setUndoTask(null)
  }, [undoTask, refreshTasks])

  function handleOpenRevisionPlan(examSubject: string, examDate: string) {
    setScheduleCreatorParams({
      isOpen: true,
      template: 'exam_prep',
      subject: examSubject,
      date: examDate
    })
  }

  const isCompactMode = widgetMode === 'compact'

  return (
    <div className={`widget-window mode-${widgetMode}`} data-theme={theme}>
      {/* Titlebar with real brand icon and theme switcher */}
      <TitleBar
        pinned={pinned}
        onTogglePin={handleTogglePin}
        widgetMode={widgetMode}
        onToggleMode={handleToggleMode}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Container: Compact Floating Widget or Full Application Dashboard */}
      {isCompactMode ? (
        // ================= COMPACT FLOATING WIDGET VIEW =================
        <div className="widget-body-compact">
          {undoTask && (
            <div
              style={{
                background: 'rgba(124, 58, 237, 0.2)',
                border: '1px solid var(--accent-purple)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11.5,
                color: 'var(--text-primary)'
              }}
            >
              <span>Done: <strong>{undoTask.task.title}</strong></span>
              <button
                type="button"
                className="btn-primary-pill"
                style={{ padding: '2px 8px', fontSize: 10.5, background: 'var(--accent-purple-btn)' }}
                onClick={handleUndoDone}
              >
                Undo
              </button>
            </div>
          )}

          {message && (
            <div
              style={{
                background: 'var(--accent-purple-bg)',
                border: '1px solid var(--border-focus)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11.5,
                color: 'var(--text-primary)'
              }}
            >
              <span>{message}</span>
              <button
                type="button"
                onClick={() => setMessage('')}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          <TodayView
            today={today}
            classes={classes}
            tasks={tasks}
            isCompact={true}
            onToggleTask={handleToggleTask}
            onNavigate={tab => {
              setActiveTab(tab)
              handleToggleMode()
            }}
            onOpenTaskModal={() => {
              setEditingTask(null)
              setShowGlobalTaskModal(true)
            }}
            onOpenClassModal={() => setShowGlobalClassModal(true)}
            onExpandApp={handleToggleMode}
            onOpenTaskDetails={handleOpenTaskForEdit}
            onRefreshTasks={refreshTasks}
            onShowMessage={setMessage}
            onOpenFocusTimer={task => setFocusTask(task)}
            onScheduleTask={task => setSchedulingTask(task)}
            onOpenRevisionPlan={handleOpenRevisionPlan}
          />
        </div>
      ) : (
        // ================= FULL APPLICATION DASHBOARD VIEW =================
        <div className="dashboard-layout">
          {/* Left Sidebar without duplicate stacked branding */}
          <aside className="dashboard-sidebar">
            {/* Motivational Quote in Sidebar with Tagline */}
            <div className="sidebar-quote-card">
              <span className="sidebar-quote-tag">Plan • Study • Achieve</span>
              <p>“Small steps every day create big results.”</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <Heart size={12} fill="var(--accent-purple)" color="var(--accent-purple)" />
              </div>
            </div>

            {/* Navigation links */}
            <nav className="sidebar-nav-list">
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'today' ? 'active' : ''}`}
                onClick={() => setActiveTab('today')}
              >
                <Home size={15} /> Home
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'timetable' ? 'active' : ''}`}
                onClick={() => setActiveTab('timetable')}
              >
                <CalendarDays size={15} /> Timetable
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'schedules' ? 'active' : ''}`}
                onClick={() => setActiveTab('schedules')}
              >
                <CalendarCheck size={15} /> Schedules
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
                onClick={() => setActiveTab('tasks')}
              >
                <ListTodo size={15} /> Tasks
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'plan' ? 'active' : ''}`}
                onClick={() => setActiveTab('plan')}
              >
                <Sparkles size={15} /> Tomorrow
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'weekly' ? 'active' : ''}`}
                onClick={() => setActiveTab('weekly')}
              >
                <BarChart3 size={15} /> Weekly
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <SettingsIcon size={15} /> Settings
              </button>
            </nav>

            {/* Bottom discipline quote */}
            <div className="sidebar-footer-quote">
              <p>“Discipline today builds the freedom you want tomorrow.”</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <Heart size={12} color="var(--accent-purple)" />
              </div>
            </div>
          </aside>

          {/* Right Main Content */}
          <main className="dashboard-main-area">
            {undoTask && (
              <div
                style={{
                  background: 'rgba(124, 58, 237, 0.2)',
                  border: '1px solid var(--accent-purple)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '7px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  boxShadow: '0 2px 10px rgba(124, 58, 237, 0.25)'
                }}
              >
                <span>
                  Marked as done: <strong>{undoTask.task.title}</strong>
                </span>
                <button
                  type="button"
                  className="btn-primary-pill"
                  style={{
                    padding: '3px 12px',
                    fontSize: 11,
                    background: 'var(--accent-purple-btn)',
                    cursor: 'pointer'
                  }}
                  onClick={handleUndoDone}
                >
                  Undo (60s)
                </button>
              </div>
            )}

            {message && (
              <div
                style={{
                  background: 'var(--accent-purple-bg)',
                  border: '1px solid var(--border-focus)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: 'var(--text-primary)'
                }}
              >
                <span>{message}</span>
                <button
                  type="button"
                  onClick={() => setMessage('')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {activeTab === 'today' && (
              <TodayView
                today={today}
                classes={classes}
                tasks={tasks}
                isCompact={false}
                onToggleTask={handleToggleTask}
                onNavigate={setActiveTab}
                onOpenTaskModal={() => {
                  setEditingTask(null)
                  setShowGlobalTaskModal(true)
                }}
                onOpenClassModal={() => setShowGlobalClassModal(true)}
                onOpenTaskDetails={handleOpenTaskForEdit}
                onRefreshTasks={refreshTasks}
                onShowMessage={setMessage}
                onOpenFocusTimer={task => setFocusTask(task)}
                onScheduleTask={task => setSchedulingTask(task)}
                onOpenRevisionPlan={handleOpenRevisionPlan}
              />
            )}

            {activeTab === 'timetable' && (
              <TimetableManager
                classes={classes}
                onRefreshClasses={refreshClasses}
                onShowMessage={setMessage}
              />
            )}

            {activeTab === 'schedules' && (
              <SchedulesView onShowMessage={setMessage} />
            )}

            {activeTab === 'tasks' && (
              <TasksView
                tasks={tasks}
                today={today}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
                onRefreshTasks={refreshTasks}
                onShowMessage={setMessage}
                onOpenFocusTimer={task => setFocusTask(task)}
                onScheduleTask={task => setSchedulingTask(task)}
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
                onOpenFocusTimer={task => setFocusTask(task)}
                onScheduleTask={task => setSchedulingTask(task)}
              />
            )}

            {activeTab === 'weekly' && (
              <WeeklyOverview
                today={today}
                classes={classes}
                tasks={tasks}
                onNavigatePlan={() => setActiveTab('plan')}
                onOpenTaskModal={() => setShowGlobalTaskModal(true)}
                onOpenFocusTimer={task => setFocusTask(task)}
                onScheduleTask={task => setSchedulingTask(task)}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                pinned={pinned}
                onTogglePin={handleTogglePin}
                widgetMode={widgetMode}
                onToggleMode={handleToggleMode}
                theme={theme}
                onThemeChange={handleSetTheme}
                onRefreshAll={async () => {
                  await Promise.all([refreshTasks(), refreshClasses()])
                }}
                onShowMessage={setMessage}
              />
            )}
          </main>
        </div>
      )}

      {/* Global Add / Edit Task Modal */}
      <TaskModal
        isOpen={showGlobalTaskModal || editingTask !== null}
        onClose={() => {
          setShowGlobalTaskModal(false)
          setEditingTask(null)
        }}
        task={editingTask}
        defaultDate={toDateKey(today)}
        onSave={handleSaveGlobalTask}
      />

      {/* Global Add Subject Modal */}
      <SubjectModal
        isOpen={showGlobalClassModal}
        onClose={() => setShowGlobalClassModal(false)}
        defaultWeekday={today.getDay()}
        onSave={handleCreateClass}
      />

      {/* Phase 2: Focus View Timer Modal */}
      <FocusViewModal
        isOpen={focusTask !== null}
        onClose={() => setFocusTask(null)}
        task={focusTask}
        onTaskCompleted={handleTaskCompleted}
        onShowMessage={setMessage}
      />

      {/* Phase 2: Schedule Task Slot Modal */}
      <ScheduleTaskModal
        isOpen={schedulingTask !== null}
        onClose={() => setSchedulingTask(null)}
        task={schedulingTask}
        classes={classes}
        today={today}
        onSaveSchedule={handleScheduleTaskSave}
      />

      {/* Phase 3 & 4: In-App Schedule Creator & Auto Revision Planner */}
      <ScheduleCreatorModal
        isOpen={scheduleCreatorParams.isOpen}
        onClose={() => setScheduleCreatorParams({ isOpen: false })}
        initialTemplate={scheduleCreatorParams.template}
        initialSubject={scheduleCreatorParams.subject}
        initialDate={scheduleCreatorParams.date}
        onSaveEvents={async (newEvents) => {
          try {
            const res = await window.hello11824.batchSaveScheduleEvents({ events: newEvents })
            setMessage(`Created ${res.savedCount || newEvents.length} events for ${scheduleCreatorParams.subject || 'schedule'}!`)
            setScheduleCreatorParams({ isOpen: false })
            setActiveTab('schedules')
          } catch (err) {
            setMessage(`Error saving schedule: ${err instanceof Error ? err.message : String(err)}`)
          }
        }}
        onShowMessage={setMessage}
      />
    </div>
  )
}
