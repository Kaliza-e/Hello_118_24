import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, screen } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import {
  initDatabase,
  getSetting,
  setSetting,
  getAllSettings,
  listTasks,
  addTask,
  updateTask,
  toggleTask,
  deleteTask,
  rolloverTasks,
  listClasses,
  addClass,
  updateClass,
  deleteClass,
  replaceClasses,
  appendClasses,
  getDailyPlan,
  saveDailyPlan,
  exportAllData,
  importAllData,
  clearAllData
} from './db'
import { parseTimetableText } from './importers/parser'
import { initNotifications } from './notifications'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isAppQuitting = false
const isDev = !app.isPackaged

// Creates an SVG-based tray icon with dark purple & blue gradient
function createTrayIcon(): Electron.NativeImage {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="8" fill="#141a2e"/>
    <circle cx="16" cy="16" r="10" stroke="#818cf8" stroke-width="2.5" fill="none"/>
    <path d="M16 10v6l4 2.5" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="16" cy="16" r="2.5" fill="#a855f7"/>
  </svg>`
  return nativeImage.createFromBuffer(Buffer.from(svg), { width: 16, height: 16 })
}

function ensureWindowWithinDisplayBounds(x: number, y: number, width: number, height: number): { x: number; y: number; width: number; height: number } {
  const displays = screen.getAllDisplays()
  const windowRect = { x, y, width, height }

  // Check if window center point is inside any visible display
  const centerX = x + width / 2
  const centerY = y + height / 2

  const isVisible = displays.some(display => {
    const { x: dx, y: dy, width: dw, height: dh } = display.bounds
    return centerX >= dx && centerX <= dx + dw && centerY >= dy && centerY <= dy + dh
  })

  if (isVisible) {
    return windowRect
  }

  // Fallback to primary display workArea
  const primary = screen.getPrimaryDisplay()
  const { x: px, y: py, width: pw, height: ph } = primary.workArea
  return {
    x: Math.max(px, px + Math.round((pw - width) / 2)),
    y: Math.max(py, py + Math.round((ph - height) / 2)),
    width,
    height
  }
}

function createWindow() {
  const savedWidth = parseInt(getSetting('window_width') || '720', 10)
  const savedHeight = parseInt(getSetting('window_height') || '470', 10)
  const savedX = parseInt(getSetting('window_x') || '-9999', 10)
  const savedY = parseInt(getSetting('window_y') || '-9999', 10)
  const isPinned = getSetting('pinned') !== 'false'

  let initialBounds = {
    width: isNaN(savedWidth) ? 720 : Math.max(500, savedWidth),
    height: isNaN(savedHeight) ? 470 : Math.max(420, savedHeight),
    x: savedX,
    y: savedY
  }

  if (savedX !== -9999 && savedY !== -9999) {
    initialBounds = ensureWindowWithinDisplayBounds(initialBounds.x, initialBounds.y, initialBounds.width, initialBounds.height)
  }

  mainWindow = new BrowserWindow({
    width: initialBounds.width,
    height: initialBounds.height,
    x: savedX !== -9999 ? initialBounds.x : undefined,
    y: savedY !== -9999 ? initialBounds.y : undefined,
    minWidth: 480,
    minHeight: 420,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: isPinned,
    resizable: true,
    show: false,
    title: 'Hello 118:24',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => {
    const startMinimized = getSetting('start_minimized') === 'true'
    if (!startMinimized) {
      mainWindow?.show()
    }
  })

  // Save window bounds on move / resize
  const saveBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const bounds = mainWindow.getBounds()
    setSetting('window_x', String(bounds.x))
    setSetting('window_y', String(bounds.y))
    setSetting('window_width', String(bounds.width))
    setSetting('window_height', String(bounds.height))
  }

  mainWindow.on('moved', saveBounds)
  mainWindow.on('resized', saveBounds)

  mainWindow.on('close', (event) => {
    if (!isAppQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function updateTrayMenu() {
  if (!tray) return

  const isPinned = getSetting('pinned') !== 'false'
  const startupSetting = app.getLoginItemSettings()

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Hello 118:24',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    {
      label: 'Toggle Compact / Expanded View',
      click: () => {
        if (mainWindow) {
          const bounds = mainWindow.getBounds()
          if (bounds.width < 800) {
            mainWindow.setBounds({ width: 940, height: 600, x: Math.max(40, bounds.x - 110), y: bounds.y })
            setSetting('widget_mode', 'standard')
          } else {
            mainWindow.setBounds({ width: 720, height: 470, x: bounds.x, y: bounds.y })
            setSetting('widget_mode', 'compact')
          }
          mainWindow.webContents.send('widget:mode-changed')
        }
      }
    },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: isPinned,
      click: (item) => {
        const next = item.checked
        setSetting('pinned', String(next))
        mainWindow?.setAlwaysOnTop(next)
        mainWindow?.webContents.send('window:pinned-changed', next)
      }
    },
    { type: 'separator' },
    {
      label: 'Launch on Windows Startup',
      type: 'checkbox',
      checked: startupSetting.openAtLogin,
      click: (item) => {
        const next = item.checked
        app.setLoginItemSettings({ openAtLogin: next, openAsHidden: getSetting('start_minimized') === 'true' })
        setSetting('launch_on_startup', String(next))
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Hello 118:24',
      click: () => {
        isAppQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

app.whenReady().then(() => {
  initDatabase()
  initNotifications()

  // Configure Windows startup setting based on database
  const launchOnStartup = getSetting('launch_on_startup') !== 'false'
  const startMinimized = getSetting('start_minimized') === 'true'
  app.setLoginItemSettings({ openAtLogin: launchOnStartup, openAsHidden: startMinimized })

  // System Tray setup
  try {
    const icon = createTrayIcon()
    tray = new Tray(icon)
    tray.setToolTip('Hello 118:24 — Daily Planner & Timetable')
    updateTrayMenu()
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.focus()
        } else {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    })
  } catch (err) {
    console.error('Failed to initialize tray:', err)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow?.show()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isAppQuitting) {
    app.quit()
  }
})

app.on('before-quit', () => {
  isAppQuitting = true
})

// ----------------- IPC Channel Handlers -----------------

// Window Management
ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:close', () => mainWindow?.hide())
ipcMain.handle('window:toggle-pin', (_event, pinned: boolean) => {
  const next = Boolean(pinned)
  mainWindow?.setAlwaysOnTop(next)
  setSetting('pinned', String(next))
  updateTrayMenu()
  return next
})
ipcMain.handle('window:set-mode', (_event, mode: 'compact' | 'standard') => {
  if (!mainWindow) return
  const bounds = mainWindow.getBounds()
  if (mode === 'compact') {
    mainWindow.setBounds({ width: 720, height: 470, x: bounds.x, y: bounds.y })
    setSetting('widget_mode', 'compact')
  } else {
    mainWindow.setBounds({ width: 940, height: 600, x: Math.max(40, bounds.x - 110), y: bounds.y })
    setSetting('widget_mode', 'standard')
  }
  return mode
})
ipcMain.handle('window:open-external', async (_event, url: string) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    await shell.openExternal(url)
  }
})

// Settings
ipcMain.handle('settings:get', (_event, key: string) => getSetting(key))
ipcMain.handle('settings:set', (_event, key: string, value: string) => {
  setSetting(key, value)
  updateTrayMenu()
  return true
})
ipcMain.handle('settings:get-all', () => getAllSettings())
ipcMain.handle('settings:update-startup', (_event, openAtLogin: boolean, openAsHidden: boolean) => {
  app.setLoginItemSettings({ openAtLogin, openAsHidden })
  setSetting('launch_on_startup', String(openAtLogin))
  setSetting('start_minimized', String(openAsHidden))
  updateTrayMenu()
  return app.getLoginItemSettings()
})
ipcMain.handle('settings:get-startup-status', () => app.getLoginItemSettings())

// Tasks
ipcMain.handle('tasks:list', (_event, date?: string) => listTasks(date))
ipcMain.handle('tasks:add', (_event, payload) => addTask(payload))
ipcMain.handle('tasks:update', (_event, id: number, payload) => updateTask(Number(id), payload))
ipcMain.handle('tasks:toggle', (_event, id: number, completed: boolean) => toggleTask(Number(id), completed))
ipcMain.handle('tasks:delete', (_event, id: number) => deleteTask(Number(id)))
ipcMain.handle('tasks:rollover', (_event, fromDate: string, toDate: string) => rolloverTasks(fromDate, toDate))

// Classes / Timetable
ipcMain.handle('classes:list', () => listClasses())
ipcMain.handle('classes:add', (_event, payload) => addClass(payload))
ipcMain.handle('classes:update', (_event, id: number, payload) => updateClass(Number(id), payload))
ipcMain.handle('classes:delete', (_event, id: number) => deleteClass(Number(id)))
ipcMain.handle('classes:replace', (_event, classes, sourceFileName?: string) => replaceClasses(classes, sourceFileName))
ipcMain.handle('classes:append', (_event, classes, sourceFileName?: string) => appendClasses(classes, sourceFileName))

// Daily Plans
ipcMain.handle('daily-plans:get', (_event, date: string) => getDailyPlan(date))
ipcMain.handle('daily-plans:save', (_event, date: string, payload) => saveDailyPlan(date, payload))

// Timetable Document Extraction
ipcMain.handle('files:pick-and-extract', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'All Supported Formats', extensions: ['pdf', 'docx', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif'] },
      { name: 'PDF Documents (*.pdf)', extensions: ['pdf'] },
      { name: 'Word Documents (*.docx)', extensions: ['docx'] },
      { name: 'Images & Screenshots (*.png, *.jpg, *.jpeg)', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff'] }
    ]
  })

  if (result.canceled || !result.filePaths[0]) {
    return null
  }

  const filePath = result.filePaths[0]
  const ext = (filePath.split('.').pop() || '').toLowerCase()
  const fileName = filePath.split(/[\\/]/).pop() || 'document'

  let rawText = ''
  let needsOcr = false
  let imageData: string | undefined = undefined

  try {
    if (ext === 'pdf') {
      const buffer = readFileSync(filePath)
      const parsed = await pdfParse(buffer)
      rawText = parsed.text || ''

      // If PDF text is very short (e.g. scanned image PDF with < 50 chars), indicate that OCR may be helpful
      if (rawText.trim().length < 50) {
        needsOcr = true
      }
    } else if (ext === 'docx') {
      const parsed = await mammoth.extractRawText({ path: filePath })
      rawText = parsed.value || ''
    } else {
      // Images: load image base64 data so renderer can run Tesseract.js with real-time UI progress
      const buffer = readFileSync(filePath)
      const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
      imageData = `data:${mime};base64,${buffer.toString('base64')}`
      needsOcr = true
    }

    // Try parsing candidate class rows from any text extracted so far
    const candidates = rawText ? parseTimetableText(rawText) : []

    return {
      fileName,
      filePath,
      fileType: ext,
      text: rawText,
      needsOcr,
      imageData,
      candidates
    }
  } catch (error) {
    throw new Error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`)
  }
})

