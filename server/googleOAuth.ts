import { Router, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { findOrCreateGoogleUser } from "./auth";
import { generateToken } from "./auth";
import { getSessionCookieOptions } from "./_core/cookies";

const router = Router();

// Initialize Google OAuth client
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = `${process.env.VITE_FRONTEND_FORGE_API_URL || 'http://localhost:3000'}/api/auth/google/callback`;

if (!googleClientId || !googleClientSecret) {
  console.warn('[Google OAuth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables');
}

const oauth2Client = googleClientId && googleClientSecret 
  ? new OAuth2Client(googleClientId, googleClientSecret, redirectUri)
  : null;

/**
 * Initiate Google OAuth flow
 * GET /api/auth/google
 */
router.get("/google", (req: Request, res: Response) => {
  if (!oauth2Client) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    // Store return path in state
    state: req.query.returnTo as string || '/',
  });

  res.redirect(authorizeUrl);
});

/**
 * Handle Google OAuth callback
 * GET /api/auth/google/callback
 */
router.get("/google/callback", async (req: Request, res: Response) => {
  if (!oauth2Client) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  const { code, state } = req.query;

  if (!code) {
    return res.redirect('/login?error=no_code');
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.redirect('/login?error=invalid_token');
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.redirect('/login?error=no_email');
    }

    // Find or create user (picture parameter not used in current implementation)
    const result = await findOrCreateGoogleUser(googleId, email, name);

    if (!result.success || !result.user) {
      return res.redirect('/login?error=user_creation_failed');
    }

    // Token is already generated in findOrCreateGoogleUser
    const token = result.token;

    // Set session cookie
    if (!token) {
      return res.redirect('/login?error=token_generation_failed');
    }
    res.cookie('session', token, getSessionCookieOptions(req));

    // Redirect to return path or home
    const returnTo = (state as string) || '/';
    res.redirect(returnTo);
  } catch (error: any) {
    console.error('[Google OAuth] Callback error:', error);
    res.redirect('/login?error=auth_failed');
  }
});

export default router;
