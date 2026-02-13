import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a password with a hashed password
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(userId: number, username: string): string {
  const secret = process.env.JWT_SECRET || "fallback-secret-key";
  return jwt.sign(
    { userId, username },
    secret,
    { expiresIn: "7d" } // Token expires in 7 days
  );
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): { userId: number; username: string } | null {
  try {
    const secret = process.env.JWT_SECRET || "fallback-secret-key";
    const decoded = jwt.verify(token, secret) as { userId: number; username: string };
    return decoded;
  } catch (error) {
    return null;
  }
}