// Parse arbitrary text (e.g. after OCR finishes or when user edits raw text)
ipcMain.handle('files:parse-text', (_event, text: string) => {
  return parseTimetableText(text)
})

// Data Backup & Export / Import
ipcMain.handle('data:export', async () => {
  const data = exportAllData()
  const saveResult = await dialog.showSaveDialog({
    title: 'Export Hello 118:24 Data Backup',
    defaultPath: `hello11824-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON Backup (*.json)', extensions: ['json'] }]
  })

  if (saveResult.canceled || !saveResult.filePath) {
    return false
  }

  writeFileSync(saveResult.filePath, JSON.stringify(data, null, 2), 'utf-8')
  return true
})

ipcMain.handle('data:import', async () => {
  const openResult = await dialog.showOpenDialog({
    title: 'Restore Hello 118:24 Backup',
    properties: ['openFile'],
    filters: [{ name: 'JSON Backup (*.json)', extensions: ['json'] }]
  })

  if (openResult.canceled || !openResult.filePaths[0]) {
    return false
  }

  const raw = readFileSync(openResult.filePaths[0], 'utf-8')
  const json = JSON.parse(raw)
  return importAllData(json)
})

ipcMain.handle('data:clear', (_event, options: { tasks?: boolean; classes?: boolean; plans?: boolean }) => {
  clearAllData(options)
  return true
})
