import { Notification, NativeImage } from 'electron'
import { listClasses, listTasks, getSetting, getPendingRemindersToTrigger, markReminderDelivered } from './db'
import { getFreeTimeSuggestion } from './freeTimeEngine'

let reminderInterval: NodeJS.Timeout | null = null
const sentNotificationKeys = new Set<string>()
let getIconResolver: (() => string | NativeImage) | null = null

// Clear old notifications cache periodically (e.g. after 12h or if large)
setInterval(() => {
  if (sentNotificationKeys.size > 200) {
    sentNotificationKeys.clear()
  }
}, 60 * 60 * 1000)

export function initNotifications(iconResolver?: () => string | NativeImage): void {
  if (iconResolver) {
    getIconResolver = iconResolver
  }
  if (reminderInterval) {
    clearInterval(reminderInterval)
  }

  // Check every 45 seconds for upcoming classes, tasks, and free period study suggestions
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

    // 1. Check Subject Reminders (Lead time before next class)
    const leadTimeSetting = parseInt(
      getSetting('subject_reminder_minutes') || getSetting('class_reminder_minutes') || '10',
      10
    )
    const leadTime = isNaN(leadTimeSetting) ? 10 : leadTimeSetting

    const subjects = listClasses()
    const todaysSubjects = subjects
      .filter(c => c.weekday === currentWeekday)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))

    for (const c of todaysSubjects) {
      if (!c.start_time || !/^\d{2}:\d{2}$/.test(c.start_time)) continue

      const [sH, sM] = c.start_time.split(':').map(Number)
      const subjectStartTotalMinutes = sH * 60 + sM
      const diffMinutes = subjectStartTotalMinutes - currentTotalMinutes

      // If subject is starting within [0, leadTime] minutes and not yet passed
      if (diffMinutes >= 0 && diffMinutes <= leadTime) {
        const notifKey = `subject-${c.id}-${todayStr}-${c.start_time}`
        if (!sentNotificationKeys.has(notifKey)) {
          sentNotificationKeys.add(notifKey)

          const timeText = diffMinutes === 0 ? 'Starting now!' : `Starts in ${diffMinutes} min (${c.start_time})`
          const roomText = c.room ? ` • ${c.room}` : ''

          const appIcon = getIconResolver ? getIconResolver() : undefined
          const notif = new Notification({
            title: `Hello 118:24 — Class Reminder`,
            body: `${c.title}${roomText}\n${timeText}`,
            icon: appIcon,
            silent: false
          })
          notif.show()
        }
      }
    }

    // 2. Check Task Due Reminders
    const taskRemindersEnabled = getSetting('task_reminder_enabled') !== 'false'
    const todayTasks = listTasks(todayStr)
    const unfinishedTasks = todayTasks.filter(t => !t.completed)

    if (taskRemindersEnabled) {
      for (const t of unfinishedTasks) {
        if (!t.due_time || !/^\d{2}:\d{2}$/.test(t.due_time)) continue

        const [tH, tM] = t.due_time.split(':').map(Number)
        const taskTotalMinutes = tH * 60 + tM
        const diffMinutes = taskTotalMinutes - currentTotalMinutes

        if (diffMinutes >= 0 && diffMinutes <= 15) {
          const notifKey = `task-${t.id}-${todayStr}-${t.due_time}`
          if (!sentNotificationKeys.has(notifKey)) {
            sentNotificationKeys.add(notifKey)

            const appIcon = getIconResolver ? getIconResolver() : undefined
            const notif = new Notification({
              title: `Task Due Soon: ${t.title}`,
              body: `Scheduled for ${t.due_time}${t.priority === 'high' ? ' • High Priority' : ''}`,
              icon: appIcon,
              silent: false
            })
            notif.show()
          }
        }
      }
    }

    // 3. Smart Free-Period Task Suggestions (via freeTimeEngine)
    const suggestion = getFreeTimeSuggestion(now)
    if (suggestion.hasFreeTime && !suggestion.isSnoozed && suggestion.slotKey) {
      const notifKey = `free-slot-${suggestion.slotKey}`
      if (!sentNotificationKeys.has(notifKey)) {
        sentNotificationKeys.add(notifKey)

        const title = `Hello 118:24 — ${suggestion.freeMinutes} min Free Time`
        const body = suggestion.suggestedTask
          ? `Free until ${suggestion.freeUntil}${suggestion.nextEventTitle ? ` (${suggestion.nextEventTitle})` : ''}. Good time to work on: "${suggestion.suggestedTask.title}".`
          : suggestion.message

        const appIcon = getIconResolver ? getIconResolver() : undefined
        const notif = new Notification({
          title,
          body,
          icon: appIcon,
          silent: false
        })
        notif.show()
      }
    }

    // 4. Check Persistent Schedule Event Reminders
    checkScheduleEventReminders(now)
  } catch (err) {
    console.error('Error checking reminders:', err)
  }
}

export function checkScheduleEventReminders(now: Date = new Date()): void {
  try {
    const pending = getPendingRemindersToTrigger()
    if (!pending || pending.length === 0) return

    const nowMs = now.getTime()
    const appIcon = getIconResolver ? getIconResolver() : undefined

    for (const reminder of pending) {
      // Calculate target trigger time
      const dateParts = reminder.start_date.split('-').map(Number)
      if (dateParts.length !== 3) continue

      let eventHour = 8
      let eventMinute = 0

      if (reminder.is_all_day) {
        const delivery = reminder.all_day_delivery_time || '08:00'
        const [dH, dM] = delivery.split(':').map(Number)
        eventHour = isNaN(dH) ? 8 : dH
        eventMinute = isNaN(dM) ? 0 : dM
      } else if (reminder.start_time) {
        const [sH, sM] = reminder.start_time.split(':').map(Number)
        eventHour = isNaN(sH) ? 8 : sH
        eventMinute = isNaN(sM) ? 0 : sM
      }

      const eventTime = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], eventHour, eventMinute, 0, 0)
      const targetTriggerMs = eventTime.getTime() - (reminder.trigger_offset_minutes * 60 * 1000)

      // If trigger time has arrived
      if (nowMs >= targetTriggerMs) {
        // If the event is in the past by more than 24h, mark delivered without buzzing
        const isStale = (nowMs - targetTriggerMs) > (24 * 60 * 60 * 1000)
        if (!isStale) {
          const offsetText = reminder.trigger_offset_minutes > 0
            ? reminder.trigger_offset_minutes >= 1440
              ? ` (in ${Math.round(reminder.trigger_offset_minutes / 1440)} day${reminder.trigger_offset_minutes >= 2880 ? 's' : ''})`
              : reminder.trigger_offset_minutes >= 60
                ? ` (in ${Math.round(reminder.trigger_offset_minutes / 60)} hr)`
                : ` (in ${reminder.trigger_offset_minutes} mins)`
            : ' (Now)'

          const timeDisplay = reminder.is_all_day
            ? `Today (${reminder.start_date})`
            : `${reminder.start_time || ''}`

          const title = `Hello 118:24 — ${reminder.category}: ${reminder.event_title}`
          const body = `${timeDisplay}${offsetText}${reminder.location ? ` • ${reminder.location}` : ''}${reminder.description ? `\n${reminder.description}` : ''}`

          const notif = new Notification({
            title,
            body: body.trim(),
            icon: appIcon,
            silent: false
          })
          notif.show()
        }

        markReminderDelivered(reminder.id)
      }
    }
  } catch (err) {
    console.error('Error checking schedule event reminders:', err)
  }
}
