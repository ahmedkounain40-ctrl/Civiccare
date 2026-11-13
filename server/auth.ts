import crypto from 'node:crypto';
import type { Request } from 'express';
import { db } from './db.ts';

export interface AdminUserRow {
  id: number;
  email: string;
  password_hash: string;
  session_version: number;
  created_at: string;
  updated_at: string;
}

const SCRYPT_KEYLEN = 64;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000;

const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

export function hashPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainPassword, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(plainPassword, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function getSessionSecret(): string {
  const envSecret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }
  const row = db
    .prepare("SELECT value FROM admin_settings WHERE key = 'session_secret'")
    .get() as { value: string } | undefined;
  if (row?.value) {
    return row.value;
  }
  const generated = crypto.randomBytes(32).toString('hex');
  db.prepare("INSERT OR REPLACE INTO admin_settings (key, value) VALUES ('session_secret', ?)").run(
    generated
  );
  return generated;
}

export function createAdminSessionToken(admin: AdminUserRow): string {
  const secret = getSessionSecret();
  const payload = Buffer.from(
    JSON.stringify({
      uid: admin.id,
      email: admin.email,
      sv: admin.session_version,
      iat: Date.now(),
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAdminSessionToken(token: string | undefined): AdminUserRow | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;

  const secret = getSessionSecret();
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid?: number;
      email?: string;
      sv?: number;
      iat?: number;
    };
    if (!decoded.uid || !decoded.email || !decoded.iat || typeof decoded.sv !== 'number') {
      return null;
    }
    if (Date.now() - decoded.iat > SESSION_TTL_MS) {
      return null;
    }

    const admin = db
      .prepare('SELECT * FROM admin_users WHERE id = ? AND LOWER(email) = LOWER(?)')
      .get(decoded.uid, decoded.email) as AdminUserRow | undefined;

    if (!admin || admin.session_version !== decoded.sv) {
      return null;
    }
    return admin;
  } catch {
    return null;
  }
}

export function isAdminConfigured(): boolean {
  const row = db.prepare('SELECT COUNT(*) AS count FROM admin_users').get() as { count: number };
  return row.count > 0;
}

export function syncAdminFromEnvironment(): void {
  const envEmail = (process.env.ADMIN_EMAIL || 'ahmedkounain40@gmail.com').trim().toLowerCase();
  const envHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  const envPassword = process.env.ADMIN_PASSWORD;

  if (!envHash && !envPassword) {
    return;
  }

  const finalHash =
    envHash && envHash.startsWith('scrypt$') ? envHash : hashPassword(String(envPassword));

  const nowIso = new Date().toISOString();
  const existing = db
    .prepare('SELECT * FROM admin_users WHERE LOWER(email) = LOWER(?)')
    .get(envEmail) as AdminUserRow | undefined;

  if (existing) {
    // Only update if env password changed relative to stored hash
    if (envPassword && !verifyPassword(envPassword, existing.password_hash)) {
      db.prepare(
        'UPDATE admin_users SET password_hash = ?, session_version = session_version + 1, updated_at = ? WHERE id = ?'
      ).run(finalHash, nowIso, existing.id);
    } else if (envHash && envHash !== existing.password_hash) {
      db.prepare(
        'UPDATE admin_users SET password_hash = ?, session_version = session_version + 1, updated_at = ? WHERE id = ?'
      ).run(finalHash, nowIso, existing.id);
    }
  } else {
    db.prepare(
      'INSERT INTO admin_users (email, password_hash, session_version, created_at, updated_at) VALUES (?, ?, 1, ?, ?)'
    ).run(envEmail, finalHash, nowIso, nowIso);
  }
}

export function getRateLimitKey(req: Request, email: string): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `${ip}::${email.toLowerCase()}`;
}

export function checkLoginRateLimit(key: string): { allowed: boolean; retryAfterSec: number } {
  const entry = failedAttempts.get(key);
  if (!entry) return { allowed: true, retryAfterSec: 0 };
  if (entry.lockedUntil > Date.now()) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((entry.lockedUntil - Date.now()) / 1000),
    };
  }
  if (entry.lockedUntil > 0 && entry.lockedUntil <= Date.now()) {
    failedAttempts.delete(key);
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function recordFailedLogin(key: string): void {
  const prev = failedAttempts.get(key) || { count: 0, lockedUntil: 0 };
  const nextCount = prev.count + 1;
  if (nextCount >= MAX_LOGIN_ATTEMPTS) {
    failedAttempts.set(key, { count: nextCount, lockedUntil: Date.now() + LOCKOUT_MS });
  } else {
    failedAttempts.set(key, { count: nextCount, lockedUntil: 0 });
  }
}

export function clearFailedLogins(key: string): void {
  failedAttempts.delete(key);
}
