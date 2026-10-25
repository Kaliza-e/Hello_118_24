import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

test('Updater: package.json has valid electron-updater and GitHub publish config', () => {
  const pkgPath = resolve('package.json')
  assert.ok(existsSync(pkgPath), 'package.json must exist')

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

  // Verify electron-updater dependency
  assert.ok(pkg.dependencies && pkg.dependencies['electron-updater'], 'electron-updater must be in dependencies')
  const version = pkg.dependencies['electron-updater']
  assert.ok(version.startsWith('^6') || version.startsWith('6'), `electron-updater version should be ^6.x, got ${version}`)

  // Verify electron-builder publish configuration
  assert.ok(pkg.build, 'build object must exist in package.json')
  assert.ok(pkg.build.publish, 'build.publish must be configured for auto-updates')
  
  const publish = pkg.build.publish
  assert.equal(publish.provider, 'github', 'Publish provider must be github')
  assert.equal(publish.owner, 'Kaliza-e', 'Publish owner must match GitHub account')
  assert.equal(publish.repo, 'Hello_118_24', 'Publish repository must match GitHub repository')

  // Verify publish:win script
  assert.ok(pkg.scripts['publish:win'], 'publish:win npm script must exist')
  assert.ok(pkg.scripts['publish:win'].includes('--publish always'), 'publish:win must include --publish always flag')
})

test('Updater: main process and preload bridge expose safe auto-update contract', () => {
  const updaterPath = resolve('src/main/updater.ts')
  const preloadPath = resolve('src/preload/index.ts')
  const envPath = resolve('src/renderer/src/vite-env.d.ts')

  assert.ok(existsSync(updaterPath), 'src/main/updater.ts must exist')
  assert.ok(existsSync(preloadPath), 'src/preload/index.ts must exist')
  assert.ok(existsSync(envPath), 'src/renderer/src/vite-env.d.ts must exist')

  const updaterCode = readFileSync(updaterPath, 'utf8')
  const preloadCode = readFileSync(preloadPath, 'utf8')
  const envCode = readFileSync(envPath, 'utf8')

  // Verify safety guards in updater.ts
  assert.ok(updaterCode.includes('!app.isPackaged'), 'updater must guard against running in development mode')
  assert.ok(updaterCode.includes('net.isOnline()'), 'updater must check network status to handle offline mode')
  assert.ok(updaterCode.includes('autoUpdater.autoDownload = false'), 'autoDownload should be false to allow user-controlled downloads')
  assert.ok(updaterCode.includes('autoUpdater.autoInstallOnAppQuit = true'), 'autoInstallOnAppQuit must be true for non-forced installs')

  // Verify IPC bridge methods in preload
  assert.ok(preloadCode.includes('getAppVersion'), 'preload must expose getAppVersion')
  assert.ok(preloadCode.includes('getUpdateStatus'), 'preload must expose getUpdateStatus')
  assert.ok(preloadCode.includes('checkForUpdates'), 'preload must expose checkForUpdates')
  assert.ok(preloadCode.includes('downloadUpdate'), 'preload must expose downloadUpdate')
  assert.ok(preloadCode.includes('quitAndInstallUpdate'), 'preload must expose quitAndInstallUpdate')
  assert.ok(preloadCode.includes('onUpdateStatusChanged'), 'preload must expose onUpdateStatusChanged')

  // Verify TypeScript typings in vite-env.d.ts
  assert.ok(envCode.includes('interface UpdateStatusInfo'), 'vite-env.d.ts must define UpdateStatusInfo')
  assert.ok(envCode.includes('type UpdateState'), 'vite-env.d.ts must define UpdateState')
  assert.ok(envCode.includes('availableVersion?: string'), 'UpdateStatusInfo must define availableVersion')
})

test('Updater: User data isolation ensures SQLite database preservation during updates', () => {
  const dbPath = resolve('src/main/db.ts')
  assert.ok(existsSync(dbPath), 'src/main/db.ts must exist')

  const dbCode = readFileSync(dbPath, 'utf8')
  // Verify database is stored in userData (%APPDATA%\hello-118-24), not application directory
  assert.ok(dbCode.includes("app.getPath('userData')"), "Database must use app.getPath('userData') for persistent storage")
  assert.ok(!dbCode.includes('__dirname'), 'Database path must never rely on local installation folder __dirname')
})
