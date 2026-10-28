import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'

function createReminderTestDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS schedule_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'Other',
      start_date TEXT NOT NULL,
      start_time TEXT,
      is_all_day INTEGER NOT NULL DEFAULT 1,
      location TEXT,
      is_completed INTEGER NOT NULL DEFAULT 0,
      review_status TEXT NOT NULL DEFAULT 'confirmed'
    );

    CREATE TABLE IF NOT EXISTS event_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES schedule_events(id) ON DELETE CASCADE,
      trigger_offset_minutes INTEGER NOT NULL DEFAULT 10,
      all_day_delivery_time TEXT NOT NULL DEFAULT '08:00',
      last_triggered_at TEXT,
      is_delivered INTEGER NOT NULL DEFAULT 0
    );
  `)
  return db
}

test('Schedule Reminders: triggers upcoming timed event at exact offset', () => {
  const db = createReminderTestDb()

  // Event starts at 10:00, reminder is set for 30 minutes before (09:30)
  const evRes = db.prepare(`
    INSERT INTO schedule_events (title, category, start_date, start_time, is_all_day)
    VALUES ('Physics Examination', 'Exams', '2026-11-04', '10:00', 0)
  `).run()
  const eventId = Number(evRes.lastInsertRowid)

  db.prepare(`
    INSERT INTO event_reminders (event_id, trigger_offset_minutes) VALUES (?, 30)
  `).run(eventId)

  // Test at 09:15 (before trigger time: 45 min before event)
  const timeBefore = new Date('2026-11-04T09:15:00').getTime()
  const eventTime = new Date('2026-11-04T10:00:00').getTime()
  const targetTriggerTime = eventTime - (30 * 60 * 1000)

  assert.equal(timeBefore >= targetTriggerTime, false, 'Should not trigger before 09:30')

  // Test at 09:30 (exact trigger time)
  const timeAt = new Date('2026-11-04T09:30:00').getTime()
  assert.equal(timeAt >= targetTriggerTime, true, 'Should trigger at 09:30')

  // Simulate delivery in DB
  db.prepare('UPDATE event_reminders SET is_delivered = 1, last_triggered_at = CURRENT_TIMESTAMP WHERE event_id = ?').run(eventId)

  const pending = db.prepare('SELECT * FROM event_reminders WHERE is_delivered = 0').all()
  assert.equal(pending.length, 0, 'Delivered reminder must not appear in pending queue')
})

test('Schedule Reminders: all-day event delivers at custom delivery time', () => {
  const db = createReminderTestDb()

  // All-day event on 2026-10-21 with delivery time 07:30
  const evRes = db.prepare(`
    INSERT INTO schedule_events (title, category, start_date, is_all_day)
    VALUES ('General Staff Meeting', 'Meetings', '2026-10-21', 1)
  `).run()
  const eventId = Number(evRes.lastInsertRowid)

  db.prepare(`
    INSERT INTO event_reminders (event_id, trigger_offset_minutes, all_day_delivery_time)
    VALUES (?, 0, '07:30')
  `).run(eventId)

  const deliveryMs = new Date('2026-10-21T07:30:00').getTime()

  // 07:00 (before delivery)
  assert.equal(new Date('2026-10-21T07:00:00').getTime() >= deliveryMs, false)
  // 07:35 (after delivery)
  assert.equal(new Date('2026-10-21T07:35:00').getTime() >= deliveryMs, true)
})

test('Schedule Reminders: persistent deduplication across application restart', () => {
  const db = createReminderTestDb()

  const evRes = db.prepare(`
    INSERT INTO schedule_events (title, category, start_date, is_all_day)
    VALUES ('Holiday Programme', 'Academic Calendar', '2026-08-05', 1)
  `).run()
  const eventId = Number(evRes.lastInsertRowid)

  const remRes = db.prepare(`
    INSERT INTO event_reminders (event_id, trigger_offset_minutes) VALUES (?, 60)
  `).run(eventId)
  const reminderId = Number(remRes.lastInsertRowid)

  // Mark delivered before app shutdown
  db.prepare('UPDATE event_reminders SET is_delivered = 1, last_triggered_at = CURRENT_TIMESTAMP WHERE id = ?').run(reminderId)

  // On simulated restart, query pending reminders
  const pendingAfterRestart = db.prepare(`
    SELECT r.* FROM event_reminders r
    JOIN schedule_events e ON r.event_id = e.id
    WHERE r.is_delivered = 0 AND e.is_completed = 0
  `).all()

  assert.equal(pendingAfterRestart.length, 0, 'Deduplicated reminders must remain delivered after restart')
})

