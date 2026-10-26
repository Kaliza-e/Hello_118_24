export interface ParsedClassCandidate {
  title: string
  weekday: number // 0 = Sun, 1 = Mon, ..., 6 = Sat
  startTime: string // HH:mm
  endTime: string // HH:mm
  room: string
  notes: string
  confidence?: 'high' | 'medium' | 'low'
  warning?: string
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
  return (
    /^[—–\-]+$/.test(trimmed) ||
    /^(free|nil|none|n\/a|self\s*study|study|empty|break|lunch|recess)$/i.test(trimmed) ||
    trimmed === ''
  )
}

interface DayColumn {
  name: string
  weekday: number
  columnIndex?: number
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

function splitTableRow(line: string, delimiter: RegExp): string[] {
  let clean = line.trim()
  if (delimiter.source.includes('\\|')) {
    clean = clean.replace(/^\|+/, '').replace(/\|+$/, '').trim()
  }
  return clean.split(delimiter).map(s => s.trim().replace(/^\|+|\|+$/g, '').trim())
}

// ----------------- Structure 1: Delimited Tabular Grid (CSV, TSV, Pipe Tables) -----------------
export function parseDelimitedTable(text: string): ParsedClassCandidate[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  // Determine likely delimiter: tab, pipe, or multiple spaces/commas
  let delimiter: RegExp | null = null
  let headerLineIndex = -1
  let dayColumnMap: Array<{ colIdx: number; weekday: number }> = []

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i]

    // Test delimiters
    const candidateDelims: RegExp[] = [/\t+/, /\s*\|\s*/, /,\s*/, /\s{2,}/]
    for (const d of candidateDelims) {
      let parts = splitTableRow(line, d)
      const daysFound: Array<{ colIdx: number; weekday: number }> = []
      parts.forEach((p, cIdx) => {
        const w = resolveWeekday(p)
        if (w >= 0) {
          daysFound.push({ colIdx: cIdx, weekday: w })
        }
      })

      if (daysFound.length >= 3) {
        delimiter = d
        headerLineIndex = i
        dayColumnMap = daysFound
        break
      }
    }
    if (delimiter) break
  }

  if (!delimiter || headerLineIndex < 0 || dayColumnMap.length < 3) {
    return []
  }

  const candidates: ParsedClassCandidate[] = []

  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const line = lines[i]

    // Skip separator lines like |---|---|
    if (/^[|\s\-:+=]+$/.test(line)) continue

    // Skip admin/break rows
    if (/^(break|lunch|morning break|afternoon break|interval)\b/i.test(line)) continue

    let parts = splitTableRow(line, delimiter)
    if (parts.length < 2) continue

    // Find the cell with the time range
    let timeRange: { startTime: string; endTime: string } | null = null
    let timeColIdx = -1

    for (let cIdx = 0; cIdx < parts.length; cIdx++) {
      const cell = parts[cIdx]
      const rangeMatch = cell.match(TIME_RANGE_REGEX)
      if (rangeMatch) {
        timeRange = {
          startTime: normalizeTime(rangeMatch[1], rangeMatch[2], rangeMatch[3]),
          endTime: normalizeTime(rangeMatch[4], rangeMatch[5], rangeMatch[6] || rangeMatch[3])
        }
        timeColIdx = cIdx
        break
      }
    }

    if (!timeRange) continue

    // For each day column, extract the corresponding subject
    for (const { colIdx, weekday } of dayColumnMap) {
      if (colIdx >= parts.length || colIdx === timeColIdx) continue
      const cellText = parts[colIdx]
      if (isEmptySlot(cellText)) continue

      // Extract bracketed/labeled room
      let room = ''
      let cleaned = cellText
      const brMatch = cellText.match(ROOM_BRACKET_REGEX)
      if (brMatch) {
        room = (brMatch[1] || brMatch[2]).trim()
        cleaned = cleaned.replace(brMatch[0], ' ')
      } else {
        const rMatch = cellText.match(ROOM_REGEX)
        if (rMatch) {
          room = (rMatch[1] || rMatch[0]).trim()
          cleaned = cleaned.replace(rMatch[0], ' ')
        }
      }

      // Teacher / Instructor notes
      let notes = 'Imported class'
      const linesOrParts = cleaned.split(/[\r\n]+/)
      let subjectTitle = cleaned
      if (linesOrParts.length > 1) {
        const teacherPart = linesOrParts.find(p => isTeacherNameLine(p))
        if (teacherPart) {
          notes = `Instructor: ${teacherPart.trim()}`
          subjectTitle = linesOrParts.filter(p => p !== teacherPart).join(' ')
        }
      }

      subjectTitle = subjectTitle
        .replace(/[|\t–—\-:;,\/\\_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (!subjectTitle || subjectTitle.length < 2) continue

      candidates.push({
        title: subjectTitle.slice(0, 100),
        weekday,
        startTime: timeRange.startTime,
        endTime: timeRange.endTime,
        room,
        notes,
        confidence: 'high'
      })
    }
  }

  return candidates
}

