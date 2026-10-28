/// <reference types="vite/client" />

export interface Task {
  id: number
  title: string
  description: string | null
  due_date: string | null
  due_time: string | null
  priority: 'low' | 'normal' | 'high'
  completed: number
  category: string | null
  class_id: number | null
  estimated_minutes?: number | null
  created_at: string
}

export interface FreeTimeSuggestion {
  hasFreeTime: boolean
  freeMinutes: number
  freeUntil: string
  nextEventTitle?: string
  slotKey: string
  suggestedTask?: Task | null
  message: string
  isSnoozed?: boolean
}

export interface SubjectItem {
  id: number
  title: string
  weekday: number
  start_time: string
  end_time: string | null
  room: string | null
  notes: string | null
  color?: string | null
  created_at?: string
}

export type ClassItem = SubjectItem

export interface CandidateSubject {
  title: string
  weekday: number
  startTime: string
  endTime: string
  room: string
  notes: string
  confidence?: 'high' | 'medium' | 'low'
  warning?: string
}

export type CandidateClass = CandidateSubject

export interface DailyPlan {
  plan_date: string
  notes: string | null
  materials_checked: string | null
  created_at: string
  updated_at: string
}

export interface ImportResult {
  fileName: string
  filePath: string
  fileType: string
  text: string
  needsOcr: boolean
  imageData?: string
  candidates: CandidateSubject[]
}

export interface HelloAPI {
  // Platform
  platform?: 'win32' | 'darwin' | 'linux'

  // Window
  minimize(): Promise<void>
  maximize(): Promise<boolean>
  isMaximized(): Promise<boolean>
  hide(): Promise<void>
  togglePin(pinned: boolean): Promise<boolean>
  setMode(mode: 'compact' | 'standard'): Promise<string>
  openExternal(url: string): Promise<void>
  onModeChanged(callback: (mode?: 'compact' | 'standard') => void): () => void
  onPinnedChanged(callback: (pinned: boolean) => void): () => void
  onMaximizeChanged(callback: (isMax: boolean) => void): () => void

  // Settings
  getSetting(key: string): Promise<string | null>
  setSetting(key: string, value: string): Promise<boolean>
  getAllSettings(): Promise<Record<string, string>>
  updateStartup(openAtLogin: boolean, openAsHidden: boolean): Promise<any>
  getStartupStatus(): Promise<any>

  // Tasks
  listTasks(date?: string): Promise<Task[]>
  addTask(task: {
    title: string
    description?: string
    dueDate?: string
    dueTime?: string
    priority?: 'low' | 'normal' | 'high'
    category?: string
    classId?: number
    estimatedMinutes?: number | null
  }): Promise<Task>
  updateTask(id: number, payload: {
    title?: string
    description?: string | null
    dueDate?: string | null
    dueTime?: string | null
    priority?: 'low' | 'normal' | 'high'
    completed?: boolean
    category?: string | null
    classId?: number | null
    estimatedMinutes?: number | null
  }): Promise<Task>
  toggleTask(id: number, completed: boolean): Promise<boolean>
  deleteTask(id: number): Promise<boolean>
  rolloverTasks(fromDate: string, toDate: string): Promise<number>

  // Smart Free Time Task Suggestions
  getFreeTimeSuggestion(): Promise<FreeTimeSuggestion>
  snoozeFreeTimeReminder(minutes?: number): Promise<boolean>
  dismissFreeTimeReminder(slotKey: string): Promise<boolean>
  completeSuggestedTask(taskId: number): Promise<boolean>

  // Subjects / Classes
  listSubjects(): Promise<SubjectItem[]>
  addSubject(item: {
    title: string
    weekday: number
    startTime: string
    endTime?: string
    room?: string
    notes?: string
    color?: string
  }): Promise<SubjectItem>
  updateSubject(id: number, payload: {
    title?: string
    weekday?: number
    startTime?: string
    endTime?: string | null
    room?: string | null
    notes?: string | null
    color?: string | null
  }): Promise<SubjectItem>
  deleteSubject(id: number): Promise<boolean>
  replaceSubjects(subjects: Array<{
    title: string
    weekday: number
    startTime: string
    endTime?: string
    room?: string
    notes?: string
    color?: string
  }>, sourceFileName?: string): Promise<SubjectItem[]>
  appendSubjects(subjects: Array<{
    title: string
    weekday: number
    startTime: string
    endTime?: string
    room?: string
    notes?: string
    color?: string
  }>, sourceFileName?: string): Promise<SubjectItem[]>

  listClasses(): Promise<ClassItem[]>
  addClass(cls: {
    title: string
    weekday: number
    startTime: string
    endTime?: string
    room?: string
    notes?: string
    color?: string
  }): Promise<ClassItem>
  updateClass(id: number, payload: {
    title?: string
    weekday?: number
    startTime?: string
    endTime?: string | null
    room?: string | null
    notes?: string | null
    color?: string | null
  }): Promise<ClassItem>
  deleteClass(id: number): Promise<boolean>
  replaceClasses(classes: Array<{
    title: string
    weekday: number
    startTime: string
    endTime?: string
    room?: string
    notes?: string
    color?: string
  }>, sourceFileName?: string): Promise<ClassItem[]>
  appendClasses(classes: Array<{
    title: string
    weekday: number
    startTime: string
    endTime?: string
    room?: string
    notes?: string
    color?: string
  }>, sourceFileName?: string): Promise<ClassItem[]>

  // Daily Plans
  getDailyPlan(date: string): Promise<DailyPlan | null>
  saveDailyPlan(date: string, payload: { notes?: string; materialsChecked?: string[] }): Promise<DailyPlan>

  // Document extraction
  pickAndExtract(): Promise<ImportResult | null>
  parseText(text: string): Promise<CandidateSubject[]>

  // Backup & Storage
  exportData(): Promise<boolean>
  importData(): Promise<boolean>
  clearData(options: { tasks?: boolean; classes?: boolean; plans?: boolean }): Promise<boolean>

  // Application Info
  getAppVersion(): Promise<string>
}

declare global {
  interface Window {
    hello11824: HelloAPI
    daylight: HelloAPI
  }
}

export {}
