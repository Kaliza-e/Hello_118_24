import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import pdfParse from 'pdf-parse'
import * as XLSX from 'xlsx'

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
]
const SHORT_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function getMonthIndex(name) {
  const clean = name.toLowerCase().trim()
  const fullIdx = MONTH_NAMES.indexOf(clean)
  if (fullIdx !== -1) return fullIdx
  return SHORT_MONTHS.indexOf(clean.slice(0, 3))
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function computeFileHash(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function extractJpegsFromPdf(buffer) {
  const images = []
  let i = 0
  while (i < buffer.length - 3 && images.length < 15) {
    if (buffer[i] === 0xff && buffer[i + 1] === 0xd8 && buffer[i + 2] === 0xff) {
      let end = i + 2
      while (end < buffer.length - 1) {
        if (buffer[end] === 0xff && buffer[end + 1] === 0xd9) {
          const slice = buffer.subarray(i, end + 2)
          if (slice.length > 5120) {
            images.push(`data:image/jpeg;base64,${slice.toString('base64')}`)
          }
          i = end + 2
          break
        }
        end++
      }
    }
    i++
  }
  return images
}

function inferCategory(text) {
  const lower = text.toLowerCase()
  if (/\b(exam|examination|examinations|cats|cat|assessment|test|quiz)\b/i.test(lower)) {
    return 'Exams'
  }
  if (/\b(meeting|staff meeting|general staff|board)\b/i.test(lower)) {
    return 'Meetings'
  }
  if (/\b(hackathon|workshop|ideation|bootcamp|seminar|training)\b/i.test(lower)) {
    return 'Workshops'
  }
  if (/\b(assignment|homework|student projects|project presentation|project ideation|prototype|feedback)\b/i.test(lower)) {
    return 'Assignments'
  }
  if (/\b(internship|career fair|application|registration|admission)\b/i.test(lower)) {
    return 'Applications'
  }
  if (/\b(academic|term one|term two|term three|term 1|term 2|term 3|teaching|classes|induction|orientation|holiday|heroes day|labour day|independence day|liberation day|christmas|break|school break|commemoration|closing|reopening)\b/i.test(lower)) {
    return 'Academic Calendar'
  }
  if (/\b(exhibition|social|club|sports|fair|festival|ceremony)\b/i.test(lower)) {
    return 'Events'
  }
  return 'Other'
}

function normalizeScheduleTime(str) {
  if (!str) return null
  const cleaned = str.trim().toLowerCase()
  const hMatch = cleaned.match(/^(\d{1,2})h(?::?(\d{2}))?$/)
  if (hMatch) {
    const h = parseInt(hMatch[1], 10)
    const m = hMatch[2] ? parseInt(hMatch[2], 10) : 0
    return `${pad2(h)}:${pad2(m)}`
  }
  const standardMatch = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (standardMatch) {
    let h = parseInt(standardMatch[1], 10)
    const m = standardMatch[2] ? parseInt(standardMatch[2], 10) : 0
    const ap = standardMatch[3]
    if (ap === 'pm' && h < 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    return `${pad2(h)}:${pad2(m)}`
  }
  return null
}

function parseScheduleText(rawText, defaultYear = 2026) {
  if (!rawText || rawText.trim().length === 0) return []
  const events = []
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)

  let currentYear = defaultYear
  let currentMonth = null
  let currentTerm = null
  let activeDateGrid = []
  let currentCohort = ''

  const yearHeaderMatch = rawText.match(/\b(20\d{2})[\s\/-](20\d{2})\b/i)
  let academicStartYear = defaultYear
  let academicEndYear = defaultYear + 1
  if (yearHeaderMatch) {
    academicStartYear = parseInt(yearHeaderMatch[1], 10)
    academicEndYear = parseInt(yearHeaderMatch[2], 10)
    currentYear = academicStartYear
  }

  const monthHeaderRegex = /^(?:#+\s*)?(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(20\d{2}))?/i
  const termHeaderRegex = /\b(term\s+(?:one|two|three|1|2|3)|holiday\s+programmes)\b/i

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]

    const cohortMatch = line.match(/\b(Year\s*[1-3]|SPE|GENAI)\b/i)
    if (cohortMatch) {
      currentCohort = cohortMatch[1]
    }

    const termMatch = line.match(termHeaderRegex)
    if (termMatch) {
      currentTerm = termMatch[1]
      if (/term\s*(?:two|three|2|3)|holiday/i.test(line)) {
        currentYear = academicEndYear
      } else if (/term\s*(?:one|1)/i.test(line)) {
        currentYear = academicStartYear
      }
    }

    const monthMatch = line.match(monthHeaderRegex)
    if (monthMatch && !line.includes('continue') && !line.includes('meeting') && !line.includes('exam')) {
      const mIdx = getMonthIndex(monthMatch[1])
      if (mIdx !== -1) {
        currentMonth = mIdx
        if (monthMatch[2]) {
          currentYear = parseInt(monthMatch[2], 10)
        } else {
          if (mIdx < 8 && academicEndYear) {
            currentYear = academicEndYear
          } else {
            currentYear = academicStartYear
          }
        }
        continue
      }
    }

    const multiDateMatches = [...line.matchAll(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g)]
    if (multiDateMatches.length >= 2) {
      activeDateGrid = multiDateMatches.map(m => {
        const part1 = parseInt(m[1], 10)
        const part2 = parseInt(m[2], 10)
        let y = parseInt(m[3], 10)
        if (y < 100) y += 2000
        if (y > 2099 || y < 2000) y = currentYear

        let day = part1
        let month = part2
        if (part1 <= 12 && part2 > 12) {
          month = part1
          day = part2
        }
        return `${y}-${pad2(month)}-${pad2(day)}`
      })
      continue
    }

    const gridTimeMatch = line.match(/(\d{1,2}(?:h:?\d{2}|:\d{2}|000))\s*(?:-|–|—|to)\s*(\d{1,2}(?:h:?\d{2}|:\d{2}|000))?/i)
    if (gridTimeMatch && activeDateGrid.length > 0 && !line.includes('Academic Year') && !line.includes('TERM')) {
      const startTime = normalizeScheduleTime(gridTimeMatch[1]) || undefined
      let endTime = gridTimeMatch[2] ? normalizeScheduleTime(gridTimeMatch[2]) || undefined : undefined
      if (!endTime && idx + 1 < lines.length && /^\d{1,2}(?:h\d{2}|000)/i.test(lines[idx + 1])) {
        endTime = normalizeScheduleTime(lines[idx + 1]) || undefined
      }

      let content = line.replace(gridTimeMatch[0], '').replace(/^[\|\s–\-:;,]+|[\|\s–\-:;,]+$/g, '').trim()
      if (idx + 1 < lines.length && !/^\d/.test(lines[idx + 1]) && !lines[idx + 1].includes('Days') && lines[idx + 1].length > 3) {
        content += ' ' + lines[idx + 1]
      }

      const KNOWN_MW = ['Embedded Systems', 'Java scripts', 'AI Prompt Engineering', 'System Networking', 'Computer Basics', '3D Models', 'Adv Databases', 'Adv Networking', 'ML with Python', 'Cyber security', 'IT Projects Monetization', 'Mobile Application', 'Intelligent Robotics']
      let remainingSub = content
      const extractedMw = []
      for (const mw of KNOWN_MW) {
        const reg = new RegExp(`\\b${mw}\\b`, 'i')
        if (reg.test(remainingSub)) {
          remainingSub = remainingSub.replace(reg, ' ___MW___ ')
          extractedMw.push(mw)
        }
      }
      let subjects = []
      if (content.includes('|')) {
        subjects = content.split('|').map(s => s.trim()).filter(Boolean)
      } else {
        const words = remainingSub.split(/\s+/).filter(w => w && w !== '___MW___' && w.length > 1)
        subjects = [...words, ...extractedMw]
      }

      for (let sIdx = 0; sIdx < Math.min(subjects.length, activeDateGrid.length); sIdx++) {
        const title = subjects[sIdx] + (currentCohort ? ` (${currentCohort})` : '')
        events.push({
          title,
          category: 'Exams',
          startDate: activeDateGrid[sIdx],
          endDate: activeDateGrid[sIdx],
          startTime,
          endTime,
          isAllDay: !startTime,
          sourceExcerpt: line,
          confidence: 'high'
        })
      }
      continue
    }

    if (!/\d/.test(line) && /^(date\s*[\/\-]?\s*period|category|academic\s*or\s*institutional\s*activity|time\b|days\b|day\b)/i.test(line)) {
      continue
    }

    const isoDateMatch = line.match(/\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/)
    if (isoDateMatch) {
      const year = parseInt(isoDateMatch[1], 10)
      const month = parseInt(isoDateMatch[2], 10)
      const day = parseInt(isoDateMatch[3], 10)

      let title = line.replace(isoDateMatch[0], '').replace(/^[\|\s–\-:;,]+|[\|\s–\-:;,]+$/g, '').trim()
      let timeMatch = line.match(/(\d{1,2}(?:h:?\d{2}|:\d{2}))\s*(?:-|–|to)\s*(\d{1,2}(?:h:?\d{2}|:\d{2}))/i)
      let startTime = undefined
      let endTime = undefined
      if (timeMatch) {
        startTime = normalizeScheduleTime(timeMatch[1]) || undefined
        endTime = normalizeScheduleTime(timeMatch[2]) || undefined
        title = title.replace(timeMatch[0], '').replace(/^[\|\s–\-:;,]+|[\|\s–\-:;,]+$/g, '').trim()
      }

      if (title.length > 1) {
        let cat = inferCategory(title + ' ' + (currentTerm || ''))
        if (title.includes('|')) {
          const parts = title.split('|').map(p => p.trim()).filter(Boolean)
          if (parts.length >= 2) {
            cat = inferCategory(parts[0] + ' ' + parts[1])
            title = parts[parts.length - 1]
          }
        }
        const startDate = `${year}-${pad2(month)}-${pad2(day)}`
        events.push({
          title,
          category: cat,
          startDate,
          endDate: startDate,
          startTime,
          endTime,
          isAllDay: !startTime,
          sourceExcerpt: line,
          confidence: 'high'
        })
        continue
      }
    }

    const dmyMatch = line.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/)
    if (dmyMatch) {
      const part1 = parseInt(dmyMatch[1], 10)
      const part2 = parseInt(dmyMatch[2], 10)
      let year = parseInt(dmyMatch[3], 10)
      if (year < 100) year += 2000

      let day = part1
      let month = part2
      if (part1 <= 12 && part2 > 12) {
        month = part1
        day = part2
      }

      let title = line.replace(dmyMatch[0], '').replace(/^[\|\s–\-:;,]+|[\|\s–\-:;,]+$/g, '').trim()
      let timeMatch = line.match(/(\d{1,2}(?:h:?\d{2}|:\d{2}))\s*(?:-|–|to)\s*(\d{1,2}(?:h:?\d{2}|:\d{2}))/i)
      let startTime = undefined
      let endTime = undefined
      if (timeMatch) {
        startTime = normalizeScheduleTime(timeMatch[1]) || undefined
        endTime = normalizeScheduleTime(timeMatch[2]) || undefined
        title = title.replace(timeMatch[0], '').replace(/^[\|\s–\-:;,]+|[\|\s–\-:;,]+$/g, '').trim()
      }

      if (title.length > 1) {
        let cat = inferCategory(title + ' ' + (currentTerm || ''))
        if (title.includes('|')) {
          const parts = title.split('|').map(p => p.trim()).filter(Boolean)
          if (parts.length >= 2) {
            cat = inferCategory(parts[0] + ' ' + parts[1])
            title = parts[parts.length - 1]
          }
        }
        const startDate = `${year}-${pad2(month)}-${pad2(day)}`
        events.push({
          title,
          category: cat,
          startDate,
          endDate: startDate,
          startTime,
          endTime,
          isAllDay: !startTime,
          sourceExcerpt: line,
          confidence: 'high'
        })
        continue
      }
    }

    const crossMonthRangeMatch = line.match(/^(\d{1,2})\s+([a-z]+)\s*(?:-|–|—|to)\s*(\d{1,2})\s+([a-z]+)(?:\s+(20\d{2}))?/i)
    if (crossMonthRangeMatch) {
      const startDay = parseInt(crossMonthRangeMatch[1], 10)
      const startMonthIdx = getMonthIndex(crossMonthRangeMatch[2])
      const endDay = parseInt(crossMonthRangeMatch[3], 10)
      const endMonthIdx = getMonthIndex(crossMonthRangeMatch[4])

      if (startMonthIdx !== -1 && endMonthIdx !== -1) {
        let startYr = crossMonthRangeMatch[5] ? parseInt(crossMonthRangeMatch[5], 10) : currentYear
        if (!crossMonthRangeMatch[5] && startMonthIdx < 8 && academicEndYear) {
          startYr = academicEndYear
        }
        let endYr = startYr
        if (startMonthIdx > endMonthIdx) {
          endYr = startYr + 1
        } else if (endMonthIdx < 8 && academicEndYear) {
          endYr = academicEndYear
        }

        const remaining = line.slice(crossMonthRangeMatch[0].length).replace(/^[\|\s–\-:;,]+|[\|\s–\-:;,]+$/g, '').trim()
        const title = remaining.length > 0 ? remaining : (lines[idx + 1] || 'Academic Event')
        const cat = inferCategory(title + ' ' + remaining)

        events.push({
          title,
          category: cat,
          startDate: `${startYr}-${pad2(startMonthIdx + 1)}-${pad2(startDay)}`,
          endDate: `${endYr}-${pad2(endMonthIdx + 1)}-${pad2(endDay)}`,
          isAllDay: true,
          sourceExcerpt: line,
          confidence: 'high'
        })
        continue
      }
    }

    const intraMonthRangeMatch = line.match(/^(\d{1,2})\s*(?:-|–|—|to)\s*(\d{1,2})\s+([a-z]+)?/i)
    if (intraMonthRangeMatch) {
      const startDay = parseInt(intraMonthRangeMatch[1], 10)
      const endDay = parseInt(intraMonthRangeMatch[2], 10)
      let monthIdx = intraMonthRangeMatch[3] ? getMonthIndex(intraMonthRangeMatch[3]) : currentMonth

      if (monthIdx !== null && monthIdx !== -1) {
        let yr = currentYear
        if (monthIdx < 8 && academicEndYear) yr = academicEndYear

        let remaining = line.replace(intraMonthRangeMatch[0], '').replace(/^[\|\s–\-:;,]+|[\|\s–\-:;,]+$/g, '').trim()
        let description = undefined
        if (remaining.split(/\s+/).length <= 2 && idx + 1 < lines.length) {
          const next = lines[idx + 1]
          if (!/^\d/.test(next) && !next.match(monthHeaderRegex)) {
            description = next
            remaining = `${remaining}: ${next}`
          }
        }

        const title = remaining.length > 0 ? remaining : 'Scheduled Activity'
        events.push({
          title,
          description,
          category: inferCategory(title + ' ' + (intraMonthRangeMatch[3] || '')),
          startDate: `${yr}-${pad2(monthIdx + 1)}-${pad2(startDay)}`,
          endDate: `${yr}-${pad2(monthIdx + 1)}-${pad2(endDay)}`,
          isAllDay: true,
          sourceExcerpt: line,
          confidence: 'high'
        })
        continue
      }
    }

    const singleDateMatch = line.match(/^(?:from\s+)?(\d{1,2})\s+([a-z]+)/i)
    if (singleDateMatch) {
      const day = parseInt(singleDateMatch[1], 10)
      const mIdx = getMonthIndex(singleDateMatch[2])

      if (mIdx !== -1) {
        let yr = currentYear
        if (mIdx < 8 && academicEndYear) yr = academicEndYear

        let remaining = line.replace(singleDateMatch[0], '').replace(/^[\|\s–\-:;,]+|[\|\s–\-:;,]+$/g, '').trim()
        if (remaining.split(/\s+/).length <= 2 && idx + 1 < lines.length) {
          const next = lines[idx + 1]
          if (!/^\d/.test(next) && !next.match(monthHeaderRegex)) {
            remaining = `${remaining}: ${next}`
          }
        }

        const title = remaining.length > 0 ? remaining : 'Scheduled Event'
        const startDate = `${yr}-${pad2(mIdx + 1)}-${pad2(day)}`
        events.push({
          title,
          category: inferCategory(title + ' ' + singleDateMatch[2]),
          startDate,
          endDate: startDate,
          isAllDay: true,
          sourceExcerpt: line,
          confidence: 'high'
        })
        continue
      }
    }

    if (line.includes('|')) {
      const cols = line.split('|').map(c => c.trim()).filter(c => c.length > 0)
      if (cols.length >= 2) {
        const dateCol = cols[0]
        const catCol = cols.length >= 3 ? cols[1] : undefined
        const descCol = cols.length >= 3 ? cols[2] : cols[1]

        const parsedSub = parseScheduleText(`${dateCol} ${descCol}`, currentYear)
        if (parsedSub.length > 0) {
          const item = parsedSub[0]
          if (catCol) {
            item.category = inferCategory(catCol)
          }
          item.sourceExcerpt = line
          events.push(item)
          continue
        }
      }
    }
  }

  const uniqueEvents = []
  const seenKeys = new Set()

  for (const ev of events) {
    const key = `${ev.startDate}__${ev.title.toLowerCase().trim()}`
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      uniqueEvents.push(ev)
    }
  }

  return uniqueEvents
}

