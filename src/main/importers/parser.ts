export interface ParsedClassCandidate {
  title: string
  weekday: number // 0 = Sun, 1 = Mon, ..., 6 = Sat
  startTime: string // HH:mm
  endTime: string // HH:mm
  room: string
  notes: string
  confidence?: 'high' | 'medium' | 'low'
}

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Day pattern matching
export const DAY_REGEX = /\b(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)\b/i

// Time matching patterns
export const TIME_RANGE_REGEX = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to|until)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/i
export const SINGLE_TIME_REGEX = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/ig

// Room patterns
export const ROOM_BRACKET_REGEX = /\[(?:Room|Rm|Hall|Lab)\s*[:#-]?\s*([a-z0-9\-]+)\]|\((?:Room|Rm|Hall|Lab)\s*[:#-]?\s*([a-z0-9\-]+)\)/i
export const ROOM_REGEX = /\b(?:room|rm\.?|hall|lab|lecture\s*hall|auditorium|bldg\.?|building|block)\s*[:#-]?\s*([a-z0-9\-]+)/i

const KNOWN_SUBJECT_WORDS = new Set([
  'maths', 'mathematics', 'physics', 'chemistry', 'biology',
  'devops', 'mobile', 'intelligent robotics', 'machine learning',
  'cybersecurity', 'project management', 'english', 'french',
  'kinyarwanda', 'history', 'geography', 'ict', 'computer science',
  'software engineering', 'networking', 'database', 'entrepreneurship',
  'physical education', 'robotics', 'economics', 'accounting',
  'philosophy', 'literature', 'music', 'art', 'calculus', 'algebra',
  'geometry', 'statistics', 'science', 'technology', 'design'
])

const SUBJECT_ACRONYMS = new Set(['DEVOPS', 'ICT', 'STEM', 'AI', 'ML', 'IOT', 'IT', 'CAD', 'OS', 'OOP', 'DBMS'])

export function normalizeTime(hourStr: string, minStr: string | undefined, ampm: string | undefined = ''): string {
  let h = parseInt(hourStr, 10)
  const m = minStr ? parseInt(minStr, 10) : 0
  const ap = (ampm || '').toLowerCase()

  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0

  if (h > 23) h = 23
  const safeM = m > 59 ? 0 : m

  return `${String(h).padStart(2, '0')}:${String(safeM).padStart(2, '0')}`
}

export function parseTimeString(timeStr: string): string {
  const match = timeStr.trim().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/i)
  if (!match) return timeStr.trim()
  return normalizeTime(match[1], match[2], match[3])
}

export function resolveWeekday(text: string): number {
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

function isKnownSubject(text: string): boolean {
  return KNOWN_SUBJECT_WORDS.has(text.toLowerCase().trim())
}

function isSurname(word: string): boolean {
  return /^[A-Z]{3,}$/.test(word) && !SUBJECT_ACRONYMS.has(word)
}

function isTeacherNameLine(line: string): boolean {
  if (isKnownSubject(line)) return false
  const words = line.trim().split(/\s+/)
  if (/^(dr\.?|prof\.?|mr\.?|ms\.?|mrs\.?|eng\.?|teacher)\b/i.test(line)) return true
  return words.some(w => isSurname(w))
}

function isEmptySlot(line: string): boolean {
  const trimmed = line.trim()
  return /^[—–\-]+$/.test(trimmed) || /^(free|nil|none|n\/a|self\s*study|study|empty)$/i.test(trimmed)
}

interface DayColumn {
  name: string
  weekday: number
}

function extractDayColumnsFromHeader(line: string): DayColumn[] {
  const dayMatches = [...line.matchAll(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/gi)]
  if (dayMatches.length < 3) return []

  const columns: DayColumn[] = []
  const seenDays = new Set<number>()
  for (const m of dayMatches) {
    const idx = resolveWeekday(m[0])
    if (idx >= 0 && !seenDays.has(idx)) {
      seenDays.add(idx)
      columns.push({ name: m[0], weekday: idx })
    }
  }
  return columns.length >= 3 ? columns : []
}

interface TimeBlock {
  startTime: string
  endTime: string
  tokens: string[]
}

export function parseGridTimetable(text: string): ParsedClassCandidate[] {
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  // 1. Detect header day columns
  let dayColumns: DayColumn[] = []
  for (const line of rawLines) {
    const cols = extractDayColumnsFromHeader(line)
    if (cols.length >= 3) {
      dayColumns = cols
      break
    }
  }

  if (dayColumns.length < 3) {
    return []
  }

  const numCols = dayColumns.length

  // 2. Preprocess lines: filter noise and separate inline dash indicators
  const lines: string[] = []
  for (const line of rawLines) {
    // Skip break intervals
    if (
      /^(morning\s*break|afternoon\s*break|lunch|tea\s*break|break|recess|assembly|interval)\b/i.test(line) ||
      /\b(break|lunch)\s*\(\d{1,2}:\d{2}/i.test(line)
    ) {
      continue
    }

    // Skip admin/metadata/footer lines
    if (
      /^(approved\s*by|principal\s*director|ag\.\s*principal\s*director|rwanda\s*coding\s*academy|academic\s*operations|class\s*timetable|scan\s*to\s*verify)/i.test(line) ||
      /\b(term\s*\d|generated:|rca-ctt-)/i.test(line)
    ) {
      continue
    }

    // Skip repeated day header lines
    if (extractDayColumnsFromHeader(line).length >= 3) {
      continue
    }

    // Check for leading or trailing dashes (e.g. "Stanley MWIZERWA —" or "to 16:10 —")
    let working = line
    let leadingDash = false
    let trailingDash = false

    if (/^[—–\-]+\s+/.test(working)) {
      leadingDash = true
      working = working.replace(/^[—–\-]+\s+/, '').trim()
    }
    if (/\s+[—–\-]+$/.test(working)) {
      trailingDash = true
      working = working.replace(/\s+[—–\-]+$/, '').trim()
    }

    if (leadingDash) lines.push('—')
    if (working) lines.push(working)
    if (trailingDash) lines.push('—')
  }

  // 3. Segment into time blocks
  const timeRangeRegex = /^(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)\s*(?:to|-|–|—)\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)$/i
  const blocks: TimeBlock[] = []
  let currentBlock: TimeBlock | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Case A: two lines: "08:30" followed by "to 09:20"
    const singleTimeMatch = line.match(/^(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)$/i)
    const nextLine = lines[i + 1] || ''
    const toTimeMatch = nextLine.match(/^(?:to|-|–|—)\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)$/i)

    if (singleTimeMatch && toTimeMatch) {
      if (currentBlock) blocks.push(currentBlock)
      currentBlock = {
        startTime: parseTimeString(singleTimeMatch[1]),
        endTime: parseTimeString(toTimeMatch[1]),
        tokens: []
      }
      i++ // Skip nextLine
      continue
    }

    // Case B: single line range: "08:30 to 09:20" or "08:30 - 09:20"
    const rangeMatch = line.match(timeRangeRegex)
    if (rangeMatch) {
      if (currentBlock) blocks.push(currentBlock)
      currentBlock = {
        startTime: parseTimeString(rangeMatch[1]),
        endTime: parseTimeString(rangeMatch[2]),
        tokens: []
      }
      continue
    }

    if (currentBlock) {
      currentBlock.tokens.push(line)
    }
  }
  if (currentBlock) blocks.push(currentBlock)

  if (blocks.length === 0) return []

  // 4. Partition each time block's tokens into numCols slots
  const candidates: ParsedClassCandidate[] = []

  for (const b of blocks) {
    const tokens = b.tokens
    const slots: string[][] = []
    let currentSlotTokens: string[] = []

    for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
      const token = tokens[tIdx]

      if (isEmptySlot(token)) {
        if (currentSlotTokens.length > 0) {
          slots.push(currentSlotTokens)
          currentSlotTokens = []
        }
        slots.push([token])
        if (slots.length === numCols) break
        continue
      }

      currentSlotTokens.push(token)

      // Check if this token completes the current non-empty slot
      if (currentSlotTokens.length >= 2 && isTeacherNameLine(token)) {
        slots.push(currentSlotTokens)
        currentSlotTokens = []
        if (slots.length === numCols) break
      }
    }

    if (currentSlotTokens.length > 0 && slots.length < numCols) {
      slots.push(currentSlotTokens)
    }

    // Process each slot up to numCols
    for (let sIdx = 0; sIdx < Math.min(slots.length, numCols); sIdx++) {
      const sTokens = slots[sIdx]
      if (sTokens.length === 1 && isEmptySlot(sTokens[0])) {
        continue // Free period
      }

      const colDay = dayColumns[sIdx].weekday

      // Extract room if bracketed or labeled
      let room = ''
      const filteredTokens: string[] = []
      for (const t of sTokens) {
        const brMatch = t.match(ROOM_BRACKET_REGEX)
        if (brMatch) {
          room = (brMatch[1] || brMatch[2]).trim()
          const rem = t.replace(brMatch[0], '').trim()
          if (rem) filteredTokens.push(rem)
          continue
        }
        filteredTokens.push(t)
      }

      // Separate subject from teacher
      let teacherIndex = filteredTokens.findIndex((tok, idx) => idx > 0 && isTeacherNameLine(tok))
      let subjectParts: string[] = []
      let teacherParts: string[] = []

      if (teacherIndex >= 0) {
        const teacherLineWords = filteredTokens[teacherIndex].trim().split(/\s+/)
        if (teacherLineWords.length === 1 && teacherIndex > 1) {
          const prev = filteredTokens[teacherIndex - 1]
          if (!isKnownSubject(prev) && /^[A-Z][a-z]+(\s+[A-Za-z]+)*$/.test(prev)) {
            teacherIndex--
          }
        }
        subjectParts = filteredTokens.slice(0, teacherIndex)
        teacherParts = filteredTokens.slice(teacherIndex)
      } else {
        subjectParts = filteredTokens
      }

      let title = subjectParts.join(' ').replace(/[|\t–—\-:;,\/\\_]+/g, ' ').replace(/\s+/g, ' ').trim()
      const teacher = teacherParts.join(' ').trim()

      if (!title || title.length < 2) {
        title = 'Class / Lecture'
      }

      candidates.push({
        title: title.slice(0, 100),
        weekday: colDay,
        startTime: b.startTime,
        endTime: b.endTime,
        room,
        notes: teacher ? `Instructor: ${teacher}` : 'Imported class',
        confidence: 'high'
      })
    }
  }

  return candidates
}