// ----------------- Structure 2: Token Grid Timetable (e.g. Rwanda Coding Academy) -----------------
export function parseGridTimetable(text: string): ParsedClassCandidate[] {
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

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

  const lines: string[] = []
  for (const line of rawLines) {
    if (
      /^(morning\s*break|afternoon\s*break|lunch|tea\s*break|break|recess|assembly|interval)\b/i.test(line) ||
      /\b(break|lunch)\s*\(\d{1,2}:\d{2}/i.test(line)
    ) {
      continue
    }

    if (
      /^(approved\s*by|principal\s*director|ag\.\s*principal\s*director|rwanda\s*coding\s*academy|academic\s*operations|class\s*timetable|scan\s*to\s*verify)/i.test(line) ||
      /\b(term\s*\d|generated:|rca-ctt-)/i.test(line)
    ) {
      continue
    }

    if (extractDayColumnsFromHeader(line).length >= 3) {
      continue
    }

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

  const timeRangeRegex = /^(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)\s*(?:to|-|–|—)\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)$/i
  const blocks: TimeBlock[] = []
  let currentBlock: TimeBlock | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

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
      i++
      continue
    }

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

      if (currentSlotTokens.length >= 2 && isTeacherNameLine(token)) {
        slots.push(currentSlotTokens)
        currentSlotTokens = []
        if (slots.length === numCols) break
      }
    }

    if (currentSlotTokens.length > 0 && slots.length < numCols) {
      slots.push(currentSlotTokens)
    }

    for (let sIdx = 0; sIdx < Math.min(slots.length, numCols); sIdx++) {
      const sTokens = slots[sIdx]
      if (sTokens.length === 1 && isEmptySlot(sTokens[0])) {
        continue
      }

      const colDay = dayColumns[sIdx].weekday

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
        title = ''
      }

      candidates.push({
        title: title.slice(0, 100),
        weekday: colDay,
        startTime: b.startTime,
        endTime: b.endTime,
        room,
        notes: teacher ? `Instructor: ${teacher}` : 'Imported class',
        confidence: title ? 'high' : 'low',
        warning: title ? undefined : 'Subject title was not clearly identified'
      })
    }
  }

  return candidates
}

