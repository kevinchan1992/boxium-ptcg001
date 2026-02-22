import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname;
  const isSecure = isSecureRequest(req);
  
  console.log("[Cookie] Request protocol:", req.protocol);
  console.log("[Cookie] x-forwarded-proto:", req.headers["x-forwarded-proto"]);
  console.log("[Cookie] isSecure:", isSecure);
  console.log("[Cookie] hostname:", req.hostname);
  console.log("[Cookie] host:", req.headers.host);
  
  // Don't set domain at all - let the browser handle it automatically
  // This is the most reliable approach for complex subdomain scenarios
  const options = {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    // Use secure in production (HTTPS), but allow HTTP for local development
    secure: isSecure,
  };
  
  console.log("[Cookie] Final options:", JSON.stringify(options));
  return options;
}