test('Schedule Parser: parses intra-month date ranges', () => {
  const text = `
    SEPTEMBER 2026
    7-11 September | Opening | Start of classes and induction week
    2-6 November | Assessment | Continuous Assessment Tests (CATs)
    25-26 February | Student Projects | Presentation of the first prototype
  `
  const events = parseScheduleText(text, 2026)
  assert.equal(events.length, 3)

  assert.equal(events[0].startDate, '2026-09-07')
  assert.equal(events[0].endDate, '2026-09-11')
  assert.equal(events[0].category, 'Academic Calendar')

  assert.equal(events[1].startDate, '2026-11-02')
  assert.equal(events[1].endDate, '2026-11-06')
  assert.equal(events[1].category, 'Exams')

  assert.equal(events[2].startDate, '2027-02-25')
  assert.equal(events[2].endDate, '2027-02-26')
  assert.equal(events[2].category, 'Assignments')
})

test('Schedule Parser: parses cross-month date ranges spanning year boundaries', () => {
  const text = `
    2026/2027 Academic Year
    DECEMBER 2026
    18 December - 3 January | School Break | Christmas break
    31 May - 18 June | NESA Examination | NESA practical examinations
  `
  const events = parseScheduleText(text, 2026)
  assert.equal(events.length, 2)

  assert.equal(events[0].startDate, '2026-12-18')
  assert.equal(events[0].endDate, '2027-01-03')
  assert.equal(events[0].category, 'Academic Calendar')

  assert.equal(events[1].startDate, '2027-05-31')
  assert.equal(events[1].endDate, '2027-06-18')
  assert.equal(events[1].category, 'Exams')
})

