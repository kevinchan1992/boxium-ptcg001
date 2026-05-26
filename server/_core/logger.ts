/**
 * Lightweight structured logger for server-side use.
 *
 * In production (NODE_ENV=production), only warn/error are emitted.
 * In development, all levels are emitted.
 *
 * Usage:
 *   import { logger } from "./_core/logger";
 *   logger.info("[Scraper] Starting batch update");
 *   logger.warn("[Auth] Token near expiry");
 *   logger.error("[DB] Query failed", err);
 */

const isDev = process.env.NODE_ENV !== "production";

function formatMsg(level: string, msg: string, ...args: unknown[]): void {
  const ts = new Date().toISOString();
  const extra = args.length ? " " + args.map((a) => (a instanceof Error ? a.stack ?? a.message : JSON.stringify(a))).join(" ") : "";
  // eslint-disable-next-line no-console
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(`[${ts}] [${level.toUpperCase()}] ${msg}${extra}`);
}

export const logger = {
  /** Verbose debug – suppressed in production */
  debug(msg: string, ...args: unknown[]): void {
    if (isDev) formatMsg("debug", msg, ...args);
  },
  /** Informational – suppressed in production */
  info(msg: string, ...args: unknown[]): void {
    if (isDev) formatMsg("info", msg, ...args);
  },
  /** Warnings – always emitted */
  warn(msg: string, ...args: unknown[]): void {
    formatMsg("warn", msg, ...args);
  },
  /** Errors – always emitted */
  error(msg: string, ...args: unknown[]): void {
    formatMsg("error", msg, ...args);
  },
};
