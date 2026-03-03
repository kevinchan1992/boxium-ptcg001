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
  const isSecure = isSecureRequest(req);

  console.log("[Cookie] Request protocol:", req.protocol);
  console.log("[Cookie] x-forwarded-proto:", req.headers["x-forwarded-proto"]);
  console.log("[Cookie] isSecure:", isSecure);
  console.log("[Cookie] hostname:", req.hostname);
  console.log("[Cookie] host:", req.headers.host);

  // When served over HTTPS (including Manus preview / production), use SameSite=None
  // so the cookie works in cross-origin iframe contexts (e.g. Manus preview panel).
  // SameSite=None REQUIRES Secure=true per the spec.
  // On plain HTTP (local dev without proxy) fall back to SameSite=Lax.
  const options: Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure"> = isSecure
    ? {
        httpOnly: true,
        path: "/",
        sameSite: "none" as const,
        secure: true,
      }
    : {
        httpOnly: true,
        path: "/",
        sameSite: "lax" as const,
        secure: false,
      };

  console.log("[Cookie] Final options:", JSON.stringify(options));
  return options;
}
