import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const rawKey = process.env.ENCRYPTION_KEY || 'b495b76a3b357ecdd22e9f8837b7948f8a3bc83a42dc4cadd16b44c35ca6f92e';
// Guarantee a perfect 32-byte key buffer using SHA-256 hashing
const KEY_BUFFER = crypto.createHash('sha256').update(rawKey).digest();

// Known previous/legacy encryption keys for backward compatibility & key rotation
const LEGACY_KEYS = [
  '32byteencryptkeyforhosplymessage',
].map(k => crypto.createHash('sha256').update(k).digest());

export function encrypt(text: string): string {
  if (!text) return '';
  
  // Prevent double-encryption: if text is already an encrypted payload (iv:ciphertext),
  // decrypt it first so we always encrypt clean plaintext with the current active key.
  const parts = text.split(':');
  if (parts.length === 2 && /^[0-9a-fA-F]{32}$/.test(parts[0]) && /^[0-9a-fA-F]+$/.test(parts[1])) {
    const decrypted = decrypt(text);
    if (decrypted !== text) {
      text = decrypted;
    }
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  if (!text) return '';
  const textParts = text.split(':');
  // If it does not have the colon separator, it is plain text, return directly
  if (textParts.length < 2) {
    return text;
  }
  
  const ivHex = textParts.shift()!;
  const encryptedHex = textParts.join(':');
  
  // Check if parts are valid hex strings to prevent false deciphering on colon-containing plain text
  const hexRegex = /^[0-9a-fA-F]+$/;
  if (!hexRegex.test(ivHex) || !hexRegex.test(encryptedHex)) {
    return text;
  }

  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');

  // 1. Try with current primary KEY_BUFFER
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    // Primary key failed, try legacy keys
  }

  // 2. Try with legacy keys
  for (const legacyKey of LEGACY_KEYS) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, legacyKey, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch {
      // Continue to next legacy key
    }
  }

  // 3. Fallback: return text as-is
  return text;
}