// ----------------- Structure 3: Day Header Blocks (Columnar / Vertically Grouped Days) -----------------
export function parseDayBlockTimetable(text: string): ParsedClassCandidate[] {
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const candidates: ParsedClassCandidate[] = []
  let currentDay = -1

  for (const line of rawLines) {
    const standaloneDayMatch = line.match(/^[\s\W#*_-]*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)[\s\W*_-]*$/i)
    if (standaloneDayMatch) {
      currentDay = resolveWeekday(standaloneDayMatch[1])
      continue
    }

    if (currentDay < 0) continue

    const parsed = parseLineForLesson(line, currentDay)
    if (parsed) {
      candidates.push(parsed)
    }
  }

  return candidates
}

// ----------------- Structure 4: Single Line Fallback -----------------
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

  const isGeneric = /^(am|pm|class|period|session|lecture|lesson)$/i.test(title)
  const isMissing = title.length < 2 || isGeneric

  return {
    title: isMissing ? '' : title.slice(0, 100),
    weekday,
    startTime,
    endTime,
    room,
    notes: 'Imported — verify day and time',
    confidence: !isMissing && room && endTime ? 'high' : !isMissing ? 'medium' : 'low',
    warning: isMissing ? 'Subject name is missing or unclear' : undefined
  }
}

// ----------------- Validation, Overlap Detection, & Deduplication -----------------
export function validateAndFinalizeCandidates(candidates: ParsedClassCandidate[]): ParsedClassCandidate[] {
  // 1. Deduplicate identical entries
  const seen = new Set<string>()
  const unique: ParsedClassCandidate[] = []

  for (const c of candidates) {
    const titleKey = (c.title || '').toLowerCase().trim()
    const key = `${c.weekday}-${c.startTime}-${c.endTime}-${titleKey}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push({ ...c })
    }
  }

  // 2. Sort chronologically by weekday, then start time
  unique.sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday
    return a.startTime.localeCompare(b.startTime)
  })

  // 3. Time Validation & Overlap Detection
  for (let i = 0; i < unique.length; i++) {
    const current = unique[i]

    // Time integrity
    if (!current.startTime || !/^\d{2}:\d{2}$/.test(current.startTime)) {
      current.confidence = 'low'
      current.warning = 'Invalid or missing start time'
      continue
    }

    const [sH, sM] = current.startTime.split(':').map(Number)
    const startMins = sH * 60 + sM

    if (current.endTime && /^\d{2}:\d{2}$/.test(current.endTime)) {
      const [eH, eM] = current.endTime.split(':').map(Number)
      const endMins = eH * 60 + eM
      if (endMins <= startMins) {
        current.confidence = 'low'
        current.warning = 'End time must be after start time'
      }
    } else if (!current.endTime) {
      // Default to 1 hr later if missing
      const defEndH = Math.min(23, sH + 1)
      current.endTime = `${String(defEndH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`
      if (current.confidence !== 'low') {
        current.confidence = 'medium'
      }
    }

    if (!current.title || current.title.trim().length === 0) {
      current.confidence = 'low'
      current.warning = current.warning || 'Subject name is missing'
    }

    // Check overlap with next entries on the same weekday
    if (current.endTime && /^\d{2}:\d{2}$/.test(current.endTime)) {
      const [eH, eM] = current.endTime.split(':').map(Number)
      const endMins = eH * 60 + eM

      for (let j = i + 1; j < unique.length; j++) {
        const next = unique[j]
        if (next.weekday !== current.weekday) break

        const [nextSH, nextSM] = next.startTime.split(':').map(Number)
        const nextStartMins = nextSH * 60 + nextSM

        if (nextStartMins < endMins) {
          current.warning = current.warning || `Overlaps with "${next.title || 'Subject'}" (${next.startTime})`
          next.warning = next.warning || `Overlaps with "${current.title || 'Subject'}" (${current.startTime})`
          if (current.confidence === 'high') current.confidence = 'medium'
          if (next.confidence === 'high') next.confidence = 'medium'
        }
      }
    }
  }

  return unique.slice(0, 200)
}

// ----------------- Main Parsing Entry Point -----------------
export function parseTimetableText(text: string): ParsedClassCandidate[] {
  if (!text || !text.trim()) return []

  // Strategy 1: Delimited table (TSV, pipe-delimited, CSV with day columns)
  const delimitedResults = parseDelimitedTable(text)
  if (delimitedResults.length >= 3) {
    return validateAndFinalizeCandidates(delimitedResults)
  }

  // Strategy 2: Multi-line Token Grid (like RCA timetable)
  const gridCandidates = parseGridTimetable(text)
  if (gridCandidates.length > 0) {
    return validateAndFinalizeCandidates(gridCandidates)
  }

  // Strategy 3: Day Header Blocks (Columnar days or segmented sections)
  const blockCandidates = parseDayBlockTimetable(text)
  if (blockCandidates.length > 0) {
    return validateAndFinalizeCandidates(blockCandidates)
  }

  // Strategy 4: Fallback line-by-line single row parsing
  const fallbackCandidates: ParsedClassCandidate[] = []
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
      fallbackCandidates.push(parsed)
      if (parsed.weekday >= 0) {
        currentContextDay = parsed.weekday
      }
    }
  }

  return validateAndFinalizeCandidates(fallbackCandidates)
}
