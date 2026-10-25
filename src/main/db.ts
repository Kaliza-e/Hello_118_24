import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, copyFileSync } from 'node:fs'

export interface TaskRecord {
  id: number
  title: string
  description: string | null
  due_date: string | null
  due_time: string | null
  priority: 'low' | 'normal' | 'high'
  completed: number
  category: string | null
  class_id: number | null
  created_at: string
}

export interface ClassRecord {
  id: number
  title: string
  weekday: number // 0 = Sun, 1 = Mon, ..., 6 = Sat
  start_time: string // HH:mm
  end_time: string | null // HH:mm
  room: string | null
  notes: string | null
  color?: string | null
  created_at: string
}

export type SubjectRecord = ClassRecord

export interface DailyPlanRecord {
  plan_date: string // YYYY-MM-DD
  notes: string | null
  materials_checked: string | null // JSON array of string ids/names
  created_at: string
  updated_at: string
}

export interface ImportHistoryRecord {
  id: number
  file_name: string
  file_type: string
  imported_count: number
  imported_at: string
}

let db: Database.Database

export function getDatabase(): Database.Database {
  if (!db) {
    initDatabase()
  }
  return db
}

export function initDatabase(): Database.Database {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const dbPath = join(dir, 'hello11824.sqlite')
  const legacyDbPath = join(dir, 'daylight.sqlite')
  const prodDbPath = join(app.getPath('appData'), 'hello-118-24', 'hello11824.sqlite')

  // Seamless migration from legacy database or copy existing data to dev database
  if (!existsSync(dbPath)) {
    if (existsSync(legacyDbPath)) {
      try {
        copyFileSync(legacyDbPath, dbPath)
      } catch {
        // Continue with fresh database
      }
    } else if (existsSync(prodDbPath) && prodDbPath !== dbPath) {
      try {
        copyFileSync(prodDbPath, dbPath)
      } catch {
        // Continue with fresh database
      }
    }
  }

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Run schema migrations
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `)

  const currentVersionRow = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get() as { version: number } | undefined
  const currentVersion = currentVersionRow?.version ?? 0

  if (currentVersion < 1) {
    db.exec(`
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

      CREATE VIEW IF NOT EXISTS subjects AS SELECT * FROM classes;

      INSERT OR REPLACE INTO schema_version (version) VALUES (1);
    `)
  }

  // Ensure default settings exist
  const defaultSettings: Record<string, string> = {
    pinned: 'true',
    widget_mode: 'compact', // 'compact' or 'standard'
    launch_on_startup: 'true',
    start_minimized: 'false',
    notifications_enabled: 'true',
    class_reminder_minutes: '10',
    task_reminder_enabled: 'true',
    verse_visible: 'true'
  }

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  for (const [k, v] of Object.entries(defaultSettings)) {
    insertSetting.run(k, v)
  }

  return db
}

// ----------------- Database CRUD operations -----------------

// Settings
export function getSetting(key: string): string | null {
  const row = getDatabase().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  getDatabase().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}

export function getAllSettings(): Record<string, string> {
  const rows = getDatabase().prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>
  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.key] = row.value
  }
  return result
}

// Tasks
export function listTasks(filterDate?: string): TaskRecord[] {
  const d = getDatabase()
  if (filterDate) {
    return d.prepare(`
      SELECT * FROM tasks 
      WHERE due_date = ? OR (due_date IS NULL AND ? = 'all')
      ORDER BY completed ASC, 
        CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
        due_time ASC NULLS LAST,
        id DESC
    `).all(filterDate, filterDate) as TaskRecord[]
  }
  return d.prepare(`
    SELECT * FROM tasks 
    ORDER BY completed ASC,
      CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
      due_date ASC NULLS LAST,
      due_time ASC NULLS LAST,
      id DESC
  `).all() as TaskRecord[]
}

export function addTask(payload: {
  title: string
  description?: string
  dueDate?: string
  dueTime?: string
  priority?: 'low' | 'normal' | 'high'
  category?: string
  classId?: number
}): TaskRecord {
  const title = (payload.title || '').trim().slice(0, 240)
  if (!title) {
    throw new Error('Task title cannot be empty')
  }
  const priority = ['low', 'normal', 'high'].includes(payload.priority || '') ? payload.priority! : 'normal'
  const d = getDatabase()
  const info = d.prepare(`
    INSERT INTO tasks (title, description, due_date, due_time, priority, category, class_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    payload.description?.trim() || null,
    payload.dueDate || null,
    payload.dueTime || null,
    priority,
    payload.category?.trim() || null,
    payload.classId || null
  )
  return d.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid) as TaskRecord
}

