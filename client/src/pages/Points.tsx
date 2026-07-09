/**
 * Points — 點數儲值頁
 * 顯示餘額、儲值套餐、交易紀錄
 */
import { useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Zap, CreditCard, History, ArrowUpRight, Loader2, Gift } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  topup: "儲值",
  draw: "抽卡",
  buyback: "回購",
  refund: "退款",
  admin_grant: "管理員贈送",
};

const TYPE_COLORS: Record<string, string> = {
  topup: "text-green-400",
  draw: "text-red-400",
  buyback: "text-blue-400",
  refund: "text-yellow-400",
  admin_grant: "text-purple-400",
};

export default function Points() {
  const [location] = useLocation();
  const { data: balanceData, isLoading: balanceLoading, refetch: refetchBalance } = trpc.points.getBalance.useQuery();
  const { data: txData, isLoading: txLoading } = trpc.points.getTransactions.useQuery({ limit: 20, offset: 0 });
  const { data: packages } = trpc.points.getTopupPackages.useQuery();

  const topupMutation = trpc.points.createTopupCheckout.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e) => toast.error(`儲值失敗：${e.message}`),
  });

  // 處理 Stripe 回調
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("topup") === "success") {
      toast.success("儲值成功！點數已入帳");
      refetchBalance();
      window.history.replaceState({}, "", "/points");
    } else if (params.get("topup") === "cancel") {
      toast.info("儲值已取消");
      window.history.replaceState({}, "", "/points");
    }
  }, []);

  const balance = balanceData?.balance ?? 0;
  const transactions = txData?.rows ?? [];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* 頂部 */}
      <div className="relative overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-zinc-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(250,204,21,0.06),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-black text-white mb-1 flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-400" /> 我的點數
          </h1>
          <p className="text-zinc-400 text-sm">HK$1 = 1 點，可用於抽取福袋格子</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 餘額卡片 */}
        <Card className="bg-gradient-to-br from-yellow-500/10 to-amber-500/5 border-yellow-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm mb-1">目前點數餘額</p>
                {balanceLoading ? (
                  <div className="h-10 w-32 bg-zinc-800 rounded animate-pulse" />
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-yellow-400">{balance.toLocaleString()}</span>
                    <span className="text-zinc-400 text-lg">點</span>
                  </div>
                )}
              </div>
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                <Zap className="w-8 h-8 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 儲值套餐 */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-yellow-400" /> 儲值套餐
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {packages?.map((pkg) => (
              <button
                key={pkg.amount}
                onClick={() => topupMutation.mutate({ amount: pkg.amount, origin: window.location.origin })}
                disabled={topupMutation.isPending}
                className={`relative group bg-zinc-900 border rounded-xl p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_0_15px_rgba(250,204,21,0.2)] ${
                  pkg.bonus > 0 ? "border-yellow-500/40 hover:border-yellow-500/60" : "border-zinc-700 hover:border-zinc-500"
                }`}
              >
                {pkg.bonus > 0 && (
                  <div className="absolute -top-2 -right-2">
                    <Badge className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5">
                      <Gift className="w-2.5 h-2.5 mr-0.5 inline" />+{pkg.bonus}
                    </Badge>
                  </div>
                )}
                <div className="text-zinc-400 text-xs mb-1">HK${pkg.amount.toLocaleString()}</div>
                <div className="text-white font-bold text-lg">{pkg.totalPoints.toLocaleString()} 點</div>
                {pkg.bonus > 0 && (
                  <div className="text-yellow-400 text-xs mt-0.5">含 {pkg.bonus} 點贈送</div>
                )}
              </button>
            ))}
          </div>
          {topupMutation.isPending && (
            <div className="flex items-center gap-2 text-zinc-400 text-sm mt-3">
              <Loader2 className="w-4 h-4 animate-spin" /> 跳轉至付款頁面...
            </div>
          )}
        </div>

        {/* 交易紀錄 */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-yellow-400" /> 交易紀錄
          </h2>
          {txLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-zinc-900 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-10 text-zinc-500">
              <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>尚無交易紀錄</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      tx.amount > 0 ? "bg-green-500/10" : "bg-red-500/10"
                    }`}>
                      <ArrowUpRight className={`w-4 h-4 ${tx.amount > 0 ? "text-green-400" : "text-red-400 rotate-180"}`} />
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium">
                        {TYPE_LABELS[tx.type] ?? tx.type}
                      </div>
                      {tx.note && <div className="text-zinc-500 text-xs">{tx.note}</div>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()} 點
                    </div>
                    <div className="text-zinc-500 text-xs">{new Date(tx.createdAt).toLocaleDateString("zh-TW")}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
