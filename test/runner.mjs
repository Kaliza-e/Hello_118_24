import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

// If running in regular Node instead of Electron's runtime, forward to electron binary with ELECTRON_RUN_AS_NODE=1
// because native better-sqlite3 is compiled against Electron's ABI.
if (!process.versions.electron && !process.env.ELECTRON_RUN_AS_NODE) {
  const binary = resolve(
    process.platform === 'win32'
      ? 'node_modules/electron/dist/electron.exe'
      : process.platform === 'darwin'
        ? 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'
        : 'node_modules/electron/dist/electron'
  )

  if (existsSync(binary)) {
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
    resolve('test/updater.test.mjs'),
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
