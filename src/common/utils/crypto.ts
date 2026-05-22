import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const rawKey = process.env.ENCRYPTION_KEY;
const ENCRYPTION_KEY = (rawKey && rawKey !== 'undefined' && rawKey !== 'null')
  ? rawKey
  : '32byteencryptkeyforhosplymessage'; // Must be 32 bytes

export function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  if (!text) return '';
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    // If decryption fails, return placeholder indicating encryption mismatch
    return '[Encrypted PHI - Secure Decryption Failed]';
  }
}