export function updateTask(id: number, payload: Partial<{
  title: string
  description: string | null
  dueDate: string | null
  dueTime: string | null
  priority: 'low' | 'normal' | 'high'
  completed: boolean
  category: string | null
  classId: number | null
}>): TaskRecord {
  const d = getDatabase()
  const existing = d.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRecord | undefined
  if (!existing) {
    throw new Error(`Task ${id} not found`)
  }

  const nextTitle = payload.title !== undefined ? payload.title.trim().slice(0, 240) : existing.title
  const nextDesc = payload.description !== undefined ? payload.description : existing.description
  const nextDueDate = payload.dueDate !== undefined ? payload.dueDate : existing.due_date
  const nextDueTime = payload.dueTime !== undefined ? payload.dueTime : existing.due_time
  const nextPriority = payload.priority !== undefined ? payload.priority : existing.priority
  const nextCompleted = payload.completed !== undefined ? (payload.completed ? 1 : 0) : existing.completed
  const nextCategory = payload.category !== undefined ? payload.category : existing.category
  const nextClassId = payload.classId !== undefined ? payload.classId : existing.class_id

  d.prepare(`
    UPDATE tasks 
    SET title = ?, description = ?, due_date = ?, due_time = ?, priority = ?, completed = ?, category = ?, class_id = ?
    WHERE id = ?
  `).run(nextTitle, nextDesc, nextDueDate, nextDueTime, nextPriority, nextCompleted, nextCategory, nextClassId, id)

  return d.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRecord
}

export function toggleTask(id: number, completed: boolean): boolean {
  getDatabase().prepare('UPDATE tasks SET completed = ? WHERE id = ?').run(completed ? 1 : 0, id)
  return true
}

export function deleteTask(id: number): boolean {
  getDatabase().prepare('DELETE FROM tasks WHERE id = ?').run(id)
  return true
}

export function rolloverTasks(fromDueDate: string, toDueDate: string): number {
  const d = getDatabase()
  const result = d.prepare(`
    UPDATE tasks 
    SET due_date = ? 
    WHERE completed = 0 AND due_date = ?
  `).run(toDueDate, fromDueDate)
  return result.changes
}

// Classes
export function listClasses(): ClassRecord[] {
  return getDatabase().prepare(`
    SELECT * FROM classes 
    ORDER BY weekday ASC, start_time ASC, id ASC
  `).all() as ClassRecord[]
}

