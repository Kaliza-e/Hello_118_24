import { app, dialog } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync, appendFileSync, statSync, renameSync } from 'node:fs'

let logFilePath: string | null = null
let initialized = false

export function initLogger(userDataDir: string): void {
  try {
    const logsDir = join(userDataDir, 'logs')
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true })
    }
    logFilePath = join(logsDir, 'app.log')

    // Simple 5MB log file rotation
    if (existsSync(logFilePath)) {
      try {
        const stats = statSync(logFilePath)
        if (stats.size > 5 * 1024 * 1024) {
          const oldPath = join(logsDir, 'app.old.log')
          renameSync(logFilePath, oldPath)
        }
      } catch {}
    }

    if (!initialized) {
      initialized = true

      process.on('uncaughtException', (err) => {
        logError('[UncaughtException]', err)
        if (app.isPackaged) {
          dialog.showErrorBox(
            'Hello 118:24 - Unexpected Error',
            `An unexpected error occurred during execution:\n\n${err?.message || String(err)}\n\nPlease see the log file at:\n${logFilePath}`
          )
        }
      })

      process.on('unhandledRejection', (reason) => {
        logError('[UnhandledRejection]', reason)
      })
    }
  } catch (err) {
    console.error('Failed to initialize logger:', err)
  }
}

function writeEntry(level: string, message: string, extra?: any): void {
  const timestamp = new Date().toISOString()
  let line = `[${timestamp}] [${level}] ${message}`
  if (extra !== undefined) {
    if (extra instanceof Error) {
      line += `\n  Stack: ${extra.stack || extra.message}`
    } else if (typeof extra === 'object') {
      try {
        line += `\n  Data: ${JSON.stringify(extra)}`
      } catch {
        line += `\n  Data: ${String(extra)}`
      }
    } else {
      line += ` ${String(extra)}`
    }
  }
  line += '\n'

  // Print to standard console
  if (level === 'ERROR') {
    console.error(line.trimEnd())
  } else if (level === 'WARN') {
    console.warn(line.trimEnd())
  } else {
    console.log(line.trimEnd())
  }

  // Append to log file
  if (logFilePath) {
    try {
      appendFileSync(logFilePath, line, 'utf8')
    } catch {}
  }
}

export function logInfo(message: string, extra?: any): void {
  writeEntry('INFO', message, extra)
}

export function logWarn(message: string, extra?: any): void {
  writeEntry('WARN', message, extra)
}

export function logError(message: string, extra?: any): void {
  writeEntry('ERROR', message, extra)
}

export function getLogFilePath(): string | null {
  return logFilePath
}
