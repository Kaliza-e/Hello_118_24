import { listClasses, listTasks, getSetting, toggleTask, TaskRecord } from './db'

export interface FreeTimeSlot {
  slotKey: string
  startMinutes: number
  endMinutes: number
  durationMinutes: number
  freeUntil: string
  nextEventTitle?: string
  nextClassId?: number
}

export interface FreeTimeSuggestion {
  hasFreeTime: boolean
  freeMinutes: number
  freeUntil: string
  nextEventTitle?: string
  slotKey: string
  suggestedTask?: TaskRecord | null
  message: string
  isSnoozed?: boolean
}

// In-memory snooze & dismissal tracking
let snoozeAllUntilTimestamp = 0
const dismissedSlots = new Set<string>()

// Helper: Convert "HH:mm" to total minutes since midnight
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return -1
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

// Helper: Convert total minutes since midnight to "HH:mm"
export function minutesToTimeString(minutes: number): string {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, Math.floor(minutes)))
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Helper: Determine if current time is inside quiet hours
export function isTimeInQuietHours(now: Date, quietStartStr = '21:00', quietEndStr = '07:00'): boolean {
  const currentMins = now.getHours() * 60 + now.getMinutes()
  const startMins = timeStringToMinutes(quietStartStr)
  const endMins = timeStringToMinutes(quietEndStr)

  if (startMins === -1 || endMins === -1) return false

  if (startMins > endMins) {
    // Crosses midnight, e.g. 21:00 to 07:00
    return currentMins >= startMins || currentMins < endMins
  } else {
    // Within the same day, e.g. 13:00 to 15:00
    return currentMins >= startMins && currentMins < endMins
  }
}

// Helper: Check if today is allowed based on user preference
export function isDayAllowedForReminders(weekday: number, allowedDaysSetting = 'all'): boolean {
  if (allowedDaysSetting === 'weekdays') {
    // 0 = Sunday, 6 = Saturday
    return weekday >= 1 && weekday <= 5
  }
  return true
}

