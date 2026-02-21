import axios from 'axios';
import { ENV } from '../_core/env';
import * as db from '../db';
import { createSession } from './session';

// Google OAuth configuration
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USER_INFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';



/**
 * Generate Google OAuth authorization URL
 */
export function getGoogleAuthUrl(redirectUri: string, state?: string): string {
  const params = new URLSearchParams({
    client_id: ENV.googleClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });

  if (state) {
    params.append('state', state);
  }

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange Google authorization code for access token
 */
export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const response = await axios.post(GOOGLE_TOKEN_URL, {
    code,
    client_id: ENV.googleClientId,
    client_secret: ENV.googleClientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  return response.data;
}

/**
 * Get Google user info from access token
 */
export async function getGoogleUserInfo(accessToken: string) {
  const response = await axios.get(GOOGLE_USER_INFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
}

/**
 * Handle Google OAuth callback and create/login user
 */
export async function handleGoogleCallback(code: string, redirectUri: string): Promise<{ sessionToken: string; userId: number }> {
  // Exchange code for tokens
  const tokenData = await exchangeGoogleCode(code, redirectUri);
  const { access_token, refresh_token, expires_in } = tokenData;

  // Get user info
  const userInfo = await getGoogleUserInfo(access_token);
  const { id: googleId, email, name, picture } = userInfo;

  // Check if OAuth account exists
  let oauthAccount = await db.getOAuthAccount('google', googleId);

  let userId: number;

  if (oauthAccount) {
    // User exists, update OAuth tokens
    userId = oauthAccount.userId;
    await db.upsertOAuthAccount({
      userId,
      provider: 'google',
      providerAccountId: googleId,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : undefined,
    });
  } else {
    // Check if user with this email already exists
    let user = await db.getUserByEmail(email);

    if (user) {
      // Link OAuth account to existing user
      userId = user.id;
    } else {
      // Create new user
      userId = await db.createUser({
        email,
        name: name || null,
        avatar: picture || null,
        emailVerified: true, // Google OAuth emails are verified
        role: 'user',
      });
    }

    // Create OAuth account
    await db.upsertOAuthAccount({
      userId,
      provider: 'google',
      providerAccountId: googleId,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : undefined,
    });
  }

  // Update last signed in
  await db.updateUserLastSignedIn(userId);

  // Create session
  const sessionToken = await createSession(userId);

  return { sessionToken, userId };
}


