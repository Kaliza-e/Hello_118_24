import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'

function createTestDb() {
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
    CREATE TABLE IF NOT EXISTS daily_plans (
      plan_date TEXT PRIMARY KEY,
      notes TEXT,
      materials_checked TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS import_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      imported_count INTEGER NOT NULL,
      imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  return db
}

test('Database: Task lifecycle (create, toggle, update, delete)', () => {
  const db = createTestDb()

  // Add task
  const insert = db.prepare(`
    INSERT INTO tasks (title, description, due_date, due_time, priority, category)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const info = insert.run('Study Calculus chapter 4', 'Focus on limits', '2026-10-24', '14:00', 'high', 'Math')
  assert.equal(info.changes, 1)

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid)
  assert.equal(task.title, 'Study Calculus chapter 4')
  assert.equal(task.priority, 'high')
  assert.equal(task.completed, 0)

  // Toggle complete
  db.prepare('UPDATE tasks SET completed = 1 WHERE id = ?').run(task.id)
  const completedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id)
  assert.equal(completedTask.completed, 1)

  // Update task
  db.prepare('UPDATE tasks SET title = ? WHERE id = ?').run('Study Calculus chapter 4 & 5', task.id)
  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id)
  assert.equal(updatedTask.title, 'Study Calculus chapter 4 & 5')

  // Delete task
  db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id)
  const deletedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id)
  assert.equal(deletedTask, undefined)
})

test('Database: Timetable class ordering and replacement', () => {
  const db = createTestDb()

  const insertClass = db.prepare(`
    INSERT INTO classes (title, weekday, start_time, end_time, room)
    VALUES (?, ?, ?, ?, ?)
  `)

  insertClass.run('Algorithms', 1, '11:00', '12:30', 'Room 101')
  insertClass.run('Chemistry Lab', 1, '08:30', '10:00', 'Lab 3')
  insertClass.run('Calculus', 2, '09:00', '10:30', 'Room 205')

  const ordered = db.prepare('SELECT * FROM classes ORDER BY weekday ASC, start_time ASC').all()
  assert.equal(ordered.length, 3)
  // Chemistry Lab starts earlier than Algorithms on Monday
  assert.equal(ordered[0].title, 'Chemistry Lab')
  assert.equal(ordered[1].title, 'Algorithms')
  assert.equal(ordered[2].title, 'Calculus')
})

test('Database: Rollover of unfinished tasks to tomorrow', () => {
  const db = createTestDb()

  const insert = db.prepare('INSERT INTO tasks (title, due_date, completed) VALUES (?, ?, ?)')
  insert.run('Task 1 (Done)', '2026-10-23', 1)
  insert.run('Task 2 (Incomplete)', '2026-10-23', 0)
  insert.run('Task 3 (Incomplete)', '2026-10-23', 0)

  // Rollover incomplete tasks from 2026-10-23 to 2026-10-24
  const res = db.prepare('UPDATE tasks SET due_date = ? WHERE completed = 0 AND due_date = ?').run('2026-10-24', '2026-10-23')
  assert.equal(res.changes, 2)

  // Verify task 1 remains on 2026-10-23
  const t1 = db.prepare('SELECT * FROM tasks WHERE title = ?').get('Task 1 (Done)')
  assert.equal(t1.due_date, '2026-10-23')

  // Verify task 2 and 3 moved to 2026-10-24
  const t2 = db.prepare('SELECT * FROM tasks WHERE title = ?').get('Task 2 (Incomplete)')
  assert.equal(t2.due_date, '2026-10-24')
})

test('Database: Daily plan and materials checklist persistence', () => {
  const db = createTestDb()
  const date = '2026-10-24'
  const materials = JSON.stringify(['Laptop', 'Notebook', 'Calculator'])

  db.prepare(`
    INSERT INTO daily_plans (plan_date, notes, materials_checked)
    VALUES (?, ?, ?)
    ON CONFLICT(plan_date) DO UPDATE SET notes=excluded.notes, materials_checked=excluded.materials_checked
  `).run(date, 'Review CS notes before 10 AM', materials)

  const plan = db.prepare('SELECT * FROM daily_plans WHERE plan_date = ?').get(date)
  assert.equal(plan.plan_date, date)
  assert.equal(plan.notes, 'Review CS notes before 10 AM')
  assert.deepEqual(JSON.parse(plan.materials_checked), ['Laptop', 'Notebook', 'Calculator'])
})

test('Database: Settings persistence and upsert', () => {
  const db = createTestDb()

  const setSetting = (k, v) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, v)
  const getSetting = (k) => db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value

  setSetting('pinned', 'true')
  assert.equal(getSetting('pinned'), 'true')

  setSetting('pinned', 'false')
  assert.equal(getSetting('pinned'), 'false')

  setSetting('launch_on_startup', 'true')
  assert.equal(getSetting('launch_on_startup'), 'true')

  setSetting('free_period_reminders_enabled', 'true')
  assert.equal(getSetting('free_period_reminders_enabled'), 'true')
})

test('Database: Subject deletion and undo restoration', () => {
  const db = createTestDb()

  const insertClass = db.prepare(`
    INSERT INTO classes (title, weekday, start_time, end_time, room, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const info = insertClass.run('Mobile App Development', 1, '11:20', '12:10', 'Lab 2', 'Instructor: Louis')
  const insertedId = info.lastInsertRowid

  // Verify class exists
  const existing = db.prepare('SELECT * FROM classes WHERE id = ?').get(insertedId)
  assert.ok(existing)
  assert.equal(existing.title, 'Mobile App Development')

  // Simulate user deletion
  db.prepare('DELETE FROM classes WHERE id = ?').run(insertedId)
  const afterDelete = db.prepare('SELECT * FROM classes WHERE id = ?').get(insertedId)
  assert.equal(afterDelete, undefined, 'Subject should be deleted')

  // Simulate Undo action restoration
  const restore = db.prepare(`
    INSERT INTO classes (title, weekday, start_time, end_time, room, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const restoredInfo = restore.run(
    existing.title,
    existing.weekday,
    existing.start_time,
    existing.end_time,
    existing.room,
    existing.notes
  )
  const restored = db.prepare('SELECT * FROM classes WHERE id = ?').get(restoredInfo.lastInsertRowid)

  assert.ok(restored, 'Subject should be restored')
  assert.equal(restored.title, existing.title)
  assert.equal(restored.weekday, existing.weekday)
  assert.equal(restored.start_time, existing.start_time)
  assert.equal(restored.end_time, existing.end_time)
  assert.equal(restored.room, existing.room)
})

test('Database: Task completed state toggles on and off persistently', () => {
  const db = createTestDb()

  const info = db.prepare('INSERT INTO tasks (title, completed) VALUES (?, ?)').run('Test toggle task', 0)
  const id = info.lastInsertRowid

  let task = db.prepare('SELECT completed FROM tasks WHERE id = ?').get(id)
  assert.equal(task.completed, 0)

  // Toggle on
  db.prepare('UPDATE tasks SET completed = 1 WHERE id = ?').run(id)
  task = db.prepare('SELECT completed FROM tasks WHERE id = ?').get(id)
  assert.equal(task.completed, 1)

  // Toggle off (unchecking)
  db.prepare('UPDATE tasks SET completed = 0 WHERE id = ?').run(id)
  task = db.prepare('SELECT completed FROM tasks WHERE id = ?').get(id)
  assert.equal(task.completed, 0)
})