export function addClass(payload: {
  title: string
  weekday: number
  startTime: string
  endTime?: string
  room?: string
  notes?: string
  color?: string
}): ClassRecord {
  const title = (payload.title || '').trim().slice(0, 160)
  if (!title) throw new Error('Class title is required')
  if (!Number.isInteger(payload.weekday) || payload.weekday < 0 || payload.weekday > 6) {
    throw new Error('Invalid weekday (must be 0-6)')
  }
  if (!/^\d{2}:\d{2}$/.test(payload.startTime)) {
    throw new Error('Invalid start time (must be HH:mm)')
  }

  const d = getDatabase()
  const info = d.prepare(`
    INSERT INTO classes (title, weekday, start_time, end_time, room, notes, color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    payload.weekday,
    payload.startTime,
    payload.endTime || null,
    payload.room?.trim() || null,
    payload.notes?.trim() || null,
    payload.color || null
  )

  return d.prepare('SELECT * FROM classes WHERE id = ?').get(info.lastInsertRowid) as ClassRecord
}

export function updateClass(id: number, payload: Partial<{
  title: string
  weekday: number
  startTime: string
  endTime: string | null
  room: string | null
  notes: string | null
  color: string | null
}>): ClassRecord {
  const d = getDatabase()
  const existing = d.prepare('SELECT * FROM classes WHERE id = ?').get(id) as ClassRecord | undefined
  if (!existing) throw new Error(`Class ${id} not found`)

  const nextTitle = payload.title !== undefined ? payload.title.trim().slice(0, 160) : existing.title
  const nextWeekday = payload.weekday !== undefined ? payload.weekday : existing.weekday
  const nextStart = payload.startTime !== undefined ? payload.startTime : existing.start_time
  const nextEnd = payload.endTime !== undefined ? payload.endTime : existing.end_time
  const nextRoom = payload.room !== undefined ? payload.room : existing.room
  const nextNotes = payload.notes !== undefined ? payload.notes : existing.notes
  const nextColor = payload.color !== undefined ? payload.color : existing.color

  d.prepare(`
    UPDATE classes
    SET title = ?, weekday = ?, start_time = ?, end_time = ?, room = ?, notes = ?, color = ?
    WHERE id = ?
  `).run(nextTitle, nextWeekday, nextStart, nextEnd, nextRoom, nextNotes, nextColor, id)

  return d.prepare('SELECT * FROM classes WHERE id = ?').get(id) as ClassRecord
}

export function deleteClass(id: number): boolean {
  getDatabase().prepare('DELETE FROM classes WHERE id = ?').run(id)
  return true
}

export function replaceClasses(classes: Array<{
  title: string
  weekday: number
  startTime: string
  endTime?: string
  room?: string
  notes?: string
  color?: string
}>, sourceFileName?: string): ClassRecord[] {
  const d = getDatabase()
  const replaceTx = d.transaction((items) => {
    d.prepare('DELETE FROM classes').run()
    const insert = d.prepare(`
      INSERT INTO classes (title, weekday, start_time, end_time, room, notes, color)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    let count = 0
    for (const item of items) {
      if (!item.title?.trim() || !Number.isInteger(item.weekday) || item.weekday < 0 || item.weekday > 6) continue
      const startTime = /^\d{2}:\d{2}$/.test(item.startTime) ? item.startTime : '08:00'
      insert.run(
        item.title.trim().slice(0, 160),
        item.weekday,
        startTime,
        item.endTime || null,
        item.room?.trim() || null,
        item.notes?.trim() || null,
        item.color || null
      )
      count++
    }

    if (sourceFileName) {
      d.prepare('INSERT INTO import_history (file_name, file_type, imported_count) VALUES (?, ?, ?)').run(
        sourceFileName,
        sourceFileName.split('.').pop() || 'unknown',
        count
      )
    }
  })

  replaceTx(Array.isArray(classes) ? classes.slice(0, 500) : [])
  return listClasses()
}

