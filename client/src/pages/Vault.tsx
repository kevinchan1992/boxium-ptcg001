/**
 * Vault — 虛擬倉庫頁
 * 顯示用戶抽到的所有卡牌，支援申請回購和出貨
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Package, Truck, RefreshCw, Loader2, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  in_vault: { label: "倉庫中", color: "bg-zinc-700 text-zinc-300" },
  buyback_requested: { label: "回購申請中", color: "bg-blue-500/20 text-blue-300" },
  buyback_approved: { label: "回購已批准", color: "bg-green-500/20 text-green-300" },
  shipping_requested: { label: "出貨申請中", color: "bg-yellow-500/20 text-yellow-300" },
  shipped: { label: "已出貨", color: "bg-purple-500/20 text-purple-300" },
};

const TIER_STYLES: Record<number, { border: string; glow: string; label: string }> = {
  1: { border: "border-purple-500/50", glow: "shadow-[0_0_15px_rgba(168,85,247,0.3)]", label: "🌈 Rainbow" },
  2: { border: "border-yellow-500/50", glow: "shadow-[0_0_12px_rgba(234,179,8,0.25)]", label: "🥇 Gold" },
  3: { border: "border-blue-500/40", glow: "shadow-[0_0_10px_rgba(59,130,246,0.2)]", label: "💙 Blue" },
};

export default function Vault() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [shippingVaultId, setShippingVaultId] = useState<number | null>(null);

  const { data: vaultItems, isLoading, refetch } = trpc.lootpool.vault.list.useQuery({ status: statusFilter as any });
  const { data: addresses } = trpc.grading.getMyShippingAddresses.useQuery();

  const buybackMutation = trpc.lootpool.vault.requestBuyback.useMutation({
    onSuccess: () => {
      toast.success("回購申請已提交！");
      refetch();
    },
    onError: (e) => toast.error(`申請失敗：${e.message}`),
  });

  const shippingMutation = trpc.lootpool.vault.requestShipping.useMutation({
    onSuccess: () => {
      toast.success("出貨申請已提交！");
      setShippingVaultId(null);
      refetch();
    },
    onError: (e) => toast.error(`申請失敗：${e.message}`),
  });

  const items = Array.isArray(vaultItems) ? vaultItems : [];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* 頂部 */}
      <div className="relative overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-zinc-800">
        <div className="relative max-w-5xl mx-auto px-4 py-6">
          <button onClick={() => navigate("/pools")}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> 返回福袋
          </button>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-yellow-400" /> 我的倉庫
          </h1>
          <p className="text-zinc-400 text-sm mt-1">管理你抽到的所有卡牌</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* 狀態篩選 */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[undefined, "in_vault", "buyback_requested", "shipping_requested", "shipped"].map((s) => (
            <button
              key={s ?? "all"}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                statusFilter === s
                  ? "bg-yellow-500 text-black"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {s === undefined ? "全部" : STATUS_LABELS[s]?.label ?? s}
            </button>
          ))}
        </div>

        {/* 卡牌列表 */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-zinc-900 rounded-xl h-48 animate-pulse border border-zinc-800" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-zinc-400">倉庫是空的</h2>
            <p className="text-zinc-500 mt-2 mb-6">去抽福袋獲得你的第一張卡牌吧！</p>
            <Button onClick={() => navigate("/pools")} className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold">
              前往福袋
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item: any) => {
              const tier = TIER_STYLES[item.effectTier] ?? TIER_STYLES[3];
              const statusInfo = STATUS_LABELS[item.status] ?? { label: item.status, color: "bg-zinc-700 text-zinc-300" };

              return (
                <Card key={item.id} className={`bg-zinc-900 border ${tier.border} ${tier.glow} overflow-hidden`}>
                  <CardContent className="p-0">
                    {/* 卡牌圖片 */}
                    <div className="h-32 bg-zinc-800 flex items-center justify-center relative">
                      {item.cardImageUrl ? (
                        <img src={item.cardImageUrl} alt={item.cardName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="text-4xl opacity-30">🃏</div>
                      )}
                      <div className="absolute top-2 right-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* 卡牌資訊 */}
                    <div className="p-3 space-y-2">
                      <div>
                        <div className="text-white text-sm font-semibold line-clamp-1">{item.cardName}</div>
                        <div className="text-zinc-400 text-xs">{tier.label}</div>
                        {item.poolTitle && <div className="text-zinc-500 text-xs line-clamp-1">{item.poolTitle}</div>}
                      </div>

                      {/* 操作按鈕 */}
                      {item.status === "in_vault" && (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => buybackMutation.mutate({ vaultId: item.id })}
                            disabled={buybackMutation.isPending}
                            className="flex-1 text-[10px] h-7 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                          >
                            {buybackMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                            回購
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setShippingVaultId(item.id)}
                            className="flex-1 text-[10px] h-7 bg-yellow-500 hover:bg-yellow-400 text-black"
                          >
                            <Truck className="w-3 h-3 mr-1" /> 出貨
                          </Button>
                        </div>
                      )}

                      {/* 里程碑獎品 */}
                      {item.isMilestone && item.milestoneCardName && (
                        <div className="text-xs text-green-400 bg-green-500/10 rounded px-2 py-1">
                          🎯 里程碑：{item.milestoneCardName}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 出貨地址選擇對話框 */}
      {shippingVaultId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-yellow-400" /> 選擇出貨地址
            </h3>
            {!addresses?.length ? (
              <div className="text-center py-6">
                <p className="text-zinc-400 text-sm mb-4">尚未設定收貨地址</p>
                <Button onClick={() => navigate("/profile?tab=addresses")} variant="outline" size="sm">
                  前往設定地址
                </Button>
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {addresses.map((addr: any) => (
                  <button
                    key={addr.id}
                    onClick={() => shippingMutation.mutate({ vaultId: shippingVaultId, shippingAddressId: addr.id })}
                    disabled={shippingMutation.isPending}
                    className="w-full text-left bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl p-3 transition-all"
                  >
                    <div className="text-white text-sm font-medium">{addr.name ?? addr.recipientName}</div>
                    <div className="text-zinc-400 text-xs mt-0.5">{addr.phone}</div>
                    <div className="text-zinc-400 text-xs">{addr.address ?? addr.addressLine1}</div>
                  </button>
                ))}
              </div>
            )}
            <Button variant="ghost" onClick={() => setShippingVaultId(null)} className="w-full text-zinc-400">
              取消
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