test('Schedule Parser: parses single dates and open-ended dates', () => {
  const text = `
    SEPTEMBER 2026
    10 September | Staff Meeting | General staff meeting to launch the 2026/2027 academic year
    21 October | Staff Meeting | General staff meeting
    1 February | Public Holiday | National Heroes Day
    From 9 August | Internship | Internship begins for finalists
  `
  const events = parseScheduleText(text, 2026)
  assert.equal(events.length, 4)

  assert.equal(events[0].startDate, '2026-09-10')
  assert.equal(events[0].category, 'Meetings')

  assert.equal(events[1].startDate, '2026-10-21')
  assert.equal(events[1].category, 'Meetings')

  assert.equal(events[2].startDate, '2027-02-01')
  assert.equal(events[2].category, 'Academic Calendar')

  assert.equal(events[3].startDate, '2027-08-09')
  assert.equal(events[3].category, 'Applications')
})

test('Schedule Parser: parses numerical date with exam times', () => {
  const text = `
    Monday 02/11/2026 8h:30 - 11h30 Mathematics CAT
    Tuesday 03/11/2026 14h00 - 17h00 Databases Assessment
  `
  const events = parseScheduleText(text, 2026)
  assert.equal(events.length, 2)

  assert.equal(events[0].startDate, '2026-11-02')
  assert.equal(events[0].startTime, '08:30')
  assert.equal(events[0].endTime, '11:30')
  assert.equal(events[0].isAllDay, false)
  assert.equal(events[0].category, 'Exams')

  assert.equal(events[1].startDate, '2026-11-03')
  assert.equal(events[1].startTime, '14:00')
  assert.equal(events[1].endTime, '17:00')
  assert.equal(events[1].isAllDay, false)
})