export function appendClasses(classes: Array<{
  title: string
  weekday: number
  startTime: string
  endTime?: string
  room?: string
  notes?: string
  color?: string
}>, sourceFileName?: string): ClassRecord[] {
  const d = getDatabase()
  const appendTx = d.transaction((items) => {
    const insert = d.prepare(`
      INSERT INTO classes (title, weekday, start_time, end_time, room, notes, color)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    let count = 0
    for (const item of items) {
      if (!item.title?.trim() || !Number.isInteger(item.weekday) || item.weekday < 0 || item.weekday > 6) continue
      const startTime = /^\d{2}:\d{2}$/.test(item.startTime) ? item.startTime : '08:00'
      insert.run(
        item.title.trim().slice(0, 160),
        item.weekday,
        startTime,
        item.endTime || null,
        item.room?.trim() || null,
        item.notes?.trim() || null,
        item.color || null
      )
      count++
    }

    if (sourceFileName) {
      d.prepare('INSERT INTO import_history (file_name, file_type, imported_count) VALUES (?, ?, ?)').run(
        sourceFileName,
        sourceFileName.split('.').pop() || 'unknown',
        count
      )
    }
  })

  appendTx(Array.isArray(classes) ? classes.slice(0, 500) : [])
  return listClasses()
}

export const listSubjects = listClasses
export const addSubject = addClass
export const updateSubject = updateClass
export const deleteSubject = deleteClass
export const replaceSubjects = replaceClasses
export const appendSubjects = appendClasses

// Daily Plans
export function getDailyPlan(date: string): DailyPlanRecord | null {
  const row = getDatabase().prepare('SELECT * FROM daily_plans WHERE plan_date = ?').get(date) as DailyPlanRecord | undefined
  return row || null
}

export function saveDailyPlan(date: string, payload: { notes?: string; materialsChecked?: string[] }): DailyPlanRecord {
  const d = getDatabase()
  const existing = getDailyPlan(date)
  const notes = payload.notes !== undefined ? payload.notes : (existing?.notes ?? '')
  const materialsJson = payload.materialsChecked !== undefined 
    ? JSON.stringify(payload.materialsChecked) 
    : (existing?.materials_checked ?? '[]')

  d.prepare(`
    INSERT INTO daily_plans (plan_date, notes, materials_checked, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(plan_date) DO UPDATE SET
      notes = excluded.notes,
      materials_checked = excluded.materials_checked,
      updated_at = CURRENT_TIMESTAMP
  `).run(date, notes, materialsJson)

  return getDailyPlan(date)!
}

// Data Export & Backup
export function exportAllData(): {
  version: number
  exportedAt: string
  tasks: TaskRecord[]
  classes: ClassRecord[]
  dailyPlans: DailyPlanRecord[]
  settings: Record<string, string>
  importHistory: ImportHistoryRecord[]
} {
  const d = getDatabase()
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: d.prepare('SELECT * FROM tasks').all() as TaskRecord[],
    classes: d.prepare('SELECT * FROM classes').all() as ClassRecord[],
    dailyPlans: d.prepare('SELECT * FROM daily_plans').all() as DailyPlanRecord[],
    settings: getAllSettings(),
    importHistory: d.prepare('SELECT * FROM import_history').all() as ImportHistoryRecord[]
  }
}

export function importAllData(data: {
  tasks?: TaskRecord[]
  classes?: ClassRecord[]
  dailyPlans?: DailyPlanRecord[]
  settings?: Record<string, string>
}): boolean {
  const d = getDatabase()
  const restoreTx = d.transaction(() => {
    if (Array.isArray(data.tasks)) {
      d.prepare('DELETE FROM tasks').run()
      const insertTask = d.prepare(`
        INSERT INTO tasks (id, title, description, due_date, due_time, priority, completed, category, class_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const t of data.tasks) {
        insertTask.run(t.id, t.title, t.description, t.due_date, t.due_time, t.priority, t.completed, t.category, t.class_id, t.created_at)
      }
    }

    if (Array.isArray(data.classes)) {
      d.prepare('DELETE FROM classes').run()
      const insertClass = d.prepare(`
        INSERT INTO classes (id, title, weekday, start_time, end_time, room, notes, color, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const c of data.classes) {
        insertClass.run(c.id, c.title, c.weekday, c.start_time, c.end_time, c.room, c.notes, c.color || null, c.created_at)
      }
    }

    if (Array.isArray(data.dailyPlans)) {
      d.prepare('DELETE FROM daily_plans').run()
      const insertPlan = d.prepare(`
        INSERT INTO daily_plans (plan_date, notes, materials_checked, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      for (const p of data.dailyPlans) {
        insertPlan.run(p.plan_date, p.notes, p.materials_checked, p.created_at, p.updated_at)
      }
    }

    if (data.settings && typeof data.settings === 'object') {
      const insertSetting = d.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      for (const [k, v] of Object.entries(data.settings)) {
        insertSetting.run(k, String(v))
      }
    }
  })

  restoreTx()
  return true
}

export function clearAllData(options: { tasks?: boolean; classes?: boolean; plans?: boolean }): void {
  const d = getDatabase()
  if (options.tasks) d.prepare('DELETE FROM tasks').run()
  if (options.classes) d.prepare('DELETE FROM classes').run()
  if (options.plans) d.prepare('DELETE FROM daily_plans').run()
}
