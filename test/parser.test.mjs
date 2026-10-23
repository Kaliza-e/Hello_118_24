import test from 'node:test'
import assert from 'node:assert/strict'

function normalizeTime(hourStr, minStr, ampm) {
  let h = parseInt(hourStr, 10)
  const m = minStr ? parseInt(minStr, 10) : 0
  const ap = (ampm || '').toLowerCase()

  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  if (h > 23) h = 23
  const safeM = m > 59 ? 0 : m
  return `${String(h).padStart(2, '0')}:${String(safeM).padStart(2, '0')}`
}

function resolveWeekday(text) {
  const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
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

const DAY_REGEX = /\b(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)\b/i
const TIME_RANGE_REGEX = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to|until)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/i
const SINGLE_TIME_REGEX = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/ig
const ROOM_BRACKET_REGEX = /\[(?:Room|Rm|Hall|Lab)\s*[:#-]?\s*([a-z0-9\-]+)\]|\((?:Room|Rm|Hall|Lab)\s*[:#-]?\s*([a-z0-9\-]+)\)/i
const ROOM_REGEX = /\b(?:room|rm\.?|hall|lab|lecture\s*hall|auditorium|bldg\.?|building|block)\s*[:#-]?\s*([a-z0-9\-]+)/i

function parseTimetableText(text) {
  if (!text || !text.trim()) return []
  const candidates = []
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  let currentContextDay = -1

  for (const line of rawLines) {
    const standaloneDayMatch = line.match(/^[\s\W]*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)[\s\W]*$/i)
    if (standaloneDayMatch) {
      currentContextDay = resolveWeekday(standaloneDayMatch[1])
      continue
    }

    let weekday = currentContextDay
    const dayMatch = line.match(DAY_REGEX)
    let cleanLine = line

    if (dayMatch) {
      const matchedDay = resolveWeekday(dayMatch[1])
      if (matchedDay >= 0) {
        weekday = matchedDay
        cleanLine = cleanLine.replace(dayMatch[0], ' ')
      }
    }

    if (weekday < 0) continue

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

    if (!startTime) continue

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

    candidates.push({
      title: title.slice(0, 100),
      weekday,
      startTime,
      endTime,
      room
    })
  }

  // Deduplicate
  const seen = new Set()
  const unique = []
  for (const c of candidates) {
    const key = `${c.weekday}-${c.startTime}-${c.title.toLowerCase()}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(c)
    }
  }
  return unique
}

test('Timetable Parser: handles line with day, time range, subject, and room', () => {
  const input = 'Monday 09:00 - 10:30 Data Structures Room 302'
  const result = parseTimetableText(input)
  assert.equal(result.length, 1)
  assert.equal(result[0].weekday, 1) // Monday
  assert.equal(result[0].startTime, '09:00')
  assert.equal(result[0].endTime, '10:30')
  assert.equal(result[0].room, '302')
  assert.equal(result[0].title, 'Data Structures')
})

test('Timetable Parser: converts 12-hour PM times correctly', () => {
  const input = 'Wednesday 2:30 PM to 4:00 PM Operating Systems Rm Lab-B'
  const result = parseTimetableText(input)
  assert.equal(result.length, 1)
  assert.equal(result[0].weekday, 3) // Wednesday
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

  assert.equal(result[1].weekday, 2)
  assert.equal(result[1].startTime, '10:00')
  assert.equal(result[1].title, 'Linear Algebra')
  assert.equal(result[1].room, '102')

  assert.equal(result[2].weekday, 2)
  assert.equal(result[2].startTime, '13:00')
  assert.equal(result[2].title, 'Physics Mechanics')
  assert.equal(result[2].room, '405')
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
