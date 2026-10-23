export interface ParsedClassCandidate {
  title: string
  weekday: number // 0 = Sun, 1 = Mon, ..., 6 = Sat
  startTime: string // HH:mm
  endTime: string // HH:mm
  room: string
  notes: string
  confidence?: 'high' | 'medium' | 'low'
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Day pattern matching
const DAY_REGEX = /\b(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)\b/i

// Time matching patterns
const TIME_RANGE_REGEX = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to|until)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/i
const SINGLE_TIME_REGEX = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/ig

// Room patterns
const ROOM_BRACKET_REGEX = /\[(?:Room|Rm|Hall|Lab)\s*[:#-]?\s*([a-z0-9\-]+)\]|\((?:Room|Rm|Hall|Lab)\s*[:#-]?\s*([a-z0-9\-]+)\)/i
const ROOM_REGEX = /\b(?:room|rm\.?|hall|lab|lecture\s*hall|auditorium|bldg\.?|building|block)\s*[:#-]?\s*([a-z0-9\-]+)/i

function normalizeTime(hourStr: string, minStr: string | undefined, ampm: string | undefined): string {
  let h = parseInt(hourStr, 10)
  const m = minStr ? parseInt(minStr, 10) : 0
  const ap = (ampm || '').toLowerCase()

  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0

  if (h > 23) h = 23
  const safeM = m > 59 ? 0 : m

  return `${String(h).padStart(2, '0')}:${String(safeM).padStart(2, '0')}`
}

function resolveWeekday(text: string): number {
  const lower = text.toLowerCase().trim()
  for (let i = 0; i < WEEKDAY_NAMES.length; i++) {
    if (WEEKDAY_NAMES[i].toLowerCase() === lower) return i
  }
  for (let i = 0; i < SHORT_WEEKDAYS.length; i++) {
    if (lower.startsWith(SHORT_WEEKDAYS[i].toLowerCase())) return i
  }
  if (lower.startsWith('tues')) return 2
  if (lower.startsWith('thur') || lower.startsWith('thurs')) return 4
  return -1
}

export function parseTimetableText(text: string): ParsedClassCandidate[] {
  if (!text || !text.trim()) return []

  const candidates: ParsedClassCandidate[] = []
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  // First check if text looks like a tabular schedule with day columns as headers
  const headerCheck = checkTabularHeader(rawLines)
  if (headerCheck.isTabular && headerCheck.results.length > 0) {
    return headerCheck.results
  }

  let currentContextDay = -1

  for (const line of rawLines) {
    // Check if line is purely a weekday header, e.g. "MONDAY" or "Tuesday Schedule"
    const standaloneDayMatch = line.match(/^[\s\W]*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)[\s\W]*$/i)
    if (standaloneDayMatch) {
      currentContextDay = resolveWeekday(standaloneDayMatch[1])
      continue
    }

    // Try parsing line
    const parsed = parseLineForLesson(line, currentContextDay)
    if (parsed) {
      candidates.push(parsed)
      // update context day if one was found explicitly on this line
      if (parsed.weekday >= 0) {
        currentContextDay = parsed.weekday
      }
    }
  }

  // Deduplicate candidates with identical title, weekday, and startTime
  const seen = new Set<string>()
  const uniqueCandidates: ParsedClassCandidate[] = []

  for (const c of candidates) {
    const key = `${c.weekday}-${c.startTime}-${c.title.toLowerCase()}`
    if (!seen.has(key)) {
      seen.add(key)
      uniqueCandidates.push(c)
    }
  }

  return uniqueCandidates.slice(0, 150)
}

function parseLineForLesson(line: string, defaultDay: number): ParsedClassCandidate | null {
  // Check for weekday
  let weekday = defaultDay
  const dayMatch = line.match(DAY_REGEX)
  let cleanLine = line

  if (dayMatch) {
    const matchedDay = resolveWeekday(dayMatch[1])
    if (matchedDay >= 0) {
      weekday = matchedDay
      cleanLine = cleanLine.replace(dayMatch[0], ' ')
    }
  }

  if (weekday < 0) {
    return null
  }

  // Check for time range first (e.g. "09:00 - 10:30" or "9:00am to 10:00am")
  let startTime = ''
  let endTime = ''

  const rangeMatch = cleanLine.match(TIME_RANGE_REGEX)
  if (rangeMatch) {
    const startH = rangeMatch[1]
    const startM = rangeMatch[2]
    const startAp = rangeMatch[3]
    const endH = rangeMatch[4]
    const endM = rangeMatch[5]
    const endAp = rangeMatch[6] || startAp

    startTime = normalizeTime(startH, startM, startAp)
    endTime = normalizeTime(endH, endM, endAp)

    cleanLine = cleanLine.replace(rangeMatch[0], ' ')
  } else {
    // Check for single times
    const times = [...cleanLine.matchAll(SINGLE_TIME_REGEX)].map(m => {
      return normalizeTime(m[1], m[2], m[3])
    })

    if (times.length >= 1) {
      startTime = times[0]
      if (times.length >= 2) {
        endTime = times[1]
      }
      cleanLine = cleanLine.replace(SINGLE_TIME_REGEX, ' ')
    }
  }

  if (!startTime) {
    return null
  }

  // Extract room - check bracketed room first
  let room = ''
  const bracketMatch = cleanLine.match(ROOM_BRACKET_REGEX)
  if (bracketMatch) {
    room = (bracketMatch[1] || bracketMatch[2]).trim()
    cleanLine = cleanLine.replace(bracketMatch[0], ' ')
  } else {
    const roomMatch = cleanLine.match(ROOM_REGEX)
    if (roomMatch) {
      room = (roomMatch[1] || roomMatch[0]).trim()
      cleanLine = cleanLine.replace(roomMatch[0], ' ')
    }
  }

  // Clean remaining title
  let title = cleanLine
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/[|\t–—\-:;,\/\\_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Filter out noisy fragments
  if (title.length < 2 || /^(am|pm|class|period|session|lecture|lesson)$/i.test(title)) {
    title = 'Class / Lecture'
  }

  // If title ends with common noise like "Room" or "Rm"
  title = title.replace(/\b(room|rm|hall|lab)\b$/i, '').trim()

  return {
    title: title.slice(0, 100),
    weekday,
    startTime,
    endTime,
    room,
    notes: 'Imported — verify day and time',
    confidence: room && endTime ? 'high' : 'medium'
  }
}

interface TabularDetection {
  isTabular: boolean
  results: ParsedClassCandidate[]
}

function checkTabularHeader(lines: string[]): TabularDetection {
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i]
    const dayMatches = [...line.matchAll(new RegExp(DAY_REGEX.source, 'gi'))]
    if (dayMatches.length >= 3) {
      const dayColumns = dayMatches.map(m => ({
        dayIndex: resolveWeekday(m[0]),
        name: m[0],
        charIndex: m.index ?? 0
      })).filter(d => d.dayIndex >= 0)

      const parsed: ParsedClassCandidate[] = []

      for (let j = i + 1; j < lines.length; j++) {
        const row = lines[j]
        const timeMatch = row.match(TIME_RANGE_REGEX) || row.match(/^\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)/i)
        if (!timeMatch) continue

        let startTime = '09:00'
        let endTime = ''
        if (row.match(TIME_RANGE_REGEX)) {
          const m = row.match(TIME_RANGE_REGEX)!
          startTime = normalizeTime(m[1], m[2], m[3])
          endTime = normalizeTime(m[4], m[5], m[6] || m[3])
        }

        const cells = row.split(/\t|\s{3,}|\|/).map(c => c.trim()).filter(Boolean)
        for (let colIdx = 0; colIdx < Math.min(cells.length, dayColumns.length); colIdx++) {
          const cellText = cells[colIdx]
          if (!cellText || cellText.length < 2 || cellText === timeMatch[0]) continue

          const colDay = dayColumns[colIdx].dayIndex
          let room = ''
          const rMatch = cellText.match(/\((.*?)\)|\[(.*?)\]/)
          let cleanTitle = cellText
          if (rMatch) {
            room = (rMatch[1] || rMatch[2]).trim()
            cleanTitle = cleanTitle.replace(rMatch[0], '').trim()
          }

          if (cleanTitle.length > 1) {
            parsed.push({
              title: cleanTitle.slice(0, 100),
              weekday: colDay,
              startTime,
              endTime,
              room,
              notes: 'Extracted from table',
              confidence: 'high'
            })
          }
        }
      }

      if (parsed.length > 0) {
        return { isTabular: true, results: parsed }
      }
    }
  }

  return { isTabular: false, results: [] }
}
