/**
 * useVip — hook to read current user's VIP status
 * Uses trpc.auth.me which already includes vipPlan + vipExpiresAt
 */
import { trpc } from "@/lib/trpc";

export function useVip() {
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  const vipPlan = (user as any)?.vipPlan ?? "none";
  const vipExpiresAt = (user as any)?.vipExpiresAt
    ? new Date((user as any).vipExpiresAt)
    : null;

  const isVip =
    vipPlan !== "none" &&
    vipExpiresAt !== null &&
    vipExpiresAt > new Date();

  return {
    isVip,
    vipPlan,
    vipExpiresAt,
    isLoading,
    user,
  };
}
