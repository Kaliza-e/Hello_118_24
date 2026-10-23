import { Notification } from 'electron'
import { listClasses, listTasks, getSetting } from './db'

let reminderInterval: NodeJS.Timeout | null = null
const sentNotificationKeys = new Set<string>()

// Clear old notifications cache periodically (e.g. at midnight or after 24h)
setInterval(() => {
  if (sentNotificationKeys.size > 200) {
    sentNotificationKeys.clear()
  }
}, 60 * 60 * 1000)

export function initNotifications(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval)
  }

  // Check every 45 seconds for upcoming classes and tasks
  reminderInterval = setInterval(checkReminders, 45_000)
  // Run an immediate check 5 seconds after launch
  setTimeout(checkReminders, 5_000)
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function checkReminders(): void {
  try {
    const notificationsEnabled = getSetting('notifications_enabled') !== 'false'
    if (!notificationsEnabled) return

    if (!Notification.isSupported()) {
      return
    }

    const now = new Date()
    const currentWeekday = now.getDay()
    const currentHours = now.getHours()
    const currentMinutes = now.getMinutes()
    const currentTotalMinutes = currentHours * 60 + currentMinutes
    const todayStr = dateKey(now)

    // Check Class Reminders
    const leadTimeSetting = parseInt(getSetting('class_reminder_minutes') || '10', 10)
    const leadTime = isNaN(leadTimeSetting) ? 10 : leadTimeSetting

    const classes = listClasses()
    const todaysClasses = classes.filter(c => c.weekday === currentWeekday)

    for (const c of todaysClasses) {
      if (!c.start_time || !/^\d{2}:\d{2}$/.test(c.start_time)) continue

      const [sH, sM] = c.start_time.split(':').map(Number)
      const classStartTotalMinutes = sH * 60 + sM
      const diffMinutes = classStartTotalMinutes - currentTotalMinutes

      // If class is starting within [0, leadTime] minutes and not yet passed
      if (diffMinutes >= 0 && diffMinutes <= leadTime) {
        const notifKey = `class-${c.id}-${todayStr}-${c.start_time}`
        if (!sentNotificationKeys.has(notifKey)) {
          sentNotificationKeys.add(notifKey)

          const timeText = diffMinutes === 0 ? 'Starting now!' : `Starts in ${diffMinutes} min (${c.start_time})`
          const roomText = c.room ? ` • ${c.room}` : ''

          const notif = new Notification({
            title: `Hello 118:24 — Class Reminder`,
            body: `${c.title}${roomText}\n${timeText}`,
            silent: false
          })
          notif.show()
        }
      }
    }

    // Check Task Reminders
    const taskRemindersEnabled = getSetting('task_reminder_enabled') !== 'false'
    if (taskRemindersEnabled) {
      const tasks = listTasks(todayStr)
      for (const t of tasks) {
        if (t.completed) continue
        if (!t.due_time || !/^\d{2}:\d{2}$/.test(t.due_time)) continue

        const [tH, tM] = t.due_time.split(':').map(Number)
        const taskTotalMinutes = tH * 60 + tM
        const diffMinutes = taskTotalMinutes - currentTotalMinutes

        if (diffMinutes >= 0 && diffMinutes <= 15) {
          const notifKey = `task-${t.id}-${todayStr}-${t.due_time}`
          if (!sentNotificationKeys.has(notifKey)) {
            sentNotificationKeys.add(notifKey)

            const notif = new Notification({
              title: `Task Due Soon: ${t.title}`,
              body: `Scheduled for ${t.due_time}${t.priority === 'high' ? ' • High Priority' : ''}`,
              silent: false
            })
            notif.show()
          }
        }
      }
    }
  } catch (err) {
    console.error('Error checking reminders:', err)
  }
}
