import { useState, useEffect } from 'react'
import {
  ChevronRight,
  Sunset,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RotateCcw
} from 'lucide-react'
import type { UpdateStatusInfo } from '../vite-env'

interface SettingsViewProps {
  pinned: boolean
  onTogglePin: () => void
  widgetMode: 'compact' | 'standard'
  onToggleMode: () => void
  onRefreshAll: () => Promise<void>
  onShowMessage: (msg: string) => void
}

export function SettingsView({
  pinned,
  onTogglePin,
  widgetMode,
  onToggleMode,
  onRefreshAll,
  onShowMessage
}: SettingsViewProps) {
  const [launchAtLogin, setLaunchAtLogin] = useState(true)
  const [showWidgetOnStartup, setShowWidgetOnStartup] = useState(true)
  const [startMinimized, setStartMinimized] = useState(false)
  const [widgetSize, setWidgetSize] = useState<'Small' | 'Medium' | 'Large'>('Medium')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [reminderInterval, setReminderInterval] = useState('10 minutes')

  // Auto-Update State
  const [appVersion, setAppVersion] = useState<string>('0.1.0')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusInfo>({
    state: 'idle',
    currentVersion: '0.1.0',
    isPackaged: true
  })
  const [isCheckingManually, setIsCheckingManually] = useState(false)

  useEffect(() => {
    // Load app version
    window.hello11824?.getAppVersion?.().then(ver => {
      if (ver) setAppVersion(ver)
    })

    // Load initial update status
    window.hello11824?.getUpdateStatus?.().then(status => {
      if (status) setUpdateStatus(status)
    })

    // Subscribe to live update notifications
    const unsubUpdate = window.hello11824?.onUpdateStatusChanged?.(status => {
      setUpdateStatus(status)
      if (status.state !== 'checking') {
        setIsCheckingManually(false)
      }
    })

    window.hello11824.getAllSettings().then(s => {
      if (s.launch_on_startup !== undefined) setLaunchAtLogin(s.launch_on_startup !== 'false')
      if (s.start_minimized !== undefined) {
        const min = s.start_minimized === 'true'
        setStartMinimized(min)
        setShowWidgetOnStartup(!min)
      }
      if (s.notifications_enabled !== undefined) setNotificationsEnabled(s.notifications_enabled !== 'false')
      if (s.class_reminder_minutes !== undefined) setReminderInterval(`${s.class_reminder_minutes} minutes`)
    })

    return () => {
      unsubUpdate?.()
    }
  }, [])

  async function handleToggleStartup(login: boolean, minimized: boolean) {
    setLaunchAtLogin(login)
    setStartMinimized(minimized)
    setShowWidgetOnStartup(!minimized)
    await window.hello11824.updateStartup(login, minimized)
    onShowMessage(login ? 'Set to launch at Windows login.' : 'Disabled launch at Windows login.')
  }

  async function handleToggleShowWidgetOnStartup(showWidget: boolean) {
    setShowWidgetOnStartup(showWidget)
    const minimized = !showWidget
    setStartMinimized(minimized)
    await window.hello11824.updateStartup(launchAtLogin, minimized)
    onShowMessage(showWidget ? 'Widget will appear automatically on startup.' : 'Widget will start minimized to tray.')
  }

  async function handleToggleNotifications(enabled: boolean) {
    setNotificationsEnabled(enabled)
    await window.hello11824.setSetting('notifications_enabled', String(enabled))
  }

  async function handleIntervalChange(val: string) {
    setReminderInterval(val)
    const minutes = val.replace(/\D/g, '') || '10'
    await window.hello11824.setSetting('class_reminder_minutes', minutes)
  }

  async function handleBackupExport() {
    try {
      const ok = await window.hello11824.exportData()
      if (ok) onShowMessage('Backup exported successfully.')
    } catch (err) {
      onShowMessage(`Export error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function handleCheckUpdates() {
    setIsCheckingManually(true)
    try {
      const status = await window.hello11824.checkForUpdates(true)
      setUpdateStatus(status)
      if (status.state === 'not-available') {
        onShowMessage('Hello 118:24 is up to date!')
      } else if (status.state === 'available') {
        onShowMessage(`New update available: v${status.availableVersion || ''}`)
      } else if (status.state === 'error' && status.error) {
        onShowMessage(`Update check failed: ${status.error}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setUpdateStatus(prev => ({ ...prev, state: 'error', error: msg }))
      onShowMessage(`Update check error: ${msg}`)
    } finally {
      setIsCheckingManually(false)
    }
  }

  async function handleDownloadUpdate() {
    try {
      onShowMessage('Downloading update package in background...')
      await window.hello11824.downloadUpdate()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setUpdateStatus(prev => ({ ...prev, state: 'error', error: msg }))
      onShowMessage(`Download error: ${msg}`)
    }
  }

  async function handleRestartAndInstall() {
    try {
      onShowMessage('Restarting Hello 118:24 to apply update...')
      await window.hello11824.quitAndInstallUpdate()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setUpdateStatus(prev => ({ ...prev, state: 'error', error: msg }))
      onShowMessage(`Install error: ${msg}`)
    }
  }

  return (
    <div className="settings-grid-layout">
      {/* ================= LEFT COLUMN ================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Settings Group */}
        <div className="settings-group">
          <span className="section-sublabel" style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>
            Settings
          </span>

          <div className="setting-toggle-row">
            <span className="setting-title">Launch on Windows login</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={launchAtLogin}
                onChange={e => handleToggleStartup(e.target.checked, startMinimized)}
              />
              <span className="slider" />
            </label>
          </div>

          <div className="setting-toggle-row">
            <span className="setting-title">Show widget on startup</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={showWidgetOnStartup}
                onChange={e => handleToggleShowWidgetOnStartup(e.target.checked)}
              />
              <span className="slider" />
            </label>
          </div>

          <div className="setting-toggle-row">
            <span className="setting-title">Always on top</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={pinned}
                onChange={onTogglePin}
              />
              <span className="slider" />
            </label>
          </div>

          <div className="setting-toggle-row">
            <span className="setting-title">Start minimized</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={startMinimized}
                disabled={!launchAtLogin}
                onChange={e => handleToggleStartup(launchAtLogin, e.target.checked)}
              />
              <span className="slider" />
            </label>
          </div>

          <div className="setting-toggle-row">
            <span className="setting-title">Default widget size</span>
            <select
              className="select-field"
              style={{ width: 110, padding: '4px 8px', fontSize: 11.5 }}
              value={widgetSize}
              onChange={e => setWidgetSize(e.target.value as any)}
            >
              <option value="Small">Small</option>
              <option value="Medium">Medium</option>
              <option value="Large">Large</option>
            </select>
          </div>
        </div>

        {/* Notifications Group */}
        <div className="settings-group" style={{ paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
          <span className="section-sublabel" style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginTop: 4 }}>
            Notifications
          </span>

          <div className="setting-toggle-row">
            <span className="setting-title">Enable notifications</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={e => handleToggleNotifications(e.target.checked)}
              />
              <span className="slider" />
            </label>
          </div>

          <div className="setting-toggle-row">
            <span className="setting-title">Reminder interval</span>
            <select
              className="select-field"
              style={{ width: 120, padding: '4px 8px', fontSize: 11.5 }}
              value={reminderInterval}
              disabled={!notificationsEnabled}
              onChange={e => handleIntervalChange(e.target.value)}
            >
              <option value="5 minutes">5 minutes</option>
              <option value="10 minutes">10 minutes</option>
              <option value="15 minutes">15 minutes</option>
              <option value="30 minutes">30 minutes</option>
            </select>
          </div>
        </div>

        {/* Data Group */}
        <div className="settings-group" style={{ paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
          <span className="section-sublabel" style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginTop: 4 }}>
            Data
          </span>

          <div
            className="setting-toggle-row"
            style={{ cursor: 'pointer' }}
            onClick={handleBackupExport}
          >
            <span className="setting-title">Backup & Export</span>
            <ChevronRight size={14} color="var(--text-muted)" />
          </div>
        </div>
      </div>

      {/* ================= RIGHT COLUMN: ABOUT & UPDATES ================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* About App Card */}
        <div className="about-card">
          <div className="about-app-icon">
            <Sunset size={28} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Hello 118:24</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Version {appVersion}</span>
          </div>

          <p className="about-scripture-quote">
            “This is the day which the LORD hath made; we will rejoice and be glad in it.”
            <br />
            <strong style={{ fontStyle: 'normal', color: 'var(--accent-cyan)', fontSize: 10.5, display: 'block', marginTop: 4 }}>
              Psalm 118:24 (KJV)
            </strong>
          </p>
        </div>

        {/* Automatic Software Updates Card */}
        <div className="update-card">
          <div className="update-header">
            <div className="update-title-group">
              <Sparkles size={15} color="var(--accent-cyan)" />
              <span>Software Updates</span>
            </div>

            {/* Status Badges */}
            {updateStatus.state === 'idle' && (
              <span className="update-status-badge idle">Ready</span>
            )}
            {updateStatus.state === 'checking' && (
              <span className="update-status-badge checking">
                <RefreshCw size={11} className="spin-icon" /> Checking
              </span>
            )}
            {updateStatus.state === 'available' && (
              <span className="update-status-badge available">
                v{updateStatus.availableVersion || 'New'} Available
              </span>
            )}
            {updateStatus.state === 'downloading' && (
              <span className="update-status-badge downloading">
                <Download size={11} /> {Math.round(updateStatus.progress || 0)}%
              </span>
            )}
            {updateStatus.state === 'downloaded' && (
              <span className="update-status-badge downloaded">
                <CheckCircle2 size={11} /> Ready to Install
              </span>
            )}
            {updateStatus.state === 'not-available' && updateStatus.isPackaged && (
              <span className="update-status-badge downloaded">
                <CheckCircle2 size={11} /> Up to Date
              </span>
            )}
            {!updateStatus.isPackaged && (
              <span className="update-status-badge dev">Dev Mode</span>
            )}
            {updateStatus.state === 'error' && (
              <span className="update-status-badge error">
                <AlertCircle size={11} /> Error
              </span>
            )}
          </div>

          {/* Description & Dynamic Progress Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {updateStatus.state === 'idle' && (
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Installed version is <strong>v{appVersion}</strong>. Automatic background checks keep your app updated seamlessly.
              </span>
            )}

            {updateStatus.state === 'checking' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: '#a5b4fc' }}>
                <RefreshCw size={13} className="spin-icon" />
                <span>Checking GitHub Releases for new updates...</span>
              </div>
            )}

            {updateStatus.state === 'available' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
                  Update v{updateStatus.availableVersion || ''} is available!
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Download and prepare the update in the background while continuing your work.
                </span>
              </div>
            )}

            {updateStatus.state === 'downloading' && (
              <div className="update-progress-container">
                <div className="update-progress-bar-track">
                  <div
                    className="update-progress-bar-fill"
                    style={{ width: `${Math.min(100, Math.max(0, updateStatus.progress || 0))}%` }}
                  />
                </div>
                <div className="update-progress-metrics">
                  <span>
                    {updateStatus.transferredBytes
                      ? `${(updateStatus.transferredBytes / (1024 * 1024)).toFixed(1)} MB`
                      : '0 MB'}{' '}
                    / {updateStatus.totalBytes
                      ? `${(updateStatus.totalBytes / (1024 * 1024)).toFixed(1)} MB`
                      : '...'}
                  </span>
                  <span>
                    {updateStatus.bytesPerSecond
                      ? `${(updateStatus.bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
                      : ''}{' '}
                    ({Math.round(updateStatus.progress || 0)}%)
                  </span>
                </div>
              </div>
            )}

            {updateStatus.state === 'downloaded' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6ee7b7' }}>
                  Update v{updateStatus.availableVersion || ''} has finished downloading!
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Restart now to apply the update immediately, or keep working — it will automatically install when you close Hello 118:24.
                </span>
              </div>
            )}

            {updateStatus.state === 'not-available' && updateStatus.isPackaged && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#6ee7b7' }}>
                <CheckCircle2 size={13} />
                <span>You are on the latest version (v{appVersion}).</span>
              </div>
            )}

            {!updateStatus.isPackaged && (
              <span style={{ fontSize: 11.5, color: '#fcd34d', lineHeight: 1.4 }}>
                Running in Development Mode. Update checks and installation are active in packaged production releases.
              </span>
            )}

            {updateStatus.state === 'error' && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: '#fca5a5', lineHeight: 1.4 }}>
                <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{updateStatus.error || 'Network error checking for updates.'}</span>
              </div>
            )}
          </div>

          {/* Action Buttons Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {updateStatus.state === 'downloaded' && (
              <button
                type="button"
                className="btn-update-primary"
                onClick={handleRestartAndInstall}
              >
                <RotateCcw size={13} /> Restart & Install
              </button>
            )}

            {updateStatus.state === 'available' && (
              <button
                type="button"
                className="btn-update-primary"
                onClick={handleDownloadUpdate}
              >
                <Download size={13} /> Download Update
              </button>
            )}

            {updateStatus.state !== 'downloading' && (
              <button
                type="button"
                className="btn-update-secondary"
                disabled={isCheckingManually || updateStatus.state === 'checking'}
                onClick={handleCheckUpdates}
              >
                <RefreshCw
                  size={12}
                  className={isCheckingManually || updateStatus.state === 'checking' ? 'spin-icon' : ''}
                />
                {isCheckingManually || updateStatus.state === 'checking'
                  ? 'Checking...'
                  : 'Check for Updates'}
              </button>
            )}
          </div>

          {/* Release Provider & Timestamp */}
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 8,
              borderTop: '1px solid var(--border-subtle)'
            }}
          >
            <span>GitHub Releases (Kaliza-e/Hello_118_24)</span>
            {updateStatus.lastChecked && (
              <span>
                Checked {new Date(updateStatus.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
