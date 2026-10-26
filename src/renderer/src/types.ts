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

export type ActiveTab = 'today' | 'timetable' | 'tasks' | 'plan' | 'weekly' | 'settings'

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function formatFriendlyDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
}