// Detect the current free time slot
export function detectCurrentFreeSlot(now: Date = new Date()): FreeTimeSlot | null {
  const currentWeekday = now.getDay()
  const currentHours = now.getHours()
  const currentMinutes = now.getMinutes()
  const currentTotalMinutes = currentHours * 60 + currentMinutes
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // Check master setting
  const freePeriodRemindersEnabled = getSetting('free_period_reminders_enabled') !== 'false'
  if (!freePeriodRemindersEnabled) return null

  // Check notifications setting
  const notificationsEnabled = getSetting('notifications_enabled') !== 'false'
  if (!notificationsEnabled) return null

  // Check quiet hours
  const quietHoursEnabled = getSetting('quiet_hours_enabled') !== 'false'
  if (quietHoursEnabled) {
    const qStart = getSetting('quiet_hours_start') || '21:00'
    const qEnd = getSetting('quiet_hours_end') || '07:00'
    if (isTimeInQuietHours(now, qStart, qEnd)) {
      return null
    }
  }

  // Check active days setting
  const allowedDays = getSetting('free_reminder_days') || 'all'
  if (!isDayAllowedForReminders(currentWeekday, allowedDays)) {
    return null
  }

  // Minimum free time duration setting (default: 20 min)
  const minMinsSetting = parseInt(getSetting('free_reminder_min_minutes') || '20', 10)
  const minDuration = isNaN(minMinsSetting) || minMinsSetting < 10 ? 20 : minMinsSetting

  // Get today's classes
  const classes = listClasses()
    .filter(c => c.weekday === currentWeekday && c.start_time && /^\d{2}:\d{2}$/.test(c.start_time))
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  // Compute parsed start and end minutes for each class
  const classIntervals = classes.map(c => {
    const sMins = timeStringToMinutes(c.start_time)
    let eMins = c.end_time && /^\d{2}:\d{2}$/.test(c.end_time) ? timeStringToMinutes(c.end_time) : -1
    if (eMins <= sMins) {
      eMins = sMins + 50 // Standard class duration fallback
    }
    return {
      id: c.id,
      title: c.title,
      startMins: sMins,
      endMins: eMins,
      startTimeStr: c.start_time,
      endTimeStr: minutesToTimeString(eMins)
    }
  })

  // 1. NEVER INTERRUPT AN ONGOING CLASS
  for (const item of classIntervals) {
    if (currentTotalMinutes >= item.startMins && currentTotalMinutes < item.endMins) {
      // User is currently in class
      return null
    }
  }

  // 2. CHECK GAPS BETWEEN CONSECUTIVE CLASSES
  for (let i = 0; i < classIntervals.length - 1; i++) {
    const prevClass = classIntervals[i]
    const nextClass = classIntervals[i + 1]

    if (currentTotalMinutes >= prevClass.endMins && currentTotalMinutes < nextClass.startMins) {
      const remainingMinutes = nextClass.startMins - currentTotalMinutes
      if (remainingMinutes >= minDuration) {
        return {
          slotKey: `gap-${todayStr}-${prevClass.id}-${nextClass.id}-${prevClass.endTimeStr}-${nextClass.startTimeStr}`,
          startMinutes: prevClass.endMins,
          endMinutes: nextClass.startMins,
          durationMinutes: remainingMinutes,
          freeUntil: nextClass.startTimeStr,
          nextEventTitle: nextClass.title,
          nextClassId: nextClass.id
        }
      }
    }
  }

  // 3. CHECK FREE TIME BEFORE THE FIRST CLASS
  if (classIntervals.length > 0) {
    const firstClass = classIntervals[0]
    // Consider active daytime starting at 08:00 (480 mins)
    const dayStartMins = 8 * 60
    if (currentTotalMinutes >= dayStartMins && currentTotalMinutes < firstClass.startMins) {
      const remainingMinutes = firstClass.startMins - currentTotalMinutes
      if (remainingMinutes >= minDuration) {
        return {
          slotKey: `before-first-${todayStr}-${firstClass.id}-${firstClass.startTimeStr}`,
          startMinutes: dayStartMins,
          endMinutes: firstClass.startMins,
          durationMinutes: remainingMinutes,
          freeUntil: firstClass.startTimeStr,
          nextEventTitle: firstClass.title,
          nextClassId: firstClass.id
        }
      }
    }
  }

  // 4. CHECK FREE TIME AFTER THE LAST CLASS
  if (classIntervals.length > 0) {
    const lastClass = classIntervals[classIntervals.length - 1]
    const quietStartStr = getSetting('quiet_hours_start') || '21:00'
    const eveningEndMins = Math.min(21 * 60, timeStringToMinutes(quietStartStr) > 0 ? timeStringToMinutes(quietStartStr) : 21 * 60)

    if (currentTotalMinutes >= lastClass.endMins && currentTotalMinutes < eveningEndMins) {
      const remainingMinutes = eveningEndMins - currentTotalMinutes
      if (remainingMinutes >= minDuration) {
        return {
          slotKey: `after-last-${todayStr}-${lastClass.id}-${lastClass.endTimeStr}`,
          startMinutes: lastClass.endMins,
          endMinutes: eveningEndMins,
          durationMinutes: remainingMinutes,
          freeUntil: minutesToTimeString(eveningEndMins),
          nextEventTitle: 'Study / Evening time'
        }
      }
    }
  }

  // 5. NO SCHEDULED CLASSES TODAY
  if (classIntervals.length === 0) {
    const dayStartMins = 9 * 60
    const quietStartStr = getSetting('quiet_hours_start') || '21:00'
    const eveningEndMins = Math.min(21 * 60, timeStringToMinutes(quietStartStr) > 0 ? timeStringToMinutes(quietStartStr) : 21 * 60)

    if (currentTotalMinutes >= dayStartMins && currentTotalMinutes < eveningEndMins) {
      const remainingMinutes = eveningEndMins - currentTotalMinutes
      if (remainingMinutes >= minDuration) {
        return {
          slotKey: `free-day-${todayStr}-${Math.floor(currentTotalMinutes / 60)}`,
          startMinutes: currentTotalMinutes,
          endMinutes: eveningEndMins,
          durationMinutes: Math.min(90, remainingMinutes),
          freeUntil: minutesToTimeString(currentTotalMinutes + Math.min(90, remainingMinutes)),
          nextEventTitle: 'Free day'
        }
      }
    }
  }

  return null
}

