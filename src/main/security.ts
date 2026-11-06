import { safeStorage } from 'electron'
import { randomBytes, scryptSync, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve, normalize } from 'node:path'

const SCRYPT_KEY_LEN = 32
const AES_ALGORITHM = 'aes-256-gcm'
const IV_LEN = 16
const SALT_LEN = 16
const AUTH_TAG_LEN = 16

/**
 * Derives an encryption key from a passphrase and salt using scrypt KDF.
 */
function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, SCRYPT_KEY_LEN, { N: 16384, r: 8, p: 1 })
}

/**
 * Hashes a PIN using a salted scrypt KDF.
 */
export function hashPin(pin: string, existingSaltHex?: string): { hashHex: string; saltHex: string } {
  const salt = existingSaltHex ? Buffer.from(existingSaltHex, 'hex') : randomBytes(SALT_LEN)
  const derived = deriveKey(pin, salt)
  return {
    hashHex: derived.toString('hex'),
    saltHex: salt.toString('hex')
  }
}

/**
 * Verifies a provided PIN against stored salt and hash in constant time.
 */
export function verifyPin(pin: string, storedHashHex: string, storedSaltHex: string): boolean {
  try {
    const salt = Buffer.from(storedSaltHex, 'hex')
    const expectedHash = Buffer.from(storedHashHex, 'hex')
    const calculatedHash = deriveKey(pin, salt)
    if (calculatedHash.length !== expectedHash.length) return false
    return timingSafeEqual(calculatedHash, expectedHash)
  } catch {
    return false
  }
}

/**
 * Encrypts a sensitive string (e.g. personal notes) using Electron safeStorage
 * when available, or fallbacks to AES-256-GCM.
 */
export function encryptAtRest(plainText: string): string {
  if (!plainText) return ''
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = safeStorage.encryptString(plainText)
      return `safe:${buffer.toString('base64')}`
    }
  } catch (err) {
    console.warn('[Security] Electron safeStorage failed, using fallback encryption:', err)
  }

  // Fallback AES-256-GCM
  const salt = randomBytes(SALT_LEN)
  const key = deriveKey('hello11824-local-vault-key', salt)
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(AES_ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  const combined = Buffer.concat([salt, iv, tag, encrypted])
  return `aes:${combined.toString('base64')}`
}

/**
 * Decrypts a sensitive string previously encrypted by encryptAtRest.
 */
export function decryptAtRest(cipherTextWithPrefix: string): string {
  if (!cipherTextWithPrefix) return ''
  try {
    if (cipherTextWithPrefix.startsWith('safe:')) {
      const raw = Buffer.from(cipherTextWithPrefix.slice(5), 'base64')
      return safeStorage.decryptString(raw)
    }

    if (cipherTextWithPrefix.startsWith('aes:')) {
      const combined = Buffer.from(cipherTextWithPrefix.slice(4), 'base64')
      const salt = combined.subarray(0, SALT_LEN)
      const iv = combined.subarray(SALT_LEN, SALT_LEN + IV_LEN)
      const tag = combined.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + AUTH_TAG_LEN)
      const encrypted = combined.subarray(SALT_LEN + IV_LEN + AUTH_TAG_LEN)

      const key = deriveKey('hello11824-local-vault-key', salt)
      const decipher = createDecipheriv(AES_ALGORITHM, key, iv)
      decipher.setAuthTag(tag)
      return decipher.update(encrypted) + decipher.final('utf8')
    }

    // Unencrypted legacy plain text
    return cipherTextWithPrefix
  } catch (err) {
    console.error('[Security] Failed to decrypt data at rest:', err)
    return cipherTextWithPrefix
  }
}

/**
 * Exports data into a password-encrypted standalone file (.enc.json).
 */
export function exportEncryptedFile(data: unknown, passphrase: string, destinationPath: string): void {
  const jsonStr = JSON.stringify(data)
  const salt = randomBytes(SALT_LEN)
  const key = deriveKey(passphrase, salt)
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(AES_ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  const payload = {
    version: 1,
    format: 'hello11824-encrypted-backup',
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: tag.toString('hex'),
    cipherText: encrypted.toString('base64')
  }

  writeFileSync(destinationPath, JSON.stringify(payload, null, 2), 'utf8')
}

/**
 * Imports and decrypts a password-protected backup file.
 */
export function importEncryptedFile(filePath: string, passphrase: string): any {
  if (!existsSync(filePath)) {
    throw new Error('Encrypted backup file does not exist')
  }

  const raw = readFileSync(filePath, 'utf8')
  const payload = JSON.parse(raw)

  if (payload.format !== 'hello11824-encrypted-backup') {
    throw new Error('Invalid encrypted backup format')
  }

  const salt = Buffer.from(payload.salt, 'hex')
  const iv = Buffer.from(payload.iv, 'hex')
  const tag = Buffer.from(payload.authTag, 'hex')
  const encrypted = Buffer.from(payload.cipherText, 'base64')

  const key = deriveKey(passphrase, salt)
  const decipher = createDecipheriv(AES_ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  const decryptedText = decipher.update(encrypted) + decipher.final('utf8')
  return JSON.parse(decryptedText)
}

/**
 * Validates that a user-selected path does not attempt path traversal attacks.
 */
export function isPathSafe(targetPath: string, allowedParentDir?: string): boolean {
  const normalized = normalize(targetPath)
  if (normalized.includes('\0')) return false
  if (allowedParentDir) {
    const resolvedParent = resolve(allowedParentDir)
    const resolvedTarget = resolve(targetPath)
    return resolvedTarget.startsWith(resolvedParent)
  }
  return true
}

