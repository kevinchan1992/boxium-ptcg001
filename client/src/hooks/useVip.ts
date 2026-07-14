/**
 * useVip — hook to read current user's VIP status
 * Uses trpc.auth.me which already includes vipPlan + vipExpiresAt + role
 * Admin accounts are treated as permanent VIP (matching server-side isVipActive logic)
 */
import { trpc } from "@/lib/trpc";

export function useVip() {
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  const role = (user as any)?.role ?? "user";
  const vipPlan = (user as any)?.vipPlan ?? "none";
  const vipExpiresAt = (user as any)?.vipExpiresAt
    ? new Date((user as any).vipExpiresAt)
    : null;

  // Admin accounts have permanent VIP (mirrors server-side isVipActive)
  const isVip =
    role === "admin" ||
    (vipPlan !== "none" && vipExpiresAt !== null && vipExpiresAt > new Date());

  return {
    isVip,
    vipPlan,
    vipExpiresAt,
    isLoading,
    user,
  };
}
