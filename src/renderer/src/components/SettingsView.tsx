import { useState, useEffect } from 'react'
import {
  ChevronRight,
  Sunset
} from 'lucide-react'

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

  useEffect(() => {
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

      {/* ================= RIGHT COLUMN: ABOUT CARD (Panel 6) ================= */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="about-card">
          <div className="about-app-icon">
            <Sunset size={28} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Hello 118:24</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Version 1.0.0</span>
          </div>

          <p className="about-scripture-quote">
            “This is the day which the LORD hath made; we will rejoice and be glad in it.”
            <br />
            <strong style={{ fontStyle: 'normal', color: 'var(--accent-cyan)', fontSize: 10.5, display: 'block', marginTop: 4 }}>
              Psalm 118:24 (KJV)
            </strong>
          </p>
        </div>
      </div>
    </div>
  )
}
