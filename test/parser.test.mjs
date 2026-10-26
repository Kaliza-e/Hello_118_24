import test from 'node:test'
import assert from 'node:assert/strict'

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DAY_REGEX = /\b(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)\b/i
const TIME_RANGE_REGEX = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to|until)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/i
const SINGLE_TIME_REGEX = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/ig
const ROOM_BRACKET_REGEX = /\[(?:Room|Rm|Hall|Lab)\s*[:#-]?\s*([a-z0-9\-]+)\]|\((?:Room|Rm|Hall|Lab)\s*[:#-]?\s*([a-z0-9\-]+)\)/i
const ROOM_REGEX = /\b(?:room|rm\.?|hall|lab|lecture\s*hall|auditorium|bldg\.?|building|block)\s*[:#-]?\s*([a-z0-9\-]+)/i

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

function normalizeTime(hourStr, minStr, ampm = '') {
  let h = parseInt(hourStr, 10)
  const m = minStr ? parseInt(minStr, 10) : 0
  const ap = (ampm || '').toLowerCase()

  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0

  if (h > 23) h = 23
  const safeM = m > 59 ? 0 : m

  return `${String(h).padStart(2, '0')}:${String(safeM).padStart(2, '0')}`
}

function parseTimeString(timeStr) {
  const match = timeStr.trim().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/i)
  if (!match) return timeStr.trim()
  return normalizeTime(match[1], match[2], match[3])
}

function resolveWeekday(text) {
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

function isKnownSubject(text) {
  return KNOWN_SUBJECT_WORDS.has(text.toLowerCase().trim())
}

function isSurname(word) {
  return /^[A-Z]{3,}$/.test(word) && !SUBJECT_ACRONYMS.has(word)
}

function isTeacherNameLine(line) {
  if (isKnownSubject(line)) return false
  const words = line.trim().split(/\s+/)
  if (/^(dr\.?|prof\.?|mr\.?|ms\.?|mrs\.?|eng\.?|teacher)\b/i.test(line)) return true
  return words.some(w => isSurname(w))
}

function isEmptySlot(line) {
  const trimmed = line.trim()
  return (
    /^[—–\-]+$/.test(trimmed) ||
    /^(free|nil|none|n\/a|self\s*study|study|empty|break|lunch|recess)$/i.test(trimmed) ||
    trimmed === ''
  )
}

function extractDayColumnsFromHeader(line) {
  const dayMatches = [...line.matchAll(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/gi)]
  if (dayMatches.length < 3) return []

  const columns = []
  const seenDays = new Set()
  for (const m of dayMatches) {
    const idx = resolveWeekday(m[0])
    if (idx >= 0 && !seenDays.has(idx)) {
      seenDays.add(idx)
      columns.push({ name: m[0], weekday: idx })
    }
  }
  return columns.length >= 3 ? columns : []
}

function splitTableRow(line, delimiter) {
  let clean = line.trim()
  if (delimiter.source.includes('\\|')) {
    clean = clean.replace(/^\|+/, '').replace(/\|+$/, '').trim()
  }
  return clean.split(delimiter).map(s => s.trim().replace(/^\|+|\|+$/g, '').trim())
}

function parseDelimitedTable(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  let delimiter = null
  let headerLineIndex = -1
  let dayColumnMap = []

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i]
    const candidateDelims = [/\t+/, /\s*\|\s*/, /,\s*/, /\s{2,}/]
    for (const d of candidateDelims) {
      let parts = splitTableRow(line, d)
      const daysFound = []
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

  const candidates = []

  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const line = lines[i]
    if (/^[|\s\-:+=]+$/.test(line)) continue
    if (/^(break|lunch|morning break|afternoon break|interval)\b/i.test(line)) continue

    let parts = splitTableRow(line, delimiter)
    if (parts.length < 2) continue

    let timeRange = null
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

    for (const { colIdx, weekday } of dayColumnMap) {
      if (colIdx >= parts.length || colIdx === timeColIdx) continue
      const cellText = parts[colIdx]
      if (isEmptySlot(cellText)) continue

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

function parseGridTimetable(text) {
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  let dayColumns = []
  for (const line of rawLines) {
    const cols = extractDayColumnsFromHeader(line)
    if (cols.length >= 3) {
      dayColumns = cols
      break
    }
  }

  if (dayColumns.length < 3) return []
  const numCols = dayColumns.length

  const lines = []
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
  const blocks = []
  let currentBlock = null

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

  const candidates = []

  for (const b of blocks) {
    const tokens = b.tokens
    const slots = []
    let currentSlotTokens = []

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
      const filteredTokens = []
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
      let subjectParts = []
      let teacherParts = []

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

function parseDayBlockTimetable(text) {
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const candidates = []
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

function parseLineForLesson(line, defaultDay) {
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

  if (weekday < 0) return null

  let startTime = ''
  let endTime = ''

  const rangeMatch = cleanLine.match(TIME_RANGE_REGEX)
  if (rangeMatch) {
    startTime = normalizeTime(rangeMatch[1], rangeMatch[2], rangeMatch[3])
    endTime = normalizeTime(rangeMatch[4], rangeMatch[5], rangeMatch[6] || rangeMatch[3])
    cleanLine = cleanLine.replace(rangeMatch[0], ' ')
  } else {
    const times = [...cleanLine.matchAll(SINGLE_TIME_REGEX)].map(m => normalizeTime(m[1], m[2], m[3]))
    if (times.length >= 1) {
      startTime = times[0]
      if (times.length >= 2) endTime = times[1]
      cleanLine = cleanLine.replace(SINGLE_TIME_REGEX, ' ')
    }
  }

  if (!startTime) return null

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

function validateAndFinalizeCandidates(candidates) {
  const seen = new Set()
  const unique = []

  for (const c of candidates) {
    const titleKey = (c.title || '').toLowerCase().trim()
    const key = `${c.weekday}-${c.startTime}-${c.endTime}-${titleKey}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push({ ...c })
    }
  }

  unique.sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday
    return a.startTime.localeCompare(b.startTime)
  })

  for (let i = 0; i < unique.length; i++) {
    const current = unique[i]

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

function parseTimetableText(text) {
  if (!text || !text.trim()) return []

  const delimitedResults = parseDelimitedTable(text)
  if (delimitedResults.length >= 3) {
    return validateAndFinalizeCandidates(delimitedResults)
  }

  const gridCandidates = parseGridTimetable(text)
  if (gridCandidates.length > 0) {
    return validateAndFinalizeCandidates(gridCandidates)
  }

  const blockCandidates = parseDayBlockTimetable(text)
  if (blockCandidates.length > 0) {
    return validateAndFinalizeCandidates(blockCandidates)
  }

  const fallbackCandidates = []
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

// ======================= UNIT TESTS =======================

test('Timetable Parser: parses Rwanda Coding Academy grid format with all 31 classes', () => {
  const rcaSampleText = `
    RWANDA CODING ACADEMY
    Academic Operations
    Y3A Class Timetable
    Y3A — 2026-2027 Term 1 · RCA-CTT-2627-T1-Y3A-08-18714C · Generated: 09/10/2026
    Time Monday Tuesday Wednesday Thursday Friday
    08:30
    to 09:20
    Maths
    Jean Bosco 
    UWITONZE
    Physics
    Jean de Dieu 
    NSHIMIYIMANA
    Maths
    Jean Bosco 
    UWITONZE
    DEVOPS
    Stanley MWIZERWA
    English
    Egide NSABYIMANA
    09:20
    to 10:10
    Maths
    Jean Bosco 
    UWITONZE
    Physics
    Jean de Dieu 
    NSHIMIYIMANA
    Maths
    Jean Bosco 
    UWITONZE
    DEVOPS
    Stanley MWIZERWA
    English
    Egide NSABYIMANA
    Morning Break (10:10–10:30)
    10:30
    to 11:20
    Mobile
    Louis MUKAMA
    Physics
    Jean de Dieu 
    NSHIMIYIMANA
    Maths
    Jean Bosco 
    UWITONZE
    DEVOPS
    Stanley MWIZERWA —
    Time Monday Tuesday Wednesday Thursday Friday
    11:20
    to 12:10
    Mobile
    Louis MUKAMA —
    Intelligent Robotics
    Gabriel 
    BAZIRAMWABO
    Machine Learning
    Louis MUKAMA —
    Lunch (12:10–13:30)
    13:30
    to 14:20
    Physics
    Jean de Dieu 
    NSHIMIYIMANA
    Machine Learning
    Louis MUKAMA
    Intelligent Robotics
    Gabriel 
    BAZIRAMWABO
    Machine Learning
    Louis MUKAMA
    Project 
    Management
    Aphrodice RWAGAJU
    14:20
    to 15:10
    Physics
    Jean de Dieu 
    NSHIMIYIMANA
    Machine Learning
    Louis MUKAMA
    Intelligent Robotics
    Gabriel 
    BAZIRAMWABO
    Cybersecurity
    Celestin NZEYIMANA
    Project 
    Management
    Aphrodice RWAGAJU
    Afternoon Break (15:10–15:20)
    15:20
    to 16:10 —
    English
    Egide NSABYIMANA —
    Cybersecurity
    Celestin NZEYIMANA —
    Time Monday Tuesday Wednesday Thursday Friday
    16:10
    to 17:00 —
    English
    Egide NSABYIMANA —
    Cybersecurity
    Celestin NZEYIMANA —
    Approved by
    NZEYIMANA Celestin
    Ag. Principal Director
    Rwanda Coding Academy
    Scan to verify
  `

  const results = parseTimetableText(rcaSampleText)
  assert.equal(results.length, 31, `Expected 31 classes parsed, got ${results.length}`)

  const mondayMaths = results.find(c => c.weekday === 1 && c.startTime === '08:30')
  assert.ok(mondayMaths)
  assert.equal(mondayMaths.title, 'Maths')
  assert.equal(mondayMaths.endTime, '09:20')
  assert.match(mondayMaths.notes, /Jean Bosco UWITONZE/)

  const tuesdayPhysics = results.find(c => c.weekday === 2 && c.startTime === '08:30')
  assert.ok(tuesdayPhysics)
  assert.equal(tuesdayPhysics.title, 'Physics')

  const thursdayDevops = results.find(c => c.weekday === 4 && c.startTime === '08:30')
  assert.ok(thursdayDevops)
  assert.equal(thursdayDevops.title, 'DEVOPS')

  const fridayProject = results.find(c => c.weekday === 5 && c.startTime === '13:30')
  assert.ok(fridayProject)
  assert.equal(fridayProject.title, 'Project Management')

  const wedRobotics = results.find(c => c.weekday === 3 && c.startTime === '11:20')
  assert.ok(wedRobotics)
  assert.equal(wedRobotics.title, 'Intelligent Robotics')
})

test('Timetable Parser: handles attached header words like TimeMondayTuesdayWednesdayThursdayFriday', () => {
  const attachedHeaderText = `
    TimeMondayTuesdayWednesdayThursdayFriday
    08:30
    to 09:20
    Mobile
    Louis MUKAMA
    Physics
    Jean de Dieu
    NSHIMIYIMANA
    Maths
    Jean Bosco
    UWITONZE
    DEVOPS
    Stanley MWIZERWA
    English
    Egide NSABYIMANA
  `
  const results = parseTimetableText(attachedHeaderText)
  assert.equal(results.length, 5)
  assert.equal(results[0].weekday, 1) // Monday
  assert.equal(results[0].title, 'Mobile')
  assert.equal(results[4].weekday, 5) // Friday
  assert.equal(results[4].title, 'English')
})

test('Timetable Parser: parses column-based delimited table where days are columns', () => {
  const tableText = `
    Time\tMonday\tTuesday\tWednesday\tThursday\tFriday
    08:30 - 09:20\tMaths [Rm 101]\tPhysics [Lab 2]\tChemistry\tDEVOPS\tEnglish
    09:20 - 10:10\tMobile App\tAlgorithms\tFree\tDatabase\tFrench
    10:30 - 11:20\tLiterature\tMachine Learning\tHistory\tGeography\tBiology
  `
  const results = parseTimetableText(tableText)
  assert.ok(results.length >= 13, `Expected at least 13 classes, got ${results.length}`)

  // Verify Monday Maths
  const monMaths = results.find(c => c.weekday === 1 && c.startTime === '08:30')
  assert.ok(monMaths, 'Monday 08:30 Maths should exist')
  assert.equal(monMaths.title, 'Maths')
  assert.equal(monMaths.room, '101')

  // Verify Tuesday Physics
  const tuePhysics = results.find(c => c.weekday === 2 && c.startTime === '08:30')
  assert.ok(tuePhysics, 'Tuesday 08:30 Physics should exist')
  assert.equal(tuePhysics.title, 'Physics')
  assert.equal(tuePhysics.room, '2')

  // Wednesday 09:20 was Free, so no Wednesday 09:20 class
  const wedFree = results.find(c => c.weekday === 3 && c.startTime === '09:20')
  assert.equal(wedFree, undefined, 'Free period should not generate a subject')
})

test('Timetable Parser: parses pipe-delimited Markdown table with day columns', () => {
  const pipeText = `
    | Time | Monday | Tuesday | Wednesday | Thursday | Friday |
    | --- | --- | --- | --- | --- | --- |
    | 09:00 - 10:00 | Calculus I | Physics I | Linear Algebra | Chemistry | Biology |
    | 10:00 - 11:00 | Computer Science | Economics | Music | Art | Physical Education |
  `
  const results = parseTimetableText(pipeText)
  assert.equal(results.length, 10)

  const monCalc = results.find(c => c.weekday === 1 && c.startTime === '09:00')
  assert.ok(monCalc)
  assert.equal(monCalc.title, 'Calculus I')
  assert.equal(monCalc.endTime, '10:00')

  const friBio = results.find(c => c.weekday === 5 && c.startTime === '09:00')
  assert.ok(friBio)
  assert.equal(friBio.title, 'Biology')
})

test('Timetable Parser: detects invalid time range and flags warning', () => {
  const input = 'Monday 14:00 - 13:00 Invalid Backward Time Class'
  const result = parseTimetableText(input)
  assert.equal(result.length, 1)
  assert.equal(result[0].confidence, 'low')
  assert.match(result[0].warning, /End time must be after start time/i)
})

test('Timetable Parser: detects overlapping entries on the same day', () => {
  const input = `
    Monday 09:00 - 10:30 Subject Alpha
    Monday 10:00 - 11:30 Subject Beta
  `
  const result = parseTimetableText(input)
  assert.equal(result.length, 2)
  assert.ok(result[0].warning && result[0].warning.includes('Overlaps'))
  assert.ok(result[1].warning && result[1].warning.includes('Overlaps'))
})

test('Timetable Parser: handles line with day, time range, subject, and room (single line fallback)', () => {
  const input = 'Monday 09:00 - 10:30 Data Structures Room 302'
  const result = parseTimetableText(input)
  assert.equal(result.length, 1)
  assert.equal(result[0].weekday, 1)
  assert.equal(result[0].startTime, '09:00')
  assert.equal(result[0].endTime, '10:30')
  assert.equal(result[0].room, '302')
  assert.equal(result[0].title, 'Data Structures')
})

test('Timetable Parser: converts 12-hour PM times correctly', () => {
  const input = 'Wednesday 2:30 PM to 4:00 PM Operating Systems Rm Lab-B'
  const result = parseTimetableText(input)
  assert.equal(result.length, 1)
  assert.equal(result[0].weekday, 3)
  assert.equal(result[0].startTime, '14:30')
  assert.equal(result[0].endTime, '16:00')
  assert.equal(result[0].room, 'Lab-B')
  assert.equal(result[0].title, 'Operating Systems')
})

test('Timetable Parser: handles day header followed by lesson rows with bracketed rooms', () => {
  const input = `
    TUESDAY
    08:00 - 09:30 Calculus I (Room 101)
    10:00 - 11:30 Linear Algebra (Room 102)
    13:00 - 14:30 Physics Mechanics Room 405
  `
  const result = parseTimetableText(input)
  assert.equal(result.length, 3)
  assert.equal(result[0].weekday, 2)
  assert.equal(result[0].startTime, '08:00')
  assert.equal(result[0].title, 'Calculus I')
  assert.equal(result[0].room, '101')
})

test('Timetable Parser: deduplicates identical entries', () => {
  const input = `
    Friday 11:00 - 12:00 Chemistry 101 Room 204
    Friday 11:00 - 12:00 Chemistry 101 Room 204
  `
  const result = parseTimetableText(input)
  assert.equal(result.length, 1)
})

test('Timetable Parser: returns empty array for empty or unparseable input', () => {
  assert.deepEqual(parseTimetableText(''), [])
  assert.deepEqual(parseTimetableText('   \n  \t  '), [])
  assert.deepEqual(parseTimetableText('Just some random text with no timetable info.'), [])
})
