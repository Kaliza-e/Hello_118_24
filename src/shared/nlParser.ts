export interface ParsedTaskInput {
  raw: string
  cleanTitle: string
  dueDate?: string // YYYY-MM-DD
  dueTime?: string // HH:mm
  priority?: 'low' | 'normal' | 'high'
  estimatedMinutes?: number
  category?: string
  hasParsedFields: boolean
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6
}

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
}

/**
 * Natural Language Task Parser
 * Parses date, time, priority, duration, and category out of freeform input.
 */
export function parseNaturalLanguageTask(text: string, baseDate = new Date()): ParsedTaskInput {
  if (!text || !text.trim()) {
    return {
      raw: '',
      cleanTitle: '',
      hasParsedFields: false
    }
  }

  let working = text.trim()
  let dueDate: string | undefined = undefined
  let dueTime: string | undefined = undefined
  let priority: 'low' | 'normal' | 'high' | undefined = undefined
  let estimatedMinutes: number | undefined = undefined
  let category: string | undefined = undefined

  // 1. Category extraction: e.g. #Project, #Math, #Exam
  const categoryMatch = working.match(/(?:^|\s)#([a-zA-Z0-9_\-]+)/)
  if (categoryMatch) {
    category = categoryMatch[1]
    working = working.replace(categoryMatch[0], ' ')
  }

  // 2. Duration extraction: e.g. ~45m, ~1h, 45min, 1.5h, 90m
  const durationMatch = working.match(/(?:^|\s)(?:~|for\s+)?(\d+(?:\.\d+)?)\s*(m|min|mins|minutes|h|hr|hrs|hours)\b/i)
  if (durationMatch) {
    const val = parseFloat(durationMatch[1])
    const unit = durationMatch[2].toLowerCase()
    if (unit.startsWith('h')) {
      estimatedMinutes = Math.round(val * 60)
    } else {
      estimatedMinutes = Math.round(val)
    }
    working = working.replace(durationMatch[0], ' ')
  }

  // 3. Priority extraction: e.g. !high, high, urgent, asap, p1, !low, p3, low
  const priorityMatch = working.match(/(?:^|\s)(?:!|priority:)?(urgent|asap|high|p1|medium|normal|p2|low|p3)\b/i)
  if (priorityMatch) {
    const pStr = priorityMatch[1].toLowerCase()
    if (['urgent', 'asap', 'high', 'p1'].includes(pStr)) {
      priority = 'high'
    } else if (['low', 'p3'].includes(pStr)) {
      priority = 'low'
    } else if (['medium', 'normal', 'p2'].includes(pStr)) {
      priority = 'normal'
    }
    working = working.replace(priorityMatch[0], ' ')
  }

  // 4. Time extraction: e.g. at 5pm, 5:30pm, 17:00, 9am, at noon, midnight, at 8h30
  const timeMatch = working.match(
    /(?:^|\s)(?:at\s+)?(?:(\d{1,2})(?::(\d{2}))?\s*(am|pm)|(\d{1,2})h(?:(\d{2}))?|(\d{1,2}):(\d{2})|noon|midnight)\b/i
  )
  if (timeMatch) {
    const fullMatch = timeMatch[0]
    const lower = fullMatch.toLowerCase().trim().replace(/^at\s+/, '')

    if (lower === 'noon') {
      dueTime = '12:00'
    } else if (lower === 'midnight') {
      dueTime = '00:00'
    } else if (timeMatch[1]) {
      // 5pm or 5:30pm or 9am
      let h = parseInt(timeMatch[1], 10)
      const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0
      const ampm = timeMatch[3].toLowerCase()
      if (ampm === 'pm' && h < 12) h += 12
      if (ampm === 'am' && h === 12) h = 0
      dueTime = `${pad2(h)}:${pad2(m)}`
    } else if (timeMatch[4]) {
      // 8h30 or 14h
      const h = parseInt(timeMatch[4], 10)
      const m = timeMatch[5] ? parseInt(timeMatch[5], 10) : 0
      dueTime = `${pad2(h)}:${pad2(m)}`
    } else if (timeMatch[6] && timeMatch[7]) {
      // 17:00
      const h = parseInt(timeMatch[6], 10)
      const m = parseInt(timeMatch[7], 10)
      dueTime = `${pad2(h)}:${pad2(m)}`
    }
    working = working.replace(fullMatch, ' ')
  }

  // 5. Date extraction
  // Relative days: today, tomorrow, tmr, tonight
  const relDayMatch = working.match(/(?:^|\s)\b(today|tonight|tomorrow|tmr)\b/i)
  if (relDayMatch) {
    const word = relDayMatch[1].toLowerCase()
    const target = new Date(baseDate)
    if (word === 'tomorrow' || word === 'tmr') {
      target.setDate(target.getDate() + 1)
    }
    dueDate = toDateString(target)
    working = working.replace(relDayMatch[0], ' ')
  }

  // In X days / in a week
  if (!dueDate) {
    const inDaysMatch = working.match(/(?:^|\s)\bin\s+(\d+)\s+days?\b/i)
    if (inDaysMatch) {
      const days = parseInt(inDaysMatch[1], 10)
      const target = new Date(baseDate)
      target.setDate(target.getDate() + days)
      dueDate = toDateString(target)
      working = working.replace(inDaysMatch[0], ' ')
    } else {
      const inWeekMatch = working.match(/(?:^|\s)\bin\s+a\s+week\b/i)
      if (inWeekMatch) {
        const target = new Date(baseDate)
        target.setDate(target.getDate() + 7)
        dueDate = toDateString(target)
        working = working.replace(inWeekMatch[0], ' ')
      }
    }
  }

  // Next / this / on <weekday>
  if (!dueDate) {
    const weekdayMatch = working.match(
      /(?:^|\s)(?:on\s+|this\s+|next\s+)?\b(monday|mon|tuesday|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat|sunday|sun)\b/i
    )
    if (weekdayMatch) {
      const fullMatch = weekdayMatch[0]
      const dayName = weekdayMatch[1].toLowerCase()
      const targetDay = WEEKDAY_MAP[dayName]
      if (targetDay !== undefined) {
        const currentDay = baseDate.getDay()
        let diff = targetDay - currentDay
        if (diff <= 0) diff += 7 // next upcoming occurrence
        const isNext = /next\s+/i.test(fullMatch)
        if (isNext && diff < 7) {
          diff += 7
        }
        const target = new Date(baseDate)
        target.setDate(target.getDate() + diff)
        dueDate = toDateString(target)
        working = working.replace(fullMatch, ' ')
      }
    }
  }

  // Month date: e.g. Nov 15 or 15 Nov or November 25
  if (!dueDate) {
    const monthDateMatch = working.match(
      /(?:^|\s)\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i
    )
    if (monthDateMatch) {
      const mStr = monthDateMatch[1].toLowerCase().slice(0, 3)
      const dNum = parseInt(monthDateMatch[2], 10)
      const mNum = MONTH_MAP[mStr]
      if (mNum && dNum >= 1 && dNum <= 31) {
        const y = baseDate.getFullYear()
        dueDate = `${y}-${pad2(mNum)}-${pad2(dNum)}`
        working = working.replace(monthDateMatch[0], ' ')
      }
    } else {
      const dayMonthMatch = working.match(
        /(?:^|\s)\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i
      )
      if (dayMonthMatch) {
        const dNum = parseInt(dayMonthMatch[1], 10)
        const mStr = dayMonthMatch[2].toLowerCase().slice(0, 3)
        const mNum = MONTH_MAP[mStr]
        if (mNum && dNum >= 1 && dNum <= 31) {
          const y = baseDate.getFullYear()
          dueDate = `${y}-${pad2(mNum)}-${pad2(dNum)}`
          working = working.replace(dayMonthMatch[0], ' ')
        }
      }
    }
  }

  // ISO date: YYYY-MM-DD
  if (!dueDate) {
    const isoMatch = working.match(/(?:^|\s)(\d{4}-\d{2}-\d{2})\b/)
    if (isoMatch) {
      dueDate = isoMatch[1]
      working = working.replace(isoMatch[0], ' ')
    }
  }

  // Clean title: collapse extra spaces and trim punctuation
  const cleanTitle = working
    .replace(/\s+/g, ' ')
    .replace(/^[-–—:,.\s]+|[-–—:,.\s]+$/g, '')
    .trim()

  const hasParsedFields = Boolean(dueDate || dueTime || priority || estimatedMinutes || category)

  return {
    raw: text,
    cleanTitle: cleanTitle || text.trim(),
    dueDate,
    dueTime,
    priority,
    estimatedMinutes,
    category,
    hasParsedFields
  }
}

