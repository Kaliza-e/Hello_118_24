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

export type ScheduleCategory =
  | 'Academic Calendar'
  | 'Exams'
  | 'Assignments'
  | 'Applications'
  | 'Events'
  | 'Workshops'
  | 'Meetings'
  | 'Personal'
  | 'Other'

export const SCHEDULE_CATEGORIES: ScheduleCategory[] = [
  'Academic Calendar',
  'Exams',
  'Assignments',
  'Applications',
  'Events',
  'Workshops',
  'Meetings',
  'Personal',
  'Other'
]

export interface EventReminder {
  id?: number
  event_id?: number
  trigger_offset_minutes: number
  all_day_delivery_time?: string
  last_triggered_at?: string | null
  is_delivered?: number
  created_at?: string
}

export interface ScheduleEvent {
  id: number
  source_doc_id: number | null
  title: string
  description: string | null
  category: ScheduleCategory
  tags: string | null
  start_date: string // YYYY-MM-DD
  start_time: string | null // HH:mm
  end_date: string | null // YYYY-MM-DD
  end_time: string | null // HH:mm
  is_all_day: number // 0 or 1
  location: string | null
  recurrence_rule: string | null
  source_excerpt: string | null
  source_page: number | null
  confidence: 'high' | 'medium' | 'low'
  review_status: 'confirmed' | 'pending_review' | 'excluded'
  is_completed: number // 0 or 1
  user_edited: number // 0 or 1
  created_at: string
  updated_at: string
  reminders?: EventReminder[]
  source_document_name?: string
}

export interface CandidateScheduleEvent {
  id?: string
  title: string
  description?: string
  category: ScheduleCategory
  startDate: string
  startTime?: string
  endDate?: string
  endTime?: string
  isAllDay: boolean
  location?: string
  recurrenceRule?: string
  sourceExcerpt?: string
  sourcePage?: number
  confidence: 'high' | 'medium' | 'low'
  warning?: string
  reminders?: Array<{ trigger_offset_minutes: number; all_day_delivery_time?: string }>
}

export interface SourceDocument {
  id: number
  file_hash: string
  file_name: string
  file_type: string
  file_size: number
  event_count: number
  raw_text: string | null
  imported_at: string
}

export interface ScheduleIngestionResult {
  fileName: string
  fileType: string
  fileSize: number
  fileHash: string
  rawText: string
  needsOcr: boolean
  pageImages?: string[]
  candidates: CandidateScheduleEvent[]
  isDuplicate?: boolean
  existingDocId?: number
}

export interface ScheduleEventFilters {
  category?: string
  startDate?: string
  endDate?: string
  sourceDocId?: number
  isCompleted?: boolean
  reviewStatus?: string
  search?: string
}

export type ActiveTab = 'today' | 'timetable' | 'schedules' | 'tasks' | 'plan' | 'weekly' | 'settings'

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