test('Schedule Parser: parses multi-column exam grid matrix from CATs timetable', () => {
  const text = `
    Year 3
    Days Monday Tuesday Wednesday Thursday Friday
    02/11/2026 03/11/2026 04/11/2026 05/11/2026 06/11/2026
    8h:30 — 11h30 | Mathematics | ML with Python | Physics | Cyber security | IT Projects
    14000-17000 | Devops | Mobile Application | English | Intelligent Robotics | Mini-CAT
  `
  const events = parseScheduleText(text, 2026)
  assert.ok(events.length >= 10, 'Must extract at least 10 exam activities from grid')
  assert.equal(events[0].startDate, '2026-11-02')
  assert.equal(events[0].startTime, '08:30')
  assert.equal(events[0].category, 'Exams')
  assert.equal(events[1].startDate, '2026-11-03')
})

test('Schedule Parser: category inference covers canonical taxonomy', () => {
  assert.equal(inferCategory('Continuous Assessment Tests (CATs)'), 'Exams')
  assert.equal(inferCategory('Term One final examinations'), 'Exams')
  assert.equal(inferCategory('General staff academic meeting'), 'Meetings')
  assert.equal(inferCategory('Fourth Hackathon activity'), 'Workshops')
  assert.equal(inferCategory('Presentation of the first prototype'), 'Assignments')
  assert.equal(inferCategory('Internship begins for finalists'), 'Applications')
  assert.equal(inferCategory('Christmas break'), 'Academic Calendar')
  assert.equal(inferCategory('National Heroes Day public holiday'), 'Academic Calendar')
  assert.equal(inferCategory('Clubs exhibition & festival'), 'Events')
})

