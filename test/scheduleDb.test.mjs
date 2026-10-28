import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'

function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')

  // Run schema migrations up to v3
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS source_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_hash TEXT UNIQUE NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      event_count INTEGER NOT NULL DEFAULT 0,
      raw_text TEXT,
      imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS schedule_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_doc_id INTEGER REFERENCES source_documents(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'Other',
      tags TEXT,
      start_date TEXT NOT NULL,
      start_time TEXT,
      end_date TEXT,
      end_time TEXT,
      is_all_day INTEGER NOT NULL DEFAULT 1,
      location TEXT,
      recurrence_rule TEXT,
      source_excerpt TEXT,
      source_page INTEGER,
      confidence TEXT NOT NULL DEFAULT 'high',
      review_status TEXT NOT NULL DEFAULT 'confirmed',
      is_completed INTEGER NOT NULL DEFAULT 0,
      user_edited INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS event_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES schedule_events(id) ON DELETE CASCADE,
      trigger_offset_minutes INTEGER NOT NULL DEFAULT 10,
      all_day_delivery_time TEXT NOT NULL DEFAULT '08:00',
      last_triggered_at TEXT,
      is_delivered INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO schema_version (version) VALUES (3);
  `)
  return db
}

test('Schedule DB: Migration v3 schema integrity and tables exist', () => {
  const db = createTestDb()
  const version = db.prepare('SELECT version FROM schema_version').get().version
  assert.equal(version, 3)

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name)
  assert.ok(tables.includes('source_documents'))
  assert.ok(tables.includes('schedule_events'))
  assert.ok(tables.includes('event_reminders'))
})

test('Schedule DB: SHA-256 duplicate source document detection', () => {
  const db = createTestDb()
  const hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

  // Insert initial document
  db.prepare(`
    INSERT INTO source_documents (file_hash, file_name, file_type, file_size, event_count)
    VALUES (?, ?, ?, ?, ?)
  `).run(hash, 'calendar.pdf', 'pdf', 1024, 5)

  const doc = db.prepare('SELECT * FROM source_documents WHERE file_hash = ?').get(hash)
  assert.ok(doc)
  assert.equal(doc.file_name, 'calendar.pdf')

  // Check duplicate hash constraint prevents duplicate inserts
  assert.throws(() => {
    db.prepare(`
      INSERT INTO source_documents (file_hash, file_name, file_type, file_size, event_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(hash, 'calendar_copy.pdf', 'pdf', 1024, 5)
  })
})

test('Schedule DB: Event lifecycle (create, update with user_edited, toggle, delete)', () => {
  const db = createTestDb()

  // Create event
  const insertStmt = db.prepare(`
    INSERT INTO schedule_events (title, category, start_date, start_time, is_all_day)
    VALUES (?, ?, ?, ?, ?)
  `)
  const result = insertStmt.run('Continuous Assessment Tests', 'Exams', '2026-11-02', '08:30', 0)
  const eventId = Number(result.lastInsertRowid)

  const created = db.prepare('SELECT * FROM schedule_events WHERE id = ?').get(eventId)
  assert.equal(created.title, 'Continuous Assessment Tests')
  assert.equal(created.category, 'Exams')
  assert.equal(created.user_edited, 0)
  assert.equal(created.is_completed, 0)

  // Update event and verify user_edited flag is set to 1
  db.prepare(`
    UPDATE schedule_events SET title = ?, location = ?, user_edited = 1 WHERE id = ?
  `).run('Updated CAT Exam', 'Lab 1', eventId)

  const updated = db.prepare('SELECT * FROM schedule_events WHERE id = ?').get(eventId)
  assert.equal(updated.title, 'Updated CAT Exam')
  assert.equal(updated.location, 'Lab 1')
  assert.equal(updated.user_edited, 1)

  // Toggle completion
  db.prepare('UPDATE schedule_events SET is_completed = 1 WHERE id = ?').run(eventId)
  const completed = db.prepare('SELECT * FROM schedule_events WHERE id = ?').get(eventId)
  assert.equal(completed.is_completed, 1)

  // Delete event
  db.prepare('DELETE FROM schedule_events WHERE id = ?').run(eventId)
  const deleted = db.prepare('SELECT * FROM schedule_events WHERE id = ?').get(eventId)
  assert.equal(deleted, undefined)
})

test('Schedule DB: Cascading deletes remove event reminders when event is deleted', () => {
  const db = createTestDb()

  const evResult = db.prepare(`
    INSERT INTO schedule_events (title, category, start_date, is_all_day)
    VALUES ('Staff Meeting', 'Meetings', '2026-10-21', 1)
  `).run()
  const eventId = Number(evResult.lastInsertRowid)

  // Add 2 reminders
  db.prepare(`
    INSERT INTO event_reminders (event_id, trigger_offset_minutes) VALUES (?, 60), (?, 1440)
  `).run(eventId, eventId)

  const remindersBefore = db.prepare('SELECT * FROM event_reminders WHERE event_id = ?').all(eventId)
  assert.equal(remindersBefore.length, 2)

  // Delete parent event
  db.prepare('DELETE FROM schedule_events WHERE id = ?').run(eventId)

  const remindersAfter = db.prepare('SELECT * FROM event_reminders WHERE event_id = ?').all(eventId)
  assert.equal(remindersAfter.length, 0, 'Event reminders must be cascaded on delete')
})

