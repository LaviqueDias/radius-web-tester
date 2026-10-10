import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Returns encryption key buffer from environment variable
 */
function getKey(keyHex?: string): Buffer {
  const hex = keyHex || process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes).');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypts a sensitive string (e.g. RADIUS shared secret) using AES-256-GCM
 */
export function encryptSecret(plainText: string, keyHex?: string): string {
  const key = getKey(keyHex);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a ciphertext encrypted by encryptSecret
 */
export function decryptSecret(cipherText: string, keyHex?: string): string {
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    throw new Error('Formato inválido de segredo criptografado.');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getKey(keyHex);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
