import * as XLSX from 'xlsx'
import { ScheduleEvent, ScheduleCategory } from './db'
import { CandidateScheduleEvent, inferCategory } from './importers/schedulePipeline'
import { sanitizeFormulaValue } from '../shared/schemas'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Parses iCalendar RFC 5545 date string into date and time
 * Formats:
 * - 20261106
 * - 20261106T143000
 * - 20261106T143000Z
 */
function parseIcsDate(raw: string): { date: string; time: string | null; isAllDay: boolean } {
  // Strip params like VALUE=DATE: or TZID=...:
  const val = raw.includes(':') ? raw.split(':').pop()! : raw
  const clean = val.trim()

  if (clean.length === 8) {
    // YYYYMMDD
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

  // Fallback: try JS Date
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

/**
 * Parses an iCalendar (.ics) text payload into candidate schedule events
 */
export function parseIcsSchedule(icsText: string): CandidateScheduleEvent[] {
  const events: CandidateScheduleEvent[] = []

  // Unfold folded lines (lines starting with space or tab)
  const unfolded = icsText.replace(/\r\n[ \t]|\r[ \t]|\n[ \t]/g, '')
  const lines = unfolded.split(/\r\n|\r|\n/)

  let inVevent = false
  let currentEvent: Partial<CandidateScheduleEvent> = {}

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (line === 'BEGIN:VEVENT') {
      inVevent = true
      currentEvent = {
        confidence: 'high',
        isAllDay: true
      }
      continue
    }

    if (line === 'END:VEVENT') {
      if (inVevent && currentEvent.title && currentEvent.startDate) {
        events.push({
          title: currentEvent.title,
          description: currentEvent.description || undefined,
          category: currentEvent.category || inferCategory(currentEvent.title),
          startDate: currentEvent.startDate,
          startTime: currentEvent.startTime || undefined,
          endDate: currentEvent.endDate || undefined,
          endTime: currentEvent.endTime || undefined,
          isAllDay: currentEvent.isAllDay ?? true,
          location: currentEvent.location || undefined,
          recurrenceRule: currentEvent.recurrenceRule || undefined,
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

    // Unescape iCal backslashes: \, -> , ; \; -> ; ; \n -> newline
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
      currentEvent.startTime = parsed.time || undefined
      currentEvent.isAllDay = parsed.isAllDay
    } else if (keyPart.startsWith('DTEND')) {
      const parsed = parseIcsDate(line)
      currentEvent.endDate = parsed.date
      currentEvent.endTime = parsed.time || undefined
    } else if (keyPart === 'CATEGORIES') {
      currentEvent.category = inferCategory(val)
    } else if (keyPart.startsWith('RRULE')) {
      currentEvent.recurrenceRule = val
    }
  }

  return events
}

function escapeIcsText(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function formatIcsDateTime(dateStr: string, timeStr?: string | null): string {
  const cleanDate = dateStr.replace(/-/g, '')
  if (!timeStr) {
    return `;VALUE=DATE:${cleanDate}`
  }
  const cleanTime = timeStr.replace(/:/g, '')
  return `:${cleanDate}T${cleanTime.padEnd(6, '0')}Z`
}

/**
 * Generates an RFC 5545 compliant iCalendar string from ScheduleEvent items
 */
export function generateIcs(events: ScheduleEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hello 118:24//Student Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Hello 118:24 Schedule',
    'X-WR-TIMEZONE:UTC'
  ]

  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'

  for (const ev of events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:hello11824-evt-${ev.id}@planner.desktop`)
    lines.push(`DTSTAMP:${nowStamp}`)
    lines.push(`SUMMARY:${escapeIcsText(ev.title)}`)

    if (ev.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`)
    }
    if (ev.location) {
      lines.push(`LOCATION:${escapeIcsText(ev.location)}`)
    }
    if (ev.category) {
      lines.push(`CATEGORIES:${escapeIcsText(ev.category)}`)
    }

    if (ev.is_all_day || !ev.start_time) {
      lines.push(`DTSTART${formatIcsDateTime(ev.start_date)}`)
      if (ev.end_date) {
        lines.push(`DTEND${formatIcsDateTime(ev.end_date)}`)
      }
    } else {
      lines.push(`DTSTART${formatIcsDateTime(ev.start_date, ev.start_time)}`)
      const endDate = ev.end_date || ev.start_date
      const endTime = ev.end_time || ev.start_time
      lines.push(`DTEND${formatIcsDateTime(endDate, endTime)}`)
    }

    if (ev.recurrence_rule) {
      lines.push(`RRULE:${ev.recurrence_rule}`)
    }

    lines.push(ev.is_completed ? 'STATUS:COMPLETED' : 'STATUS:CONFIRMED')
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

/**
 * Generates CSV string sanitized against formula injection
 */
export function generateCsv(events: ScheduleEvent[]): string {
  const headers = [
    'Title',
    'Category',
    'Start Date',
    'Start Time',
    'End Date',
    'End Time',
    'All Day',
    'Location',
    'Description',
    'Status'
  ]

  const rows = [headers.join(',')]

  for (const ev of events) {
    const row = [
      escapeCsvField(sanitizeFormulaValue(ev.title)),
      escapeCsvField(sanitizeFormulaValue(ev.category)),
      escapeCsvField(ev.start_date),
      escapeCsvField(ev.start_time || ''),
      escapeCsvField(ev.end_date || ''),
      escapeCsvField(ev.end_time || ''),
      ev.is_all_day ? 'Yes' : 'No',
      escapeCsvField(sanitizeFormulaValue(ev.location || '')),
      escapeCsvField(sanitizeFormulaValue(ev.description || '')),
      ev.is_completed ? 'Completed' : 'Active'
    ]
    rows.push(row.join(','))
  }

  return rows.join('\r\n')
}

function escapeCsvField(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

/**
 * Generates an Excel workbook (.xlsx) binary Buffer
 */
export function generateExcelBuffer(events: ScheduleEvent[]): Buffer {
  const data = events.map(ev => ({
    Title: sanitizeFormulaValue(ev.title),
    Category: sanitizeFormulaValue(ev.category),
    'Start Date': ev.start_date,
    'Start Time': ev.start_time || '',
    'End Date': ev.end_date || '',
    'End Time': ev.end_time || '',
    'All Day': ev.is_all_day ? 'Yes' : 'No',
    Location: sanitizeFormulaValue(ev.location || ''),
    Description: sanitizeFormulaValue(ev.description || ''),
    Status: ev.is_completed ? 'Completed' : 'Active'
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(data)

  // Auto-size columns
  ws['!cols'] = [
    { wch: 25 }, // Title
    { wch: 15 }, // Category
    { wch: 12 }, // Start Date
    { wch: 10 }, // Start Time
    { wch: 12 }, // End Date
    { wch: 10 }, // End Time
    { wch: 8 },  // All Day
    { wch: 16 }, // Location
    { wch: 30 }, // Description
    { wch: 12 }  // Status
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Schedule')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return buffer
}

/**
 * Generates a clean, printable HTML document for PDF generation
 */
export function generatePrintableHtml(
  events: ScheduleEvent[],
  options?: { title?: string; subtitle?: string }
): string {
  const title = options?.title || 'Academic Schedule & Study Planner'
  const subtitle = options?.subtitle || '“This is the day which the Lord hath made; we will rejoice and be glad in it.” — Psalm 118:24'
  const generatedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const rows = events.map(ev => {
    const timeDisplay = ev.is_all_day
      ? 'All Day'
      : ev.start_time
        ? `${ev.start_time}${ev.end_time ? ` – ${ev.end_time}` : ''}`
        : 'All Day'

    const dateDisplay = ev.end_date && ev.end_date !== ev.start_date
      ? `${ev.start_date} → ${ev.end_date}`
      : ev.start_date

    return `
      <tr>
        <td class="date-col">${dateDisplay}</td>
        <td class="time-col">${timeDisplay}</td>
        <td class="title-col">
          <strong>${escapeHtml(ev.title)}</strong>
          ${ev.description ? `<div class="desc">${escapeHtml(ev.description)}</div>` : ''}
        </td>
        <td class="cat-col"><span class="badge ${ev.category.toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(ev.category)}</span></td>
        <td class="loc-col">${escapeHtml(ev.location || '—')}</td>
        <td class="status-col">${ev.is_completed ? '✓ Completed' : 'Active'}</td>
      </tr>
    `
  }).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 0;
      font-size: 11pt;
      line-height: 1.4;
      background: #ffffff;
    }
    .header {
      border-bottom: 2px solid #7c3aed;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .brand {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .brand-title {
      font-size: 20pt;
      font-weight: 800;
      color: #7c3aed;
      margin: 0;
    }
    .brand-meta {
      font-size: 9pt;
      color: #64748b;
    }
    .quote {
      margin-top: 6px;
      font-size: 9.5pt;
      font-style: italic;
      color: #475569;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 9.5pt;
    }
    th {
      background-color: #f8fafc;
      border-bottom: 2px solid #cbd5e1;
      text-align: left;
      padding: 8px 10px;
      font-weight: 700;
      color: #334155;
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background-color: #fcfdfe;
    }
    .date-col { width: 15%; font-weight: 600; color: #1e293b; }
    .time-col { width: 14%; color: #64748b; }
    .title-col { width: 35%; }
    .title-col .desc { font-size: 8.5pt; color: #64748b; margin-top: 3px; }
    .cat-col { width: 16%; }
    .loc-col { width: 12%; color: #64748b; }
    .status-col { width: 8%; font-size: 8.5pt; color: #475569; }
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 600;
      background: #f1f5f9;
      color: #334155;
    }
    .badge.exams { background: #fee2e2; color: #991b1b; }
    .badge.study-plan { background: #ede9fe; color: #5b21b6; }
    .badge.workshops { background: #fef3c7; color: #92400e; }
    .badge.meetings { background: #e0f2fe; color: #075985; }
    .footer {
      margin-top: 25px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      font-size: 8pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <h1 class="brand-title">Hello 118:24</h1>
      <span class="brand-meta">${generatedDate} • ${events.length} Events</span>
    </div>
    <div class="quote">${escapeHtml(subtitle)}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Time</th>
        <th>Event / Topic</th>
        <th>Category</th>
        <th>Location</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #94a3b8;">No schedule events found.</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    <span>Generated by Hello 118:24 Desktop</span>
    <span>Psalm 118:24</span>
  </div>
</body>
</html>
  `
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

