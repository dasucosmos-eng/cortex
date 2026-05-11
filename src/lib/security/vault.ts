// ============================================================
// AI Browser Memory Extension — Encryption Vault
// ============================================================
// Provides AES-256-GCM encryption / decryption for storing
// sensitive vault items.  In production the key would be
// persisted in the OS keychain or a KMS; this implementation
// keeps it in-memory for the lifetime of the server process.
// ============================================================

import crypto from "crypto";

// --------------- Types ---------------

export interface EncryptedPayload {
  encryptedData: string;
  iv: string;
  authTag: string;
}

// --------------- Module State ---------------

let encryptionKey: Buffer | null = null;

// --------------- Key Management ---------------

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // bytes — AES-256
const IV_LENGTH = 12; // bytes — recommended for GCM
const AUTH_TAG_LENGTH = 16; // bytes — GCM default

/**
 * Generate a cryptographically secure random AES-256 key.
 */
export function generateKey(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Return the cached encryption key, generating one lazily
 * on first access.
 *
 * The key lives only in process memory.  In a production
 * deployment, replace this with OS keychain / Vault / KMS.
 */
export function getEncryptionKey(): Buffer {
  if (encryptionKey) return encryptionKey;
  encryptionKey = generateKey();
  return encryptionKey;
}

/**
 * Replace the current encryption key.  **All previously
 * encrypted data will become undecryptable.**
 */
export function setEncryptionKey(key: Buffer): void {
  encryptionKey = key;
}

// --------------- Encryption ---------------

/**
 * Encrypt `plaintext` with AES-256-GCM.
 *
 * Returns hex-encoded `{ encryptedData, iv, authTag }` suitable
 * for storage in the database.
 *
 * @throws {Error} if plaintext is empty
 */
export function encrypt(plaintext: string): EncryptedPayload {
  if (!plaintext || plaintext.length === 0) {
    throw new Error("Cannot encrypt an empty string");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    encryptedData: encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

// --------------- Decryption ---------------

/**
 * Decrypt ciphertext that was produced by `encrypt()`.
 *
 * @param encryptedData - hex-encoded ciphertext
 * @param iv           - hex-encoded 12-byte IV
 * @param authTag      - hex-encoded 16-byte GCM auth tag
 * @throws {Error} on invalid input, wrong key, or tampered data
 */
export function decrypt(
  encryptedData: string,
  iv: string,
  authTag: string
): string {
  if (!encryptedData || !iv || !authTag) {
    throw new Error("encryptedData, iv, and authTag are all required");
  }

  const key = getEncryptionKey();

  const ivBuf = Buffer.from(iv, "hex");
  const authTagBuf = Buffer.from(authTag, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuf);
  decipher.setAuthTag(authTagBuf);

  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// --------------- Utility ---------------

/**
 * Validate that a set of vault fields look structurally
 * correct (hex strings of expected lengths).  Does *not*
 * attempt to decrypt — just checks format.
 */
export function isValidPayload(payload: {
  encryptedData: string;
  iv: string;
  authTag: string;
}): boolean {
  const { encryptedData, iv, authTag } = payload;

  if (!encryptedData || !iv || !authTag) return false;

  // hex-encoded IV should decode to 12 bytes → 24 hex chars
  if (!/^[0-9a-f]{24}$/i.test(iv)) return false;

  // hex-encoded auth tag should decode to 16 bytes → 32 hex chars
  if (!/^[0-9a-f]{32}$/i.test(authTag)) return false;

  // encryptedData must be valid hex
  if (!/^[0-9a-f]+$/i.test(encryptedData)) return false;

  return true;
}
