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
  - Smart Free-Time Suggestions: toggle suggestions, configure quiet hours, and set minimum gap durations.
  - Full data backup export to JSON and restore from JSON with pre-restore snapshot protection.
  - Psalm 118:24 theme display toggle.

---

## 🔒 Security Architecture & Hardening

Hello 118:24 follows the official Electron security guidelines:

- `contextIsolation: true` and `nodeIntegration: false` enforced.
- `sandbox: true` enabled for the renderer process.
- `webSecurity: true` and `allowRunningInsecureContent: false` strictly enforced.
- **Content Security Policy (CSP)**: Enforced via HTTP headers and document `<meta>` tags:
  `default-src 'self'; script-src 'self' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self' blob: data: https://api.github.com https://github.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';`
- **IPC Sender Authorization**: Every IPC channel validates `event.senderFrame === mainWindow.webContents.mainFrame` to prevent unauthorized message spoofing.
- **Navigation & Window Restriction**: `setWindowOpenHandler` denies all arbitrary popup creation, and `will-navigate` blocks unexpected external navigations, routing safe URLs to the default system browser via an HTTPS allowlist.
- **Untrusted File Hardening**: Imported documents are subject to strict file type allowlists and size limits (25MB documents, 15MB images, 10MB backups) to prevent memory exhaustion DoS.
- **Database Safety**: All database operations use parameterized queries. Automated snapshot backups are created in `userData/backups/` prior to migrations and restore operations, with automated integrity check (`PRAGMA integrity_check`) on launch.
- Zero external tracking or user analytics; 100% functional offline.

---

## 🗄️ SQLite Database Schema & Migrations

The database is stored locally in the operating system's standard user data directory with WAL mode enabled:
- **Windows:** `%APPDATA%\hello-118-24\hello11824.sqlite`
- **macOS:** `~/Library/Application Support/hello-118-24/hello11824.sqlite`
- **Linux:** `~/.config/hello-118-24/hello11824.sqlite`

Tables:
- `classes`: `id`, `title`, `weekday`, `start_time`, `end_time`, `room`, `notes`, `color`, `created_at`
- `tasks`: `id`, `title`, `description`, `due_date`, `due_time`, `priority`, `completed`, `category`, `class_id`, `estimated_minutes`, `created_at`
- `daily_plans`: `plan_date`, `notes`, `materials_checked`, `created_at`, `updated_at`
- `settings`: `key`, `value`
- `import_history`: `id`, `file_name`, `file_type`, `imported_count`, `imported_at`

---

## 🚀 Running and Developing Locally

### Prerequisites
- Node.js 20 or 22 (LTS recommended)
- Windows 10/11, macOS 11+, or modern Linux distribution

### Commands

```powershell
# 1. Install dependencies
npm install

# 2. Run TypeScript typecheck
npm run typecheck

# 3. Run automated tests (42/42 tests pass)
npm test

# 4. Start the app in development mode
npm run dev

# 5. Build production bundle
npm run build
```

---

## 📦 Cross-Platform Packaging

```powershell
# Windows NSIS installer
npm run package:win

# macOS DMG & ZIP (on macOS runner or CI)
npm run package:mac

# Linux AppImage & DEB (on Linux runner or CI)
npm run package:linux
```

This compiles production assets and generates:
1. **Windows Installer**: `release/Hello 11824 Setup 0.1.1.exe`
2. **macOS**: `release/Hello-118-24-0.1.1.dmg` and `release/Hello-118-24-0.1.1-mac.zip`
3. **Linux**: `release/Hello-118-24-0.1.1.AppImage` and `release/hello-118-24_0.1.1_amd64.deb`
4. **Unpacked Executable**: `release/win-unpacked/Hello 11824.exe`
