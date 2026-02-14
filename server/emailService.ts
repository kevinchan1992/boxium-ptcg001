import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import * as db from "./db";

// Email configuration will be loaded from database

let transporter: Transporter | null = null;

/**
 * Initialize email transporter
 */
async function getTransporter(): Promise<Transporter> {
  // Load SMTP settings from database
  const smtpHost = await db.getSystemSetting("smtp_host");
  const smtpPort = await db.getSystemSetting("smtp_port");
  const smtpUser = await db.getSystemSetting("smtp_user");
  const smtpPass = await db.getSystemSetting("smtp_pass");

  const SMTP_HOST = smtpHost?.settingValue || "smtp.gmail.com";
  const SMTP_PORT = parseInt(smtpPort?.settingValue || "587");
  const SMTP_USER = smtpUser?.settingValue || "";
  const SMTP_PASS = smtpPass?.settingValue || "";

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return transporter;
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  username: string
): Promise<boolean> {
  // Load SMTP settings from database
  const smtpUser = await db.getSystemSetting("smtp_user");
  const smtpPass = await db.getSystemSetting("smtp_pass");
  const fromEmail = await db.getSystemSetting("from_email");
  const fromName = await db.getSystemSetting("from_name");

  const SMTP_USER = smtpUser?.settingValue || "";
  const SMTP_PASS = smtpPass?.settingValue || "";
  const FROM_EMAIL = fromEmail?.settingValue || "noreply@boxium.com";
  const FROM_NAME = fromName?.settingValue || "BOXIUM PTCG";

  // Check if SMTP is configured
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn("[Email] SMTP not configured, skipping email send");
    console.log(`[Email] Password reset token for ${email}: ${resetToken}`);
    return false;
  }

  try {
    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: email,
      subject: "重置您的 BOXIUM PTCG 密碼",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #06038d;">重置密碼</h2>
          <p>親愛的 ${username}，</p>
          <p>我們收到了您的密碼重置請求。請點擊下方按鈕重置您的密碼：</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #06038d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              重置密碼
            </a>
          </div>
          <p>或者複製以下連結到瀏覽器：</p>
          <p style="color: #666; word-break: break-all;">${resetUrl}</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            此連結將在 1 小時後過期。如果您沒有請求重置密碼，請忽略此郵件。
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            © 2026 BOXIUM PTCG. All rights reserved.
          </p>
        </div>
      `,
    };

    const transporter = await getTransporter();
    await transporter.sendMail(mailOptions);
    console.log(`[Email] Password reset email sent to ${email}`);
    return true;
  } catch (error) {
    console.error("[Email] Failed to send password reset email:", error);
    return false;
  }
}

/**
 * Generate a secure random token
 */
export function generateResetToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
