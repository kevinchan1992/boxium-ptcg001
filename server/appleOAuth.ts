/**
 * Sign in with Apple — OAuth 2.0 / OIDC flow
 *
 * Apple uses a slightly non-standard OIDC flow:
 *   1. Frontend redirects to Apple's authorization endpoint with a client_secret JWT
 *   2. Apple POSTs back to /api/auth/apple/callback with code + id_token
 *   3. We verify the id_token against Apple's public keys (JWKS)
 *   4. Extract user info and find-or-create the user in our DB
 *
 * Required environment variables:
 *   APPLE_CLIENT_ID   — Service ID (e.g. com.boxium.ptcg.web)
 *   APPLE_TEAM_ID     — 10-char Team ID (e.g. L2C86D5CU2)
 *   APPLE_KEY_ID      — Key ID from Apple Developer Console
 *   APPLE_PRIVATE_KEY — Contents of the .p8 file (newlines as \n)
 */

import { Router, Request, Response } from "express";
import * as jose from "jose";
import { findOrCreateAppleUser } from "./auth";
import { getSessionCookieOptions } from "./_core/cookies";

const router = Router();

const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
const APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY;

const APPLE_AUTH_URL = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";

function isConfigured(): boolean {
  return !!(APPLE_CLIENT_ID && APPLE_TEAM_ID && APPLE_KEY_ID && APPLE_PRIVATE_KEY);
}

/**
 * Generate a client_secret JWT for Apple OAuth
 * Apple requires a signed JWT as the client_secret (not a static string)
 */
async function generateClientSecret(origin: string): Promise<string> {
  if (!APPLE_PRIVATE_KEY || !APPLE_TEAM_ID || APPLE_KEY_ID === undefined || !APPLE_CLIENT_ID) {
    throw new Error("Apple OAuth not configured");
  }

  // Apple private key is stored with literal \n — convert to real newlines
  const privateKeyPem = APPLE_PRIVATE_KEY.replace(/\\n/g, "\n");

  const privateKey = await jose.importPKCS8(privateKeyPem, "ES256");

  const now = Math.floor(Date.now() / 1000);
  const clientSecret = await new jose.SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: APPLE_KEY_ID })
    .setIssuer(APPLE_TEAM_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + 15777000) // 6 months max
    .setAudience("https://appleid.apple.com")
    .setSubject(APPLE_CLIENT_ID)
    .sign(privateKey);

  return clientSecret;
}

/**
 * Verify Apple id_token and extract user info
 */
async function verifyAppleToken(idToken: string, clientId: string): Promise<{
  sub: string;
  email?: string;
  emailVerified?: boolean;
}> {
  const JWKS = jose.createRemoteJWKSet(new URL(APPLE_JWKS_URL));

  const { payload } = await jose.jwtVerify(idToken, JWKS, {
    issuer: "https://appleid.apple.com",
    audience: clientId,
  });

  return {
    sub: payload.sub as string,
    email: payload.email as string | undefined,
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
  };
}

/**
 * GET /api/auth/apple
 * Initiates the Sign in with Apple flow
 */
router.get("/apple", async (req: Request, res: Response) => {
  if (!isConfigured()) {
    return res.status(503).json({ error: "Sign in with Apple is not configured" });
  }

  const origin = (req.query.origin as string) || `${req.protocol}://${req.get("host")}`;
  const returnTo = (req.query.returnTo as string) || "/";

  const redirectUri = `${origin}/api/auth/apple/callback`;

  // State encodes origin + returnTo so the callback can redirect correctly
  const state = Buffer.from(JSON.stringify({ origin, returnTo })).toString("base64url");

  const params = new URLSearchParams({
    response_type: "code id_token",
    response_mode: "form_post", // Apple POSTs to callback
    client_id: APPLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope: "name email",
    state,
  });

  res.redirect(`${APPLE_AUTH_URL}?${params.toString()}`);
});

/**
 * POST /api/auth/apple/callback
 * Apple POSTs here after user authorizes (response_mode: form_post)
 */
router.post("/apple/callback", async (req: Request, res: Response) => {
  let origin = `${req.protocol}://${req.get("host")}`;
  let returnTo = "/";

  try {
    // Decode state
    const stateParam = req.body.state as string | undefined;
    if (stateParam) {
      try {
        const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString("utf-8"));
        origin = decoded.origin || origin;
        returnTo = decoded.returnTo || returnTo;
      } catch {
        // ignore malformed state
      }
    }

    const { code, id_token: idToken, error } = req.body;

    if (error) {
      console.error("[Apple OAuth] Authorization error:", error);
      return res.redirect(`${origin}/login?error=apple_denied`);
    }

    if (!code || !idToken) {
      return res.redirect(`${origin}/login?error=apple_no_code`);
    }

    if (!isConfigured()) {
      return res.redirect(`${origin}/login?error=apple_not_configured`);
    }

    // Verify the id_token
    const payload = await verifyAppleToken(idToken, APPLE_CLIENT_ID!);
    const { sub: appleId, email } = payload;

    if (!appleId) {
      return res.redirect(`${origin}/login?error=apple_invalid_token`);
    }

    // Apple only sends user name on FIRST sign-in — extract from form_post body
    let name: string | undefined;
    if (req.body.user) {
      try {
        const userObj = JSON.parse(req.body.user);
        const firstName = userObj?.name?.firstName || "";
        const lastName = userObj?.name?.lastName || "";
        name = [firstName, lastName].filter(Boolean).join(" ") || undefined;
      } catch {
        // ignore
      }
    }

    // Find or create user
    const result = await findOrCreateAppleUser(appleId, email, name);

    if (!result.success || !result.user || !result.token) {
      if (result.error?.includes("封鎖")) {
        const encodedMsg = encodeURIComponent(result.error);
        return res.redirect(`${origin}/login?error=blocked&message=${encodedMsg}`);
      }
      return res.redirect(`${origin}/login?error=apple_user_creation_failed`);
    }

    // Set session cookie
    res.cookie("session", result.token, getSessionCookieOptions(req));
    res.redirect(`${origin}${returnTo}`);
  } catch (err: any) {
    console.error("[Apple OAuth] Callback error:", err);
    res.redirect(`${origin}/login?error=apple_auth_failed`);
  }
});

export default router;
