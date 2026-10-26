import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, screen, session } from 'electron'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, statSync } from 'node:fs'
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
import { initUpdater, cleanupUpdater } from './updater'
import {
  getFreeTimeSuggestion,
  snoozeFreeTimeReminder,
  dismissFreeTimeReminder,
  completeSuggestedTask
} from './freeTimeEngine'

// Set application name and Windows AppUserModelID early for native toast attribution
app.name = 'Hello 118:24'
if (process.platform === 'win32') {
  app.setAppUserModelId('com.hello11824.desktop')
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isAppQuitting = false
const isDev = !app.isPackaged

// In development, isolate userData to prevent GPU/cache conflicts and DB collisions
// with the installed production app running in the background.
if (isDev) {
  const devUserData = join(app.getPath('appData'), 'hello-118-24-dev')
  app.setPath('userData', devUserData)
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

export function getWindowIcon(): string {
  if (process.platform === 'linux') {
    const pngPath = join(__dirname, '../../build/icon.png')
    if (existsSync(pngPath)) return pngPath
  }
  const icoPath = join(__dirname, '../../build/icon.ico')
  if (existsSync(icoPath) && process.platform === 'win32') return icoPath
  const pngPath = join(__dirname, '../../build/icon.png')
  if (existsSync(pngPath)) return pngPath
  return join(app.getAppPath(), 'build/icon.png')
}

// Ensures a Start Menu shortcut exists with the app's AppUserModelId on Windows
// so notifications display the real app name and branding instead of electron.app.Electron.
export function ensureWindowsShortcut(): void {
  if (process.platform !== 'win32') return
  try {
    const programsPath = join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
    if (!existsSync(programsPath)) return
    const shortcutPath = join(programsPath, 'Hello 11824.lnk')
    const icoPath = getWindowIcon()
    shell.writeShortcutLink(shortcutPath, existsSync(shortcutPath) ? 'update' : 'create', {
      target: process.execPath,
      args: isDev ? `"${app.getAppPath()}"` : '',
      cwd: app.getAppPath(),
      description: 'Hello 118:24 — Daily Planner & Timetable',
      appUserModelId: 'com.hello11824.desktop',
      icon: icoPath,
      iconIndex: 0
    })
  } catch (err) {
    console.error('Failed to create/update Windows shortcut:', err)
  }
}

// Creates an SVG or native icon for the system tray
function createTrayIcon(): Electron.NativeImage {
  const pngPath = join(__dirname, '../../build/icon.png')
  if (existsSync(pngPath)) {
    const img = nativeImage.createFromPath(pngPath).resize({ width: 16, height: 16 })
    if (process.platform === 'darwin') {
      img.setTemplateImage(true)
    }
    return img
  }
  const icoPath = join(__dirname, '../../build/icon.ico')
  if (existsSync(icoPath) && process.platform === 'win32') {
    return nativeImage.createFromPath(icoPath).resize({ width: 16, height: 16 })
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="8" fill="#141a2e"/>
    <circle cx="16" cy="16" r="10" stroke="#818cf8" stroke-width="2.5" fill="none"/>
    <path d="M16 10v6l4 2.5" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="16" cy="16" r="2.5" fill="#a855f7"/>
  </svg>`
  const img = nativeImage.createFromBuffer(Buffer.from(svg), { width: 16, height: 16 })
  if (process.platform === 'darwin') {
    img.setTemplateImage(true)
  }
  return img
}

// Cross-platform autostart management (Windows registry, macOS login items, Linux XDG autostart)
export function updateAutoStart(openAtLogin: boolean, openAsHidden: boolean): void {
  try {
    app.setLoginItemSettings({ openAtLogin, openAsHidden })
  } catch (err) {
    console.error('Failed to set login item settings:', err)
  }

  // Linux XDG Autostart support
  if (process.platform === 'linux') {
    try {
      const autostartDir = join(app.getPath('home'), '.config', 'autostart')
      const desktopFilePath = join(autostartDir, 'hello-118-24.desktop')
      if (openAtLogin) {
        if (!existsSync(autostartDir)) {
          mkdirSync(autostartDir, { recursive: true })
        }
        const execPath = app.getPath('exe')
        const content = `[Desktop Entry]
Type=Application
Version=1.0
Name=Hello 118:24
Comment=Personal desktop companion for school, productivity, timetable management, and daily planning
Exec="${execPath}"${openAsHidden ? ' --hidden' : ''}
Icon=hello-118-24
Terminal=false
Categories=Education;Utility;
X-GNOME-Autostart-enabled=true
`
        writeFileSync(desktopFilePath, content, 'utf8')
      } else {
        if (existsSync(desktopFilePath)) {
          unlinkSync(desktopFilePath)
        }
      }
    } catch (err) {
      console.error('Failed to update Linux autostart:', err)
    }
  }
}

// Configures standard native application menus on macOS (ensuring Cmd+C, Cmd+V, Cmd+Q work)
function setupApplicationMenu(): void {
  if (process.platform === 'darwin') {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Hello 118:24',
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          {
            label: 'Quit Hello 118:24',
            accelerator: 'Command+Q',
            click: () => {
              isAppQuitting = true
              app.quit()
            }
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          {
            label: 'Toggle View Mode',
            accelerator: 'Command+Shift+M',
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
          { type: 'separator' },
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' }
        ]
      }
    ]
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  } else {
    // Keep window menu hidden on Windows and Linux so the custom frameless titlebar stays clean
    Menu.setApplicationMenu(null)
  }
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

function applyPinnedState(pinned: boolean) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.setAlwaysOnTop(pinned, pinned ? 'screen-saver' : 'normal')
  if (pinned) {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }
}

const SAFE_EXTERNAL_HOSTS = new Set([
  'github.com',
  'raw.githubusercontent.com',
  'api.github.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
])

export function isSafeExternalUrl(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl)
    if (parsed.protocol !== 'https:') return false
    const hostname = parsed.hostname.toLowerCase()
    if (SAFE_EXTERNAL_HOSTS.has(hostname)) return true
    for (const allowed of SAFE_EXTERNAL_HOSTS) {
      if (hostname.endsWith(`.${allowed}`)) return true
    }
    return false
  } catch {
    return false
  }
}

export function setupSecurityHeaders(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "worker-src 'self' blob:",
      "connect-src 'self' blob: data: https://api.github.com https://github.com https://fonts.googleapis.com https://fonts.gstatic.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; ')

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY']
      }
    })
  })
}

export function isAuthorizedSender(event: Electron.IpcMainInvokeEvent): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) return false
  return event.senderFrame === mainWindow.webContents.mainFrame
}

export function assertAuthorizedSender(event: Electron.IpcMainInvokeEvent): void {
  if (!isAuthorizedSender(event)) {
    throw new Error('Unauthorized IPC sender: frame origin does not match application window.')
  }
}

function createWindow() {
  const savedMode = getSetting('widget_mode') || 'compact'
  const isCompact = savedMode === 'compact'
  const defaultWidth = isCompact ? 720 : 940
  const defaultHeight = isCompact ? 470 : 600
  const savedWidth = parseInt(getSetting('window_width') || String(defaultWidth), 10)
  const savedHeight = parseInt(getSetting('window_height') || String(defaultHeight), 10)
  const savedX = parseInt(getSetting('window_x') || '-9999', 10)
  const savedY = parseInt(getSetting('window_y') || '-9999', 10)
  const isPinned = getSetting('pinned') !== 'false'

  let initialBounds = {
    width: isNaN(savedWidth) || savedWidth < 480 ? defaultWidth : savedWidth,
    height: isNaN(savedHeight) || savedHeight < 420 ? defaultHeight : savedHeight,
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
    icon: getWindowIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  // Prevent creation of untrusted popup windows; open safe external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url).catch(console.error)
    }
    return { action: 'deny' }
  })

  // Restrict navigation away from the packaged renderer app
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (isDev && process.env.ELECTRON_RENDERER_URL) {
      if (navigationUrl.startsWith(process.env.ELECTRON_RENDERER_URL)) return
    }
    if (navigationUrl.startsWith('file://')) return
    event.preventDefault()
    if (isSafeExternalUrl(navigationUrl)) {
      shell.openExternal(navigationUrl).catch(console.error)
    }
  })

  initUpdater(mainWindow)

  mainWindow.once('ready-to-show', () => {
    const wasOpenedAsHidden = app.getLoginItemSettings().wasOpenedAsHidden || process.argv.includes('--hidden')
    const startMinimized = getSetting('start_minimized') === 'true'

    // If opened directly by user (or in dev), always show the widget immediately
    if (!startMinimized || !wasOpenedAsHidden || isDev) {
      mainWindow?.show()
      mainWindow?.focus()
      if (isPinned) {
        applyPinnedState(true)
      }
    }
  })

  // Ensure pinned topmost status sticks on Windows blur and show
  mainWindow.on('show', () => {
    const pinned = getSetting('pinned') !== 'false'
    if (pinned) {
      applyPinnedState(true)
    }
  })

  mainWindow.on('blur', () => {
    const pinned = getSetting('pinned') !== 'false'
    if (pinned && mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
      applyPinnedState(true)
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

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximize-changed', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximize-changed', false)
  })

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
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.show()
          mainWindow.focus()
          const pinned = getSetting('pinned') !== 'false'
          if (pinned) {
            applyPinnedState(true)
          }
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
        applyPinnedState(next)
        mainWindow?.webContents.send('window:pinned-changed', next)
      }
    },
    { type: 'separator' },
    {
      label: process.platform === 'darwin' ? 'Launch at Login' : 'Launch at Startup',
      type: 'checkbox',
      checked: startupSetting.openAtLogin,
      click: (item) => {
        const next = item.checked
        updateAutoStart(next, getSetting('start_minimized') === 'true')
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

if (gotSingleInstanceLock) {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
      const pinned = getSetting('pinned') !== 'false'
      if (pinned) {
        applyPinnedState(true)
      }
    }
  })

  app.whenReady().then(() => {
    setupSecurityHeaders()

    if (process.platform === 'win32') {
      app.setAppUserModelId('com.hello11824.desktop')
      ensureWindowsShortcut()
    }

    setupApplicationMenu()
    initDatabase()
    initNotifications(getWindowIcon)

    // Configure startup setting based on database
    const launchOnStartup = getSetting('launch_on_startup') !== 'false'
    const startMinimized = getSetting('start_minimized') === 'true'
    updateAutoStart(launchOnStartup, startMinimized)

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
            const pinned = getSetting('pinned') !== 'false'
            if (pinned) {
              applyPinnedState(true)
            }
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
        mainWindow?.focus()
        const pinned = getSetting('pinned') !== 'false'
        if (pinned) {
          applyPinnedState(true)
        }
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isAppQuitting) {
    app.quit()
  }
})

app.on('before-quit', () => {
  isAppQuitting = true
  cleanupUpdater()
})

// ----------------- IPC Channel Handlers -----------------

const MAX_DOC_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB max for PDF / Word documents
const MAX_IMG_SIZE_BYTES = 15 * 1024 * 1024 // 15 MB max for images
const MAX_BACKUP_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB max for JSON backups
const ALLOWED_IMPORT_EXTENSIONS = new Set(['pdf', 'docx', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif'])

// Window Management
ipcMain.handle('window:minimize', (event) => {
  assertAuthorizedSender(event)
  return mainWindow?.minimize()
})

ipcMain.handle('window:maximize', (event) => {
  assertAuthorizedSender(event)
  if (!mainWindow) return false
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize()
    return false
  } else {
    mainWindow.maximize()
    return true
  }
})

ipcMain.handle('window:is-maximized', (event) => {
  assertAuthorizedSender(event)
  return mainWindow?.isMaximized() ?? false
})

ipcMain.handle('window:close', (event) => {
  assertAuthorizedSender(event)
  return mainWindow?.hide()
})

ipcMain.handle('window:toggle-pin', (event, pinned: boolean) => {
  assertAuthorizedSender(event)
  const next = Boolean(pinned)
  applyPinnedState(next)
  setSetting('pinned', String(next))
  updateTrayMenu()
  return next
})

ipcMain.handle('window:set-mode', (event, mode: 'compact' | 'standard') => {
  assertAuthorizedSender(event)
  if (!mainWindow) return
  const bounds = mainWindow.getBounds()
  if (mode === 'compact') {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    }
    mainWindow.setBounds({ width: 720, height: 470, x: bounds.x, y: bounds.y })
    setSetting('widget_mode', 'compact')
  } else {
    mainWindow.setBounds({ width: 940, height: 600, x: Math.max(40, bounds.x - 110), y: bounds.y })
    setSetting('widget_mode', 'standard')
  }
  mainWindow.webContents.send('widget:mode-changed', mode)
  return mode
})

ipcMain.handle('window:open-external', async (event, url: string) => {
  assertAuthorizedSender(event)
  if (typeof url === 'string' && isSafeExternalUrl(url)) {
    await shell.openExternal(url)
    return true
  }
  console.warn(`[Security] Blocked attempt to open unauthorized external URL: ${url}`)
  return false
})

// Settings
ipcMain.handle('settings:get', (event, key: string) => {
  assertAuthorizedSender(event)
  return getSetting(String(key))
})

ipcMain.handle('settings:set', (event, key: string, value: string) => {
  assertAuthorizedSender(event)
  setSetting(String(key), String(value))
  updateTrayMenu()
  return true
})

ipcMain.handle('settings:get-all', (event) => {
  assertAuthorizedSender(event)
  return getAllSettings()
})

ipcMain.handle('settings:update-startup', (event, openAtLogin: boolean, openAsHidden: boolean) => {
  assertAuthorizedSender(event)
  updateAutoStart(Boolean(openAtLogin), Boolean(openAsHidden))
  setSetting('launch_on_startup', String(openAtLogin))
  setSetting('start_minimized', String(openAsHidden))
  updateTrayMenu()
  return app.getLoginItemSettings()
})

ipcMain.handle('settings:get-startup-status', (event) => {
  assertAuthorizedSender(event)
  return app.getLoginItemSettings()
})

// Tasks
ipcMain.handle('tasks:list', (event, date?: string) => {
  assertAuthorizedSender(event)
  return listTasks(date ? String(date) : undefined)
})

ipcMain.handle('tasks:add', (event, payload) => {
  assertAuthorizedSender(event)
  return addTask(payload)
})

ipcMain.handle('tasks:update', (event, id: number, payload) => {
  assertAuthorizedSender(event)
  return updateTask(Number(id), payload)
})

ipcMain.handle('tasks:toggle', (event, id: number, completed: boolean) => {
  assertAuthorizedSender(event)
  return toggleTask(Number(id), Boolean(completed))
})

ipcMain.handle('tasks:delete', (event, id: number) => {
  assertAuthorizedSender(event)
  return deleteTask(Number(id))
})

ipcMain.handle('tasks:rollover', (event, fromDate: string, toDate: string) => {
  assertAuthorizedSender(event)
  return rolloverTasks(String(fromDate), String(toDate))
})

// Smart Free Time Task Suggestions
ipcMain.handle('free-time:get-suggestion', (event) => {
  assertAuthorizedSender(event)
  return getFreeTimeSuggestion()
})

ipcMain.handle('free-time:snooze', (event, minutes?: number) => {
  assertAuthorizedSender(event)
  snoozeFreeTimeReminder(minutes ? Number(minutes) : undefined)
  return true
})

ipcMain.handle('free-time:dismiss', (event, slotKey: string) => {
  assertAuthorizedSender(event)
  dismissFreeTimeReminder(String(slotKey))
  return true
})

ipcMain.handle('free-time:complete-task', (event, taskId: number) => {
  assertAuthorizedSender(event)
  return completeSuggestedTask(Number(taskId))
})

// Subjects / Timetable
ipcMain.handle('subjects:list', (event) => {
  assertAuthorizedSender(event)
  return listClasses()
})

ipcMain.handle('subjects:add', (event, payload) => {
  assertAuthorizedSender(event)
  return addClass(payload)
})

ipcMain.handle('subjects:update', (event, id: number, payload) => {
  assertAuthorizedSender(event)
  return updateClass(Number(id), payload)
})

ipcMain.handle('subjects:delete', (event, id: number) => {
  assertAuthorizedSender(event)
  return deleteClass(Number(id))
})

ipcMain.handle('subjects:replace', (event, items, sourceFileName?: string) => {
  assertAuthorizedSender(event)
  return replaceClasses(items, sourceFileName ? String(sourceFileName) : undefined)
})

ipcMain.handle('subjects:append', (event, items, sourceFileName?: string) => {
  assertAuthorizedSender(event)
  return appendClasses(items, sourceFileName ? String(sourceFileName) : undefined)
})

// Classes / Timetable (backward compatibility)
ipcMain.handle('classes:list', (event) => {
  assertAuthorizedSender(event)
  return listClasses()
})

ipcMain.handle('classes:add', (event, payload) => {
  assertAuthorizedSender(event)
  return addClass(payload)
})

ipcMain.handle('classes:update', (event, id: number, payload) => {
  assertAuthorizedSender(event)
  return updateClass(Number(id), payload)
})

ipcMain.handle('classes:delete', (event, id: number) => {
  assertAuthorizedSender(event)
  return deleteClass(Number(id))
})

ipcMain.handle('classes:replace', (event, classes, sourceFileName?: string) => {
  assertAuthorizedSender(event)
  return replaceClasses(classes, sourceFileName ? String(sourceFileName) : undefined)
})

ipcMain.handle('classes:append', (event, classes, sourceFileName?: string) => {
  assertAuthorizedSender(event)
  return appendClasses(classes, sourceFileName ? String(sourceFileName) : undefined)
})

// Daily Plans
ipcMain.handle('daily-plans:get', (event, date: string) => {
  assertAuthorizedSender(event)
  return getDailyPlan(String(date))
})

ipcMain.handle('daily-plans:save', (event, date: string, payload) => {
  assertAuthorizedSender(event)
  return saveDailyPlan(String(date), payload)
})

// Timetable Document Extraction
ipcMain.handle('files:pick-and-extract', async (event) => {
  assertAuthorizedSender(event)
  if (!mainWindow || mainWindow.isDestroyed()) return null

  // Pass mainWindow as parent so native file dialog opens in front of always-on-top window
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Timetable Document',
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
  if (!existsSync(filePath)) {
    throw new Error('Selected file does not exist on disk.')
  }

  const ext = (filePath.split('.').pop() || '').toLowerCase()
  if (!ALLOWED_IMPORT_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported file type (.${ext}). Allowed formats: PDF, DOCX, PNG, JPG, WEBP, BMP, TIFF.`)
  }

  const stats = statSync(filePath)
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif'].includes(ext)
  const maxSize = isImage ? MAX_IMG_SIZE_BYTES : MAX_DOC_SIZE_BYTES
  if (stats.size > maxSize) {
    const limitMb = Math.round(maxSize / (1024 * 1024))
    const actualMb = (stats.size / (1024 * 1024)).toFixed(1)
    throw new Error(`File is too large (${actualMb} MB). Maximum allowed size is ${limitMb} MB.`)
  }

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
ipcMain.handle('files:parse-text', (event, text: string) => {
  assertAuthorizedSender(event)
  if (typeof text !== 'string') return []
  return parseTimetableText(text)
})

// Data Backup & Export / Import
ipcMain.handle('data:export', async (event) => {
  assertAuthorizedSender(event)
  if (!mainWindow || mainWindow.isDestroyed()) return false
  const data = exportAllData()
  const saveResult = await dialog.showSaveDialog(mainWindow, {
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

ipcMain.handle('data:import', async (event) => {
  assertAuthorizedSender(event)
  if (!mainWindow || mainWindow.isDestroyed()) return false
  const openResult = await dialog.showOpenDialog(mainWindow, {
    title: 'Restore Hello 118:24 Backup',
    properties: ['openFile'],
    filters: [{ name: 'JSON Backup (*.json)', extensions: ['json'] }]
  })

  if (openResult.canceled || !openResult.filePaths[0]) {
    return false
  }

  const filePath = openResult.filePaths[0]
  if (!existsSync(filePath)) {
    throw new Error('Backup file not found on disk.')
  }

  const stats = statSync(filePath)
  if (stats.size > MAX_BACKUP_SIZE_BYTES) {
    throw new Error('Backup file exceeds the 10 MB maximum allowed size.')
  }

  const raw = readFileSync(filePath, 'utf-8')
  const json = JSON.parse(raw)
  return importAllData(json)
})

ipcMain.handle('data:clear', (event, options: { tasks?: boolean; classes?: boolean; plans?: boolean }) => {
  assertAuthorizedSender(event)
  clearAllData(options)
  return true
})
