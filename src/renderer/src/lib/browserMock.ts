import type { HelloAPI, Task, ClassItem, SubjectItem, DailyPlan, ImportResult, CandidateSubject } from '../vite-env'

const STORAGE_KEYS = {
  TASKS: 'hello11824_tasks',
  CLASSES: 'hello11824_classes',
  SETTINGS: 'hello11824_settings',
  DAILY_PLANS: 'hello11824_daily_plans'
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage quota errors in demo mode
  }
}

const DEFAULT_SETTINGS: Record<string, string> = {
  notifications_enabled: 'true',
  class_reminder_minutes: '10',
  launch_on_startup: 'true',
  start_minimized: 'false',
  pinned: 'true',
  widget_mode: 'compact'
}

const DEFAULT_CLASSES: ClassItem[] = [
  { id: 1, title: 'Data Structures & Algorithms', weekday: 1, start_time: '08:30', end_time: '10:00', room: 'Lab 2', notes: 'Trees & Graphs', color: '#818cf8', created_at: new Date().toISOString() },
  { id: 2, title: 'Computer Networks', weekday: 1, start_time: '10:30', end_time: '12:00', room: 'Room 204', notes: 'OSI Model & TCP/IP', color: '#38bdf8', created_at: new Date().toISOString() },
  { id: 3, title: 'Database Systems', weekday: 2, start_time: '09:00', end_time: '11:00', room: 'Lab 1', notes: 'SQL & Normalization', color: '#34d399', created_at: new Date().toISOString() },
  { id: 4, title: 'Web Development', weekday: 3, start_time: '13:30', end_time: '15:30', room: 'Lab 3', notes: 'React & Vite UI', color: '#f472b6', created_at: new Date().toISOString() },
  { id: 5, title: 'Discrete Mathematics', weekday: 4, start_time: '11:00', end_time: '12:30', room: 'Hall A', notes: 'Set Theory & Logic', color: '#fbbf24', created_at: new Date().toISOString() },
  { id: 6, title: 'Software Engineering', weekday: 5, start_time: '08:30', end_time: '10:30', room: 'Lab 2', notes: 'Agile & Git Workflow', color: '#a78bfa', created_at: new Date().toISOString() }
]

const DEFAULT_TASKS: Task[] = [
  { id: 1, title: 'Review Database normalization notes', description: 'Covers 1NF through BCNF', due_date: new Date().toISOString().slice(0, 10), due_time: '18:00', priority: 'high', completed: 0, category: 'Academic', class_id: 3, created_at: new Date().toISOString() },
  { id: 2, title: 'Submit DSA Lab assignment 4', description: 'Implement Binary Search Tree methods', due_date: new Date().toISOString().slice(0, 10), due_time: '23:59', priority: 'high', completed: 0, category: 'Assignment', class_id: 1, created_at: new Date().toISOString() },
  { id: 3, title: 'Pack laptop charger and notebook', description: 'For tomorrow morning class', due_date: new Date().toISOString().slice(0, 10), due_time: '21:00', priority: 'normal', completed: 1, category: 'Personal', class_id: null, created_at: new Date().toISOString() }
]

