# Hello 118:24 — Public Distribution & Security Release Guide

## 1. Overview & Distribution Strategy

**Hello 118:24** is distributed as a multi-platform desktop application built with Electron 33, React 18, TypeScript, and SQLite.

- **Primary Distribution Channel:** GitHub Releases (`Kaliza-e/Hello_118_24`).
- **Build Pipeline:** Automated, repeatable builds orchestrated via GitHub Actions (`.github/workflows/build.yml`) across `windows-latest`, `macos-latest`, and `ubuntu-latest`.
- **Public Website / Download Page:** `docs/index.html` (deployable directly via Vercel or GitHub Pages).

---

## 2. Release Artifacts & Platform Matrix

| Operating System | Target Package Format | Target Architecture | Generated Artifact Filename | Installation Details |
| :--- | :--- | :--- | :--- | :--- |
| **Windows** | NSIS Installer (.exe) | `x64` | `Hello 11824 Setup 0.1.1.exe` | Standard wizard; creates desktop & Start Menu shortcuts with `com.hello11824.desktop` AppUserModelID |
| **macOS** | Apple Disk Image (.dmg) | Universal (`x64` + `arm64`) | `Hello-118-24-0.1.1.dmg` | Drag-to-Applications bundle |
| **macOS** | Portable ZIP (.zip) | Universal (`x64` + `arm64`) | `Hello-118-24-0.1.1-mac.zip` | Standalone application folder |
| **Linux** | AppImage | `x64` | `Hello-118-24-0.1.1.AppImage` | Portable binary (`chmod +x && ./Hello-118-24-0.1.1.AppImage`) |
| **Linux** | Debian Package (.deb) | `x64` (amd64) | `hello-118-24_0.1.1_amd64.deb` | System package (`sudo dpkg -i hello-118-24_0.1.1_amd64.deb`) |

---

## 3. Data Storage & Privacy Policy (Truth-in-Software Disclosure)

### Local Data Storage
- **Operating System Paths:**
  - **Windows:** `%APPDATA%\hello-118-24\hello11824.sqlite`
  - **macOS:** `~/Library/Application Support/hello-118-24/hello11824.sqlite`
  - **Linux:** `~/.config/hello-118-24/hello11824.sqlite`
- **Data Stored:**
  - User timetable entries (`classes`: title, weekday, start_time, end_time, room, notes, color).
  - User to-dos (`tasks`: title, description, due_date, due_time, priority, completed, category, estimated_minutes).
  - Daily planning notes and packed materials checklists (`daily_plans`).
  - User interface settings (`settings`: widget_mode, pinned, theme, notification lead times, quiet hours).
  - Automated database snapshot backups (`userData/backups/`).
- **Encryption Status:**
  - SQLite data is stored in standard SQLite WAL format. It is **not** encrypted at rest with SQLCipher. (Documented truthfully to avoid false security claims).
- **Network Requests:**
  - **Telemetry / Analytics:** None. Zero tracking or telemetry SDKs are bundled.
  - **Remote APIs:** None. 100% offline and self-contained; all scheduling, free-time suggestions, OCR extraction, and database transactions execute locally on the device.

---

## 4. Code Signing & Notarization Setup

### Windows Code Signing
To avoid the Windows Defender SmartScreen "Unknown Publisher" warning:
1. Obtain an EV (Extended Validation) or Standard Authenticode Code Signing Certificate.
2. In your GitHub Repository Settings (`Settings` -> `Secrets and variables` -> `Actions`), add:
   - `WIN_CSC_LINK`: Base64-encoded `.pfx` or `.p12` certificate file.
   - `WIN_CSC_KEY_PASSWORD`: Password for the certificate.
3. `electron-builder` will automatically detect these environment variables during `npx electron-builder --win`.

### macOS Signing & Notarization
To pass macOS Gatekeeper without quarantine flags:
1. Join the Apple Developer Program.
2. Generate a **Developer ID Application** certificate and export it as `.p12`.
3. In GitHub Secrets, configure:
   - `MAC_CSC_LINK`: Base64-encoded `.p12` certificate file.
   - `MAC_CSC_KEY_PASSWORD`: Certificate password.
   - `APPLE_ID`: Your Apple ID email address.
   - `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password generated at `appleid.apple.com`.
   - `APPLE_TEAM_ID`: 10-character Apple Developer Team ID.
4. The workflow in `.github/workflows/build.yml` will automatically sign and notarize `.dmg` and `.zip` artifacts when these secrets are present.

---

## 5. Safe Public Release Checklist

Before marking any release as public:

- [ ] **1. Run Full Local Verification Suite:**
  ```powershell
  npm test
  npm run typecheck
  npm run build
  ```
  Ensure all 42+ tests pass with zero errors.

- [ ] **2. Check Version Bump:**
  - Verify `version` in `package.json` corresponds to the intended release tag (e.g., `0.1.1`).
  - Update `docs/index.html` download links to point to the new tag.

- [ ] **3. Push Git Tag:**
  ```bash
  git tag -a v0.1.1 -m "Release v0.1.1: Security hardened cross-platform desktop release"
  git push origin v0.1.1
  ```

- [ ] **4. GitHub Actions Build:**
  - Observe `.github/workflows/build.yml` running across Windows, macOS, and Linux.
  - Verify that all three runner jobs complete successfully and produce the expected artifacts.

- [ ] **5. Review Draft Release:**
  - Attach the produced `.exe`, `.dmg`, `.zip`, `.AppImage`, and `.deb` files to the GitHub Release.
  - Generate SHA-256 checksums for each artifact and paste them into the release notes.

- [ ] **6. Final Human Approval:**
  - Manually install the `.exe` on a test Windows machine to verify clean launch and data persistence.
  - Click **Publish Release** in GitHub Releases only after explicit review and approval.
