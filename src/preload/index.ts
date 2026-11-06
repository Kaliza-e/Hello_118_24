import { contextBridge, ipcRenderer } from 'electron'

export interface TaskPayload {
  title: string
  description?: string
  dueDate?: string
  dueTime?: string
  priority?: 'low' | 'normal' | 'high'
  category?: string
  classId?: number
  estimatedMinutes?: number | null
}

export interface TaskUpdatePayload {
  title?: string
  description?: string | null
  dueDate?: string | null
  dueTime?: string | null
  priority?: 'low' | 'normal' | 'high'
  completed?: boolean
  category?: string | null
  classId?: number | null
  estimatedMinutes?: number | null
}

export interface ClassPayload {
  title: string
  weekday: number
  startTime: string
  endTime?: string
  room?: string
  notes?: string
  color?: string
}

export interface ClassUpdatePayload {
  title?: string
  weekday?: number
  startTime?: string
  endTime?: string | null
  room?: string | null
  notes?: string | null
  color?: string | null
}

export interface DailyPlanPayload {
  notes?: string
  materialsChecked?: string[]
}

const api = {
  // Platform
  platform: process.platform as 'win32' | 'darwin' | 'linux',

  // Window
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  hide: () => ipcRenderer.invoke('window:close'),
  togglePin: (pinned: boolean) => ipcRenderer.invoke('window:toggle-pin', pinned),
  setMode: (mode: 'compact' | 'standard') => ipcRenderer.invoke('window:set-mode', mode),
  openExternal: (url: string) => ipcRenderer.invoke('window:open-external', url),
  onModeChanged: (callback: (mode?: 'compact' | 'standard') => void) => {
    const handler = (_event: any, mode: any) => callback(mode)
    ipcRenderer.on('widget:mode-changed', handler)
    return () => ipcRenderer.removeListener('widget:mode-changed', handler)
  },
  onPinnedChanged: (callback: (pinned: boolean) => void) => {
    const handler = (_event: any, pinned: boolean) => callback(pinned)
    ipcRenderer.on('window:pinned-changed', handler)
    return () => ipcRenderer.removeListener('window:pinned-changed', handler)
  },
  onMaximizeChanged: (callback: (isMax: boolean) => void) => {
    const handler = (_event: any, isMax: boolean) => callback(isMax)
    ipcRenderer.on('window:maximize-changed', handler)
    return () => ipcRenderer.removeListener('window:maximize-changed', handler)
  },

  // Settings
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  getAllSettings: () => ipcRenderer.invoke('settings:get-all'),
  updateStartup: (openAtLogin: boolean, openAsHidden: boolean) => ipcRenderer.invoke('settings:update-startup', openAtLogin, openAsHidden),
  getStartupStatus: () => ipcRenderer.invoke('settings:get-startup-status'),

  // Tasks
  listTasks: (date?: string) => ipcRenderer.invoke('tasks:list', date),
  addTask: (task: TaskPayload) => ipcRenderer.invoke('tasks:add', task),
  updateTask: (id: number, payload: TaskUpdatePayload) => ipcRenderer.invoke('tasks:update', id, payload),
  toggleTask: (id: number, completed: boolean) => ipcRenderer.invoke('tasks:toggle', id, completed),
  deleteTask: (id: number) => ipcRenderer.invoke('tasks:delete', id),
  rolloverTasks: (fromDate: string, toDate: string) => ipcRenderer.invoke('tasks:rollover', fromDate, toDate),
  scheduleTask: (taskId: number, date: string, time?: string, durationMinutes?: number) =>
    ipcRenderer.invoke('tasks:schedule', taskId, date, time, durationMinutes),

  // Focus View & Timer
  getActiveTimer: () => ipcRenderer.invoke('timer:get-active'),
  startTimer: (taskId: number, options?: { isPomodoro?: boolean; workDuration?: number; breakDuration?: number }) =>
    ipcRenderer.invoke('timer:start', taskId, options),
  pauseTimer: () => ipcRenderer.invoke('timer:pause'),
  resumeTimer: () => ipcRenderer.invoke('timer:resume'),
  stopTimer: () => ipcRenderer.invoke('timer:stop'),
  markTaskDoneWithTimer: (taskId: number) => ipcRenderer.invoke('timer:mark-done', taskId),
  undoMarkTaskDone: (taskId: number) => ipcRenderer.invoke('timer:undo-done', taskId),
  listTaskSessions: (taskId: number) => ipcRenderer.invoke('timer:list-sessions', taskId),
  getWeeklyStudyStats: (startDate: string, endDate: string) => ipcRenderer.invoke('analytics:get-weekly-study', startDate, endDate),

  // Smart Free Time Task Suggestions
  getFreeTimeSuggestion: () => ipcRenderer.invoke('free-time:get-suggestion'),
  snoozeFreeTimeReminder: (minutes?: number) => ipcRenderer.invoke('free-time:snooze', minutes),
  dismissFreeTimeReminder: (slotKey: string) => ipcRenderer.invoke('free-time:dismiss', slotKey),
  completeSuggestedTask: (taskId: number) => ipcRenderer.invoke('free-time:complete-task', taskId),

  // Subjects / Classes
  listSubjects: () => ipcRenderer.invoke('subjects:list'),
  addSubject: (item: ClassPayload) => ipcRenderer.invoke('subjects:add', item),
  updateSubject: (id: number, payload: ClassUpdatePayload) => ipcRenderer.invoke('subjects:update', id, payload),
  deleteSubject: (id: number) => ipcRenderer.invoke('subjects:delete', id),
  replaceSubjects: (subjects: ClassPayload[], sourceFileName?: string) => ipcRenderer.invoke('subjects:replace', subjects, sourceFileName),
  appendSubjects: (subjects: ClassPayload[], sourceFileName?: string) => ipcRenderer.invoke('subjects:append', subjects, sourceFileName),

  listClasses: () => ipcRenderer.invoke('classes:list'),
  addClass: (cls: ClassPayload) => ipcRenderer.invoke('classes:add', cls),
  updateClass: (id: number, payload: ClassUpdatePayload) => ipcRenderer.invoke('classes:update', id, payload),
  deleteClass: (id: number) => ipcRenderer.invoke('classes:delete', id),
  replaceClasses: (classes: ClassPayload[], sourceFileName?: string) => ipcRenderer.invoke('classes:replace', classes, sourceFileName),
  appendClasses: (classes: ClassPayload[], sourceFileName?: string) => ipcRenderer.invoke('classes:append', classes, sourceFileName),

  // Daily Plans
  getDailyPlan: (date: string) => ipcRenderer.invoke('daily-plans:get', date),
  saveDailyPlan: (date: string, payload: DailyPlanPayload) => ipcRenderer.invoke('daily-plans:save', date, payload),

  // Document extraction
  pickAndExtract: () => ipcRenderer.invoke('files:pick-and-extract'),
  parseText: (text: string) => ipcRenderer.invoke('files:parse-text', text),

  // Backup & Storage
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
  exportEncryptedData: (passphrase: string) => ipcRenderer.invoke('data:export-encrypted', passphrase),
  importEncryptedData: (passphrase: string) => ipcRenderer.invoke('data:import-encrypted', passphrase),
  clearData: (options: { tasks?: boolean; classes?: boolean; plans?: boolean; schedules?: boolean }) => ipcRenderer.invoke('data:clear', options),

  // PIN Lock
  isPinSet: () => ipcRenderer.invoke('pin:is-set'),
  verifyPin: (pin: string) => ipcRenderer.invoke('pin:verify', pin),
  setPin: (pin: string) => ipcRenderer.invoke('pin:set', pin),
  removePin: (currentPin: string) => ipcRenderer.invoke('pin:remove', currentPin),

  // Schedules & Ingestion
  pickAndIngestSchedule: () => ipcRenderer.invoke('schedules:pick-and-ingest'),
  parseScheduleText: (text: string) => ipcRenderer.invoke('schedules:parse-text', text),
  runScheduleOcr: (images: string[]) => ipcRenderer.invoke('schedules:run-ocr', images),
  listScheduleEvents: (filters?: any) => ipcRenderer.invoke('schedules:list-events', filters),
  getScheduleEvent: (id: number) => ipcRenderer.invoke('schedules:get-event', id),
  addScheduleEvent: (payload: any, reminders?: any[]) => ipcRenderer.invoke('schedules:add-event', payload, reminders),
  updateScheduleEvent: (id: number, updates: any, reminders?: any[]) => ipcRenderer.invoke('schedules:update-event', id, updates, reminders),
  deleteScheduleEvent: (id: number) => ipcRenderer.invoke('schedules:delete-event', id),
  toggleScheduleEventCompleted: (id: number) => ipcRenderer.invoke('schedules:toggle-completed', id),
  batchSaveScheduleEvents: (payload: any) => ipcRenderer.invoke('schedules:batch-save', payload),
  listSourceDocuments: () => ipcRenderer.invoke('schedules:list-source-docs'),
  deleteSourceDocument: (id: number, deleteEvents?: boolean) => ipcRenderer.invoke('schedules:delete-source-doc', id, deleteEvents),
  setEventReminders: (eventId: number, reminders: any[]) => ipcRenderer.invoke('schedules:set-reminders', eventId, reminders),
  exportSchedulePdf: (customEvents?: any[]) => ipcRenderer.invoke('schedules:export-pdf', customEvents),
  exportScheduleExcel: (customEvents?: any[]) => ipcRenderer.invoke('schedules:export-xlsx', customEvents),
  exportScheduleCsv: (customEvents?: any[]) => ipcRenderer.invoke('schedules:export-csv', customEvents),
  exportScheduleIcs: (customEvents?: any[]) => ipcRenderer.invoke('schedules:export-ics', customEvents),

  // Journal & Reflections
  getJournalEntry: (date: string, type: 'morning' | 'evening') => ipcRenderer.invoke('journal:get', date, type),
  saveJournalEntry: (date: string, type: 'morning' | 'evening', payload: any) => ipcRenderer.invoke('journal:save', date, type, payload),
  getWeeklyReflectionReport: (startDate: string, endDate: string) => ipcRenderer.invoke('analytics:get-reflection-report', startDate, endDate),
  getUserStreakAndBadges: () => ipcRenderer.invoke('analytics:get-streaks-and-badges'),

  // Application Info
  getAppVersion: () => ipcRenderer.invoke('app:get-version')
}

contextBridge.exposeInMainWorld('hello11824', api)
// Also alias daylight for backward compatibility
contextBridge.exposeInMainWorld('daylight', api)
