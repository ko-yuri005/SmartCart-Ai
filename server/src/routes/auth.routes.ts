import { Router, Response } from 'express';
import { env } from '../config/env.js';
import {
  AuthenticatedRequest,
  AuthError,
  AuthService,
  parseCookies,
} from '../services/auth.service.js';
import { CartOrderService } from '../services/cart-order.service.js';

export function createAuthRouter(
  authService: AuthService,
  cartOrderService?: CartOrderService
): Router {
  const router = Router();

  const setSessionCookie = (res: Response, token: string, expiresAt: string) => {
    const isProd = env.NODE_ENV === 'production';
    const maxAgeSec = Math.max(
      60,
      Math.floor((Date.parse(expiresAt) - Date.now()) / 1000)
    );
    const cookieParts = [
      `${env.SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${maxAgeSec}`,
    ];
    if (isProd) {
      cookieParts.push('Secure');
    }
    res.setHeader('Set-Cookie', cookieParts.join('; '));
  };

  const clearSessionCookie = (res: Response) => {
    res.setHeader(
      'Set-Cookie',
      `${env.SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
    );
  };

  const handleAuthError = (res: Response, error: unknown, defaultMsg: string) => {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
      return;
    }
    console.error('[AuthAPI] Unexpected error:', error);
    res.status(500).json({ error: defaultMsg });
  };

  /**
   * POST /api/auth/register
   * Registers a new customer account (always role = 'customer')
   */
  router.post('/auth/register', (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        username,
        email,
        password,
        fullName,
        phone,
        guestSessionId,
      } = req.body || {};

      const authRes = authService.registerCustomer({
        username,
        email,
        password,
        fullName,
        phone,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      setSessionCookie(res, authRes.token, authRes.expiresAt);

      if (cartOrderService && typeof guestSessionId === 'string' && guestSessionId.trim()) {
        try {
          authRes.mergedCart = cartOrderService.mergeGuestCartIntoUserCart(
            guestSessionId.trim(),
            guestSessionId.trim(),
            authRes.user.id
          );
        } catch {
          // Non-fatal if guest cart merge fails
        }
      }

      res.status(201).json(authRes);
    } catch (error) {
      handleAuthError(res, error, 'Failed to register customer account');
    }
  });

  /**
   * POST /api/auth/login
   * Authenticates customer or administrator and issues session cookie + token
   */
  router.post('/auth/login', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { usernameOrEmail, username, email, password, guestSessionId } =
        req.body || {};

      const authRes = authService.login({
        usernameOrEmail: usernameOrEmail || username || email || '',
        password,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      setSessionCookie(res, authRes.token, authRes.expiresAt);

      if (cartOrderService && typeof guestSessionId === 'string' && guestSessionId.trim()) {
        try {
          authRes.mergedCart = cartOrderService.mergeGuestCartIntoUserCart(
            guestSessionId.trim(),
            guestSessionId.trim(),
            authRes.user.id
          );
        } catch {
          // Non-fatal if guest cart merge fails
        }
      }

      res.json(authRes);
    } catch (error) {
      handleAuthError(res, error, 'Failed to sign in');
    }
  });

  /**
   * POST /api/auth/logout
   * Invalidates active session token and clears HttpOnly cookie
   */
  router.post('/auth/logout', (req: AuthenticatedRequest, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      let rawToken: string | undefined;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        rawToken = authHeader.slice('Bearer '.length).trim();
      } else {
        const cookies = parseCookies(req.headers.cookie);
        rawToken = cookies[env.SESSION_COOKIE_NAME];
      }

      authService.logout(rawToken);
      clearSessionCookie(res);
      res.json({ success: true });
    } catch (error) {
      handleAuthError(res, error, 'Failed to log out');
    }
  });

  /**
   * GET /api/auth/me
   * Returns current authenticated user (if signed in) or null
   */
  router.get('/auth/me', (req: AuthenticatedRequest, res: Response) => {
    res.json({
      user: req.authUser || null,
      csrfToken: req.authSession?.csrfToken || null,
    });
  });

  /**
   * POST /api/auth/change-password
   * Changes the signed-in user's password and clears mustChangePassword flag
   */
  router.post(
    '/auth/change-password',
    authService.requireAuth,
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { currentPassword, newPassword } = req.body || {};
        const updatedUser = authService.changePassword(
          req.authUser!.id,
          currentPassword,
          newPassword
        );
        res.json({ user: updatedUser });
      } catch (error) {
        handleAuthError(res, error, 'Failed to change password');
      }
    }
  );

  /**
   * PUT /api/auth/profile
   * Updates signed-in user's profile (never modifies role)
   */
  router.put(
    '/auth/profile',
    authService.requireAuth,
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { fullName, email, phone, defaultAddress, preferences } =
          req.body || {};
        const updatedUser = authService.updateUserProfile(req.authUser!.id, {
          fullName,
          email,
          phone,
          defaultAddress,
          preferences,
        });
        res.json({ user: updatedUser });
      } catch (error) {
        handleAuthError(res, error, 'Failed to update profile');
      }
    }
  );

  return router;
}
