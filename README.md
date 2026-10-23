# Hello 118:24 — Windows Desktop Planner & Companion

> *“This is the day which the LORD hath made; we will rejoice and be glad in it.”* — Psalm 118:24 (KJV)

A Windows-first personal desktop timetable, task organizer, and daily planning companion built with **Electron 33**, **React 18**, **TypeScript**, **Vite**, and **SQLite (WAL mode)**.

---

## 🌟 Overview & Key Features

Hello 118:24 is designed as a focused, calming desktop companion for school, productivity, and everyday organization. It runs as a true floating Windows desktop widget with both a **compact widget mode** and an **expanded dashboard mode**.

### 1. Desktop Window & Widget Behavior
- **Floating Widget**: Frameless, draggable desktop window with glassmorphism styling and ambient purple & blue accents.
- **Always-on-Top Pin**: Toggle pin state from title bar or system tray; remembers position across sessions.
- **Window Bounds & Multi-Monitor Protection**: Safely checks `screen.getAllDisplays()` on startup so the window is never spawned outside visible displays.
- **System Tray Integration**:
  - Tray icon with dynamic menu: Open, Toggle Compact/Expanded mode, Always on Top, Launch on Startup, and Quit.
  - Minimizing or clicking the window close button hides the app to the system tray so your schedule is always a click away.
- **Windows Startup**: Integrated via Electron's native `app.setLoginItemSettings()` with settings to launch automatically on login and start minimized to tray.

### 2. Main Views
- **Today**:
  - Live clock and dynamic date calculations.
  - Time-of-day greeting (Morning, Afternoon, Evening) and subtle Psalm 118:24 encouragement.
  - Chronological schedule with automatic detection of current class ("In Progress") and next upcoming class ("Next").
  - Today's tasks with visual completion progress bar, quick-add input with priority, and inline checkoff.
  - Shortcut to end-of-day tomorrow planning.
- **Timetable Manager**:
  - Weekly timetable with day switcher pills (Mon–Sun and All Days).
  - Document parser supporting **PDF**, **DOCX**, and **Images/Screenshots (PNG, JPG, JPEG)**.
  - OCR extraction with Tesseract.js featuring live progress feedback.
  - Interactive **Import Review Modal**: Edit subject names, days, start/end times, and rooms before saving.
  - Choose to replace or append to your existing schedule.
  - Manual add, edit, and deletion of recurring classes.
- **Tasks & To-Dos**:
  - Persistent SQLite storage with title, description, due date, due time, priority (low, normal, high), and category.
  - Filter by **Today**, **Tomorrow**, **Upcoming**, **Overdue**, **Completed**, and **All**.
  - Sort by due date, priority, or creation date.
  - Tasteful, non-alarmist overdue badges.
- **Tomorrow Planner**:
  - Dedicated planning view for the next calendar day.
  - Preview tomorrow's schedule and tasks.
  - **Task Rollover**: One-click rollover of unfinished tasks from today to tomorrow (updates existing records without creating duplicates).
  - **Materials & Bag Checklist**: Interactive checklist of packed items (laptop, notebooks, chargers, custom items) auto-saved to SQLite.
  - Daily planning notes and focus goals.
- **Weekly Overview**:
  - 7-day horizon displaying classes and deadlines across the full week.
  - Weekly summary metrics: total classes, total deadlines, and completed items.
- **Settings & Data Management**:
  - Toggle launch on login, start minimized, always-on-top, and widget mode.
  - Desktop reminder settings: class reminder lead times (5, 10, 15, 30 min) and task due alerts.
  - Full data backup export to JSON and restore from JSON.
  - Psalm 118:24 theme display toggle.

---

## 🔒 Security Architecture

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Strict preload bridge exposing safe, typed methods via `window.hello11824`.
- Privileged operations (database, file system, shell) are restricted to the main process with parameterized SQL queries preventing injection.
- Zero external cloud services or tracking; 100% functional offline.

---

## 🗄️ SQLite Database Schema & Migrations

The database is stored locally in `%APPDATA%\hello-118-24\hello11824.sqlite` (outside the installation folder) with WAL mode enabled:

- `classes`: `id`, `title`, `weekday`, `start_time`, `end_time`, `room`, `notes`, `color`, `created_at`
- `tasks`: `id`, `title`, `description`, `due_date`, `due_time`, `priority`, `completed`, `category`, `class_id`, `created_at`
- `daily_plans`: `plan_date`, `notes`, `materials_checked`, `created_at`, `updated_at`
- `settings`: `key`, `value`
- `import_history`: `id`, `file_name`, `file_type`, `imported_count`, `imported_at`

---

## 🚀 Running and Developing Locally

### Prerequisites
- Node.js 20 or 22 (LTS recommended)
- Windows 10/11

### Commands

```powershell
# 1. Install dependencies
npm install

# 2. Run TypeScript typecheck
npm run typecheck

# 3. Run automated tests (10/10 tests pass)
npm test

# 4. Start the app in development mode
npm run dev

# 5. Build production bundle
npm run build
```

---

## 📦 Generating the Windows Installer

```powershell
# Build the NSIS Windows installer
npm run package:win
```

This compiles the production assets and generates:
1. **Windows Installer**: `release/Hello 11824 Setup 0.1.0.exe` (NSIS installer with desktop & start menu shortcuts).
2. **Unpacked Executable**: `release/win-unpacked/Hello 11824.exe` (portable runnable executable).
