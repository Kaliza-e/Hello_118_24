import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'

// -------------------------------------------------------------
// Inlined NL Parser for self-contained ESM test execution
// -------------------------------------------------------------
function pad2(n) {
  return String(n).padStart(2, '0')
}

function toDateString(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

const WEEKDAY_MAP = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, friday: 5, fri: 5,
  saturday: 6, sat: 6
}

function parseNaturalLanguageTask(text, baseDate = new Date()) {
  if (!text || !text.trim()) {
    return { raw: '', cleanTitle: '', hasParsedFields: false }
  }

  let working = text.trim()
  let dueDate = undefined
  let dueTime = undefined
  let priority = undefined
  let estimatedMinutes = undefined
  let category = undefined

  // Category
  const categoryMatch = working.match(/(?:^|\s)#([a-zA-Z0-9_\-]+)/)
  if (categoryMatch) {
    category = categoryMatch[1]
    working = working.replace(categoryMatch[0], ' ')
  }

  // Duration
  const durationMatch = working.match(/(?:^|\s)(?:~|for\s+)?(\d+(?:\.\d+)?)\s*(m|min|mins|minutes|h|hr|hrs|hours)\b/i)
  if (durationMatch) {
    const val = parseFloat(durationMatch[1])
    const unit = durationMatch[2].toLowerCase()
    estimatedMinutes = unit.startsWith('h') ? Math.round(val * 60) : Math.round(val)
    working = working.replace(durationMatch[0], ' ')
  }

  // Priority
  const priorityMatch = working.match(/(?:^|\s)(?:!|priority:)?(urgent|asap|high|p1|medium|normal|p2|low|p3)\b/i)
  if (priorityMatch) {
    const pStr = priorityMatch[1].toLowerCase()
    if (['urgent', 'asap', 'high', 'p1'].includes(pStr)) priority = 'high'
    else if (['low', 'p3'].includes(pStr)) priority = 'low'
    else priority = 'normal'
    working = working.replace(priorityMatch[0], ' ')
  }

  // Time
  const timeMatch = working.match(/(?:^|\s)(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i)
  if (timeMatch && (timeMatch[2] !== undefined || timeMatch[3] !== undefined)) {
    let hour = parseInt(timeMatch[1], 10)
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0
    const ampm = timeMatch[3]?.toLowerCase()
    if (ampm === 'pm' && hour < 12) hour += 12
    if (ampm === 'am' && hour === 12) hour = 0
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      dueTime = `${pad2(hour)}:${pad2(minute)}`
      working = working.replace(timeMatch[0], ' ')
    }
  } else {
    const noonMatch = working.match(/(?:^|\s)(?:at\s+)?(noon|midnight)\b/i)
    if (noonMatch) {
      dueTime = noonMatch[1].toLowerCase() === 'noon' ? '12:00' : '00:00'
      working = working.replace(noonMatch[0], ' ')
    }
  }

  // Relative dates
  if (/(?:^|\s)today\b/i.test(working)) {
    dueDate = toDateString(baseDate)
    working = working.replace(/(?:^|\s)today\b/i, ' ')
  } else if (/(?:^|\s)tomorrow\b/i.test(working)) {
    const d = new Date(baseDate)
    d.setDate(d.getDate() + 1)
    dueDate = toDateString(d)
    working = working.replace(/(?:^|\s)tomorrow\b/i, ' ')
  } else {
    const inDaysMatch = working.match(/(?:^|\s)in\s+(\d+)\s+days?\b/i)
    if (inDaysMatch) {
      const d = new Date(baseDate)
      d.setDate(d.getDate() + parseInt(inDaysMatch[1], 10))
      dueDate = toDateString(d)
      working = working.replace(inDaysMatch[0], ' ')
    } else {
      const weekdayMatch = working.match(/(?:^|\s)(?:on\s+|next\s+)?(monday|mon|tuesday|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat|sunday|sun)\b/i)
      if (weekdayMatch) {
        const targetDay = WEEKDAY_MAP[weekdayMatch[1].toLowerCase()]
        if (targetDay !== undefined) {
          const d = new Date(baseDate)
          const currentDay = d.getDay()
          let diff = targetDay - currentDay
          if (diff <= 0) diff += 7
          d.setDate(d.getDate() + diff)
          dueDate = toDateString(d)
          working = working.replace(weekdayMatch[0], ' ')
        }
      }
    }
  }

  // Clean title
  let cleanTitle = working
    .replace(/\b(?:due|on|at|by)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleanTitle) cleanTitle = text.trim()

  const hasParsedFields = Boolean(dueDate || dueTime || priority || estimatedMinutes || category)
  return { raw: text, cleanTitle, dueDate, dueTime, priority, estimatedMinutes, category, hasParsedFields }
}

// -------------------------------------------------------------
// Test DB Setup with Migration V5
// -------------------------------------------------------------
function createPhase4TestDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE tasks (
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
      scheduled_date TEXT,
      scheduled_time TEXT,
      scheduled_duration_minutes INTEGER,
      total_time_spent_seconds INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      weekday INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      room TEXT,
      notes TEXT,
      color TEXT
    );

    CREATE TABLE task_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      is_pomodoro INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_key TEXT NOT NULL,
      entry_type TEXT NOT NULL DEFAULT 'morning',
      gratitude TEXT,
      intention TEXT,
      reflection TEXT,
      mood TEXT,
      is_encrypted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date_key, entry_type)
    );
  `)

  return db
}

// -------------------------------------------------------------
// Phase 4 Unit Tests
// -------------------------------------------------------------
test('Phase 4: Natural Language Task Parser parses all fields', async (t) => {
  const fixedBaseDate = new Date('2026-11-06T10:00:00Z') // Friday

  await t.test('parses "Submit docs tomorrow 5pm high"', () => {
    const res = parseNaturalLanguageTask('Submit docs tomorrow 5pm high', fixedBaseDate)
    assert.equal(res.cleanTitle, 'Submit docs')
    assert.equal(res.dueDate, '2026-11-07') // Saturday
    assert.equal(res.dueTime, '17:00')
    assert.equal(res.priority, 'high')
    assert.equal(res.hasParsedFields, true)
  })

  await t.test('parses "Math homework due monday 14:00 ~45m #Math"', () => {
    const res = parseNaturalLanguageTask('Math homework due monday 14:00 ~45m #Math', fixedBaseDate)
    assert.equal(res.cleanTitle, 'Math homework')
    assert.equal(res.dueDate, '2026-11-09') // Next Monday
    assert.equal(res.dueTime, '14:00')
    assert.equal(res.estimatedMinutes, 45)
    assert.equal(res.category, 'Math')
    assert.equal(res.hasParsedFields, true)
  })

  await t.test('parses "Chemistry lab report in 3 days noon urgent ~2h"', () => {
    const res = parseNaturalLanguageTask('Chemistry lab report in 3 days noon urgent ~2h', fixedBaseDate)
    assert.equal(res.cleanTitle, 'Chemistry lab report')
    assert.equal(res.dueDate, '2026-11-09')
    assert.equal(res.dueTime, '12:00')
    assert.equal(res.priority, 'high')
    assert.equal(res.estimatedMinutes, 120)
    assert.equal(res.hasParsedFields, true)
  })

  await t.test('handles plain text with no parsed tokens gracefully', () => {
    const res = parseNaturalLanguageTask('Read chapter 4 quietly', fixedBaseDate)
    assert.equal(res.cleanTitle, 'Read chapter 4 quietly')
    assert.equal(res.dueDate, undefined)
    assert.equal(res.dueTime, undefined)
    assert.equal(res.hasParsedFields, false)
  })
})

test('Phase 4: Daily Journal Entries (Migration V5)', async (t) => {
  const db = createPhase4TestDb()

  await t.test('saves morning intention and gratitude entry', () => {
    const stmt = db.prepare(`
      INSERT INTO journal_entries (date_key, entry_type, gratitude, intention, mood, is_encrypted)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(date_key, entry_type) DO UPDATE SET
        gratitude = excluded.gratitude,
        intention = excluded.intention,
        mood = excluded.mood,
        updated_at = CURRENT_TIMESTAMP
    `)

    stmt.run('2026-11-06', 'morning', 'Thankful for health and a clear mind', 'Focus on operating systems lab', 'peaceful')

    const row = db.prepare(`SELECT * FROM journal_entries WHERE date_key = ? AND entry_type = ?`).get('2026-11-06', 'morning')
    assert.ok(row)
    assert.equal(row.gratitude, 'Thankful for health and a clear mind')
    assert.equal(row.intention, 'Focus on operating systems lab')
    assert.equal(row.mood, 'peaceful')
  })

  await t.test('updates existing journal entry on upsert', () => {
    const stmt = db.prepare(`
      INSERT INTO journal_entries (date_key, entry_type, gratitude, intention, mood, is_encrypted)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(date_key, entry_type) DO UPDATE SET
        gratitude = excluded.gratitude,
        intention = excluded.intention,
        mood = excluded.mood,
        updated_at = CURRENT_TIMESTAMP
    `)

    stmt.run('2026-11-06', 'morning', 'Updated gratitude: great sleep', 'Finish all assignments', 'energized')

    const row = db.prepare(`SELECT * FROM journal_entries WHERE date_key = ? AND entry_type = ?`).get('2026-11-06', 'morning')
    assert.equal(row.gratitude, 'Updated gratitude: great sleep')
    assert.equal(row.intention, 'Finish all assignments')
  })

  await t.test('supports distinct evening reflection for same date', () => {
    const stmt = db.prepare(`
      INSERT INTO journal_entries (date_key, entry_type, reflection, mood, is_encrypted)
      VALUES (?, ?, ?, ?, 1)
    `)

    stmt.run('2026-11-06', 'evening', 'Completed both lab assignments, proud of staying focused', 'content')

    const count = db.prepare(`SELECT COUNT(*) as c FROM journal_entries WHERE date_key = '2026-11-06'`).get().c
    assert.equal(count, 2)
  })
})

test('Phase 4: Weekly Reflection Report & Study Analytics', async (t) => {
  const db = createPhase4TestDb()

  // Seed tasks and sessions
  const task1 = db.prepare(`INSERT INTO tasks (title, category, completed) VALUES ('Math HW', 'Calculus', 1)`).run().lastInsertRowid
  const task2 = db.prepare(`INSERT INTO tasks (title, category, completed) VALUES ('Physics Lab', 'Physics', 1)`).run().lastInsertRowid

  // Add study sessions
  db.prepare(`
    INSERT INTO task_sessions (task_id, start_time, end_time, duration_seconds)
    VALUES (?, '2026-11-02T10:00:00Z', '2026-11-02T11:30:00Z', 5400)
  `).run(task1) // 1.5 hours on Monday

  db.prepare(`
    INSERT INTO task_sessions (task_id, start_time, end_time, duration_seconds)
    VALUES (?, '2026-11-04T14:00:00Z', '2026-11-04T15:00:00Z', 3600)
  `).run(task2) // 1.0 hour on Wednesday

  await t.test('aggregates study time correctly', () => {
    const totalSecs = db.prepare(`SELECT SUM(duration_seconds) as total FROM task_sessions`).get().total
    assert.equal(totalSecs, 9000) // 2.5 hours
    const totalHours = Math.round((totalSecs / 3600) * 10) / 10
    assert.equal(totalHours, 2.5)
  })

  await t.test('breaks down study hours per subject/category', () => {
    const rows = db.prepare(`
      SELECT COALESCE(t.category, 'General') as subject, SUM(ts.duration_seconds) as total_seconds
      FROM task_sessions ts
      JOIN tasks t ON ts.task_id = t.id
      GROUP BY COALESCE(t.category, 'General')
      ORDER BY total_seconds DESC
    `).all()

    assert.equal(rows.length, 2)
    assert.equal(rows[0].subject, 'Calculus')
    assert.equal(rows[0].total_seconds, 5400)
    assert.equal(rows[1].subject, 'Physics')
    assert.equal(rows[1].total_seconds, 3600)
  })
})

test('Phase 4: Gentle Encouraging Badges & Non-Guilt Streaks', async (t) => {
  function computeGentleBadges({ streakDays, totalStudyHours, completedTasksCount }) {
    const badges = []

    if (completedTasksCount >= 1) {
      badges.push({ id: 'first_step', name: 'First Step', desc: 'Completed your first study task' })
    }
    if (totalStudyHours >= 2) {
      badges.push({ id: 'deep_focus', name: 'Deep Diver', desc: 'Invested 2+ hours of deep focus' })
    }
    if (streakDays >= 3) {
      badges.push({ id: 'steady_rhythm', name: 'Steady Rhythm', desc: 'Active for 3+ consecutive study days' })
    }
    // Gentle recovery badge: always encourage, never punish
    if (streakDays <= 1) {
      badges.push({ id: 'fresh_start', name: 'Fresh Horizon', desc: 'Every day is a gift and a new beginning (Psalm 118:24)' })
    }

    return badges
  }

  await t.test('awards encouragement badges and never punishes on low streak', () => {
    const freshState = computeGentleBadges({ streakDays: 1, totalStudyHours: 0.5, completedTasksCount: 1 })
    assert.ok(freshState.some(b => b.id === 'fresh_start'))
    assert.ok(freshState.some(b => b.id === 'first_step'))
    assert.ok(!freshState.some(b => b.id === 'steady_rhythm'))
  })

  await t.test('awards steady rhythm and deep diver when criteria met', () => {
    const advancedState = computeGentleBadges({ streakDays: 5, totalStudyHours: 6, completedTasksCount: 12 })
    assert.ok(advancedState.some(b => b.id === 'steady_rhythm'))
    assert.ok(advancedState.some(b => b.id === 'deep_focus'))
  })
})