export function parseTimetableText(text: string): ParsedClassCandidate[] {
  if (!text || !text.trim()) return []

  // Try Grid timetable parsing first (for schedules like RCA and columnar tables)
  const gridCandidates = parseGridTimetable(text)
  if (gridCandidates.length > 0) {
    return deduplicate(gridCandidates)
  }

  // Fallback to line-by-line single row parsing
  const candidates: ParsedClassCandidate[] = []
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  let currentContextDay = -1

  for (const line of rawLines) {
    const standaloneDayMatch = line.match(/^[\s\W]*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)[\s\W]*$/i)
    if (standaloneDayMatch) {
      currentContextDay = resolveWeekday(standaloneDayMatch[1])
      continue
    }

    const parsed = parseLineForLesson(line, currentContextDay)
    if (parsed) {
      candidates.push(parsed)
      if (parsed.weekday >= 0) {
        currentContextDay = parsed.weekday
      }
    }
  }

  return deduplicate(candidates)
}

function parseLineForLesson(line: string, defaultDay: number): ParsedClassCandidate | null {
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

  let title = cleanLine
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/[|\t–—\-:;,\/\\_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (title.length < 2 || /^(am|pm|class|period|session|lecture|lesson)$/i.test(title)) {
    title = 'Class / Lecture'
  }

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

function deduplicate(candidates: ParsedClassCandidate[]): ParsedClassCandidate[] {
  const seen = new Set<string>()
  const unique: ParsedClassCandidate[] = []

  for (const c of candidates) {
    const key = `${c.weekday}-${c.startTime}-${c.title.toLowerCase()}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(c)
    }
  }

  return unique.slice(0, 150)
}