// Score tasks based on estimated duration, priority, deadline, and upcoming class
export function scoreTaskForFreeTime(task: TaskRecord, freeMinutes: number, todayStr: string, nextClassId?: number): number {
  let score = 0

  // 1. Estimated duration fit
  const estMins =
    task.estimated_minutes && task.estimated_minutes > 0
      ? task.estimated_minutes
      : task.priority === 'high'
        ? 45
        : task.priority === 'low'
          ? 15
          : 25

  if (estMins <= freeMinutes) {
    // Fits completely within available time
    score += 60
    // Reward tasks that make good use of the time without overflowing
    const ratio = estMins / freeMinutes
    score += Math.round(ratio * 20)
  } else if (estMins <= freeMinutes + 15) {
    // Close enough to make significant progress
    score += 35
  } else {
    // Too long for this slot
    score += 5
  }

  // 2. Priority bonus
  if (task.priority === 'high') score += 30
  else if (task.priority === 'normal') score += 15
  else score += 5

  // 3. Deadline / Urgency bonus
  if (task.due_date) {
    if (task.due_date < todayStr) {
      score += 45 // Overdue
    } else if (task.due_date === todayStr) {
      score += 35 // Due today
    } else {
      score += 10
    }
  }

  // 4. Preparation for next upcoming class
  if (nextClassId && task.class_id === nextClassId) {
    score += 25
  }

  return score
}

// Main function: Get the current smart free-time suggestion
export function getFreeTimeSuggestion(now: Date = new Date()): FreeTimeSuggestion {
  const slot = detectCurrentFreeSlot(now)
  if (!slot) {
    return {
      hasFreeTime: false,
      freeMinutes: 0,
      freeUntil: '',
      slotKey: '',
      suggestedTask: null,
      message: 'No active free period at this moment.'
    }
  }

  // Check if snoozed
  const isSnoozed = Date.now() < snoozeAllUntilTimestamp
  const isDismissed = dismissedSlots.has(slot.slotKey)

  if (isDismissed) {
    return {
      hasFreeTime: false,
      freeMinutes: 0,
      freeUntil: slot.freeUntil,
      slotKey: slot.slotKey,
      suggestedTask: null,
      message: 'Free time reminder dismissed for this period.'
    }
  }

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // Fetch pending tasks
  const pendingTasks = listTasks().filter(t => !t.completed)

  if (pendingTasks.length === 0) {
    return {
      hasFreeTime: true,
      freeMinutes: slot.durationMinutes,
      freeUntil: slot.freeUntil,
      nextEventTitle: slot.nextEventTitle,
      slotKey: slot.slotKey,
      suggestedTask: null,
      message: `You have ${slot.durationMinutes} minutes free until ${slot.freeUntil}. Want to plan something for this time?`,
      isSnoozed
    }
  }

  // Score and rank tasks
  const scored = pendingTasks.map(t => ({
    task: t,
    score: scoreTaskForFreeTime(t, slot.durationMinutes, todayStr, slot.nextClassId)
  }))

  scored.sort((a, b) => b.score - a.score)
  const bestTask = scored[0].task

  const nextContext = slot.nextEventTitle ? ` (${slot.nextEventTitle})` : ''
  const message = `You have ${slot.durationMinutes} minutes free until ${slot.freeUntil}${nextContext}. Good time to work on: "${bestTask.title}".`

  return {
    hasFreeTime: true,
    freeMinutes: slot.durationMinutes,
    freeUntil: slot.freeUntil,
    nextEventTitle: slot.nextEventTitle,
    slotKey: slot.slotKey,
    suggestedTask: bestTask,
    message,
    isSnoozed
  }
}

// Action: Snooze reminders for a number of minutes
export function snoozeFreeTimeReminder(minutes = 15): void {
  snoozeAllUntilTimestamp = Date.now() + minutes * 60 * 1000
}

// Action: Dismiss current free time slot reminder
export function dismissFreeTimeReminder(slotKey: string): void {
  if (slotKey) {
    dismissedSlots.add(slotKey)
  }
}

// Action: Complete task directly from suggestion
export function completeSuggestedTask(taskId: number): boolean {
  try {
    toggleTask(taskId, true)
    return true
  } catch {
    return false
  }
}

// Reset snooze & dismissed state (useful for tests)
export function resetFreeTimeState(): void {
  snoozeAllUntilTimestamp = 0
  dismissedSlots.clear()
}
