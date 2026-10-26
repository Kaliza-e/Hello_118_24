import { app, BrowserWindow, ipcMain, net } from 'electron'
import { autoUpdater, UpdateInfo } from 'electron-updater'

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateStatusInfo {
  state: UpdateState
  currentVersion: string
  availableVersion?: string
  releaseDate?: string
  releaseNotes?: string
  progress?: number // 0 to 100
  bytesPerSecond?: number
  transferredBytes?: number
  totalBytes?: number
  error?: string
  lastChecked?: string
  isPackaged: boolean
}

let status: UpdateStatusInfo = {
  state: 'idle',
  currentVersion: app.getVersion(),
  isPackaged: app.isPackaged
}

let targetWindow: BrowserWindow | null = null
let autoCheckTimer: NodeJS.Timeout | null = null

function broadcastStatus(): void {
  if (targetWindow && !targetWindow.isDestroyed()) {
    targetWindow.webContents.send('updater:status-changed', { ...status })
  }
}

export function getUpdateStatus(): UpdateStatusInfo {
  return { ...status, currentVersion: app.getVersion(), isPackaged: app.isPackaged }
}

export async function checkForUpdates(manual = false): Promise<UpdateStatusInfo> {
  status.lastChecked = new Date().toISOString()

  // Development mode protection: guard against running update checks in development
  if (!app.isPackaged) {
    status = {
      ...status,
      state: 'idle',
      currentVersion: app.getVersion(),
      isPackaged: false,
      error: manual ? 'Development mode: Updates are only checked in packaged production builds.' : undefined
    }
    broadcastStatus()
    return status
  }

  // Graceful offline check: check network status to handle offline mode
  if (!net.isOnline()) {
    status = {
      ...status,
      state: 'error',
      error: 'You are currently offline. Please check your internet connection.',
      currentVersion: app.getVersion(),
      isPackaged: true
    }
    broadcastStatus()
    return status
  }

  status = {
    ...status,
    state: 'checking',
    error: undefined,
    currentVersion: app.getVersion(),
    isPackaged: true
  }
  broadcastStatus()

  try {
    await autoUpdater.checkForUpdates()
  } catch (err: any) {
    const rawMsg = err?.message || String(err)
    console.error('[AutoUpdater] Check failed:', rawMsg)

    let friendlyError = rawMsg
    if (/404|latest(-win|-mac|-linux)?\.ya?ml|Cannot find/i.test(rawMsg)) {
      friendlyError =
        'No published release found on GitHub (Kaliza-e/Hello_118_24). Once a release with installer assets is published, updates will download automatically.'
    } else if (/timeout|ETIMEDOUT|ENOTFOUND|ERR_INTERNET_DISCONNECTED/i.test(rawMsg)) {
      friendlyError = 'Could not reach GitHub Releases server. Please check your internet connection.'
    }

    status = {
      ...status,
      state: 'error',
      error: friendlyError,
      currentVersion: app.getVersion(),
      isPackaged: true
    }
    broadcastStatus()
  }

  return status
}

export async function startDownload(): Promise<boolean> {
  if (!app.isPackaged) {
    status = {
      ...status,
      state: 'error',
      error: 'Cannot download updates in development mode.'
    }
    broadcastStatus()
    return false
  }

  try {
    status.state = 'downloading'
    status.progress = 0
    broadcastStatus()
    await autoUpdater.downloadUpdate()
    return true
  } catch (err: any) {
    console.error('[AutoUpdater] Download failed:', err?.message || err)
    status = {
      ...status,
      state: 'error',
      error: err?.message || 'Failed to download update.'
    }
    broadcastStatus()
    return false
  }
}

export function quitAndInstall(): void {
  if (status.state === 'downloaded') {
    // isSilent = false (interactive installer window if needed), isForceRunAfter = true
    autoUpdater.quitAndInstall(false, true)
  }
}

export function initUpdater(mainWindow: BrowserWindow): void {
  targetWindow = mainWindow
  status.currentVersion = app.getVersion()
  status.isPackaged = app.isPackaged

  // Enable updater logging
  autoUpdater.logger = console

  // Safe GitHub feed setup (public releases via HTTPS)
  try {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'Kaliza-e',
      repo: 'Hello_118_24'
    })
  } catch (err) {
    console.warn('[AutoUpdater] Feed URL configuration notice:', err)
  }

  // User-friendly update flow: don't force-download in the background immediately
  // Notify user first, then download when requested or automatically on user prompt
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // Event handlers
  autoUpdater.on('checking-for-update', () => {
    status.state = 'checking'
    status.error = undefined
    broadcastStatus()
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    status.state = 'available'
    status.availableVersion = info.version
    status.releaseDate = info.releaseDate
    status.releaseNotes = typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
    status.error = undefined
    broadcastStatus()
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    status.state = 'not-available'
    status.availableVersion = info?.version
    status.error = undefined
    broadcastStatus()
  })

  autoUpdater.on('download-progress', (progressObj) => {
    status.state = 'downloading'
    status.progress = Math.round(progressObj.percent)
    status.bytesPerSecond = progressObj.bytesPerSecond
    status.transferredBytes = progressObj.transferred
    status.totalBytes = progressObj.total
    broadcastStatus()
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    status.state = 'downloaded'
    status.availableVersion = info.version
    status.releaseDate = info.releaseDate
    status.error = undefined
    broadcastStatus()
  })

  autoUpdater.on('error', (err) => {
    const rawMsg = err ? err.message : 'Unknown updater error'
    let friendlyError = rawMsg
    if (/404|latest(-win|-mac|-linux)?\.ya?ml|Cannot find/i.test(rawMsg)) {
      friendlyError =
        'No published release found on GitHub (Kaliza-e/Hello_118_24). Once a release with installer assets is published, updates will download automatically.'
    }
    status.state = 'error'
    status.error = friendlyError
    broadcastStatus()
  })

  const validateSender = (event: Electron.IpcMainInvokeEvent) => {
    if (!targetWindow || targetWindow.isDestroyed()) return false
    return event.senderFrame === targetWindow.webContents.mainFrame
  }

  // IPC Handlers
  ipcMain.handle('updater:get-status', (event) => {
    if (!validateSender(event)) throw new Error('Unauthorized IPC sender')
    return getUpdateStatus()
  })
  ipcMain.handle('updater:get-version', (event) => {
    if (!validateSender(event)) throw new Error('Unauthorized IPC sender')
    return app.getVersion()
  })
  ipcMain.handle('updater:check', (event, manual?: boolean) => {
    if (!validateSender(event)) throw new Error('Unauthorized IPC sender')
    return checkForUpdates(Boolean(manual))
  })
  ipcMain.handle('updater:download', (event) => {
    if (!validateSender(event)) throw new Error('Unauthorized IPC sender')
    return startDownload()
  })
  ipcMain.handle('updater:install', (event) => {
    if (!validateSender(event)) throw new Error('Unauthorized IPC sender')
    return quitAndInstall()
  })

  // Gentle delayed automatic check on production launch (15s after startup)
  if (app.isPackaged) {
    setTimeout(() => {
      checkForUpdates(false).catch((err) => {
        console.warn('[AutoUpdater] Initial silent check skipped:', err?.message || err)
      })
    }, 15_000)

    // Periodic check every 4 hours if the application stays running
    autoCheckTimer = setInterval(() => {
      checkForUpdates(false).catch(() => {})
    }, 4 * 60 * 60 * 1000)
  }
}

export function cleanupUpdater(): void {
  if (autoCheckTimer) {
    clearInterval(autoCheckTimer)
    autoCheckTimer = null
  }
}
