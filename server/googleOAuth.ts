import { Router, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { findOrCreateGoogleUser } from "./auth";
import { generateToken } from "./auth";
import { getSessionCookieOptions } from "./_core/cookies";

const router = Router();

// Initialize Google OAuth client
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!googleClientId || !googleClientSecret) {
  console.warn('[Google OAuth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables');
}

// Helper function to create OAuth2Client with dynamic redirect URI
function createOAuth2Client(origin: string) {
  if (!googleClientId || !googleClientSecret) {
    return null;
  }
  const redirectUri = `${origin}/api/auth/google/callback`;
  return new OAuth2Client(googleClientId, googleClientSecret, redirectUri);
}

/**
 * Initiate Google OAuth flow
 * GET /api/auth/google
 */
router.get("/google", (req: Request, res: Response) => {
  // Get origin from request
  const origin = req.query.origin as string || `${req.protocol}://${req.get('host')}`;
  console.log('[Google OAuth] Initiating OAuth flow');
  console.log('[Google OAuth] Origin from query:', req.query.origin);
  console.log('[Google OAuth] Fallback origin:', `${req.protocol}://${req.get('host')}`);
  console.log('[Google OAuth] Final origin:', origin);
  const oauth2Client = createOAuth2Client(origin);
  
  if (!oauth2Client) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  const redirectUri = `${origin}/api/auth/google/callback`;
  console.log('[Google OAuth] Redirect URI:', redirectUri);
  
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    // Store origin and return path in state
    state: JSON.stringify({
      origin,
      returnTo: req.query.returnTo as string || '/'
    }),
  });

  res.redirect(authorizeUrl);
});

/**
 * Handle Google OAuth callback
 * GET /api/auth/google/callback
 */
router.get("/google/callback", async (req: Request, res: Response) => {
  try {
    // Parse state to get origin and returnTo
    const stateParam = req.query.state as string;
    let origin = `${req.protocol}://${req.get('host')}`;
    let returnTo = '/';
    
    if (stateParam) {
      try {
        const parsed = JSON.parse(stateParam);
        origin = parsed.origin || origin;
        returnTo = parsed.returnTo || returnTo;
      } catch (e) {
        // If state is not JSON, treat it as returnTo path
        returnTo = stateParam;
      }
    }
    
    const oauth2Client = createOAuth2Client(origin);
    if (!oauth2Client) {
      return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    const { code } = req.query;

    if (!code) {
      return res.redirect(`${origin}/login?error=no_code`);
    }

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
      return res.redirect(`${origin}/login?error=invalid_token`);
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.redirect(`${origin}/login?error=no_email`);
    }

    // Find or create user (picture parameter not used in current implementation)
    const result = await findOrCreateGoogleUser(googleId, email, name);

    if (!result.success || !result.user) {
      return res.redirect(`${origin}/login?error=user_creation_failed`);
    }

    // Token is already generated in findOrCreateGoogleUser
    const token = result.token;

    // Set session cookie
    if (!token) {
      return res.redirect(`${origin}/login?error=token_generation_failed`);
    }
    res.cookie('session', token, getSessionCookieOptions(req));

    // Redirect to return path or home
    res.redirect(`${origin}${returnTo}`);
  } catch (error: any) {
    console.error('[Google OAuth] Callback error:', error);
    const origin = `${req.protocol}://${req.get('host')}`;
    res.redirect(`${origin}/login?error=auth_failed`);
  }
});

export default router;
