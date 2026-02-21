import { COOKIE_NAME } from "@shared/const";
import type { Express, Request, Response } from "express";
import { handleGoogleCallback, handleFacebookCallback } from "../auth/oauth";

const SESSION_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Register OAuth callback routes for Google and Facebook
 */
export function registerOAuthRoutes(app: Express) {
  /**
   * Google OAuth callback
   */
  app.get("/api/oauth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code) {
      res.status(400).json({ error: "code is required" });
      return;
    }

    try {
      // Build redirect URI
      const redirectUri = `${req.protocol}://${req.get("host")}/api/oauth/google/callback`;

      // Handle Google OAuth callback
      const { sessionToken } = await handleGoogleCallback(code, redirectUri);

      // Set session cookie
      res.cookie(COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_COOKIE_MAX_AGE,
        path: '/',
      });

      // Redirect to home page or state URL
      const redirectUrl = state ? decodeURIComponent(state) : "/";
      res.redirect(302, redirectUrl);
    } catch (error) {
      console.error("[OAuth] Google callback failed", error);
      res.redirect(302, "/?error=google_oauth_failed");
    }
  });

  /**
   * Facebook OAuth callback
   */
  app.get("/api/oauth/facebook/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code) {
      res.status(400).json({ error: "code is required" });
      return;
    }

    try {
      // Build redirect URI
      const redirectUri = `${req.protocol}://${req.get("host")}/api/oauth/facebook/callback`;

      // Handle Facebook OAuth callback
      const { sessionToken } = await handleFacebookCallback(code, redirectUri);

      // Set session cookie
      res.cookie(COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_COOKIE_MAX_AGE,
        path: '/',
      });

      // Redirect to home page or state URL
      const redirectUrl = state ? decodeURIComponent(state) : "/";
      res.redirect(302, redirectUrl);
    } catch (error) {
      console.error("[OAuth] Facebook callback failed", error);
      res.redirect(302, "/?error=facebook_oauth_failed");
    }
  });
}
