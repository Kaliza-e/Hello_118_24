import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, copyFileSync, readdirSync, unlinkSync } from 'node:fs'

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
  estimated_minutes?: number | null
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

// Creates an automated snapshot backup of the current database into userData/backups/
export function createDatabaseBackup(): string | null {
  try {
    const dir = app.getPath('userData')
    const dbPath = join(dir, 'hello11824.sqlite')
    if (!existsSync(dbPath)) return null

    const backupsDir = join(dir, 'backups')
    if (!existsSync(backupsDir)) {
      mkdirSync(backupsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = join(backupsDir, `hello11824-backup-${timestamp}.sqlite`)
    copyFileSync(dbPath, backupPath)

    // Maintain a rolling window of the last 5 automated backups
    const existing = readdirSync(backupsDir)
      .filter(f => f.startsWith('hello11824-backup-') && f.endsWith('.sqlite'))
      .sort()
      .reverse()

    if (existing.length > 5) {
      for (const oldFile of existing.slice(5)) {
        try {
          unlinkSync(join(backupsDir, oldFile))
        } catch {}
      }
    }

    return backupPath
  } catch (err) {
    console.error('Failed to create database backup:', err)
    return null
  }
}

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

  try {
    db = new Database(dbPath)
    // Run integrity check
    const integrity = db.pragma('integrity_check') as Array<{ integrity_check: string }> | undefined
    if (integrity && integrity[0] && integrity[0].integrity_check !== 'ok') {
      console.warn('Database integrity check warning:', integrity)
    }
  } catch (err) {
    console.error('Failed to open database, attempting recovery from latest backup:', err)
    const backupsDir = join(dir, 'backups')
    let recovered = false
    if (existsSync(backupsDir)) {
      const backups = readdirSync(backupsDir)
        .filter(f => f.startsWith('hello11824-backup-') && f.endsWith('.sqlite'))
        .sort()
        .reverse()
      if (backups[0]) {
        try {
          copyFileSync(join(backupsDir, backups[0]), dbPath)
          db = new Database(dbPath)
          recovered = true
        } catch {}
      }
    }
    if (!recovered) {
      db = new Database(dbPath)
    }
  }

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Create a backup snapshot before migrations
  createDatabaseBackup()

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

  if (currentVersion < 2) {
    try {
      const taskCols = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>
      if (!taskCols.some(col => col.name === 'estimated_minutes')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER;`)
      }
      db.exec(`INSERT OR REPLACE INTO schema_version (version) VALUES (2);`)
    } catch (err) {
      console.error('Error running migration v2:', err)
    }
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
    free_period_reminders_enabled: 'true',
    free_reminder_min_minutes: '20',
    free_reminder_days: 'all',
    quiet_hours_enabled: 'true',
    quiet_hours_start: '21:00',
    quiet_hours_end: '07:00',
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
  estimatedMinutes?: number | null
}): TaskRecord {
  const title = (payload.title || '').trim().slice(0, 240)
  if (!title) {
    throw new Error('Task title cannot be empty')
  }
  const priority = ['low', 'normal', 'high'].includes(payload.priority || '') ? payload.priority! : 'normal'
  const estMins = typeof payload.estimatedMinutes === 'number' && !isNaN(payload.estimatedMinutes) ? payload.estimatedMinutes : null
  const d = getDatabase()
  const info = d.prepare(`
    INSERT INTO tasks (title, description, due_date, due_time, priority, category, class_id, estimated_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    payload.description?.trim() || null,
    payload.dueDate || null,
    payload.dueTime || null,
    priority,
    payload.category?.trim() || null,
    payload.classId || null,
    estMins
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
  estimatedMinutes: number | null
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
  const nextEstMins = payload.estimatedMinutes !== undefined ? payload.estimatedMinutes : (existing.estimated_minutes ?? null)

  d.prepare(`
    UPDATE tasks 
    SET title = ?, description = ?, due_date = ?, due_time = ?, priority = ?, completed = ?, category = ?, class_id = ?, estimated_minutes = ?
    WHERE id = ?
  `).run(nextTitle, nextDesc, nextDueDate, nextDueTime, nextPriority, nextCompleted, nextCategory, nextClassId, nextEstMins, id)

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
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid backup file: Root must be a valid JSON object')
  }

  // Preserve current user data state before applying backup
  createDatabaseBackup()

  const d = getDatabase()
  const restoreTx = d.transaction(() => {
    if (Array.isArray(data.tasks)) {
      d.prepare('DELETE FROM tasks').run()
      const insertTask = d.prepare(`
        INSERT INTO tasks (id, title, description, due_date, due_time, priority, completed, category, class_id, estimated_minutes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const t of data.tasks) {
        if (!t || typeof t !== 'object' || !t.title || typeof t.title !== 'string') continue
        const safeId = typeof t.id === 'number' && Number.isInteger(t.id) ? t.id : null
        const safeTitle = t.title.trim().slice(0, 240)
        const safeDesc = typeof t.description === 'string' ? t.description.slice(0, 1000) : null
        const safeDueDate = typeof t.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) ? t.due_date : null
        const safeDueTime = typeof t.due_time === 'string' && /^\d{2}:\d{2}$/.test(t.due_time) ? t.due_time : null
        const safePriority = ['low', 'normal', 'high'].includes(t.priority) ? t.priority : 'normal'
        const safeCompleted = t.completed ? 1 : 0
        const safeCategory = typeof t.category === 'string' ? t.category.slice(0, 60) : null
        const safeClassId = typeof t.class_id === 'number' && Number.isInteger(t.class_id) ? t.class_id : null
        const safeEstMins = typeof t.estimated_minutes === 'number' && Number.isInteger(t.estimated_minutes) ? t.estimated_minutes : null
        const safeCreatedAt = typeof t.created_at === 'string' ? t.created_at : new Date().toISOString()
        insertTask.run(safeId, safeTitle, safeDesc, safeDueDate, safeDueTime, safePriority, safeCompleted, safeCategory, safeClassId, safeEstMins, safeCreatedAt)
      }
    }

    if (Array.isArray(data.classes)) {
      d.prepare('DELETE FROM classes').run()
      const insertClass = d.prepare(`
        INSERT INTO classes (id, title, weekday, start_time, end_time, room, notes, color, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const c of data.classes) {
        if (!c || typeof c !== 'object' || !c.title || typeof c.title !== 'string') continue
        const safeId = typeof c.id === 'number' && Number.isInteger(c.id) ? c.id : null
        const safeTitle = c.title.trim().slice(0, 160)
        const safeWeekday = Number.isInteger(c.weekday) && c.weekday >= 0 && c.weekday <= 6 ? c.weekday : 1
        const safeStartTime = typeof c.start_time === 'string' && /^\d{2}:\d{2}$/.test(c.start_time) ? c.start_time : '08:00'
        const safeEndTime = typeof c.end_time === 'string' && /^\d{2}:\d{2}$/.test(c.end_time) ? c.end_time : null
        const safeRoom = typeof c.room === 'string' ? c.room.slice(0, 80) : null
        const safeNotes = typeof c.notes === 'string' ? c.notes.slice(0, 500) : null
        const safeColor = typeof c.color === 'string' ? c.color.slice(0, 40) : null
        const safeCreatedAt = typeof c.created_at === 'string' ? c.created_at : new Date().toISOString()
        insertClass.run(safeId, safeTitle, safeWeekday, safeStartTime, safeEndTime, safeRoom, safeNotes, safeColor, safeCreatedAt)
      }
    }

    if (Array.isArray(data.dailyPlans)) {
      d.prepare('DELETE FROM daily_plans').run()
      const insertPlan = d.prepare(`
        INSERT INTO daily_plans (plan_date, notes, materials_checked, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      for (const p of data.dailyPlans) {
        if (!p || typeof p !== 'object' || !p.plan_date || typeof p.plan_date !== 'string') continue
        const safePlanDate = /^\d{4}-\d{2}-\d{2}$/.test(p.plan_date) ? p.plan_date : null
        if (!safePlanDate) continue
        const safeNotes = typeof p.notes === 'string' ? p.notes.slice(0, 2000) : null
        const safeMaterials = typeof p.materials_checked === 'string' ? p.materials_checked : '[]'
        const safeCreatedAt = typeof p.created_at === 'string' ? p.created_at : new Date().toISOString()
        const safeUpdatedAt = typeof p.updated_at === 'string' ? p.updated_at : new Date().toISOString()
        insertPlan.run(safePlanDate, safeNotes, safeMaterials, safeCreatedAt, safeUpdatedAt)
      }
    }

    if (data.settings && typeof data.settings === 'object') {
      const insertSetting = d.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      for (const [k, v] of Object.entries(data.settings)) {
        if (typeof k === 'string' && k.length <= 80 && typeof v === 'string') {
          insertSetting.run(k, v.slice(0, 500))
        }
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
