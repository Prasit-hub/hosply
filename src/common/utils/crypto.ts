import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const rawKey = process.env.ENCRYPTION_KEY || '32byteencryptkeyforhosplymessage';
// Guarantee a perfect 32-byte key buffer using SHA-256 hashing
const KEY_BUFFER = crypto.createHash('sha256').update(rawKey).digest();

export function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  if (!text) return '';
  try {
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
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    // If decryption fails (e.g. key mismatch or legacy plain text), return the original text
    return text;
  }
}
