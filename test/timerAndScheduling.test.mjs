import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'

function createV4TestDb() {
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
      scheduled_date TEXT,
      scheduled_time TEXT,
      scheduled_duration_minutes INTEGER,
      total_time_spent_seconds INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS task_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      is_pomodoro INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS active_timer (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      task_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('idle', 'running', 'paused')),
      start_time TEXT,
      accumulated_seconds INTEGER NOT NULL DEFAULT 0,
      is_pomodoro INTEGER NOT NULL DEFAULT 0,
      pomodoro_phase TEXT NOT NULL DEFAULT 'work' CHECK (pomodoro_phase IN ('work', 'break')),
      pomodoro_work_duration INTEGER NOT NULL DEFAULT 1500,
      pomodoro_break_duration INTEGER NOT NULL DEFAULT 300,
      last_heartbeat TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
  `)
  return db
}

test('Phase 2: Task Scheduling into date/time slots', () => {
  const db = createV4TestDb()
  const insertTask = db.prepare(`
    INSERT INTO tasks (title, priority, due_date)
    VALUES (?, ?, ?)
  `)
  const info = insertTask.run('Read Chapter 4 Physics', 'high', '2026-11-10')
  const taskId = Number(info.lastInsertRowid)

  // Schedule task
  const scheduleStmt = db.prepare(`
    UPDATE tasks
    SET scheduled_date = ?, scheduled_time = ?, scheduled_duration_minutes = ?
    WHERE id = ?
  `)
  scheduleStmt.run('2026-11-10', '14:30', 45, taskId)

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId)
  assert.equal(task.scheduled_date, '2026-11-10')
  assert.equal(task.scheduled_time, '14:30')
  assert.equal(task.scheduled_duration_minutes, 45)

  // Reschedule
  scheduleStmt.run('2026-11-11', '10:00', 60, taskId)
  const rescheduled = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId)
  assert.equal(rescheduled.scheduled_date, '2026-11-11')
  assert.equal(rescheduled.scheduled_time, '10:00')
  assert.equal(rescheduled.scheduled_duration_minutes, 60)
})

test('Phase 2: Focus View Timer Lifecycle (Start, Pause, Resume, Stop)', () => {
  const db = createV4TestDb()
  const info = db.prepare("INSERT INTO tasks (title) VALUES ('Study Algorithms')").run()
  const taskId = Number(info.lastInsertRowid)

  const now = new Date('2026-11-06T10:00:00Z')

  // 1. Start timer
  db.prepare(`
    INSERT INTO active_timer (id, task_id, status, start_time, accumulated_seconds, is_pomodoro, pomodoro_phase, last_heartbeat)
    VALUES (1, ?, 'running', ?, 0, 0, 'work', ?)
    ON CONFLICT(id) DO UPDATE SET
      task_id = excluded.task_id,
      status = 'running',
      start_time = excluded.start_time,
      accumulated_seconds = 0,
      last_heartbeat = excluded.last_heartbeat
  `).run(taskId, now.toISOString(), now.toISOString())

  let active = db.prepare('SELECT * FROM active_timer WHERE id = 1').get()
  assert.equal(active.task_id, taskId)
  assert.equal(active.status, 'running')
  assert.equal(active.accumulated_seconds, 0)

  // 2. Pause timer after 15 minutes (900 seconds)
  const pauseTime = new Date('2026-11-06T10:15:00Z')
  const elapsedSinceStart = Math.floor((pauseTime.getTime() - new Date(active.start_time).getTime()) / 1000)
  const totalAcc = active.accumulated_seconds + elapsedSinceStart

  db.prepare(`
    UPDATE active_timer
    SET status = 'paused', accumulated_seconds = ?, start_time = NULL, last_heartbeat = ?
    WHERE id = 1
  `).run(totalAcc, pauseTime.toISOString())

  active = db.prepare('SELECT * FROM active_timer WHERE id = 1').get()
  assert.equal(active.status, 'paused')
  assert.equal(active.accumulated_seconds, 900)
  assert.equal(active.start_time, null)

  // 3. Resume timer
  const resumeTime = new Date('2026-11-06T10:20:00Z')
  db.prepare(`
    UPDATE active_timer
    SET status = 'running', start_time = ?, last_heartbeat = ?
    WHERE id = 1
  `).run(resumeTime.toISOString(), resumeTime.toISOString())

  active = db.prepare('SELECT * FROM active_timer WHERE id = 1').get()
  assert.equal(active.status, 'running')
  assert.equal(active.start_time, resumeTime.toISOString())
  assert.equal(active.accumulated_seconds, 900)

  // 4. Stop timer after 10 more minutes (600 seconds)
  const stopTime = new Date('2026-11-06T10:30:00Z')
  const finalSegment = Math.floor((stopTime.getTime() - new Date(active.start_time).getTime()) / 1000)
  const finalDuration = active.accumulated_seconds + finalSegment // 900 + 600 = 1500s (25 min)

  // Save session & update task
  db.prepare(`
    INSERT INTO task_sessions (task_id, start_time, end_time, duration_seconds, is_pomodoro)
    VALUES (?, ?, ?, ?, ?)
  `).run(taskId, now.toISOString(), stopTime.toISOString(), finalDuration, 0)

  db.prepare(`
    UPDATE tasks
    SET total_time_spent_seconds = total_time_spent_seconds + ?
    WHERE id = ?
  `).run(finalDuration, taskId)

  db.prepare('DELETE FROM active_timer WHERE id = 1').run()

  // Verify
  const sessions = db.prepare('SELECT * FROM task_sessions WHERE task_id = ?').all(taskId)
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0].duration_seconds, 1500)

  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId)
  assert.equal(updatedTask.total_time_spent_seconds, 1500)

  const noActive = db.prepare('SELECT * FROM active_timer WHERE id = 1').get()
  assert.equal(noActive, undefined)
})

test('Phase 2: Crash & Sleep Recovery for running timer', () => {
  const db = createV4TestDb()
  const info = db.prepare("INSERT INTO tasks (title) VALUES ('Crash Recovery Test')").run()
  const taskId = Number(info.lastInsertRowid)

  // Timer started 10 minutes ago, but app crashed (never called pause/stop)
  const tenMinutesAgo = new Date(Date.now() - 600_000)
  db.prepare(`
    INSERT INTO active_timer (id, task_id, status, start_time, accumulated_seconds, is_pomodoro)
    VALUES (1, ?, 'running', ?, 120, 0)
  `).run(taskId, tenMinutesAgo.toISOString())

  // Recover active timer after reboot
  const row = db.prepare('SELECT * FROM active_timer WHERE id = 1').get()
  assert.ok(row)

  let calculatedElapsed = row.accumulated_seconds
  if (row.status === 'running' && row.start_time) {
    const elapsedSinceStart = Math.max(0, Math.floor((Date.now() - new Date(row.start_time).getTime()) / 1000))
    calculatedElapsed += elapsedSinceStart
  }

  // 120 + 600 = 720 seconds (allow slight tolerance of +/- 2s)
  assert.ok(calculatedElapsed >= 718 && calculatedElapsed <= 725, `Expected ~720s, got ${calculatedElapsed}s`)
})

test('Phase 2: Mark Task Done with Timer & 60-Second Undo', () => {
  const db = createV4TestDb()
  const info = db.prepare("INSERT INTO tasks (title, completed) VALUES ('Write Essay', 0)").run()
  const taskId = Number(info.lastInsertRowid)

  const now = new Date().toISOString()

  // Start active timer
  db.prepare(`
    INSERT INTO active_timer (id, task_id, status, start_time, accumulated_seconds)
    VALUES (1, ?, 'running', ?, 1800)
  `).run(taskId, now)

  // Complete task via Focus view (30 min studied)
  const duration = 1800
  db.prepare('UPDATE tasks SET completed = 1, total_time_spent_seconds = total_time_spent_seconds + ? WHERE id = ?')
    .run(duration, taskId)
  db.prepare('INSERT INTO task_sessions (task_id, start_time, end_time, duration_seconds) VALUES (?, ?, ?, ?)')
    .run(taskId, now, now, duration)
  db.prepare('DELETE FROM active_timer WHERE id = 1').run()

  let task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId)
  assert.equal(task.completed, 1)
  assert.equal(task.total_time_spent_seconds, 1800)

  // Undo Mark as Done
  db.prepare('UPDATE tasks SET completed = 0 WHERE id = ?').run(taskId)
  task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId)
  assert.equal(task.completed, 0)
  // Study duration is preserved so logged study time is not lost
  assert.equal(task.total_time_spent_seconds, 1800)
})

test('Phase 2: Weekly Study Stats Aggregation (Planned vs Actual)', () => {
  const db = createV4TestDb()
  // Add tasks with scheduled duration
  db.prepare(`
    INSERT INTO tasks (title, scheduled_date, scheduled_duration_minutes)
    VALUES ('Task Mon', '2026-11-02', 60),
           ('Task Tue', '2026-11-03', 45),
           ('Task Wed', '2026-11-04', 90)
  `).run()

  // Add recorded study sessions
  db.prepare(`
    INSERT INTO task_sessions (task_id, start_time, end_time, duration_seconds)
    VALUES (1, '2026-11-02T10:00:00Z', '2026-11-02T11:00:00Z', 3600),
           (2, '2026-11-03T14:00:00Z', '2026-11-03T14:30:00Z', 1800),
           (3, '2026-11-04T16:00:00Z', '2026-11-04T17:15:00Z', 4500)
  `).run()

  // Aggregate weekly study stats for 2026-11-02 to 2026-11-08
  const startDate = '2026-11-02'
  const endDate = '2026-11-08'

  const sessionRows = db.prepare(`
    SELECT substr(start_time, 1, 10) as day_key, SUM(duration_seconds) as total_seconds
    FROM task_sessions
    WHERE substr(start_time, 1, 10) >= ? AND substr(start_time, 1, 10) <= ?
    GROUP BY day_key
  `).all(startDate, endDate)

  const dailyStudiedSeconds = {}
  let totalStudiedSeconds = 0
  for (const row of sessionRows) {
    dailyStudiedSeconds[row.day_key] = row.total_seconds
    totalStudiedSeconds += row.total_seconds
  }

  const plannedRow = db.prepare(`
    SELECT SUM(scheduled_duration_minutes) as planned_minutes
    FROM tasks
    WHERE scheduled_date >= ? AND scheduled_date <= ?
  `).get(startDate, endDate)

  const plannedMinutes = plannedRow?.planned_minutes || 0
  const actualMinutes = Math.round(totalStudiedSeconds / 60)

  // Mon: 3600s (60m), Tue: 1800s (30m), Wed: 4500s (75m)
  assert.equal(dailyStudiedSeconds['2026-11-02'], 3600)
  assert.equal(dailyStudiedSeconds['2026-11-03'], 1800)
  assert.equal(dailyStudiedSeconds['2026-11-04'], 4500)
  assert.equal(totalStudiedSeconds, 9900)
  assert.equal(actualMinutes, 165) // 60 + 30 + 75 = 165 min
  assert.equal(plannedMinutes, 195) // 60 + 45 + 90 = 195 min
})

