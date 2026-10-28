import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

// Check if better-sqlite3 can run directly in the current Node environment.
// If it is already compatible with current Node (like after npm ci in CI), run directly.
// If it was compiled against Electron's ABI (ERR_DLOPEN_FAILED), forward to Electron with ELECTRON_RUN_AS_NODE=1.
let canLoadSqlite = false
try {
  const Database = require('better-sqlite3')
  const testDb = new Database(':memory:')
  testDb.close()
  canLoadSqlite = true
} catch {
  canLoadSqlite = false
}

if (!canLoadSqlite && !process.versions.electron && !process.env.ELECTRON_RUN_AS_NODE) {
  let binary = null
  try {
    binary = require('electron')
  } catch {
    binary = resolve(
      process.platform === 'win32'
        ? 'node_modules/electron/dist/electron.exe'
        : process.platform === 'darwin'
          ? 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'
          : 'node_modules/electron/dist/electron'
    )
  }

  if (binary && existsSync(binary)) {
    const res = spawnSync(binary, [resolve('test/runner.mjs')], {
      stdio: 'inherit',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    })
    process.exit(res.status ?? 0)
  }
}

import { run } from 'node:test'
import { spec } from 'node:test/reporters'

run({
  files: [
    resolve('test/parser.test.mjs'),
    resolve('test/database.test.mjs'),
    resolve('test/packaging.test.mjs'),
    resolve('test/freeTime.test.mjs'),
    resolve('test/crossPlatform.test.mjs'),
    resolve('test/security.test.mjs')
  ]
})
  .on('test:fail', () => {
    process.exitCode = 1
  })
  .compose(spec)
  .pipe(process.stdout)
