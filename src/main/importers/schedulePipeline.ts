import { createHash } from 'node:crypto'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { createWorker } from 'tesseract.js'
import { ScheduleCategory } from '../db'

export interface CandidateScheduleEvent {
  id?: string
  title: string
  description?: string
  category: ScheduleCategory
  startDate: string // YYYY-MM-DD
  startTime?: string // HH:mm
  endDate?: string // YYYY-MM-DD
  endTime?: string // HH:mm
  isAllDay: boolean
  location?: string
  recurrenceRule?: string
  sourceExcerpt?: string
  sourcePage?: number
  confidence: 'high' | 'medium' | 'low'
  warning?: string
}

export interface IngestionResult {
  fileName: string
  fileType: string
  fileSize: number
  fileHash: string
  rawText: string
  needsOcr: boolean
  pageImages?: string[] // Base64 data URLs for OCR
  candidates: CandidateScheduleEvent[]
  isDuplicate?: boolean
  existingDocId?: number
}

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
]
const SHORT_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export function getMonthIndex(name: string): number {
  const clean = name.toLowerCase().trim()
  const fullIdx = MONTH_NAMES.indexOf(clean)
  if (fullIdx !== -1) return fullIdx
  const shortIdx = SHORT_MONTHS.indexOf(clean.slice(0, 3))
  return shortIdx
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// Computes SHA-256 fingerprint for duplicate detection
export function computeFileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

// Extracts JPEG page images from PDF buffers (for scanned documents)
export function extractJpegsFromPdf(buffer: Buffer): string[] {
  const images: string[] = []
  let i = 0
  const maxImages = 15 // Limit to first 15 pages to keep memory reasonable
  while (i < buffer.length - 3 && images.length < maxImages) {
    if (buffer[i] === 0xff && buffer[i + 1] === 0xd8 && buffer[i + 2] === 0xff) {
      let end = i + 2
      while (end < buffer.length - 1) {
        if (buffer[end] === 0xff && buffer[end + 1] === 0xd9) {
          const slice = buffer.subarray(i, end + 2)
          // Filter out tiny embedded icons (< 5KB)
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

// Maps arbitrary extracted keywords to canonical ScheduleCategory
export function inferCategory(text: string): ScheduleCategory {
  const lower = text.toLowerCase()
  // High precedence: Exams & Tests
  if (/\b(exam|examination|examinations|cats|cat|assessment|test|quiz)\b/i.test(lower)) {
    return 'Exams'
  }
  // Meetings
  if (/\b(meeting|staff meeting|general staff|board)\b/i.test(lower)) {
    return 'Meetings'
  }
  // Workshops & Hackathons
  if (/\b(hackathon|workshop|ideation|bootcamp|seminar|training)\b/i.test(lower)) {
    return 'Workshops'
  }
  // Assignments & Student Projects
  if (/\b(assignment|homework|student projects|project presentation|project ideation|prototype|feedback)\b/i.test(lower)) {
    return 'Assignments'
  }
  // Applications & Careers
  if (/\b(internship|career fair|application|registration|admission)\b/i.test(lower)) {
    return 'Applications'
  }
  // Academic Calendar
  if (/\b(academic|term one|term two|term three|term 1|term 2|term 3|teaching|classes|induction|orientation|holiday|heroes day|labour day|independence day|liberation day|christmas|break|school break|commemoration|closing|reopening)\b/i.test(lower)) {
    return 'Academic Calendar'
  }
  // Events
  if (/\b(exhibition|social|club|sports|fair|festival|ceremony)\b/i.test(lower)) {
    return 'Events'
  }
  return 'Other'
}

// Normalizes time string (e.g. "8h:30", "11h30", "14h00", "8:30 a.m.", "14000") to HH:mm
export function normalizeScheduleTime(str: string): string | null {
  if (!str) return null
  const cleaned = str.trim().toLowerCase()

  // 14000 or 17000 from OCR
  const ocrZerosMatch = cleaned.match(/^(\d{1,2})000$/)
  if (ocrZerosMatch) {
    const h = parseInt(ocrZerosMatch[1], 10)
    if (h >= 0 && h <= 23) {
      return `${pad2(h)}:00`
    }
  }

  // 8h:30 or 8h30 or 14h00
  const hMatch = cleaned.match(/^(\d{1,2})h(?::?(\d{2}))?$/)
  if (hMatch) {
    const h = parseInt(hMatch[1], 10)
    const m = hMatch[2] ? parseInt(hMatch[2], 10) : 0
    return `${pad2(h)}:${pad2(m)}`
  }

  // 8:30 am / 2:00 pm
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

const KNOWN_MULTI_WORD_SUBJECTS = [
  'Embedded Systems', 'Java scripts', 'AI Prompt Engineering', 'System Networking',
  'Computer Basics', '3D Models', 'Adv Databases', 'Adv Networking', 'ML with Python',
  'Cyber security', 'IT Projects Monetization', 'Mobile Application', 'Intelligent Robotics',
  'AI-Assisted Software', 'Frontend'
]

function splitGridSubjects(str: string): string[] {
  if (str.includes('|')) {
    const parts = str.split('|').map(s => s.trim()).filter(Boolean)
    if (parts.length >= 2) return parts
  }
  let remaining = str
  const extracted: string[] = []
  for (const mw of KNOWN_MULTI_WORD_SUBJECTS) {
    const reg = new RegExp(`\\b${mw}\\b`, 'i')
    if (reg.test(remaining)) {
      remaining = remaining.replace(reg, ' ___MW___ ')
      extracted.push(mw)
    }
  }
  const words = remaining.split(/\s+/).filter(w => w && w !== '___MW___' && w.length > 1)
  return [...words, ...extracted]
}

/**
 * Universal Node-side OCR execution
 * Runs Tesseract locally inside Node process without CDN/network dependency
 */
export async function performNodeOcr(images: string[]): Promise<string> {
  if (!images || images.length === 0) return ''
  let accumulatedText = ''
  let worker: any = null
  try {
    worker = await createWorker('eng')
    for (let idx = 0; idx < images.length; idx++) {
      const item = images[idx]
      let imgBuffer: Buffer
      if (item.startsWith('data:image/')) {
        const base64Data = item.replace(/^data:image\/\w+;base64,/, '')
        imgBuffer = Buffer.from(base64Data, 'base64')
      } else {
        imgBuffer = Buffer.from(item, 'base64')
      }
      const res = await worker.recognize(imgBuffer)
      if (res.data?.text && res.data.text.trim().length > 0) {
        accumulatedText += `\n--- Page ${idx + 1} ---\n${res.data.text}\n`
      }
    }
  } catch (err) {
    console.error('Node OCR failed:', err)
  } finally {
    if (worker) {
      try {
        await worker.terminate()
      } catch {}
    }
  }
  return accumulatedText
}

/**
 * Intelligent Layout & Context-Aware Schedule Parser
 * Extracts events from text lines, tables, or OCR transcriptions
 */
export function parseScheduleText(rawText: string, defaultYear: number = new Date().getFullYear()): CandidateScheduleEvent[] {
  if (!rawText || rawText.trim().length === 0) return []

  const events: CandidateScheduleEvent[] = []
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)

  let currentYear = defaultYear
  let currentMonth: number | null = null // 0 = Jan, 11 = Dec
  let currentTerm: string | null = null
  let activeDateGrid: string[] = []
  let currentCohort = ''

  // Check if text has academic year header (e.g., "2026/2027 Academic Year" or "2026-2027")
  const yearHeaderMatch = rawText.match(/\b(20\d{2})[\s\/-](20\d{2})\b/i)
  let academicStartYear = defaultYear
  let academicEndYear = defaultYear + 1
  if (yearHeaderMatch) {
    academicStartYear = parseInt(yearHeaderMatch[1], 10)
    academicEndYear = parseInt(yearHeaderMatch[2], 10)
    currentYear = academicStartYear
  }

  // Pre-regex for month header (e.g. "SEPTEMBER 2026", "JANUARY 2027", "FEBRUARY 2027")
  const monthHeaderRegex = /^(?:#+\s*)?(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(20\d{2}))?/i

  // Pre-regex for term headers (e.g. "TERM ONE: 7 September - 18 December 2026")
  const termHeaderRegex = /\b(term\s+(?:one|two|three|1|2|3)|holiday\s+programmes)\b/i

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]

    // Track cohort header (e.g. "Year 1", "Year 2", "Year 3", "SPE", "GENAI")
    const cohortMatch = line.match(/\b(Year\s*[1-3]|SPE|GENAI)\b/i)
    if (cohortMatch) {
      currentCohort = cohortMatch[1]
    }

    // Check term header
    const termMatch = line.match(termHeaderRegex)
    if (termMatch) {
      currentTerm = termMatch[1]
      // Adjust year if term corresponds to second calendar year (Jan-Aug)
      if (/term\s*(?:two|three|2|3)|holiday/i.test(line)) {
        currentYear = academicEndYear
      } else if (/term\s*(?:one|1)/i.test(line)) {
        currentYear = academicStartYear
      }
    }

    // Check month section header
    const monthMatch = line.match(monthHeaderRegex)
    if (monthMatch && !line.includes('continue') && !line.includes('meeting') && !line.includes('exam')) {
      const mIdx = getMonthIndex(monthMatch[1])
      if (mIdx !== -1) {
        currentMonth = mIdx
        if (monthMatch[2]) {
          currentYear = parseInt(monthMatch[2], 10)
        } else {
          // If month is Jan-Aug, it's typically the second half of the academic year
          if (mIdx < 8 && academicEndYear) {
            currentYear = academicEndYear
          } else {
            currentYear = academicStartYear
          }
        }
        continue
      }
    }

    // Check Pattern 0A: Grid/Matrix Date Header Row (e.g. "02/11/2026 03/11/2026 04/11/2026 05/11/2026 06/11/2026")
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

    // Check Pattern 0B: Time slot matching active date grid (e.g. "8h:30 — 11h30 | Mathematics FOP...")
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

      const subjects = splitGridSubjects(content)
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

    // Skip table header lines like "DATE / PERIOD | CATEGORY | ACTIVITY"
    // Only skip if line doesn't contain digits to avoid skipping lines like "Monday 02/11/2026"
    if (!/\d/.test(line) && /^(date\s*[\/\-]?\s*period|category|academic\s*or\s*institutional\s*activity|time\b|days\b|day\b)/i.test(line)) {
      continue
    }

    // Match Pattern 1A: ISO Date YYYY-MM-DD (e.g. from CSV / standard formats)
    const isoDateMatch = line.match(/\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/)
    if (isoDateMatch) {
      const year = parseInt(isoDateMatch[1], 10)
      const month = parseInt(isoDateMatch[2], 10)
      const day = parseInt(isoDateMatch[3], 10)

      let title = line.replace(isoDateMatch[0], '').replace(/^[\|\s–\-:;,]+|[\|\s–\-:;,]+$/g, '').trim()
      let timeMatch = line.match(/(\d{1,2}(?:h:?\d{2}|:\d{2}))\s*(?:-|–|to)\s*(\d{1,2}(?:h:?\d{2}|:\d{2}))/i)
      let startTime: string | undefined = undefined
      let endTime: string | undefined = undefined
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

    // Match Pattern 1B: Numerical Date DD/MM/YYYY or MM/DD/YYYY or DD/MM/YY
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
      let startTime: string | undefined = undefined
      let endTime: string | undefined = undefined
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

    // Match Pattern 2: Day range spanning across different months
    // Example: "18 December - 3 January", "31 May - 18 June", "24 February - 26 May"
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
        // If start is Dec and end is Jan, end year is next year
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

    // Match Pattern 3: Day range within current month or specified month
    // Example: "7-11 September", "2-6 November", "25-26 February", "7-30 September"
    const intraMonthRangeMatch = line.match(/^(\d{1,2})\s*(?:-|–|—|to)\s*(\d{1,2})\s+([a-z]+)?/i)
    if (intraMonthRangeMatch) {
      const startDay = parseInt(intraMonthRangeMatch[1], 10)
      const endDay = parseInt(intraMonthRangeMatch[2], 10)
      let monthIdx = intraMonthRangeMatch[3] ? getMonthIndex(intraMonthRangeMatch[3]) : currentMonth

      if (monthIdx !== null && monthIdx !== -1) {
        let yr = currentYear
        if (monthIdx < 8 && academicEndYear) yr = academicEndYear

        let remaining = line.replace(intraMonthRangeMatch[0], '').replace(/^[\|\s–\-:;,]+|[\|\s–\-:;,]+$/g, '').trim()
        // If remaining is just a category word like "Opening" or "Teaching", look ahead for activity
        let description: string | undefined = undefined
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

    // Match Pattern 4: Single Date (e.g. "10 September", "21 October", "1 February", "From 9 August")
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

    // Match Pattern 5: Pipe-separated / tabular line (e.g. from Markdown or CSV or HTML table)
    // Example: "7-11 September | Opening | Start of classes and induction week"
    if (line.includes('|')) {
      const cols = line.split('|').map(c => c.trim()).filter(c => c.length > 0)
      if (cols.length >= 2) {
        const dateCol = cols[0]
        const catCol = cols.length >= 3 ? cols[1] : undefined
        const descCol = cols.length >= 3 ? cols[2] : cols[1]

        // Parse date from dateCol
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

  // Deduplicate candidate events with identical title and start date
  const uniqueEvents: CandidateScheduleEvent[] = []
  const seenKeys = new Set<string>()

  for (const ev of events) {
    const key = `${ev.startDate}__${ev.title.toLowerCase().trim()}`
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      uniqueEvents.push(ev)
    }
  }

  return uniqueEvents
}

/**
 * Universal Ingestion Pipeline
 * Processes PDF, DOCX, XLSX, CSV, and Images into candidate events
 */
export async function ingestScheduleDocument(
  buffer: Buffer,
  fileName: string,
  ext: string
): Promise<IngestionResult> {
  const fileHash = computeFileHash(buffer)
  const fileSize = buffer.length
  let rawText = ''
  let needsOcr = false
  let pageImages: string[] | undefined = undefined

  const cleanExt = ext.toLowerCase().replace(/^\./, '')

  if (cleanExt === 'pdf') {
    const parsedPdf = await pdfParse(buffer)
    rawText = parsedPdf.text || ''

    // If selectable text is empty or sparse (< 40 chars per page on average), trigger OCR fallback
    const pages = parsedPdf.numpages || 1
    if (rawText.trim().length < 40 * pages) {
      needsOcr = true
      const extractedImages = extractJpegsFromPdf(buffer)
      if (extractedImages.length > 0) {
        pageImages = extractedImages
      }
    }
  } else if (cleanExt === 'docx') {
    // Extract both raw text and HTML tables to preserve grid semantics
    const rawResult = await mammoth.extractRawText({ buffer })
    rawText = rawResult.value || ''

    try {
      const htmlResult = await mammoth.convertToHtml({ buffer })
      if (htmlResult.value && htmlResult.value.includes('<table')) {
        // Convert simple HTML table to pipe-delimited text for superior table parsing
        const tableText = htmlResult.value
          .replace(/<\/tr>/gi, '\n')
          .replace(/<\/td>|<\/th>/gi, ' | ')
          .replace(/<[^>]+>/g, '')
        if (tableText.trim().length > rawText.trim().length * 0.5) {
          rawText = `${tableText}\n\n${rawText}`
        }
      }
    } catch {}
  } else if (['xlsx', 'xls', 'csv'].includes(cleanExt)) {
    // Read spreadsheet
    const workbook = XLSX.read(buffer, { type: 'buffer', raw: true })
    const sheetNames = workbook.SheetNames
    const allLines: string[] = []

    for (const name of sheetNames) {
      const sheet = workbook.Sheets[name]
      if (!sheet) continue
      const csv = XLSX.utils.sheet_to_csv(sheet, { dateNF: 'yyyy-mm-dd' })
      if (csv) {
        allLines.push(`--- Sheet: ${name} ---`)
        allLines.push(csv.replace(/,/g, ' | '))
      }
    }
    rawText = allLines.join('\n')
  } else if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif'].includes(cleanExt)) {
    // Image document: provide base64 data for Tesseract OCR
    const mime = cleanExt === 'jpg' ? 'image/jpeg' : `image/${cleanExt}`
    pageImages = [`data:${mime};base64,${buffer.toString('base64')}`]
    needsOcr = true
  } else {
    // Plain text or fallback
    rawText = buffer.toString('utf8')
  }

  // If document was scanned or image-based, run local Node OCR immediately
  if (needsOcr && pageImages && pageImages.length > 0) {
    try {
      const ocrText = await performNodeOcr(pageImages)
      if (ocrText.trim().length > 0) {
        rawText = `${rawText}\n${ocrText}`.trim()
        needsOcr = false
      }
    } catch (err) {
      console.error('Failed to run local OCR during ingestion:', err)
    }
  }

  // Parse candidate events from available text
  const candidates = rawText.trim().length > 0 ? parseScheduleText(rawText) : []

  return {
    fileName,
    fileType: cleanExt,
    fileSize,
    fileHash,
    rawText,
    needsOcr,
    pageImages,
    candidates
  }
}
