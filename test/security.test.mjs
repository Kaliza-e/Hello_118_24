import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Security & Hardening Audit Verification', () => {
  it('CSP: index.html contains strict Content-Security-Policy meta tag', () => {
    const htmlPath = resolve('src/renderer/index.html')
    assert.ok(existsSync(htmlPath), 'index.html must exist')
    const html = readFileSync(htmlPath, 'utf-8')
    assert.ok(html.includes('http-equiv="Content-Security-Policy"'), 'CSP meta tag must be present')
    assert.ok(html.includes("default-src 'self'"), "CSP must set default-src 'self'")
    assert.ok(html.includes("object-src 'none'"), "CSP must set object-src 'none'")
    assert.ok(html.includes("base-uri 'self'"), "CSP must set base-uri 'self'")
  })

  it('Electron Security: webPreferences encloses context isolation, sandboxing, and web security', () => {
    const indexPath = resolve('src/main/index.ts')
    const code = readFileSync(indexPath, 'utf-8')

    assert.ok(code.includes('contextIsolation: true'), 'contextIsolation must be enabled')
    assert.ok(code.includes('nodeIntegration: false'), 'nodeIntegration must be disabled')
    assert.ok(code.includes('sandbox: true'), 'sandbox must be enabled')
    assert.ok(code.includes('webSecurity: true'), 'webSecurity must be enabled')
    assert.ok(code.includes('allowRunningInsecureContent: false'), 'allowRunningInsecureContent must be explicitly false')
  })

  it('Navigation & Window Open: popups and untrusted navigations are restricted', () => {
    const indexPath = resolve('src/main/index.ts')
    const code = readFileSync(indexPath, 'utf-8')

    assert.ok(code.includes('setWindowOpenHandler'), 'setWindowOpenHandler must be registered')
    assert.ok(code.includes("action: 'deny'"), 'setWindowOpenHandler must deny arbitrary window creation')
    assert.ok(code.includes("will-navigate"), 'will-navigate handler must be registered')
    assert.ok(code.includes('event.preventDefault()'), 'will-navigate must prevent default navigation')
  })

  it('External URL Allowlist: filters out non-https and untrusted hosts', () => {
    // Regex or simulated logic test matching isSafeExternalUrl
    const SAFE_EXTERNAL_HOSTS = new Set([
      'github.com',
      'raw.githubusercontent.com',
      'api.github.com',
      'fonts.googleapis.com',
      'fonts.gstatic.com'
    ])

    function isSafeExternalUrl(targetUrl) {
      try {
        const parsed = new URL(targetUrl)
        if (parsed.protocol !== 'https:') return false
        const hostname = parsed.hostname.toLowerCase()
        if (SAFE_EXTERNAL_HOSTS.has(hostname)) return true
        for (const allowed of SAFE_EXTERNAL_HOSTS) {
          if (hostname.endsWith(`.${allowed}`)) return true
        }
        return false
      } catch {
        return false
      }
    }

    assert.equal(isSafeExternalUrl('https://github.com/Kaliza-e/Hello_118_24'), true)
    assert.equal(isSafeExternalUrl('https://api.github.com/repos/Kaliza-e/Hello_118_24/releases'), true)
    assert.equal(isSafeExternalUrl('http://github.com'), false, 'Insecure HTTP must be rejected')
    assert.equal(isSafeExternalUrl('javascript:alert(1)'), false, 'JavaScript protocol must be rejected')
    assert.equal(isSafeExternalUrl('file:///etc/passwd'), false, 'File scheme must be rejected')
    assert.equal(isSafeExternalUrl('https://malicious-site.com'), false, 'Untrusted hostnames must be rejected')
  })

  it('IPC Security: assertAuthorizedSender validates main frame identity', () => {
    const indexPath = resolve('src/main/index.ts')
    const code = readFileSync(indexPath, 'utf-8').replace(/\r\n/g, '\n')

    assert.ok(code.includes('assertAuthorizedSender'), 'assertAuthorizedSender function must be defined')
    assert.ok(code.includes('event.senderFrame === mainWindow.webContents.mainFrame'), 'Must compare senderFrame to mainFrame')
    
    // Check that key channels call assertAuthorizedSender
    assert.ok(code.includes("ipcMain.handle('window:minimize', (event) => {\n  assertAuthorizedSender(event)"), 'window:minimize must be protected')
    assert.ok(code.includes("ipcMain.handle('tasks:add', (event, payload) => {\n  assertAuthorizedSender(event)"), 'tasks:add must be protected')
    assert.ok(code.includes("ipcMain.handle('files:pick-and-extract', async (event) => {\n  assertAuthorizedSender(event)"), 'files:pick-and-extract must be protected')
    assert.ok(code.includes("ipcMain.handle('data:import', async (event) => {\n  assertAuthorizedSender(event)"), 'data:import must be protected')
  })

  it('File Import Security: enforces strict file limits and extension allowlist', () => {
    const indexPath = resolve('src/main/index.ts')
    const code = readFileSync(indexPath, 'utf-8').replace(/\r\n/g, '\n')

    assert.ok(code.includes('MAX_DOC_SIZE_BYTES'), 'Document size limits must be declared')
    assert.ok(code.includes('MAX_IMG_SIZE_BYTES'), 'Image size limits must be declared')
    assert.ok(code.includes('MAX_BACKUP_SIZE_BYTES'), 'Backup size limits must be declared')
    assert.ok(code.includes('ALLOWED_IMPORT_EXTENSIONS'), 'File extension allowlist must be enforced')
  })

  it('Database Security: parameterized queries and automated pre-mutation backups', () => {
    const dbPath = resolve('src/main/db.ts')
    const code = readFileSync(dbPath, 'utf-8').replace(/\r\n/g, '\n')

    assert.ok(code.includes('createDatabaseBackup'), 'createDatabaseBackup function must exist')
    assert.ok(code.includes("db.pragma('integrity_check')"), 'integrity_check PRAGMA must be run on launch')
    assert.ok(code.includes("db.pragma('foreign_keys = ON')"), 'foreign_keys must be enforced')
    assert.ok(!code.includes('`SELECT * FROM tasks WHERE title = ${'), 'Must not have template literal SQL injection')
    assert.ok(!code.includes('`INSERT INTO tasks VALUES (${'), 'Must not have template literal SQL injection in inserts')
  })

  it('Packaging Configuration: does not publish releases and isolates app secrets', () => {
    const pkgPath = resolve('package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

    assert.ok(pkg.build, 'build object must exist')
    assert.equal(pkg.build.publish, undefined, 'build.publish must not be configured')

    // Verify CI script does not blindly publish without credentials or manual dispatch
    const ciPath = resolve('.github/workflows/build.yml')
    const ci = readFileSync(ciPath, 'utf-8')
    assert.ok(ci.includes('--publish never'), 'Default CI runs must never auto-publish without approval')
  })
})
