import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import * as db from '../db';
import { hashPassword, comparePassword, isValidEmail, isValidPassword } from '../auth/utils';
import { createSession, deleteSession, getUserBySession } from '../auth/session';
import { handleGoogleCallback, handleFacebookCallback, getGoogleAuthUrl, getFacebookAuthUrl } from '../auth/oauth';
import { COOKIE_NAME } from '@shared/const';

const SESSION_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Set session cookie
 */
function setSessionCookie(res: any, sessionToken: string) {
  res.cookie(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: '/',
  });
}

/**
 * Clear session cookie
 */
function clearSessionCookie(res: any) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export const authRouter = router({
  /**
   * Register with email and password
   */
  register: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { email, password, name } = input;

      // Validate email format
      if (!isValidEmail(email)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid email format',
        });
      }

      // Validate password strength
      if (!isValidPassword(password)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Password must be at least 8 characters and contain uppercase, lowercase, and numbers',
        });
      }

      // Check if user already exists
      const existingUser = await db.getUserByEmail(email);
      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'User with this email already exists',
        });
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const userId = await db.createUser({
        email,
        passwordHash,
        name: name || null,
        emailVerified: false,
        role: 'user',
      });

      // Create session
      const sessionToken = await createSession(userId);

      // Set session cookie
      setSessionCookie(ctx.res, sessionToken);

      return {
        success: true,
        userId,
      };
    }),

  /**
   * Login with email and password
   */
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { email, password } = input;

      // Get user by email
      const user = await db.getUserByEmail(email);
      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        });
      }

      // Check if user has a password (not OAuth-only user)
      if (!user.passwordHash) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This account uses OAuth login. Please use Google or Facebook to sign in.',
        });
      }

      // Verify password
      const isPasswordValid = await comparePassword(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        });
      }

      // Update last signed in
      await db.updateUserLastSignedIn(user.id);

      // Create session
      const sessionToken = await createSession(user.id);

      // Set session cookie
      setSessionCookie(ctx.res, sessionToken);

      return {
        success: true,
        userId: user.id,
      };
    }),

  /**
   * Logout
   */
  logout: publicProcedure
    .mutation(async ({ ctx }) => {
      // Get session token from cookie
      const sessionToken = ctx.req.cookies[COOKIE_NAME];

      if (sessionToken) {
        // Delete session from database
        await deleteSession(sessionToken);
      }

      // Clear session cookie
      clearSessionCookie(ctx.res);

      return {
        success: true,
      };
    }),

  /**
   * Get current user
   */
  me: publicProcedure
    .query(async ({ ctx }) => {
      // Get session token from cookie
      const sessionToken = ctx.req.cookies[COOKIE_NAME];

      if (!sessionToken) {
        return null;
      }

      // Get user by session
      const user = await getUserBySession(sessionToken);

      if (!user) {
        return null;
      }

      // Return user without sensitive data
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        emailVerified: user.emailVerified,
      };
    }),

  /**
   * Get Google OAuth URL
   */
  getGoogleAuthUrl: publicProcedure
    .input(z.object({
      redirectUri: z.string().url(),
      state: z.string().optional(),
    }))
    .query(({ input }) => {
      const url = getGoogleAuthUrl(input.redirectUri, input.state);
      return { url };
    }),

  /**
   * Handle Google OAuth callback
   */
  googleCallback: publicProcedure
    .input(z.object({
      code: z.string(),
      redirectUri: z.string().url(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { sessionToken, userId } = await handleGoogleCallback(input.code, input.redirectUri);

        // Set session cookie
        setSessionCookie(ctx.res, sessionToken);

        return {
          success: true,
          userId,
        };
      } catch (error: any) {
        console.error('[Auth] Google OAuth callback error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to authenticate with Google',
        });
      }
    }),

  /**
   * Get Facebook OAuth URL
   */
  getFacebookAuthUrl: publicProcedure
    .input(z.object({
      redirectUri: z.string().url(),
      state: z.string().optional(),
    }))
    .query(({ input }) => {
      const url = getFacebookAuthUrl(input.redirectUri, input.state);
      return { url };
    }),

  /**
   * Handle Facebook OAuth callback
   */
  facebookCallback: publicProcedure
    .input(z.object({
      code: z.string(),
      redirectUri: z.string().url(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { sessionToken, userId } = await handleFacebookCallback(input.code, input.redirectUri);

        // Set session cookie
        setSessionCookie(ctx.res, sessionToken);

        return {
          success: true,
          userId,
        };
      } catch (error: any) {
        console.error('[Auth] Facebook OAuth callback error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to authenticate with Facebook',
        });
      }
    }),
});
