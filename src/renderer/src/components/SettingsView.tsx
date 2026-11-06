import { useState, useEffect } from 'react'
import {
  ChevronRight,
  Sunset,
  Sun,
  Moon,
  Lock,
  X,
  KeyRound,
  Heart,
  BookOpen
} from 'lucide-react'

interface SettingsViewProps {
  pinned: boolean
  onTogglePin: () => void
  widgetMode: 'compact' | 'standard'
  onToggleMode: () => void
  theme: 'dark' | 'light'
  onThemeChange: (theme: 'dark' | 'light') => void
  onRefreshAll: () => Promise<void>
  onShowMessage: (msg: string) => void
}

export function SettingsView({
  pinned,
  onTogglePin,
  widgetMode,
  onToggleMode,
  theme,
  onThemeChange,
  onRefreshAll,
  onShowMessage
}: SettingsViewProps) {
  const [launchAtLogin, setLaunchAtLogin] = useState(true)
  const [showWidgetOnStartup, setShowWidgetOnStartup] = useState(true)
  const [startMinimized, setStartMinimized] = useState(false)
  const [widgetSize, setWidgetSize] = useState<'Small' | 'Medium' | 'Large'>('Medium')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [freePeriodRemindersEnabled, setFreePeriodRemindersEnabled] = useState(true)
  const [reminderInterval, setReminderInterval] = useState('10 minutes')

  // Free Time Task Reminders Extended Settings
  const [minFreeMinutes, setMinFreeMinutes] = useState('20')
  const [reminderDays, setReminderDays] = useState<'all' | 'weekdays'>('all')
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true)
  const [quietHoursStart, setQuietHoursStart] = useState('21:00')
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00')

  // App Information
  const [appVersion, setAppVersion] = useState<string>('0.1.2')
  const [isPinConfigured, setIsPinConfigured] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinInput, setPinInput] = useState('')

  // Faith & Encouragement Settings
  const [faithEnabled, setFaithEnabled] = useState(true)
  const [bibleTranslation, setBibleTranslation] = useState<'KJV' | 'NIV' | 'ESV' | 'NLT'>('KJV')
  const [journalEnabled, setJournalEnabled] = useState(true)

  useEffect(() => {
    // Load app version and pin status
    window.hello11824?.getAppVersion?.().then(ver => {
      if (ver) setAppVersion(ver)
    })
    window.hello11824?.isPinSet?.().then(set => {
      setIsPinConfigured(Boolean(set))
    })

    window.hello11824.getAllSettings().then(s => {
      if (s.launch_on_startup !== undefined) setLaunchAtLogin(s.launch_on_startup !== 'false')
      if (s.start_minimized !== undefined) {
        const min = s.start_minimized === 'true'
        setStartMinimized(min)
        setShowWidgetOnStartup(!min)
      }
      if (s.notifications_enabled !== undefined) setNotificationsEnabled(s.notifications_enabled !== 'false')
      if (s.free_period_reminders_enabled !== undefined) setFreePeriodRemindersEnabled(s.free_period_reminders_enabled !== 'false')
      if (s.class_reminder_minutes !== undefined) setReminderInterval(`${s.class_reminder_minutes} minutes`)
      if (s.free_reminder_min_minutes !== undefined) setMinFreeMinutes(s.free_reminder_min_minutes)
      if (s.free_reminder_days === 'all' || s.free_reminder_days === 'weekdays') setReminderDays(s.free_reminder_days)
      if (s.quiet_hours_enabled !== undefined) setQuietHoursEnabled(s.quiet_hours_enabled !== 'false')
      if (s.quiet_hours_start !== undefined) setQuietHoursStart(s.quiet_hours_start)
      if (s.quiet_hours_end !== undefined) setQuietHoursEnd(s.quiet_hours_end)
      if (s.faith_enabled !== undefined) setFaithEnabled(s.faith_enabled !== 'false')
      if (s.journal_enabled !== undefined) setJournalEnabled(s.journal_enabled !== 'false')
      if (s.bible_translation && ['KJV', 'NIV', 'ESV', 'NLT'].includes(s.bible_translation)) {
        setBibleTranslation(s.bible_translation as any)
      }
    })
  }, [])

  const platform = window.hello11824?.platform || 'win32'
  const isMac = platform === 'darwin'
  const isLinux = platform === 'linux'
  const startupLabel = isMac ? 'Launch at Mac login' : isLinux ? 'Launch on system startup' : 'Launch on Windows login'

  async function handleToggleStartup(login: boolean, minimized: boolean) {
    setLaunchAtLogin(login)
    setStartMinimized(minimized)
    setShowWidgetOnStartup(!minimized)
    await window.hello11824.updateStartup(login, minimized)
    const msg = login
      ? isMac
        ? 'Set to launch at Mac login.'
        : isLinux
          ? 'Set to launch on system startup.'
          : 'Set to launch at Windows login.'
      : isMac
        ? 'Disabled launch at Mac login.'
        : isLinux
          ? 'Disabled launch on system startup.'
          : 'Disabled launch at Windows login.'
    onShowMessage(msg)
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

  async function handleToggleFreePeriodReminders(enabled: boolean) {
    setFreePeriodRemindersEnabled(enabled)
    await window.hello11824.setSetting('free_period_reminders_enabled', String(enabled))
    onShowMessage(enabled ? 'Free time task reminders enabled.' : 'Free time task reminders disabled.')
  }

  async function handleMinMinutesChange(val: string) {
    setMinFreeMinutes(val)
    await window.hello11824.setSetting('free_reminder_min_minutes', val)
    onShowMessage(`Minimum free duration set to ${val} minutes.`)
  }

  async function handleReminderDaysChange(val: 'all' | 'weekdays') {
    setReminderDays(val)
    await window.hello11824.setSetting('free_reminder_days', val)
    onShowMessage(val === 'weekdays' ? 'Reminders active on weekdays only.' : 'Reminders active all days.')
  }

  async function handleToggleQuietHours(enabled: boolean) {
    setQuietHoursEnabled(enabled)
    await window.hello11824.setSetting('quiet_hours_enabled', String(enabled))
    onShowMessage(enabled ? 'Quiet hours enabled.' : 'Quiet hours disabled.')
  }

  async function handleQuietHoursTimeChange(start: string, end: string) {
    setQuietHoursStart(start)
    setQuietHoursEnd(end)
    await Promise.all([
      window.hello11824.setSetting('quiet_hours_start', start),
      window.hello11824.setSetting('quiet_hours_end', end)
    ])
  }

  async function handleIntervalChange(val: string) {
    setReminderInterval(val)
    const minutes = val.replace(/\D/g, '') || '10'
    await window.hello11824.setSetting('class_reminder_minutes', minutes)
  }

  async function handleToggleFaith(enabled: boolean) {
    setFaithEnabled(enabled)
    await window.hello11824.setSetting('faith_enabled', String(enabled))
    onShowMessage(enabled ? 'Daily scripture & encouragement enabled.' : 'Scripture cards hidden.')
  }

  async function handleBibleTranslationChange(tr: 'KJV' | 'NIV' | 'ESV' | 'NLT') {
    setBibleTranslation(tr)
    await window.hello11824.setSetting('bible_translation', tr)
    onShowMessage(`Bible translation set to ${tr}.`)
  }

  async function handleToggleJournal(enabled: boolean) {
    setJournalEnabled(enabled)
    await window.hello11824.setSetting('journal_enabled', String(enabled))
    onShowMessage(enabled ? 'Daily reflection journal enabled.' : 'Daily journal disabled.')
  }

  async function handleBackupExport() {
    try {
      const ok = await window.hello11824.exportData()
      if (ok) onShowMessage('Backup exported successfully.')
    } catch (err) {
      onShowMessage(`Export error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function handleBackupImport() {
    try {
      const ok = await window.hello11824.importData()
      if (ok) {
        await onRefreshAll()
        onShowMessage('Backup restored successfully.')
      }
    } catch (err) {
      onShowMessage(`Import error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function handleEncryptedExport() {
    const passphrase = window.prompt('Enter a password to encrypt your backup file (min 4 characters):')
    if (!passphrase) return
    if (passphrase.length < 4) {
      onShowMessage('Passphrase must be at least 4 characters long.')
      return
    }
    try {
      const ok = await window.hello11824.exportEncryptedData(passphrase)
      if (ok) onShowMessage('Encrypted backup (.enc) saved successfully.')
    } catch (err) {
      onShowMessage(`Encrypted export failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function handleEncryptedImport() {
    const passphrase = window.prompt('Enter the password for your encrypted backup file:')
    if (!passphrase) return
    try {
      const ok = await window.hello11824.importEncryptedData(passphrase)
      if (ok) {
        await onRefreshAll()
        onShowMessage('Encrypted backup restored successfully.')
      }
    } catch (err) {
      onShowMessage(`Encrypted restore failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function handleSavePin() {
    if (!/^\d{4,8}$/.test(pinInput)) {
      onShowMessage('PIN must be 4 to 8 digits.')
      return
    }
    try {
      await window.hello11824.setPin(pinInput)
      setIsPinConfigured(true)
      setShowPinModal(false)
      setPinInput('')
      onShowMessage('App Lock PIN enabled successfully.')
    } catch (err) {
      onShowMessage(`Error setting PIN: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function handleRemovePin() {
    const current = window.prompt('Enter your current PIN to disable App Lock:')
    if (!current) return
    try {
      await window.hello11824.removePin(current)
      setIsPinConfigured(false)
      onShowMessage('App Lock disabled.')
    } catch (err) {
      onShowMessage(`Failed to remove PIN: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="settings-grid-layout">
      {/* ================= LEFT COLUMN ================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Appearance Group */}
        <div className="settings-group">
          <span className="section-sublabel" style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
            Appearance & Theme
          </span>

          <div className="setting-toggle-row">
            <span className="setting-title">Theme mode</span>
            <div className="theme-toggle-group">
              <button
                type="button"
                className={`theme-pill-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => onThemeChange('dark')}
              >
                <Moon size={12} /> Dark
              </button>
              <button
                type="button"
                className={`theme-pill-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => onThemeChange('light')}
              >
                <Sun size={12} /> Light
              </button>
            </div>
          </div>
        </div>

        {/* Settings Group */}
        <div className="settings-group" style={{ paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
          <span className="section-sublabel" style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
            System & Window
          </span>

          <div className="setting-toggle-row">
            <span className="setting-title">{startupLabel}</span>
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
          <span className="section-sublabel" style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginTop: 4 }}>
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

        {/* Free Time Task Reminders Group */}
        <div className="settings-group" style={{ paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 2 }}>
            <span className="section-sublabel" style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
              Free Time Task Reminders
            </span>
            <span className={`free-time-indicator-pill ${notificationsEnabled && freePeriodRemindersEnabled ? 'active' : 'inactive'}`}>
              <span className="indicator-dot" />
              {notificationsEnabled && freePeriodRemindersEnabled ? 'Active' : 'Disabled'}
            </span>
          </div>

          <div className="setting-toggle-row">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="setting-title">Enable task reminders</span>
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                Suggests pending tasks during gaps between classes
              </span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={freePeriodRemindersEnabled}
                disabled={!notificationsEnabled}
                onChange={e => handleToggleFreePeriodReminders(e.target.checked)}
              />
              <span className="slider" />
            </label>
          </div>

          {freePeriodRemindersEnabled && notificationsEnabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4, paddingLeft: 4 }}>
              <div className="setting-toggle-row">
                <span className="setting-title">Minimum free duration</span>
                <select
                  className="select-field"
                  style={{ width: 140, padding: '4px 8px', fontSize: 11.5 }}
                  value={minFreeMinutes}
                  onChange={e => handleMinMinutesChange(e.target.value)}
                >
                  <option value="15">15 minutes</option>
                  <option value="20">20 minutes (Default)</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </div>

              <div className="setting-toggle-row">
                <span className="setting-title">Active reminder days</span>
                <select
                  className="select-field"
                  style={{ width: 140, padding: '4px 8px', fontSize: 11.5 }}
                  value={reminderDays}
                  onChange={e => handleReminderDaysChange(e.target.value as 'all' | 'weekdays')}
                >
                  <option value="all">All Days (incl. weekends)</option>
                  <option value="weekdays">Weekdays Only (Mon–Fri)</option>
                </select>
              </div>

              <div className="setting-toggle-row">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="setting-title">Quiet hours (Do not disturb)</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                    Mutes reminders overnight and quiet study hours
                  </span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={quietHoursEnabled}
                    onChange={e => handleToggleQuietHours(e.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>

              {quietHoursEnabled && (
                <div className="setting-toggle-row" style={{ paddingLeft: 8 }}>
                  <span className="setting-title" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Quiet hours window
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="time"
                      className="input-field"
                      style={{ width: 85, padding: '3px 6px', fontSize: 11 }}
                      value={quietHoursStart}
                      onChange={e => handleQuietHoursTimeChange(e.target.value, quietHoursEnd)}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>to</span>
                    <input
                      type="time"
                      className="input-field"
                      style={{ width: 85, padding: '3px 6px', fontSize: 11 }}
                      value={quietHoursEnd}
                      onChange={e => handleQuietHoursTimeChange(quietHoursStart, e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Faith & Encouragement Group */}
        <div className="settings-group" style={{ paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 2 }}>
            <span className="section-sublabel" style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
              Faith & Encouragement
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 999,
                background: faithEnabled ? 'rgba(124, 58, 237, 0.15)' : 'var(--border-subtle)',
                color: faithEnabled ? 'var(--accent-purple)' : 'var(--text-muted)'
              }}
            >
              {faithEnabled ? 'Psalm 118:24 Active' : 'Disabled'}
            </span>
          </div>

          <div className="setting-toggle-row">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="setting-title">Daily scripture & encouragement</span>
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                Rotating daily verse and uplifting scriptures on Home
              </span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={faithEnabled}
                onChange={e => handleToggleFaith(e.target.checked)}
              />
              <span className="slider" />
            </label>
          </div>

          {faithEnabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4, paddingLeft: 4 }}>
              <div className="setting-toggle-row">
                <span className="setting-title">Preferred Bible translation</span>
                <select
                  className="select-field"
                  style={{ width: 140, padding: '4px 8px', fontSize: 11.5 }}
                  value={bibleTranslation}
                  onChange={e => handleBibleTranslationChange(e.target.value as any)}
                >
                  <option value="KJV">KJV (King James)</option>
                  <option value="NIV">NIV (New Int'l)</option>
                  <option value="ESV">ESV (English Standard)</option>
                  <option value="NLT">NLT (New Living)</option>
                </select>
              </div>

              <div className="setting-toggle-row">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="setting-title">Morning & evening journal</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                    Private check-in with gratitude and intentions (encrypted at rest)
                  </span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={journalEnabled}
                    onChange={e => handleToggleJournal(e.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Security & App Lock Group */}
        <div className="settings-group" style={{ paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 2 }}>
            <span className="section-sublabel" style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
              Security & Privacy
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 999,
                background: isPinConfigured ? 'rgba(34, 197, 94, 0.15)' : 'var(--border-subtle)',
                color: isPinConfigured ? '#4ade80' : 'var(--text-muted)'
              }}
            >
              {isPinConfigured ? 'PIN Lock Active' : 'No Lock'}
            </span>
          </div>

          <div className="setting-toggle-row">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="setting-title">App Lock PIN</span>
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                Protects private notes, daily journal, and plans
              </span>
            </div>
            {isPinConfigured ? (
              <button
                type="button"
                className="btn-secondary-pill"
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={handleRemovePin}
              >
                Disable PIN
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary-pill"
                style={{ fontSize: 11, padding: '4px 12px' }}
                onClick={() => setShowPinModal(true)}
              >
                Set PIN
              </button>
            )}
          </div>
        </div>

        {/* Data & Backups Group */}
        <div className="settings-group" style={{ paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
          <span className="section-sublabel" style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginTop: 4 }}>
            Data & Backup
          </span>

          <div
            className="setting-toggle-row"
            style={{ cursor: 'pointer' }}
            onClick={handleEncryptedExport}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="setting-title">Encrypted Backup (.enc)</span>
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                Password-protected export of all tasks, timetable & plans
              </span>
            </div>
            <ChevronRight size={14} color="var(--accent-purple)" />
          </div>

          <div
            className="setting-toggle-row"
            style={{ cursor: 'pointer' }}
            onClick={handleEncryptedImport}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="setting-title">Restore Encrypted Backup</span>
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                Import password-protected .enc backup file
              </span>
            </div>
            <ChevronRight size={14} color="var(--text-muted)" />
          </div>

          <div
            className="setting-toggle-row"
            style={{ cursor: 'pointer' }}
            onClick={handleBackupExport}
          >
            <span className="setting-title">Standard JSON Export</span>
            <ChevronRight size={14} color="var(--text-muted)" />
          </div>

          <div
            className="setting-toggle-row"
            style={{ cursor: 'pointer' }}
            onClick={handleBackupImport}
          >
            <span className="setting-title">Restore Standard JSON</span>
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
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Hello 118:24</span>
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
      </div>

      {/* Set PIN Modal */}
      {showPinModal && (
        <div className="modal-backdrop" onClick={() => setShowPinModal(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: 360 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRound size={16} color="var(--accent-purple)" />
                <h3 className="modal-title">Set App Lock PIN</h3>
              </div>
              <button className="win-btn" onClick={() => setShowPinModal(false)} aria-label="Close">
                <X size={15} />
              </button>
            </div>

            <div className="modal-body" style={{ gap: 14 }}>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Enter a 4 to 8 digit PIN to secure your private notes and study journal. Your PIN is protected with salted scrypt encryption.
              </p>

              <div className="input-group">
                <label className="input-label">New PIN (4-8 digits)</label>
                <input
                  type="password"
                  autoFocus
                  maxLength={8}
                  className="input-field"
                  placeholder="••••"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSavePin()
                  }}
                  style={{ textAlign: 'center', letterSpacing: '4px', fontSize: 18 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn-secondary-pill"
                  onClick={() => setShowPinModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary-pill"
                  onClick={handleSavePin}
                  disabled={pinInput.length < 4}
                >
                  Save PIN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
