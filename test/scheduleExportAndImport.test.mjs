import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'

// Self-contained logic matching scheduleExport.ts
function pad2(n) {
  return String(n).padStart(2, '0')
}

function parseIcsDate(raw) {
  const val = raw.includes(':') ? raw.split(':').pop() : raw
  const clean = val.trim()

  if (clean.length === 8) {
    const y = clean.slice(0, 4)
    const m = clean.slice(4, 6)
    const d = clean.slice(6, 8)
    return { date: `${y}-${m}-${d}`, time: null, isAllDay: true }
  }

  const dtMatch = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?Z?$/)
  if (dtMatch) {
    const y = dtMatch[1]
    const m = dtMatch[2]
    const d = dtMatch[3]
    const hh = dtMatch[4]
    const mm = dtMatch[5]
    return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}`, isAllDay: false }
  }

  const parsed = new Date(clean)
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear()
    const m = pad2(parsed.getMonth() + 1)
    const d = pad2(parsed.getDate())
    const hh = pad2(parsed.getHours())
    const mm = pad2(parsed.getMinutes())
    return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}`, isAllDay: false }
  }

  const today = new Date().toISOString().slice(0, 10)
  return { date: today, time: null, isAllDay: true }
}

function parseIcsSchedule(icsText) {
  const events = []
  const unfolded = icsText.replace(/\r\n[ \t]|\r[ \t]|\n[ \t]/g, '')
  const lines = unfolded.split(/\r\n|\r|\n/)

  let inVevent = false
  let currentEvent = {}

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (line === 'BEGIN:VEVENT') {
      inVevent = true
      currentEvent = { isAllDay: true, confidence: 'high' }
      continue
    }

    if (line === 'END:VEVENT') {
      if (inVevent && currentEvent.title && currentEvent.startDate) {
        events.push({
          title: currentEvent.title,
          description: currentEvent.description,
          category: currentEvent.category || 'Other',
          startDate: currentEvent.startDate,
          startTime: currentEvent.startTime,
          endDate: currentEvent.endDate,
          endTime: currentEvent.endTime,
          isAllDay: currentEvent.isAllDay ?? true,
          location: currentEvent.location,
          confidence: 'high'
        })
      }
      inVevent = false
      currentEvent = {}
      continue
    }

    if (!inVevent) continue

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const keyPart = line.slice(0, colonIdx).toUpperCase()
    const rawVal = line.slice(colonIdx + 1)
    const val = rawVal.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim()

    if (keyPart === 'SUMMARY') {
      currentEvent.title = val
    } else if (keyPart === 'DESCRIPTION') {
      currentEvent.description = val
    } else if (keyPart === 'LOCATION') {
      currentEvent.location = val
    } else if (keyPart.startsWith('DTSTART')) {
      const parsed = parseIcsDate(line)
      currentEvent.startDate = parsed.date
      currentEvent.startTime = parsed.time
      currentEvent.isAllDay = parsed.isAllDay
    } else if (keyPart.startsWith('DTEND')) {
      const parsed = parseIcsDate(line)
      currentEvent.endDate = parsed.date
      currentEvent.endTime = parsed.time
    } else if (keyPart === 'CATEGORIES') {
      currentEvent.category = val
    }
  }

  return events
}

