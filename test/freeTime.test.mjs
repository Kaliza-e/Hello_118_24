import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'

// Pure engine functions matching src/main/freeTimeEngine.ts
function timeStringToMinutes(timeStr) {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return -1
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function minutesToTimeString(minutes) {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, Math.floor(minutes)))
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function isTimeInQuietHours(now, quietStartStr = '21:00', quietEndStr = '07:00') {
  const currentMins = now.getHours() * 60 + now.getMinutes()
  const startMins = timeStringToMinutes(quietStartStr)
  const endMins = timeStringToMinutes(quietEndStr)

  if (startMins === -1 || endMins === -1) return false

  if (startMins > endMins) {
    // Crosses midnight, e.g. 21:00 to 07:00
    return currentMins >= startMins || currentMins < endMins
  } else {
    // Within same day
    return currentMins >= startMins && currentMins < endMins
  }
}

function isDayAllowedForReminders(weekday, allowedDaysSetting = 'all') {
  if (allowedDaysSetting === 'weekdays') {
    return weekday >= 1 && weekday <= 5
  }
  return true
}

function scoreTaskForFreeTime(task, freeMinutes, todayStr, nextClassId) {
  let score = 0
  const estMins =
    task.estimated_minutes && task.estimated_minutes > 0
      ? task.estimated_minutes
      : task.priority === 'high'
        ? 45
        : task.priority === 'low'
          ? 15
          : 25

  if (estMins <= freeMinutes) {
    score += 60
    const ratio = estMins / freeMinutes
    score += Math.round(ratio * 20)
  } else if (estMins <= freeMinutes + 15) {
    score += 35
  } else {
    score += 5
  }

  if (task.priority === 'high') score += 30
  else if (task.priority === 'normal') score += 15
  else score += 5

  if (task.due_date) {
    if (task.due_date < todayStr) score += 45
    else if (task.due_date === todayStr) score += 35
    else score += 10
  }

  if (nextClassId && task.class_id === nextClassId) {
    score += 25
  }

  return score
}

function detectFreeSlot(classes, now, settings = {}) {
  const currentWeekday = now.getDay()
  const currentMins = now.getHours() * 60 + now.getMinutes()
  const todayStr = '2026-10-26'

  if (settings.free_period_reminders_enabled === 'false') return null
  if (settings.notifications_enabled === 'false') return null

  if (settings.quiet_hours_enabled !== 'false') {
    const qStart = settings.quiet_hours_start || '21:00'
    const qEnd = settings.quiet_hours_end || '07:00'
    if (isTimeInQuietHours(now, qStart, qEnd)) return null
  }

  if (!isDayAllowedForReminders(currentWeekday, settings.free_reminder_days || 'all')) {
    return null
  }

  const minDuration = parseInt(settings.free_reminder_min_minutes || '20', 10)

  const todayClasses = classes
    .filter(c => c.weekday === currentWeekday && c.start_time && /^\d{2}:\d{2}$/.test(c.start_time))
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map(c => {
      const s = timeStringToMinutes(c.start_time)
      let e = c.end_time && /^\d{2}:\d{2}$/.test(c.end_time) ? timeStringToMinutes(c.end_time) : s + 50
      if (e <= s) e = s + 50
      return { id: c.id, title: c.title, startMins: s, endMins: e, startTimeStr: c.start_time, endTimeStr: minutesToTimeString(e) }
    })

  // 1. NEVER INTERRUPT AN ONGOING CLASS
  for (const item of todayClasses) {
    if (currentMins >= item.startMins && currentMins < item.endMins) {
      return null // In class right now!
    }
  }

  // 2. GAPS BETWEEN CONSECUTIVE CLASSES
  for (let i = 0; i < todayClasses.length - 1; i++) {
    const prev = todayClasses[i]
    const next = todayClasses[i + 1]
    if (currentMins >= prev.endMins && currentMins < next.startMins) {
      const remaining = next.startMins - currentMins
      if (remaining >= minDuration) {
        return {
          type: 'gap',
          durationMinutes: remaining,
          freeUntil: next.startTimeStr,
          nextEventTitle: next.title,
          nextClassId: next.id
        }
      }
    }
  }

  // 3. BEFORE FIRST CLASS
  if (todayClasses.length > 0) {
    const first = todayClasses[0]
    if (currentMins >= 8 * 60 && currentMins < first.startMins) {
      const remaining = first.startMins - currentMins
      if (remaining >= minDuration) {
        return {
          type: 'before-first',
          durationMinutes: remaining,
          freeUntil: first.startTimeStr,
          nextEventTitle: first.title,
          nextClassId: first.id
        }
      }
    }
  }

  // 4. AFTER LAST CLASS
  if (todayClasses.length > 0) {
    const last = todayClasses[todayClasses.length - 1]
    const eveningEndMins = 21 * 60
    if (currentMins >= last.endMins && currentMins < eveningEndMins) {
      const remaining = eveningEndMins - currentMins
      if (remaining >= minDuration) {
        return {
          type: 'after-last',
          durationMinutes: remaining,
          freeUntil: minutesToTimeString(eveningEndMins),
          nextEventTitle: 'Study / Evening time'
        }
      }
    }
  }

  // 5. FREE DAY
  if (todayClasses.length === 0) {
    const dayStartMins = 9 * 60
    const eveningEndMins = 21 * 60
    if (currentMins >= dayStartMins && currentMins < eveningEndMins) {
      const remaining = eveningEndMins - currentMins
      if (remaining >= minDuration) {
        return {
          type: 'free-day',
          durationMinutes: Math.min(90, remaining),
          freeUntil: minutesToTimeString(currentMins + Math.min(90, remaining)),
          nextEventTitle: 'Free day'
        }
      }
    }
  }

  return null
}

function createMemoryDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT,
      due_time TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      completed INTEGER NOT NULL DEFAULT 0,
      category TEXT,
      class_id INTEGER,
      estimated_minutes INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      weekday INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      room TEXT,
      notes TEXT,
      color TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
  return db
}

test('FreeTime Engine: time string conversions', () => {
  assert.equal(timeStringToMinutes('08:30'), 510)
  assert.equal(timeStringToMinutes('00:00'), 0)
  assert.equal(timeStringToMinutes('23:59'), 1439)
  assert.equal(timeStringToMinutes('invalid'), -1)

  assert.equal(minutesToTimeString(510), '08:30')
  assert.equal(minutesToTimeString(0), '00:00')
  assert.equal(minutesToTimeString(1439), '23:59')
})

test('FreeTime Engine: quiet hours detection across midnight', () => {
  const lateNight = new Date(2026, 9, 26, 22, 30) // 22:30
  assert.equal(isTimeInQuietHours(lateNight, '21:00', '07:00'), true)

  const earlyMorning = new Date(2026, 9, 26, 5, 45) // 05:45
  assert.equal(isTimeInQuietHours(earlyMorning, '21:00', '07:00'), true)

  const midday = new Date(2026, 9, 26, 12, 0) // 12:00
  assert.equal(isTimeInQuietHours(midday, '21:00', '07:00'), false)
})

test('FreeTime Engine: weekday filtering', () => {
  assert.equal(isDayAllowedForReminders(1, 'weekdays'), true) // Monday
  assert.equal(isDayAllowedForReminders(5, 'weekdays'), true) // Friday
  assert.equal(isDayAllowedForReminders(0, 'weekdays'), false) // Sunday
  assert.equal(isDayAllowedForReminders(6, 'weekdays'), false) // Saturday
  assert.equal(isDayAllowedForReminders(0, 'all'), true)
})

test('FreeTime Engine: detects gaps between classes and respects minimum duration', () => {
  const sampleClasses = [
    { id: 1, title: 'Mathematics', weekday: 1, start_time: '08:30', end_time: '09:20' },
    { id: 2, title: 'Physics', weekday: 1, start_time: '10:00', end_time: '10:50' }
  ]

  // Time at 09:30 (Monday, in 40-minute gap before Physics at 10:00)
  const duringGap = new Date(2026, 9, 26, 9, 30) // Monday
  const slot = detectFreeSlot(sampleClasses, duringGap, { free_reminder_min_minutes: '20' })
  assert.ok(slot)
  assert.equal(slot.type, 'gap')
  assert.equal(slot.durationMinutes, 30)
  assert.equal(slot.freeUntil, '10:00')
  assert.equal(slot.nextEventTitle, 'Physics')
  assert.equal(slot.nextClassId, 2)
})

test('FreeTime Engine: never interrupts an ongoing class', () => {
  const sampleClasses = [
    { id: 1, title: 'Mathematics', weekday: 1, start_time: '08:30', end_time: '09:20' },
    { id: 2, title: 'Physics', weekday: 1, start_time: '10:00', end_time: '10:50' }
  ]

  // Time at 08:50 (In the middle of Mathematics 08:30-09:20)
  const duringClass = new Date(2026, 9, 26, 8, 50)
  const slot = detectFreeSlot(sampleClasses, duringClass)
  assert.equal(slot, null, 'Must return null while user is in class')
})

