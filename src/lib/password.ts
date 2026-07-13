import crypto from 'crypto';

const HASH_COST_FACTOR = 12;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 10000 + HASH_COST_FACTOR * 1000, 64, 'sha256')
    .toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash.includes(':')) {
    return false;
  }

  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto
    .pbkdf2Sync(password, salt, 10000 + HASH_COST_FACTOR * 1000, 64, 'sha256')
    .toString('hex');

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verifyHash));
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
