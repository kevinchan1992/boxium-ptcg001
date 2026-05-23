import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Proxies CDN image URLs through our server to bypass hotlink protection.
 * Specifically handles cdn.snkrdunk.com which blocks direct browser requests.
 */
const PROXY_HOSTS = [
  "cdn.snkrdunk.com",
  "snkrdunk.com",
  "img.snkrdunk.com",
  "media.snkrdunk.com",
];

export function getProxiedImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const needsProxy = PROXY_HOSTS.some(
      h => parsed.hostname === h || parsed.hostname.endsWith("." + h)
    );
    if (needsProxy) {
      return `/api/img-proxy?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // not a valid URL, return as-is
  }
  return url;
}
