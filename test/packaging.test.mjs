import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

test('Packaging: icons and extra resources are configured properly', () => {
  const pkgPath = resolve('package.json')
  assert.ok(existsSync(pkgPath), 'package.json must exist')

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

  // Verify icon files exist on disk
  assert.ok(existsSync(resolve('build/icon.ico')), 'build/icon.ico must exist')
  assert.ok(existsSync(resolve('build/icon.png')), 'build/icon.png must exist')

  // Verify build configuration
  assert.ok(pkg.build, 'build object must exist in package.json')
  assert.equal(pkg.build.win?.icon, 'build/icon.ico', 'Windows icon must point to build/icon.ico')
  assert.equal(pkg.build.mac?.icon, 'build/icon.png', 'macOS icon must point to build/icon.png')
  assert.equal(pkg.build.linux?.icon, 'build/icon.png', 'Linux icon must point to build/icon.png')

  // Verify publish is removed
  assert.equal(pkg.build.publish, undefined, 'publish configuration must not exist')

  // Verify extraResources includes icons so they are accessible outside ASAR
  assert.ok(Array.isArray(pkg.build.extraResources), 'extraResources must be an array')
  assert.ok(pkg.build.extraResources.some(r => r.to === 'icon.ico'), 'extraResources must contain icon.ico')
  assert.ok(pkg.build.extraResources.some(r => r.to === 'icon.png'), 'extraResources must contain icon.png')
})

test('Packaging: main process and preload bridge expose safe version contract', () => {
  const mainPath = resolve('src/main/index.ts')
  const preloadPath = resolve('src/preload/index.ts')

  assert.ok(existsSync(mainPath), 'src/main/index.ts must exist')
  assert.ok(existsSync(preloadPath), 'src/preload/index.ts must exist')

  const mainCode = readFileSync(mainPath, 'utf8')
  const preloadCode = readFileSync(preloadPath, 'utf8')

  // Verify getAppVersion contract
  assert.ok(mainCode.includes("'app:get-version'"), 'main must handle app:get-version IPC channel')
  assert.ok(preloadCode.includes('getAppVersion'), 'preload must expose getAppVersion')

  // Verify updater is not imported
  assert.ok(!mainCode.includes("from './updater'"), 'main process must not import updater')
  assert.ok(!preloadCode.includes('updater:check'), 'preload must not expose updater IPC')
})

test('Packaging: User data isolation ensures SQLite database preservation', () => {
  const dbPath = resolve('src/main/db.ts')
  assert.ok(existsSync(dbPath), 'src/main/db.ts must exist')

  const dbCode = readFileSync(dbPath, 'utf8')
  // Verify database is stored in userData (%APPDATA%\hello-118-24), not application directory
  assert.ok(dbCode.includes("app.getPath('userData')"), "Database must use app.getPath('userData') for persistent storage")
  assert.ok(!dbCode.includes('__dirname'), 'Database path must never rely on local installation folder __dirname')
})