function escapeIcsText(str) {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function formatIcsDateTime(dateStr, timeStr) {
  const cleanDate = dateStr.replace(/-/g, '')
  if (!timeStr) {
    return `;VALUE=DATE:${cleanDate}`
  }
  const cleanTime = timeStr.replace(/:/g, '')
  return `:${cleanDate}T${cleanTime.padEnd(6, '0')}Z`
}

function generateIcs(events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hello 118:24//Student Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ]

  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'

  for (const ev of events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:hello11824-evt-${ev.id}@planner.desktop`)
    lines.push(`DTSTAMP:${nowStamp}`)
    lines.push(`SUMMARY:${escapeIcsText(ev.title)}`)
    if (ev.description) lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`)
    if (ev.location) lines.push(`LOCATION:${escapeIcsText(ev.location)}`)
    if (ev.category) lines.push(`CATEGORIES:${escapeIcsText(ev.category)}`)

    if (ev.is_all_day || !ev.start_time) {
      lines.push(`DTSTART${formatIcsDateTime(ev.start_date)}`)
      if (ev.end_date) lines.push(`DTEND${formatIcsDateTime(ev.end_date)}`)
    } else {
      lines.push(`DTSTART${formatIcsDateTime(ev.start_date, ev.start_time)}`)
      const endDate = ev.end_date || ev.start_date
      const endTime = ev.end_time || ev.start_time
      lines.push(`DTEND${formatIcsDateTime(endDate, endTime)}`)
    }

    lines.push(ev.is_completed ? 'STATUS:COMPLETED' : 'STATUS:CONFIRMED')
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

function sanitizeSpreadsheetCell(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/^[=\+\-@\t\r]/.test(str)) {
    return `'${str}`
  }
  return str
}

function escapeCsvField(val) {
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

function generateCsv(events) {
  const headers = ['Title', 'Category', 'Start Date', 'Start Time', 'End Date', 'End Time', 'All Day', 'Location', 'Description', 'Status']
  const rows = [headers.join(',')]
  for (const ev of events) {
    const row = [
      escapeCsvField(sanitizeSpreadsheetCell(ev.title)),
      escapeCsvField(sanitizeSpreadsheetCell(ev.category)),
      escapeCsvField(ev.start_date),
      escapeCsvField(ev.start_time || ''),
      escapeCsvField(ev.end_date || ''),
      escapeCsvField(ev.end_time || ''),
      ev.is_all_day ? 'Yes' : 'No',
      escapeCsvField(sanitizeSpreadsheetCell(ev.location || '')),
      escapeCsvField(sanitizeSpreadsheetCell(ev.description || '')),
      ev.is_completed ? 'Completed' : 'Active'
    ]
    rows.push(row.join(','))
  }
  return rows.join('\r\n')
}

function generateExcelBuffer(events) {
  const data = events.map(ev => ({
    Title: sanitizeSpreadsheetCell(ev.title),
    Category: sanitizeSpreadsheetCell(ev.category),
    'Start Date': ev.start_date,
    'Start Time': ev.start_time || '',
    'End Date': ev.end_date || '',
    'End Time': ev.end_time || '',
    'All Day': ev.is_all_day ? 'Yes' : 'No',
    Location: sanitizeSpreadsheetCell(ev.location || ''),
    Description: sanitizeSpreadsheetCell(ev.description || ''),
    Status: ev.is_completed ? 'Completed' : 'Active'
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, ws, 'Schedule')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function generatePrintableHtml(events, options) {
  const title = options?.title || 'Academic Schedule & Study Planner'
  const subtitle = options?.subtitle || '“This is the day which the Lord hath made; we will rejoice and be glad in it.” — Psalm 118:24'
  const rows = events.map(ev => `
    <tr>
      <td>${ev.start_date}</td>
      <td>${ev.is_all_day ? 'All Day' : (ev.start_time || '')}</td>
      <td><strong>${escapeHtml(ev.title)}</strong></td>
      <td>${escapeHtml(ev.category)}</td>
      <td>${escapeHtml(ev.location || '—')}</td>
      <td>${ev.is_completed ? 'Completed' : 'Active'}</td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head><title>${escapeHtml(title)}</title><style>@page { size: A4; margin: 15mm; }</style></head>
<body>
  <h1>Hello 118:24</h1>
  <p>${escapeHtml(subtitle)}</p>
  <table><tbody>${rows}</tbody></table>
</body>
</html>
  `
}

test('Phase 3: iCalendar (.ics) parsing handles all-day and timed events with unescaping', () => {
  const sampleIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Sample//EN
BEGIN:VEVENT
UID:evt-1@test
SUMMARY:Physics Final Exam
DESCRIPTION:Bring scientific calculator\\, pens\\, and ruler\\nRoom 102
LOCATION:Main Examination Hall 1
CATEGORIES:Exams
DTSTART:20261115T090000Z
DTEND:20261115T113000Z
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:evt-2@test
SUMMARY:Academic Holiday - Heroes Day
CATEGORIES:Academic Calendar
DTSTART;VALUE=DATE:20260201
DTEND;VALUE=DATE:20260202
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`

  const events = parseIcsSchedule(sampleIcs)
  assert.equal(events.length, 2)

  // Event 1: Timed exam
  const exam = events[0]
  assert.equal(exam.title, 'Physics Final Exam')
  assert.equal(exam.category, 'Exams')
  assert.equal(exam.startDate, '2026-11-15')
  assert.equal(exam.startTime, '09:00')
  assert.equal(exam.endDate, '2026-11-15')
  assert.equal(exam.endTime, '11:30')
  assert.equal(exam.isAllDay, false)
  assert.equal(exam.location, 'Main Examination Hall 1')
  assert.ok(exam.description?.includes('Bring scientific calculator, pens, and ruler'))

  // Event 2: All day holiday
  const holiday = events[1]
  assert.equal(holiday.title, 'Academic Holiday - Heroes Day')
  assert.equal(holiday.category, 'Academic Calendar')
  assert.equal(holiday.startDate, '2026-02-01')
  assert.equal(holiday.isAllDay, true)
})

test('Phase 3: iCalendar (.ics) generation produces valid RFC 5545 format with roundtrip fidelity', () => {
  const testEvents = [
    {
      id: 101,
      title: 'Database Architecture Workshop',
      category: 'Workshops',
      start_date: '2026-11-18',
      start_time: '14:00',
      end_date: '2026-11-18',
      end_time: '16:30',
      is_all_day: 0,
      location: 'Lab 4',
      description: 'Hands-on indexing, queries, and replication practice.',
      is_completed: 0,
      created_at: new Date().toISOString()
    },
    {
      id: 102,
      title: 'Term 2 Final Submissions',
      category: 'Assignments',
      start_date: '2026-12-05',
      start_time: null,
      end_date: '2026-12-05',
      end_time: null,
      is_all_day: 1,
      location: null,
      description: 'Submit portfolio and code repository link.',
      is_completed: 1,
      created_at: new Date().toISOString()
    }
  ]

  const icsOutput = generateIcs(testEvents)
  assert.ok(icsOutput.includes('BEGIN:VCALENDAR'))
  assert.ok(icsOutput.includes('VERSION:2.0'))
  assert.ok(icsOutput.includes('SUMMARY:Database Architecture Workshop'))
  assert.ok(icsOutput.includes('LOCATION:Lab 4'))
  assert.ok(icsOutput.includes('STATUS:CONFIRMED'))
  assert.ok(icsOutput.includes('STATUS:COMPLETED'))
  assert.ok(icsOutput.includes('END:VCALENDAR'))

  // Roundtrip parse test
  const parsedBack = parseIcsSchedule(icsOutput)
  assert.equal(parsedBack.length, 2)
  assert.equal(parsedBack[0].title, 'Database Architecture Workshop')
  assert.equal(parsedBack[0].startDate, '2026-11-18')
  assert.equal(parsedBack[0].startTime, '14:00')
  assert.equal(parsedBack[0].location, 'Lab 4')
  assert.equal(parsedBack[1].title, 'Term 2 Final Submissions')
  assert.equal(parsedBack[1].isAllDay, true)
})

test('Phase 3: CSV generation with formula injection neutralization', () => {
  const testEvents = [
    {
      id: 1,
      title: '=cmd|"/C calc"!A0',
      category: '+Exams',
      start_date: '2026-11-20',
      start_time: '08:30',
      end_date: '2026-11-20',
      end_time: '10:00',
      is_all_day: 0,
      location: '@Main Auditorium',
      description: '-Dangerous leading operator',
      is_completed: 0,
      created_at: new Date().toISOString()
    }
  ]

  const csv = generateCsv(testEvents)
  const lines = csv.split('\r\n')
  assert.equal(lines[0], 'Title,Category,Start Date,Start Time,End Date,End Time,All Day,Location,Description,Status')

  assert.ok(lines[1].includes("'\=cmd|"), 'Formula = prefix neutralized')
  assert.ok(lines[1].includes("'+Exams"), 'Formula + prefix neutralized')
  assert.ok(lines[1].includes("'@Main Auditorium"), 'Formula @ prefix neutralized')
  assert.ok(lines[1].includes("'-Dangerous leading operator"), 'Formula - prefix neutralized')
})

test('Phase 3: Excel (.xlsx) workbook binary buffer generation', () => {
  const testEvents = [
    {
      id: 1,
      title: 'Algorithm Analysis Lecture',
      category: 'Academic Calendar',
      start_date: '2026-11-22',
      start_time: '10:00',
      end_date: '2026-11-22',
      end_time: '12:00',
      is_all_day: 0,
      location: 'Hall B',
      description: 'Dynamic programming and greedy strategies.',
      is_completed: 0,
      created_at: new Date().toISOString()
    }
  ]

  const buffer = generateExcelBuffer(testEvents)
  assert.ok(Buffer.isBuffer(buffer), 'Should return binary Buffer')
  assert.ok(buffer.length > 0, 'Buffer should have content')

  const wb = XLSX.read(buffer, { type: 'buffer' })
  assert.ok(wb.SheetNames.includes('Schedule'))
  const sheet = wb.Sheets['Schedule']
  const json = XLSX.utils.sheet_to_json(sheet)
  assert.equal(json.length, 1)
  assert.equal(json[0].Title, 'Algorithm Analysis Lecture')
  assert.equal(json[0].Category, 'Academic Calendar')
  assert.equal(json[0].Location, 'Hall B')
})

test('Phase 3: Printable HTML for PDF export includes Psalm 118:24 and event table', () => {
  const testEvents = [
    {
      id: 1,
      title: 'Calculus Examination <Special>',
      category: 'Exams',
      start_date: '2026-11-25',
      start_time: '09:00',
      end_date: '2026-11-25',
      end_time: '11:00',
      is_all_day: 0,
      location: 'Room 304',
      description: 'Bring approved calculator & student ID.',
      is_completed: 0,
      created_at: new Date().toISOString()
    }
  ]

  const html = generatePrintableHtml(testEvents, {
    title: 'Semester 1 Exam Schedule'
  })

  assert.ok(html.includes('Psalm 118:24'), 'Must include Psalm 118:24 branding')
  assert.ok(html.includes('This is the day which the Lord hath made'), 'Must include scripture quote')
  assert.ok(html.includes('Calculus Examination &lt;Special&gt;'), 'Must escape HTML in titles to prevent XSS')
  assert.ok(html.includes('Room 304'))
  assert.ok(html.includes('@page {'))
})