test('Schedule Parser: time normalizer handles diverse formats', () => {
  assert.equal(normalizeScheduleTime('8h:30'), '08:30')
  assert.equal(normalizeScheduleTime('11h30'), '11:30')
  assert.equal(normalizeScheduleTime('14h00'), '14:00')
  assert.equal(normalizeScheduleTime('8:30 am'), '08:30')
  assert.equal(normalizeScheduleTime('2:00 pm'), '14:00')
  assert.equal(normalizeScheduleTime('11:45 PM'), '23:45')
  assert.equal(normalizeScheduleTime('invalid'), null)
})

test('Ingestion Pipeline: detects scanned PDF needing OCR fallback', async () => {
  const fixturePath = resolve('test/fixtures/ACADEMIC CALENDAR 2026 2027.pdf')
  assert.ok(existsSync(fixturePath), 'Fixture must exist')

  const buf = readFileSync(fixturePath)
  const hash = computeFileHash(buf)
  assert.ok(hash.length === 64, 'SHA-256 hash must be 64 hex characters')

  const parsed = await pdfParse(buf)
  const textLen = parsed.text.trim().length
  assert.equal(textLen, 0, 'Scanned PDF text length must be 0')

  const images = extractJpegsFromPdf(buf)
  assert.equal(images.length, 7, 'Scanned PDF must extract all 7 page JPEG images for OCR')
})

test('Ingestion Pipeline: extracts selectable text PDF', async () => {
  const fixturePath = resolve('test/fixtures/Y3A.pdf')
  assert.ok(existsSync(fixturePath), 'Fixture must exist')

  const buf = readFileSync(fixturePath)
  const parsed = await pdfParse(buf)
  assert.ok(parsed.text.length > 500, 'Must extract text from selectable PDF')
})

test('Ingestion Pipeline: parses spreadsheet CSV schedule data', async () => {
  const csvData = `Date,Category,Activity\n2026-09-07,Academic Calendar,Term 1 Begins\n2026-11-02,Exams,Midterm Assessment\n`
  const workbook = XLSX.read(Buffer.from(csvData), { type: 'buffer', raw: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const csv = XLSX.utils.sheet_to_csv(sheet)
  const parsed = parseScheduleText(csv.replace(/,/g, ' | '), 2026)

  assert.ok(parsed.length >= 2)
  assert.equal(parsed[0].startDate, '2026-09-07')
  assert.equal(parsed[1].startDate, '2026-11-02')
})