export function createBrowserMockApi(): HelloAPI {
  const modeListeners: Set<(mode?: 'compact' | 'standard') => void> = new Set()
  const pinListeners: Set<(pinned: boolean) => void> = new Set()
  const maximizeListeners: Set<(isMax: boolean) => void> = new Set()
  let isMaximizedState = false

  return {
    platform: 'win32',
    async minimize() {
      console.log('[Browser Mock] minimize() called')
    },

    async maximize() {
      isMaximizedState = !isMaximizedState
      maximizeListeners.forEach(cb => cb(isMaximizedState))
      return isMaximizedState
    },

    async isMaximized() {
      return isMaximizedState
    },

    async hide() {
      console.log('[Browser Mock] hide() called')
    },

    onMaximizeChanged(callback: (isMax: boolean) => void) {
      maximizeListeners.add(callback)
      return () => {
        maximizeListeners.delete(callback)
      }
    },

    async togglePin(pinned: boolean) {
      const settings = loadFromStorage(STORAGE_KEYS.SETTINGS, { ...DEFAULT_SETTINGS })
      settings.pinned = String(pinned)
      saveToStorage(STORAGE_KEYS.SETTINGS, settings)
      pinListeners.forEach(cb => cb(pinned))
      return pinned
    },

    async setMode(mode: 'compact' | 'standard') {
      const settings = loadFromStorage(STORAGE_KEYS.SETTINGS, { ...DEFAULT_SETTINGS })
      settings.widget_mode = mode
      saveToStorage(STORAGE_KEYS.SETTINGS, settings)
      modeListeners.forEach(cb => cb())
      return mode
    },

    async openExternal(url: string) {
      window.open(url, '_blank', 'noopener,noreferrer')
    },

    onModeChanged(callback: () => void) {
      modeListeners.add(callback)
      return () => {
        modeListeners.delete(callback)
      }
    },

    onPinnedChanged(callback: (pinned: boolean) => void) {
      pinListeners.add(callback)
      return () => {
        pinListeners.delete(callback)
      }
    },

    async getSetting(key: string) {
      const settings = loadFromStorage(STORAGE_KEYS.SETTINGS, { ...DEFAULT_SETTINGS })
      return settings[key] ?? null
    },

    async setSetting(key: string, value: string) {
      const settings = loadFromStorage(STORAGE_KEYS.SETTINGS, { ...DEFAULT_SETTINGS })
      settings[key] = value
      saveToStorage(STORAGE_KEYS.SETTINGS, settings)
      return true
    },

    async getAllSettings() {
      return loadFromStorage(STORAGE_KEYS.SETTINGS, { ...DEFAULT_SETTINGS })
    },

    async updateStartup(openAtLogin: boolean, openAsHidden: boolean) {
      const settings = loadFromStorage(STORAGE_KEYS.SETTINGS, { ...DEFAULT_SETTINGS })
      settings.launch_on_startup = String(openAtLogin)
      settings.start_minimized = String(openAsHidden)
      saveToStorage(STORAGE_KEYS.SETTINGS, settings)
      return { openAtLogin, openAsHidden }
    },

    async getStartupStatus() {
      const settings = loadFromStorage(STORAGE_KEYS.SETTINGS, { ...DEFAULT_SETTINGS })
      return {
        openAtLogin: settings.launch_on_startup !== 'false',
        openAsHidden: settings.start_minimized === 'true'
      }
    },

    async listTasks(date?: string) {
      const tasks = loadFromStorage(STORAGE_KEYS.TASKS, DEFAULT_TASKS)
      if (date) {
        return tasks.filter(t => t.due_date === date)
      }
      return tasks
    },

    async addTask(payload) {
      const tasks = loadFromStorage(STORAGE_KEYS.TASKS, DEFAULT_TASKS)
      const nextId = tasks.reduce((max, t) => Math.max(max, t.id), 0) + 1
      const newTask: Task = {
        id: nextId,
        title: payload.title,
        description: payload.description || null,
        due_date: payload.dueDate || null,
        due_time: payload.dueTime || null,
        priority: payload.priority || 'normal',
        completed: 0,
        category: payload.category || null,
        class_id: payload.classId || null,
        created_at: new Date().toISOString()
      }
      tasks.push(newTask)
      saveToStorage(STORAGE_KEYS.TASKS, tasks)
      return newTask
    },

    async updateTask(id: number, payload) {
      const tasks = loadFromStorage(STORAGE_KEYS.TASKS, DEFAULT_TASKS)
      const idx = tasks.findIndex(t => t.id === id)
      if (idx === -1) throw new Error('Task not found')

      const current = tasks[idx]
      const updated: Task = {
        ...current,
        title: payload.title !== undefined ? payload.title : current.title,
        description: payload.description !== undefined ? payload.description : current.description,
        due_date: payload.dueDate !== undefined ? payload.dueDate : current.due_date,
        due_time: payload.dueTime !== undefined ? payload.dueTime : current.due_time,
        priority: payload.priority !== undefined ? payload.priority : current.priority,
        completed: payload.completed !== undefined ? (payload.completed ? 1 : 0) : current.completed,
        category: payload.category !== undefined ? payload.category : current.category,
        class_id: payload.classId !== undefined ? payload.classId : current.class_id
      }
      tasks[idx] = updated
      saveToStorage(STORAGE_KEYS.TASKS, tasks)
      return updated
    },

    async toggleTask(id: number, completed: boolean) {
      const tasks = loadFromStorage(STORAGE_KEYS.TASKS, DEFAULT_TASKS)
      const task = tasks.find(t => t.id === id)
      if (task) {
        task.completed = completed ? 1 : 0
        saveToStorage(STORAGE_KEYS.TASKS, tasks)
        return true
      }
      return false
    },

    async deleteTask(id: number) {
      const tasks = loadFromStorage(STORAGE_KEYS.TASKS, DEFAULT_TASKS)
      const filtered = tasks.filter(t => t.id !== id)
      saveToStorage(STORAGE_KEYS.TASKS, filtered)
      return true
    },

    async rolloverTasks(fromDate: string, toDate: string) {
      const tasks = loadFromStorage(STORAGE_KEYS.TASKS, DEFAULT_TASKS)
      let count = 0
      for (const t of tasks) {
        if (t.due_date === fromDate && t.completed === 0) {
          t.due_date = toDate
          count++
        }
      }
      saveToStorage(STORAGE_KEYS.TASKS, tasks)
      return count
    },

    async getFreeTimeSuggestion() {
      const tasks = loadFromStorage<Task[]>(STORAGE_KEYS.TASKS, DEFAULT_TASKS)
      const unfinished = tasks.filter(t => !t.completed)
      const topTask = unfinished.find(t => t.priority === 'high') || unfinished[0] || null
      return {
        hasFreeTime: true,
        freeMinutes: 35,
        freeUntil: '15:30',
        nextEventTitle: 'Web Development',
        slotKey: 'mock-free-slot-1',
        suggestedTask: topTask,
        message: topTask
          ? `You have 35 minutes free until 15:30 (Web Development). Good time to work on: "${topTask.title}".`
          : 'You have 35 minutes free until 15:30. Want to plan something for this time?',
        isSnoozed: false
      }
    },

    async snoozeFreeTimeReminder(_minutes?: number) {
      return true
    },

    async dismissFreeTimeReminder(_slotKey: string) {
      return true
    },

    async completeSuggestedTask(taskId: number) {
      return this.toggleTask(taskId, true)
    },

    async listSubjects(): Promise<SubjectItem[]> {
      return loadFromStorage(STORAGE_KEYS.CLASSES, DEFAULT_CLASSES)
    },

    async addSubject(item) {
      const list = loadFromStorage<SubjectItem[]>(STORAGE_KEYS.CLASSES, DEFAULT_CLASSES)
      const nextId = list.reduce((max, c) => Math.max(max, c.id), 0) + 1
      const newSubject: SubjectItem = {
        id: nextId,
        title: item.title,
        weekday: item.weekday,
        start_time: item.startTime,
        end_time: item.endTime || null,
        room: item.room || null,
        notes: item.notes || null,
        color: item.color || '#818cf8',
        created_at: new Date().toISOString()
      }
      list.push(newSubject)
      saveToStorage(STORAGE_KEYS.CLASSES, list)
      return newSubject
    },

    async updateSubject(id: number, payload) {
      const list = loadFromStorage<SubjectItem[]>(STORAGE_KEYS.CLASSES, DEFAULT_CLASSES)
      const idx = list.findIndex(c => c.id === id)
      if (idx === -1) throw new Error('Subject not found')

      const cur = list[idx]
      const updated: SubjectItem = {
        ...cur,
        title: payload.title !== undefined ? payload.title : cur.title,
        weekday: payload.weekday !== undefined ? payload.weekday : cur.weekday,
        start_time: payload.startTime !== undefined ? payload.startTime : cur.start_time,
        end_time: payload.endTime !== undefined ? payload.endTime : cur.end_time,
        room: payload.room !== undefined ? payload.room : cur.room,
        notes: payload.notes !== undefined ? payload.notes : cur.notes,
        color: payload.color !== undefined ? payload.color : cur.color
      }
      list[idx] = updated
      saveToStorage(STORAGE_KEYS.CLASSES, list)
      return updated
    },

    async deleteSubject(id: number) {
      const list = loadFromStorage<SubjectItem[]>(STORAGE_KEYS.CLASSES, DEFAULT_CLASSES)
      saveToStorage(STORAGE_KEYS.CLASSES, list.filter(c => c.id !== id))
      return true
    },

    async replaceSubjects(subjects) {
      let idCounter = 1
      const nextList: SubjectItem[] = subjects.map(s => ({
        id: idCounter++,
        title: s.title,
        weekday: s.weekday,
        start_time: s.startTime,
        end_time: s.endTime || null,
        room: s.room || null,
        notes: s.notes || null,
        color: s.color || '#818cf8',
        created_at: new Date().toISOString()
      }))
      saveToStorage(STORAGE_KEYS.CLASSES, nextList)
      return nextList
    },

    async appendSubjects(subjects) {
      const list = loadFromStorage<SubjectItem[]>(STORAGE_KEYS.CLASSES, DEFAULT_CLASSES)
      let nextId = list.reduce((max, c) => Math.max(max, c.id), 0) + 1
      for (const s of subjects) {
        list.push({
          id: nextId++,
          title: s.title,
          weekday: s.weekday,
          start_time: s.startTime,
          end_time: s.endTime || null,
          room: s.room || null,
          notes: s.notes || null,
          color: s.color || '#818cf8',
          created_at: new Date().toISOString()
        })
      }
      saveToStorage(STORAGE_KEYS.CLASSES, list)
      return list
    },

    // Aliases for classes
    async listClasses() {
      return this.listSubjects()
    },
    async addClass(cls) {
      return this.addSubject(cls)
    },
    async updateClass(id, payload) {
      return this.updateSubject(id, payload)
    },
    async deleteClass(id) {
      return this.deleteSubject(id)
    },
    async replaceClasses(classes) {
      return this.replaceSubjects(classes)
    },
    async appendClasses(classes) {
      return this.appendSubjects(classes)
    },

    async getDailyPlan(date: string) {
      const plans = loadFromStorage<Record<string, DailyPlan>>(STORAGE_KEYS.DAILY_PLANS, {})
      return plans[date] || null
    },

    async saveDailyPlan(date: string, payload) {
      const plans = loadFromStorage<Record<string, DailyPlan>>(STORAGE_KEYS.DAILY_PLANS, {})
      const existing = plans[date]
      const updated: DailyPlan = {
        plan_date: date,
        notes: payload.notes !== undefined ? (payload.notes || null) : (existing?.notes ?? null),
        materials_checked: payload.materialsChecked ? JSON.stringify(payload.materialsChecked) : (existing?.materials_checked ?? null),
        created_at: existing?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      plans[date] = updated
      saveToStorage(STORAGE_KEYS.DAILY_PLANS, plans)
      return updated
    },

    async pickAndExtract(): Promise<ImportResult | null> {
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.txt,.json'
        input.onchange = async () => {
          const file = input.files?.[0]
          if (!file) {
            resolve(null)
            return
          }
          const text = await file.text()
          resolve({
            fileName: file.name,
            filePath: file.name,
            fileType: file.name.split('.').pop() || 'txt',
            text,
            needsOcr: false,
            candidates: []
          })
        }
        input.click()
      })
    },

    async parseText(_text: string): Promise<CandidateSubject[]> {
      return []
    },

    async exportData() {
      const data = {
        tasks: loadFromStorage(STORAGE_KEYS.TASKS, DEFAULT_TASKS),
        classes: loadFromStorage(STORAGE_KEYS.CLASSES, DEFAULT_CLASSES),
        settings: loadFromStorage(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS),
        daily_plans: loadFromStorage(STORAGE_KEYS.DAILY_PLANS, {})
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hello11824-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      return true
    },

    async importData() {
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = async () => {
          const file = input.files?.[0]
          if (!file) {
            resolve(false)
            return
          }
          try {
            const raw = await file.text()
            const data = JSON.parse(raw)
            if (data.tasks) saveToStorage(STORAGE_KEYS.TASKS, data.tasks)
            if (data.classes) saveToStorage(STORAGE_KEYS.CLASSES, data.classes)
            if (data.settings) saveToStorage(STORAGE_KEYS.SETTINGS, data.settings)
            if (data.daily_plans) saveToStorage(STORAGE_KEYS.DAILY_PLANS, data.daily_plans)
            window.location.reload()
            resolve(true)
          } catch {
            resolve(false)
          }
        }
        input.click()
      })
    },

    async clearData(options) {
      if (options.tasks) saveToStorage(STORAGE_KEYS.TASKS, [])
      if (options.classes) saveToStorage(STORAGE_KEYS.CLASSES, [])
      if (options.plans) saveToStorage(STORAGE_KEYS.DAILY_PLANS, {})
      if (options.schedules) {
        saveToStorage('hello11824_mock_schedules', [])
        saveToStorage('hello11824_mock_source_docs', [])
      }
      return true
    },

    // Schedules & Ingestion
    async pickAndIngestSchedule() {
      return null
    },
    async parseScheduleText() {
      return []
    },
    async runScheduleOcr() {
      return { text: '', candidates: [] }
    },
    async listScheduleEvents(filters) {
      let events = loadFromStorage<any[]>('hello11824_mock_schedules', [])
      if (filters?.category && filters.category !== 'All') {
        events = events.filter(e => e.category === filters.category)
      }
      if (filters?.search) {
        const q = filters.search.toLowerCase()
        events = events.filter(e => e.title?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q))
      }
      return events
    },
    async getScheduleEvent(id: number) {
      const events = loadFromStorage<any[]>('hello11824_mock_schedules', [])
      return events.find(e => e.id === id) || null
    },
    async addScheduleEvent(payload: any, reminders?: any[]) {
      const events = loadFromStorage<any[]>('hello11824_mock_schedules', [])
      const newEv = {
        ...payload,
        id: Date.now(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        reminders: reminders || []
      }
      events.push(newEv)
      saveToStorage('hello11824_mock_schedules', events)
      return newEv
    },
    async updateScheduleEvent(id: number, updates: any, reminders?: any[]) {
      const events = loadFromStorage<any[]>('hello11824_mock_schedules', [])
      const idx = events.findIndex(e => e.id === id)
      if (idx === -1) return null
      events[idx] = {
        ...events[idx],
        ...updates,
        reminders: reminders !== undefined ? reminders : events[idx].reminders,
        user_edited: 1,
        updated_at: new Date().toISOString()
      }
      saveToStorage('hello11824_mock_schedules', events)
      return events[idx]
    },
    async deleteScheduleEvent(id: number) {
      const events = loadFromStorage<any[]>('hello11824_mock_schedules', [])
      saveToStorage('hello11824_mock_schedules', events.filter(e => e.id !== id))
      return true
    },
    async toggleScheduleEventCompleted(id: number) {
      const events = loadFromStorage<any[]>('hello11824_mock_schedules', [])
      const target = events.find(e => e.id === id)
      if (target) {
        target.is_completed = target.is_completed ? 0 : 1
        saveToStorage('hello11824_mock_schedules', events)
      }
      return true
    },
    async batchSaveScheduleEvents(payload: any) {
      const events = loadFromStorage<any[]>('hello11824_mock_schedules', [])
      let docId: number | undefined = undefined
      if (payload.documentMeta) {
        const docs = loadFromStorage<any[]>('hello11824_mock_source_docs', [])
        docId = Date.now()
        docs.push({
          id: docId,
          ...payload.documentMeta,
          event_count: payload.events.length,
          imported_at: new Date().toISOString()
        })
        saveToStorage('hello11824_mock_source_docs', docs)
      }
      for (const ev of payload.events) {
        events.push({
          id: Date.now() + Math.floor(Math.random() * 10000),
          source_doc_id: docId,
          ...ev,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
      saveToStorage('hello11824_mock_schedules', events)
      return { savedCount: payload.events.length, docId }
    },
    async listSourceDocuments() {
      return loadFromStorage<any[]>('hello11824_mock_source_docs', [])
    },
    async deleteSourceDocument(id: number, deleteEvents?: boolean) {
      const docs = loadFromStorage<any[]>('hello11824_mock_source_docs', [])
      saveToStorage('hello11824_mock_source_docs', docs.filter(d => d.id !== id))
      if (deleteEvents !== false) {
        const events = loadFromStorage<any[]>('hello11824_mock_schedules', [])
        saveToStorage('hello11824_mock_schedules', events.filter(e => e.source_doc_id !== id))
      }
      return true
    },
    async setEventReminders() {
      return true
    },

    // Application Info
    async getAppVersion() {
      return '0.1.1'
    }
  }
}

export function isElectronEnvironment(): boolean {
  return typeof window !== 'undefined' && Boolean(window.hello11824 && !('__isMock' in window.hello11824))
}

export function initBrowserFallback(): void {
  if (typeof window === 'undefined') return

  if (!window.hello11824) {
    const mock = createBrowserMockApi()
    Object.defineProperty(mock, '__isMock', { value: true, enumerable: false })
    window.hello11824 = mock
    window.daylight = mock
    console.info(
      '%c[Hello 118:24]%c Running in Web Browser mode with localStorage preview. Native desktop features (Always-on-top, System Tray, Local SQLite) run in the Electron window.',
      'color: #818cf8; font-weight: bold;',
      'color: inherit;'
    )
  }
}