test('FreeTime Engine: detects free time before first class and after last class', () => {
  const sampleClasses = [
    { id: 1, title: 'Chemistry', weekday: 1, start_time: '10:00', end_time: '11:00' }
  ]

  // Before first class at 08:45
  const morning = new Date(2026, 9, 26, 8, 45)
  const beforeSlot = detectFreeSlot(sampleClasses, morning)
  assert.ok(beforeSlot)
  assert.equal(beforeSlot.type, 'before-first')
  assert.equal(beforeSlot.durationMinutes, 75)
  assert.equal(beforeSlot.freeUntil, '10:00')

  // After last class at 14:00
  const afternoon = new Date(2026, 9, 26, 14, 0)
  const afterSlot = detectFreeSlot(sampleClasses, afternoon)
  assert.ok(afterSlot)
  assert.equal(afterSlot.type, 'after-last')
  assert.equal(afterSlot.freeUntil, '21:00')
})

test('FreeTime Engine: suppresses suggestions during quiet hours or disabled setting', () => {
  const sampleClasses = [
    { id: 1, title: 'Chemistry', weekday: 1, start_time: '10:00', end_time: '11:00' }
  ]

  // Late night at 22:30 during quiet hours
  const night = new Date(2026, 9, 26, 22, 30)
  const quietSlot = detectFreeSlot(sampleClasses, night, {
    quiet_hours_enabled: 'true',
    quiet_hours_start: '21:00',
    quiet_hours_end: '07:00'
  })
  assert.equal(quietSlot, null)

  // Master toggle disabled
  const morning = new Date(2026, 9, 26, 8, 45)
  const disabledSlot = detectFreeSlot(sampleClasses, morning, {
    free_period_reminders_enabled: 'false'
  })
  assert.equal(disabledSlot, null)
})

test('FreeTime Engine: task scoring prioritizes tasks fitting available time and deadlines', () => {
  const todayStr = '2026-10-26'
  const freeMinutes = 30

  const taskFitsQuick = {
    id: 1,
    title: 'Review flashcards',
    estimated_minutes: 20,
    priority: 'normal',
    due_date: '2026-10-26',
    class_id: null
  }

  const taskTooLong = {
    id: 2,
    title: 'Write 10-page essay',
    estimated_minutes: 180,
    priority: 'high',
    due_date: null,
    class_id: null
  }

  const taskPrepUpcoming = {
    id: 3,
    title: 'Read section 3 before Chemistry',
    estimated_minutes: 25,
    priority: 'normal',
    due_date: '2026-10-26',
    class_id: 101 // matches next class
  }

  const scoreFits = scoreTaskForFreeTime(taskFitsQuick, freeMinutes, todayStr)
  const scoreLong = scoreTaskForFreeTime(taskTooLong, freeMinutes, todayStr)
  const scorePrep = scoreTaskForFreeTime(taskPrepUpcoming, freeMinutes, todayStr, 101)

  assert.ok(scoreFits > scoreLong, 'Task fitting available time must score higher than 3-hour essay')
  assert.ok(scorePrep > scoreFits, 'Task preparing for upcoming class must score higher than unrelated task')
})

test('FreeTime Database: persists estimated_minutes and free-time settings in SQLite', () => {
  const db = createMemoryDb()

  // Insert task with estimated_minutes
  const insertTask = db.prepare(`
    INSERT INTO tasks (title, description, due_date, priority, estimated_minutes)
    VALUES (?, ?, ?, ?, ?)
  `)
  const info = insertTask.run('Read Chapter 4', 'Biology text', '2026-10-26', 'high', 45)
  assert.equal(info.changes, 1)

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid)
  assert.equal(task.title, 'Read Chapter 4')
  assert.equal(task.estimated_minutes, 45)
  assert.equal(task.priority, 'high')

  // Update estimated_minutes
  db.prepare('UPDATE tasks SET estimated_minutes = ? WHERE id = ?').run(30, task.id)
  const updated = db.prepare('SELECT estimated_minutes FROM tasks WHERE id = ?').get(task.id)
  assert.equal(updated.estimated_minutes, 30)

  // Settings persistence
  const upsertSetting = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `)

  upsertSetting.run('free_period_reminders_enabled', 'true')
  upsertSetting.run('free_reminder_min_minutes', '25')
  upsertSetting.run('free_reminder_days', 'weekdays')
  upsertSetting.run('quiet_hours_enabled', 'true')
  upsertSetting.run('quiet_hours_start', '22:00')
  upsertSetting.run('quiet_hours_end', '06:30')

  const settingsList = db.prepare('SELECT * FROM settings').all()
  const map = Object.fromEntries(settingsList.map(s => [s.key, s.value]))

  assert.equal(map.free_period_reminders_enabled, 'true')
  assert.equal(map.free_reminder_min_minutes, '25')
  assert.equal(map.free_reminder_days, 'weekdays')
  assert.equal(map.quiet_hours_enabled, 'true')
  assert.equal(map.quiet_hours_start, '22:00')
  assert.equal(map.quiet_hours_end, '06:30')
})
