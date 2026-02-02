import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from environment variable.
 * Must be 32 bytes (64 hex characters).
 */
function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || !isValidKey(keyHex)) {
    throw new Error(
      "ENCRYPTION_KEY must be set and be 64 hex characters (32 bytes)"
    );
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Validates that a string is a valid 64-character hex string (32 bytes).
 */
export function isValidKey(key: string): boolean {
  if (typeof key !== "string" || key.length !== 64) {
    return false;
  }
  return /^[0-9a-fA-F]{64}$/.test(key);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns format: iv:authTag:ciphertext (all hex encoded)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts a ciphertext string that was encrypted with encrypt().
 * Expects format: iv:authTag:ciphertext (all hex encoded)
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText || typeof encryptedText !== "string") {
    throw new Error("Invalid encrypted text");
  }

  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted text format");
  }

  const [ivHex, authTagHex, ciphertext] = parts;

  if (!ivHex || !authTagHex || ciphertext === undefined) {
    throw new Error("Invalid encrypted text format");
  }

  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid IV length");
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid auth tag length");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
