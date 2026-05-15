import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { getDb } from "./db";
import { users } from "../drizzle/schema_new";
import type { User } from "../drizzle/schema_new";

/**
 * Generate a secure random email verification token
 */
export function generateEmailVerificationToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_EXPIRES_IN = "7d"; // 7 days

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): { id: number; email: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: number; email: string; role: string };
  } catch (error) {
    return null;
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * Requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export function isValidPassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: "密碼至少需要 8 個字符" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "密碼需要包含至少一個大寫字母" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "密碼需要包含至少一個小寫字母" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "密碼需要包含至少一個數字" };
  }
  return { valid: true };
}

/**
 * Register a new user with email and password
 */
export async function registerUser(
  email: string,
  password: string,
  name?: string
): Promise<{ success: boolean; user?: User; token?: string; error?: string; requiresEmailVerification?: boolean }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "數據庫連接失敗" };
  }
  
  // Validate email
  if (!isValidEmail(email)) {
    return { success: false, error: "無效的 email 格式" };
  }

  // Validate password
  const passwordValidation = isValidPassword(password);
  if (!passwordValidation.valid) {
    return { success: false, error: passwordValidation.message };
  }

  // Check if user already exists
  const existingUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const existingUser = existingUsers.length > 0 ? existingUsers[0] : null;

  if (existingUser) {
    return { success: false, error: "此 email 已被註冊" };
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Generate email verification token (valid for 24 hours)
  const emailVerificationToken = generateEmailVerificationToken();
  const emailVerificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Create user (NOT verified yet)
  const [newUser] = await db.insert(users).values({
    email,
    name: name || email.split("@")[0],
    passwordHash,
    loginMethod: "password",
    role: "user",
    emailVerified: false,
    emailVerificationToken,
    emailVerificationExpiry,
  });

  // Fetch the created user
  const createdUser = await db.select().from(users).where(eq(users.id, newUser.insertId)).limit(1);
  if (createdUser.length === 0) {
    return { success: false, error: "創建用戶失敗" };
  }

  // Send verification email (don't block registration)
  const newUserRecord = createdUser[0];
  if (newUserRecord.email) {
    import('./emailService').then(({ sendEmailVerificationEmail }) => {
      sendEmailVerificationEmail({
        userId: newUserRecord.id,
        userName: newUserRecord.name || newUserRecord.email!.split('@')[0],
        email: newUserRecord.email!,
        verificationToken: emailVerificationToken,
        siteUrl: 'https://boxium.asia',
      }).catch((err: Error) => console.error('[Auth] Failed to send verification email:', err));
    });
  }

  // Do NOT generate session token — user must verify email first
  return { success: true, user: createdUser[0], token: undefined, requiresEmailVerification: true };
}

/**
 * Login with email and password
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; token?: string; error?: string; requiresEmailVerification?: boolean }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "數據庫連接失敗" };
  }
  
  // Find user by email
  const userResults = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = userResults.length > 0 ? userResults[0] : null;

  if (!user) {
    return { success: false, error: "email 或密碼錯誤" };
  }

  // Check if user registered with password
  if (user.loginMethod !== "password" || !user.passwordHash) {
    return { success: false, error: "此帳號使用其他方式註冊，請使用對應的登入方式" };
  }

  // Verify password
  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    return { success: false, error: "email 或密碼錯誤" };
  }

  // Check if user is blocked
  if ((user as any).isBlocked) {
    const reason = (user as any).blockReason;
    return { success: false, error: reason ? `帳號已被封鎖：${reason}` : "帳號已被封鎖，請聯絡客服" };
  }

  // Check if email is verified (only for password-based accounts)
  if (!user.emailVerified) {
    return { success: false, error: "EMAIL_NOT_VERIFIED", requiresEmailVerification: true };
  }

  // Update last signed in
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

  // Generate token
  const token = generateToken(user);

  return { success: true, user, token };
}

/**
 * Find or create user from Google OAuth
 */
export async function findOrCreateGoogleUser(
  googleId: string,
  email: string,
  name?: string
): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "數據庫連接失敗" };
  }
  
  // Try to find user by googleId
  let user = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);

  if (user.length > 0) {
    // Check if user is blocked
    if ((user[0] as any).isBlocked) {
      const reason = (user[0] as any).blockReason;
      return { success: false, error: reason ? `帳號已被封鎖：${reason}` : "帳號已被封鎖，請聯絡客服" };
    }
    // Update last signed in
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user[0].id));
    const token = generateToken(user[0]);
    return { success: true, user: user[0], token };
  }

  // Try to find user by email
  user = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (user.length > 0) {
    // Check if user is blocked
    if ((user[0] as any).isBlocked) {
      const reason = (user[0] as any).blockReason;
      return { success: false, error: reason ? `帳號已被封鎖：${reason}` : "帳號已被封鎖，請聯絡客服" };
    }
    // Link Google account to existing user
    await db.update(users).set({ googleId, lastSignedIn: new Date() }).where(eq(users.id, user[0].id));
    const updatedUser = await db.select().from(users).where(eq(users.id, user[0].id)).limit(1);
    if (updatedUser.length === 0) {
      return { success: false, error: "更新用戶失敗" };
    }
    const token = generateToken(updatedUser[0]);
    return { success: true, user: updatedUser[0], token };
  }

  // Create new user
  const [newUser] = await db.insert(users).values({
    email,
    name: name || email.split("@")[0],
    googleId,
    loginMethod: "google",
    role: "user",
    emailVerified: true, // Google accounts are already verified
  });

  const createdUser = await db.select().from(users).where(eq(users.id, newUser.insertId)).limit(1);

  if (createdUser.length === 0) {
    return { success: false, error: "創建用戶失敗" };
  }

  const token = generateToken(createdUser[0]);

  // Send welcome email asynchronously for new Google users
  const googleNewUser = createdUser[0];
  if (googleNewUser.email) {
    import('./emailService').then(({ sendWelcomeEmail }) => {
      sendWelcomeEmail({
        userId: googleNewUser.id,
        userName: googleNewUser.name || googleNewUser.email!.split('@')[0],
        email: googleNewUser.email!,
        siteUrl: 'https://boxium.asia',
      }).catch((err: Error) => console.error('[Auth] Failed to send welcome email (Google):', err));
    });
  }

  return { success: true, user: createdUser[0], token };
}
