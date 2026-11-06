import { z } from 'zod'

// Task schemas
export const TaskPrioritySchema = z.enum(['low', 'normal', 'high'])

export const TaskCreateSchema = z.object({
  title: z.string().trim().min(1, 'Task title cannot be empty').max(240, 'Task title too long'),
  description: z.string().trim().max(2000).optional().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD').optional().nullable(),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/, 'Due time must be HH:mm').optional().nullable(),
  priority: TaskPrioritySchema.default('normal'),
  category: z.string().trim().max(100).optional().nullable(),
  classId: z.number().int().positive().optional().nullable(),
  estimatedMinutes: z.number().int().min(1).max(1440).optional().nullable(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable()
})

export const TaskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  priority: TaskPrioritySchema.optional(),
  completed: z.boolean().optional(),
  category: z.string().trim().max(100).optional().nullable(),
  classId: z.number().int().positive().optional().nullable(),
  estimatedMinutes: z.number().int().min(1).max(1440).optional().nullable(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable()
})

// Class / Timetable schemas
export const ClassCreateSchema = z.object({
  title: z.string().trim().min(1, 'Class title is required').max(160, 'Class title too long'),
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be HH:mm').optional().nullable(),
  room: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  color: z.string().trim().max(30).optional().nullable()
})

export const ClassUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  weekday: z.number().int().min(0).max(6).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  room: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  color: z.string().trim().max(30).optional().nullable()
})

// Daily plan schema
export const DailyPlanSchema = z.object({
  notes: z.string().max(10000).optional().nullable(),
  materialsChecked: z.array(z.string().max(200)).optional().nullable()
})

// Schedule Event schema
export const ScheduleCategorySchema = z.enum([
  'Academic Calendar',
  'Exams',
  'Assignments',
  'Applications',
  'Events',
  'Workshops',
  'Meetings',
  'Personal',
  'Other'
])

export const ScheduleEventCreateSchema = z.object({
  sourceDocId: z.number().int().positive().optional().nullable(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(3000).optional().nullable(),
  category: ScheduleCategorySchema.default('Other'),
  tags: z.string().trim().max(200).optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  isAllDay: z.boolean().default(true),
  location: z.string().trim().max(200).optional().nullable(),
  recurrenceRule: z.string().trim().max(200).optional().nullable(),
  sourceExcerpt: z.string().trim().max(1000).optional().nullable(),
  sourcePage: z.number().int().min(1).optional().nullable(),
  confidence: z.enum(['high', 'medium', 'low']).default('high'),
  reviewStatus: z.enum(['confirmed', 'pending_review', 'excluded']).default('confirmed')
})

// PIN schema
export const PinSchema = z.string().regex(/^\d{4,8}$/, 'PIN must be between 4 and 8 digits')

/**
 * Formula / CSV Injection Sanitizer:
 * Escapes leading =, +, -, @, \t, \r in untrusted cells to prevent DDE/formula execution in Excel.
 */
export function sanitizeSpreadsheetCell(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/^[=\+\-@\t\r]/.test(str)) {
    return `'${str}`
  }
  return str
}

export const sanitizeFormulaValue = sanitizeSpreadsheetCell

/**
 * Strips raw HTML tags from user input to prevent HTML/XSS injection when rendered.
 */
export function sanitizePlainText(input: string | null | undefined): string {
  if (!input) return ''
  return String(input)
    .replace(/<[^>]*>/g, '')
    .trim()
}

