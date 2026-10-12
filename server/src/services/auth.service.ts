import Database from 'better-sqlite3';
import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { env } from '../config/env.js';
import { getDatabase, initMarketplaceTables } from '../db/database.js';
import {
  AccountProfileDTO,
  AuthResponseDTO,
  ShippingAddress,
  UserDTO,
  UserRole,
} from '../types/index.js';
import { Request, Response, NextFunction } from 'express';

export class AuthError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, code = 'AUTH_ERROR', statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

interface RawUserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: UserRole;
  full_name: string;
  phone: string;
  default_address: string | null;
  preferences: string;
  must_change_password: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface RawAuthSessionRow {
  id: string;
  token_hash: string;
  csrf_token: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: string;
  created_at: string;
}

export interface AuthenticatedRequest extends Request {
  authUser?: UserDTO;
  authSession?: {
    id: string;
    csrfToken: string;
    viaCookie: boolean;
  };
}

export function hashPassword(plainPassword: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(plainPassword, salt, 64).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const salt = parts[1];
    const keyHex = parts[2];
    const keyBuf = Buffer.from(keyHex, 'hex');
    const derivedBuf = scryptSync(plainPassword, salt, 64);
    if (keyBuf.length !== derivedBuf.length) return false;
    return timingSafeEqual(keyBuf, derivedBuf);
  } catch {
    return false;
  }
}

function hashSessionToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    const val = pair.slice(eqIdx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

export class AuthService {
  private db: Database.Database;
  private loginAttempts = new Map<string, { count: number; firstAttemptAt: number }>();

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
    initMarketplaceTables(this.db);
    this.bootstrapInitialAdmin();
  }

  /**
   * Server-side bootstrap of initial administrator account.
   * - In local development (when env.ENABLE_DEMO_ADMIN is true and NODE_ENV !== 'production'),
   *   creates the demo admin ('admin' / 'admin') with must_change_password = 1.
   * - In production, only creates an admin if ADMIN_BOOTSTRAP_PASSWORD is explicitly provided via env.
   * - Never stores or returns plaintext passwords.
   */
  public bootstrapInitialAdmin(): void {
    const isProd = (process.env.NODE_ENV || env.NODE_ENV) === 'production';
    let bootstrapUsername = (
      process.env.ADMIN_BOOTSTRAP_USERNAME ||
      env.ADMIN_BOOTSTRAP_USERNAME ||
      'admin'
    )
      .trim()
      .toLowerCase();
    let bootstrapPassword =
      process.env.ADMIN_BOOTSTRAP_PASSWORD !== undefined
        ? process.env.ADMIN_BOOTSTRAP_PASSWORD
        : env.ADMIN_BOOTSTRAP_PASSWORD;
    const bootstrapEmail =
      process.env.ADMIN_BOOTSTRAP_EMAIL ||
      env.ADMIN_BOOTSTRAP_EMAIL ||
      'admin@minishopping.local';

    const existingAdmin = this.db
      .prepare("SELECT id, username, password_hash, must_change_password FROM users WHERE role = 'admin' LIMIT 1")
      .get() as
      | { id: string; username: string; password_hash: string; must_change_password: number }
      | undefined;

    if (existingAdmin) {
      if (isProd && verifyPassword('admin', existingAdmin.password_hash)) {
        if (bootstrapPassword && bootstrapPassword !== 'admin' && bootstrapPassword.length >= 8) {
          const newHash = hashPassword(bootstrapPassword);
          const nowIso = new Date().toISOString();
          this.db
            .prepare(
              'UPDATE users SET username = ?, email = ?, password_hash = ?, must_change_password = 0, is_active = 1, updated_at = ? WHERE id = ?'
            )
            .run(bootstrapUsername, bootstrapEmail, newHash, nowIso, existingAdmin.id);
        } else {
          // Disable default demo admin credentials in production until a strong ADMIN_BOOTSTRAP_PASSWORD is provided
          this.db
            .prepare('UPDATE users SET is_active = 0 WHERE id = ?')
            .run(existingAdmin.id);
        }
      }
      return;
    }

    let mustChangePassword = 0;

    if (!bootstrapPassword || (isProd && bootstrapPassword === 'admin')) {
      if (!isProd && env.ENABLE_DEMO_ADMIN) {
        bootstrapUsername = 'admin';
        bootstrapPassword = 'admin';
        mustChangePassword = 1;
      } else {
        // Production without a non-default ADMIN_BOOTSTRAP_PASSWORD: do not create default demo credentials
        return;
      }
    }

    const nowIso = new Date().toISOString();
    const adminId = `usr_admin_${randomUUID().slice(0, 8)}`;
    const passwordHash = hashPassword(bootstrapPassword);

    try {
      this.db
        .prepare(
          `INSERT OR IGNORE INTO users (
            id, username, email, password_hash, role, full_name, phone,
            default_address, preferences, must_change_password, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'admin', 'Marketplace Administrator', '', NULL, '{}', ?, 1, ?, ?)`
        )
        .run(
          adminId,
          bootstrapUsername,
          bootstrapEmail,
          passwordHash,
          mustChangePassword,
          nowIso,
          nowIso
        );
    } catch {
      // Ignore if concurrent worker already seeded admin
    }
  }

  public clearRateLimits(): void {
    this.loginAttempts.clear();
  }

  private checkLoginRateLimit(key: string): void {
    const now = Date.now();
    const windowMs = env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000;
    const maxAttempts = env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || 5;

    const record = this.loginAttempts.get(key);
    if (!record) return;

    if (now - record.firstAttemptAt > windowMs) {
      this.loginAttempts.delete(key);
      return;
    }

    if (record.count >= maxAttempts) {
      throw new AuthError(
        'Too many failed login attempts. Please wait 15 minutes before trying again.',
        'RATE_LIMITED',
        429
      );
    }
  }

  private recordFailedLogin(key: string): void {
    const now = Date.now();
    const windowMs = env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000;
    const existing = this.loginAttempts.get(key);
    if (!existing || now - existing.firstAttemptAt > windowMs) {
      this.loginAttempts.set(key, { count: 1, firstAttemptAt: now });
    } else {
      existing.count += 1;
    }
  }

  private clearFailedLogin(key: string): void {
    this.loginAttempts.delete(key);
  }

  private mapRowToUserDTO(row: RawUserRow): UserDTO {
    let defaultAddress: ShippingAddress | null = null;
    if (row.default_address) {
      try {
        defaultAddress = JSON.parse(row.default_address);
      } catch {}
    }

    let preferences: AccountProfileDTO['preferences'] = {
      preferredCategories: [],
      priorityPreference: 'quality_performance',
    };
    try {
      const parsed = JSON.parse(row.preferences || '{}');
      preferences = {
        preferredCategories: Array.isArray(parsed.preferredCategories)
          ? parsed.preferredCategories
          : [],
        budgetCeiling:
          typeof parsed.budgetCeiling === 'number' ? parsed.budgetCeiling : undefined,
        priorityPreference: parsed.priorityPreference || 'quality_performance',
      };
    } catch {}

    return {
      id: row.id,
      username: row.username,
      email: row.email,
      role: row.role,
      fullName: row.full_name,
      phone: row.phone,
      defaultAddress,
      preferences,
      mustChangePassword: Boolean(row.must_change_password),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Registers a new customer account.
   * CRITICAL SECURITY REQUIREMENT: Newly registered accounts ALWAYS receive the 'customer' role,
   * regardless of any role field supplied by the caller.
   */
  public registerCustomer(input: {
    username: string;
    email: string;
    password: string;
    fullName?: string;
    phone?: string;
    ipAddress?: string;
    userAgent?: string;
  }): AuthResponseDTO {
    const username = (input.username || '').trim().toLowerCase();
    const email = (input.email || '').trim().toLowerCase();
    const password = input.password || '';
    const fullName = (input.fullName || '').trim();
    const phone = (input.phone || '').trim();

    if (!/^[a-z0-9_.-]{3,40}$/.test(username)) {
      throw new AuthError(
        'Username must be 3–40 characters and contain only letters, numbers, dots, hyphens, or underscores.',
        'INVALID_USERNAME',
        400
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AuthError(
        'A valid email address is required.',
        'INVALID_EMAIL',
        400
      );
    }

    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      throw new AuthError(
        'Password must be between 6 and 128 characters.',
        'WEAK_PASSWORD',
        400
      );
    }

    const existingUser = this.db
      .prepare('SELECT id, username, email FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?')
      .get(username, email) as { id: string; username: string; email: string } | undefined;

    if (existingUser) {
      throw new AuthError(
        existingUser.username.toLowerCase() === username
          ? `Username '${username}' is already taken.`
          : `Email '${email}' is already registered.`,
        'ACCOUNT_EXISTS',
        409
      );
    }

    const userId = `usr_${randomUUID().slice(0, 12)}`;
    const nowIso = new Date().toISOString();
    const passwordHash = hashPassword(password);

    // Role is hardcoded to 'customer' in SQL to prevent any privilege escalation on registration
    this.db
      .prepare(
        `INSERT INTO users (
          id, username, email, password_hash, role, full_name, phone,
          default_address, preferences, must_change_password, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'customer', ?, ?, NULL, '{}', 0, 1, ?, ?)`
      )
      .run(userId, username, email, passwordHash, fullName || username, phone, nowIso, nowIso);

    const createdRow = this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(userId) as RawUserRow;

    return this.createSessionForUser(createdRow, input.ipAddress, input.userAgent);
  }

  public login(input: {
    usernameOrEmail: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): AuthResponseDTO {
    const identifier = (input.usernameOrEmail || '').trim().toLowerCase();
    const password = input.password || '';

    if (!identifier || !password) {
      throw new AuthError(
        'Username/email and password are required.',
        'MISSING_CREDENTIALS',
        400
      );
    }

    const rateKey = `${input.ipAddress || 'local'}:${identifier}`;
    this.checkLoginRateLimit(rateKey);

    const row = this.db
      .prepare(
        'SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ? LIMIT 1'
      )
      .get(identifier, identifier) as RawUserRow | undefined;

    const isProd = (process.env.NODE_ENV || env.NODE_ENV) === 'production';
    if (isProd && row && row.role === 'admin' && password === 'admin') {
      this.recordFailedLogin(rateKey);
      throw new AuthError(
        'Default demo admin credentials are disabled in production. Configure ADMIN_BOOTSTRAP_PASSWORD to enable administrator access.',
        'DEMO_ADMIN_DISABLED',
        403
      );
    }

    if (!row || !row.is_active || !verifyPassword(password, row.password_hash)) {
      this.recordFailedLogin(rateKey);
      throw new AuthError(
        'Invalid username/email or password.',
        'INVALID_CREDENTIALS',
        401
      );
    }

    this.clearFailedLogin(rateKey);
    return this.createSessionForUser(row, input.ipAddress, input.userAgent);
  }

  private createSessionForUser(
    userRow: RawUserRow,
    ipAddress?: string,
    userAgent?: string
  ): AuthResponseDTO {
    const rawToken = `tok_${randomBytes(32).toString('hex')}`;
    const tokenHash = hashSessionToken(rawToken);
    const csrfToken = `csrf_${randomBytes(24).toString('hex')}`;
    const sessionId = `asess_${randomUUID().slice(0, 12)}`;
    const now = new Date();
    const ttlHours = Math.max(1, env.SESSION_TTL_HOURS || 168);
    const expiresAt = new Date(now.getTime() + ttlHours * 3600 * 1000).toISOString();

    this.db
      .prepare(
        `INSERT INTO auth_sessions (
          id, token_hash, csrf_token, user_id, ip_address, user_agent, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        sessionId,
        tokenHash,
        csrfToken,
        userRow.id,
        ipAddress || null,
        userAgent ? userAgent.slice(0, 250) : null,
        expiresAt,
        now.toISOString()
      );

    return {
      user: this.mapRowToUserDTO(userRow),
      token: rawToken,
      csrfToken,
      expiresAt,
    };
  }

  public validateSessionToken(rawToken: string | undefined): {
    user: UserDTO;
    sessionId: string;
    csrfToken: string;
  } | null {
    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 10) {
      return null;
    }

    const tokenHash = hashSessionToken(rawToken.trim());
    const sessionRow = this.db
      .prepare('SELECT * FROM auth_sessions WHERE token_hash = ?')
      .get(tokenHash) as RawAuthSessionRow | undefined;

    if (!sessionRow) return null;

    if (Date.parse(sessionRow.expires_at) <= Date.now()) {
      this.db.prepare('DELETE FROM auth_sessions WHERE id = ?').run(sessionRow.id);
      return null;
    }

    const userRow = this.db
      .prepare('SELECT * FROM users WHERE id = ? AND is_active = 1')
      .get(sessionRow.user_id) as RawUserRow | undefined;

    if (!userRow) return null;

    return {
      user: this.mapRowToUserDTO(userRow),
      sessionId: sessionRow.id,
      csrfToken: sessionRow.csrf_token,
    };
  }

  public logout(rawToken: string | undefined): void {
    if (!rawToken) return;
    const tokenHash = hashSessionToken(rawToken.trim());
    this.db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(tokenHash);
  }

  public getUserById(userId: string): UserDTO | null {
    const row = this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(userId) as RawUserRow | undefined;
    return row ? this.mapRowToUserDTO(row) : null;
  }

  public changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): UserDTO {
    if (!newPassword || newPassword.length < 6 || newPassword.length > 128) {
      throw new AuthError(
        'New password must be between 6 and 128 characters.',
        'WEAK_PASSWORD',
        400
      );
    }

    const row = this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(userId) as RawUserRow | undefined;

    if (!row) {
      throw new AuthError('User account not found.', 'USER_NOT_FOUND', 404);
    }

    if (!verifyPassword(currentPassword || '', row.password_hash)) {
      throw new AuthError(
        'Current password is incorrect.',
        'INVALID_CURRENT_PASSWORD',
        401
      );
    }

    const newHash = hashPassword(newPassword);
    const nowIso = new Date().toISOString();
    this.db
      .prepare(
        'UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?'
      )
      .run(newHash, nowIso, userId);

    return this.getUserById(userId)!;
  }

  /**
   * Updates a user's profile fields (fullName, email, phone, defaultAddress, preferences).
   * CRITICAL SECURITY REQUIREMENT: Never allows updating `role` or promoting a customer to admin.
   */
  public updateUserProfile(
    userId: string,
    input: {
      fullName?: string;
      email?: string;
      phone?: string;
      defaultAddress?: ShippingAddress | null;
      preferences?: Partial<AccountProfileDTO['preferences']>;
    }
  ): UserDTO {
    const existing = this.getUserById(userId);
    if (!existing) {
      throw new AuthError('User account not found.', 'USER_NOT_FOUND', 404);
    }

    const fullName =
      input.fullName !== undefined ? input.fullName.trim().slice(0, 120) : existing.fullName;
    const email =
      input.email !== undefined ? input.email.trim().toLowerCase().slice(0, 120) : existing.email;
    const phone =
      input.phone !== undefined ? input.phone.trim().slice(0, 25) : existing.phone;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AuthError('A valid email address is required.', 'INVALID_EMAIL', 400);
    }

    const defaultAddress =
      input.defaultAddress !== undefined ? input.defaultAddress : existing.defaultAddress;
    const preferences: AccountProfileDTO['preferences'] = {
      preferredCategories:
        input.preferences?.preferredCategories ?? existing.preferences.preferredCategories,
      budgetCeiling:
        input.preferences?.budgetCeiling !== undefined
          ? input.preferences.budgetCeiling
          : existing.preferences.budgetCeiling,
      priorityPreference:
        input.preferences?.priorityPreference ?? existing.preferences.priorityPreference,
    };

    const nowIso = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE users
         SET full_name = ?, email = ?, phone = ?, default_address = ?, preferences = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        fullName,
        email,
        phone,
        defaultAddress ? JSON.stringify(defaultAddress) : null,
        JSON.stringify(preferences),
        nowIso,
        userId
      );

    return this.getUserById(userId)!;
  }

  /**
   * Express middleware that populates req.authUser if a valid Bearer token or session cookie is present.
   * For state-changing requests authenticated solely via cookie, verifies X-CSRF-Token.
   */
  public authenticateMiddleware = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    const authHeader = req.headers.authorization;
    let rawToken: string | undefined;
    let viaCookie = false;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      rawToken = authHeader.slice('Bearer '.length).trim();
    } else {
      const cookies = parseCookies(req.headers.cookie);
      if (cookies[env.SESSION_COOKIE_NAME]) {
        rawToken = cookies[env.SESSION_COOKIE_NAME];
        viaCookie = true;
      }
    }

    if (!rawToken) {
      next();
      return;
    }

    const validated = this.validateSessionToken(rawToken);
    if (!validated) {
      next();
      return;
    }

    // CSRF protection for state-changing requests authenticated via browser cookie
    const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
      req.method.toUpperCase()
    );
    if (viaCookie && isStateChanging) {
      const csrfHeader = req.headers['x-csrf-token'];
      const providedCsrf = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;
      if (!providedCsrf || providedCsrf !== validated.csrfToken) {
        res.status(403).json({
          error: 'CSRF token validation failed for cookie-authenticated request.',
          code: 'CSRF_INVALID',
        });
        return;
      }
    }

    req.authUser = validated.user;
    req.authSession = {
      id: validated.sessionId,
      csrfToken: validated.csrfToken,
      viaCookie,
    };
    next();
  };

  public requireAuth = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    this.authenticateMiddleware(req, res, () => {
      if (!req.authUser) {
        res.status(401).json({
          error: 'Authentication required. Please log in to continue.',
          code: 'UNAUTHENTICATED',
        });
        return;
      }
      next();
    });
  };

  public requireAdmin = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    this.authenticateMiddleware(req, res, () => {
      if (!req.authUser) {
        res.status(401).json({
          error: 'Authentication required. Please log in as an administrator.',
          code: 'UNAUTHENTICATED',
        });
        return;
      }
      if (req.authUser.role !== 'admin') {
        res.status(403).json({
          error: 'Administrator privileges are required to perform this action.',
          code: 'FORBIDDEN_ADMIN_ONLY',
        });
        return;
      }
      next();
    });
  };
}
