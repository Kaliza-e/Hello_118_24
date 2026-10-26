import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

test('Cross-Platform: package.json has complete Windows, macOS, and Linux build configuration', () => {
  const pkgPath = resolve('package.json')
  assert.ok(existsSync(pkgPath), 'package.json must exist')

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const build = pkg.build
  assert.ok(build, 'package.json must contain build object')

  // Common metadata
  assert.equal(build.appId, 'com.hello11824.desktop')
  assert.equal(build.productName, 'Hello 118:24')
  assert.ok(build.asarUnpack && build.asarUnpack.includes('node_modules/better-sqlite3/**/*'))

  // Windows build target
  assert.ok(build.win, 'Windows configuration must exist')
  assert.ok(build.win.target && build.win.target.some(t => t.target === 'nsis'))
  assert.ok(build.nsis, 'NSIS configuration must exist')

  // macOS build target
  assert.ok(build.mac, 'macOS configuration must exist')
  assert.equal(build.mac.category, 'public.app-category.education')
  assert.equal(build.mac.hardenedRuntime, true)
  assert.ok(build.mac.entitlements, 'macOS entitlements must be configured')
  assert.ok(existsSync(resolve(build.mac.entitlements)), 'macOS entitlements file must exist')
  const macTargets = build.mac.target.map(t => t.target)
  assert.ok(macTargets.includes('dmg'), 'macOS target must include dmg')
  assert.ok(macTargets.includes('zip'), 'macOS target must include zip')

  // Linux build target
  assert.ok(build.linux, 'Linux configuration must exist')
  assert.equal(build.linux.category, 'Education')
  assert.ok(build.linux.desktop, 'Linux desktop entry must be configured')
  assert.equal(build.linux.desktop.StartupWMClass, 'Hello 118:24')
  const linuxTargets = build.linux.target.map(t => t.target)
  assert.ok(linuxTargets.includes('AppImage'), 'Linux target must include AppImage')
  assert.ok(linuxTargets.includes('deb'), 'Linux target must include deb')

  // NPM scripts
  assert.ok(pkg.scripts['package:win'], 'package:win script must exist')
  assert.ok(pkg.scripts['package:mac'], 'package:mac script must exist')
  assert.ok(pkg.scripts['package:linux'], 'package:linux script must exist')
  assert.ok(pkg.scripts['package:all'], 'package:all script must exist')
  assert.ok(pkg.scripts['clean'], 'clean script must exist')
})

test('Cross-Platform: entitlements.mac.plist has valid security keys for native SQLite', () => {
  const plistPath = resolve('build/entitlements.mac.plist')
  assert.ok(existsSync(plistPath), 'build/entitlements.mac.plist must exist')

  const content = readFileSync(plistPath, 'utf8')
  assert.ok(content.includes('com.apple.security.cs.allow-jit'), 'Must include allow-jit entitlement')
  assert.ok(content.includes('com.apple.security.cs.allow-unsigned-executable-memory'), 'Must include unsigned memory entitlement')
})

test('Cross-Platform: main process handles macOS menu, Windows app ID, and Linux window icon', () => {
  const mainPath = resolve('src/main/index.ts')
  assert.ok(existsSync(mainPath), 'src/main/index.ts must exist')

  const code = readFileSync(mainPath, 'utf8')

  // Windows AppUserModelId
  assert.ok(code.includes("app.setAppUserModelId('com.hello11824.desktop')"), 'Main process must set Windows AppUserModelId')

  // macOS application menu with Edit shortcuts
  assert.ok(code.includes("process.platform === 'darwin'"), 'Main process must detect macOS')
  assert.ok(code.includes("setupApplicationMenu"), 'Main process must configure application menu')
  assert.ok(code.includes("role: 'copy'"), 'macOS menu must include copy role for inputs')
  assert.ok(code.includes("role: 'paste'"), 'macOS menu must include paste role for inputs')

  // Linux window icon fallback
  assert.ok(code.includes("process.platform === 'linux'"), 'Main process must provide Linux icon handling')

  // macOS tray template image
  assert.ok(code.includes('setTemplateImage(true)'), 'macOS tray icon must use template image')

  // Cross-platform autostart
  assert.ok(code.includes('updateAutoStart'), 'Main process must provide cross-platform autostart')
})

test('Cross-Platform: preload script and renderer types expose platform property', () => {
  const preloadPath = resolve('src/preload/index.ts')
  const envPath = resolve('src/renderer/src/vite-env.d.ts')

  const preloadCode = readFileSync(preloadPath, 'utf8')
  const envCode = readFileSync(envPath, 'utf8')

  assert.ok(preloadCode.includes('platform: process.platform'), 'Preload must expose process.platform')
  assert.ok(envCode.includes("platform?: 'win32' | 'darwin' | 'linux'"), 'vite-env.d.ts must type platform')
})
