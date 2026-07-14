/**
 * VipUpgradeModal — VIP 升級彈窗（重構版）
 * - 月費/年費卡片各自有獨立 CTA 按鈕，按鈕永遠可見
 * - 功能列表精簡，避免過長
 * - 手機版底部固定升級欄
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Crown, TrendingUp, Camera, Download, Check, X, Loader2,
  BarChart3, Star,
} from "lucide-react";

const BRAND_BLUE = "#06038d";
const BRAND_YELLOW = "#FEDD00";

const VIP_FEATURES = [
  { icon: <TrendingUp className="w-3.5 h-3.5" />, title: "持倉走勢圖", desc: "1M / 3M / 6M / 1Y / ALL 時間範圍切換" },
  { icon: <TrendingUp className="w-3.5 h-3.5" />, title: "長期價格走勢圖", desc: "解鎖 3M / 6M / 1Y / 2Y / Max 長期區間" },
  { icon: <Camera className="w-3.5 h-3.5" />, title: "智能入庫無限次", desc: "免費每月限 25 次，VIP 無限使用" },
  { icon: <Download className="w-3.5 h-3.5" />, title: "CSV 匯出", desc: "完整持倉資料匯出，Excel / Google Sheets 分析" },
  { icon: <BarChart3 className="w-3.5 h-3.5" />, title: "系列分析", desc: "各系列持倉成本、市值及盈虧比例", comingSoon: true },
  { icon: <Star className="w-3.5 h-3.5" />, title: "每週 P&L 報告", desc: "每週一自動發送盈虧摘要郵件", comingSoon: true },
];

interface VipUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VipUpgradeModal({ open, onOpenChange }: VipUpgradeModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<"monthly" | "yearly" | null>(null);
  const createCheckout = trpc.vip.createCheckout.useMutation();

  const handleUpgrade = async (plan: "monthly" | "yearly") => {
    setLoadingPlan(plan);
    try {
      const origin = window.location.origin;
      const result = await createCheckout.mutateAsync({
        plan,
        successUrl: `${origin}/profile?tab=vip&upgraded=1`,
        cancelUrl: `${origin}/vault`,
      });
      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error("無法建立付款頁面，請稍後再試");
      }
    } catch (err: any) {
      const msg = err?.message ?? "付款初始化失敗";
      if (msg.includes("Price ID")) {
        toast.error("VIP 方案尚未設定，請聯絡管理員");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-full p-0 overflow-hidden rounded-2xl border-0 shadow-2xl max-h-[92vh] flex flex-col">
        <DialogTitle className="sr-only">升級 VIP 會員</DialogTitle>

        {/* ── Header ── */}
        <div
          className="relative px-6 pt-6 pb-5 text-center flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${BRAND_YELLOW} 0%, #FFB800 100%)` }}
        >
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-black/10"
          >
            <X className="w-4 h-4 text-black/60" />
          </button>
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-2"
            style={{ background: "rgba(255,255,255,0.3)" }}
          >
            <Crown className="w-6 h-6" style={{ color: BRAND_BLUE }} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: BRAND_BLUE }}>升級 VIP 會員</h2>
          <p className="text-xs mt-0.5" style={{ color: `${BRAND_BLUE}CC` }}>
            解鎖全部進階功能，提升你的收藏管理體驗
          </p>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 bg-white">

          {/* Features — compact 2-col grid */}
          <div className="px-5 pt-4 pb-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">VIP 專屬功能</p>
            <div className="grid grid-cols-1 gap-2">
              {VIP_FEATURES.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: `${BRAND_YELLOW}35`, color: BRAND_BLUE }}
                  >
                    {f.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-900">{f.title}</span>
                      {f.comingSoon && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium leading-none">
                          即將推出
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 leading-tight">{f.desc}</p>
                  </div>
                  <Check className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />
                </div>
              ))}
            </div>
          </div>

          {/* ── Pricing cards — side by side, each with own CTA ── */}
          <div className="px-5 pb-5 pt-2">
            <div className="grid grid-cols-2 gap-3">

              {/* Monthly card */}
              <div className="flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 pt-4 pb-3 flex-1">
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-1">月費方案</p>
                  <p className="text-2xl font-extrabold leading-none" style={{ color: BRAND_BLUE }}>HK$38</p>
                  <p className="text-[11px] text-gray-400 mt-1">/ 月</p>
                </div>
                <div className="px-3 pb-3">
                  <button
                    onClick={() => handleUpgrade("monthly")}
                    disabled={loadingPlan !== null}
                    className="w-full py-2.5 rounded-xl border border-[#1A1A1A] bg-white text-[#1A1A1A] hover:bg-[#F5F5F3] text-[11px] font-bold tracking-widest uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {loadingPlan === "monthly" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : null}
                    {loadingPlan === "monthly" ? "處理中…" : "月費訂閱"}
                  </button>
                </div>
              </div>

              {/* Yearly card — highlighted */}
              <div className="flex flex-col rounded-xl border-2 border-[#1A1A1A] bg-white overflow-hidden relative shadow-[0_8px_20px_-6px_rgba(0,0,0,0.2)]">
                {/* 省34% badge */}
                <div
                  className="absolute top-0 right-0 text-[10px] font-extrabold px-2.5 py-1 rounded-bl-xl rounded-tr-xl leading-tight"
                  style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}
                >
                  省34%
                </div>
                <div className="px-4 pt-4 pb-3 flex-1">
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-1">年費方案</p>
                  <p className="text-2xl font-extrabold leading-none" style={{ color: BRAND_BLUE }}>HK$25</p>
                  <p className="text-[11px] text-gray-400 mt-1">/ 月 · 年付 HK$298</p>
                </div>
                <div className="px-3 pb-3">
                  <button
                    onClick={() => handleUpgrade("yearly")}
                    disabled={loadingPlan !== null}
                    className="w-full py-2.5 rounded-xl bg-[#1A1A1A] text-white hover:bg-[#333333] text-[11px] font-bold tracking-widest uppercase transition-all disabled:opacity-50 shadow-[0_8px_20px_-6px_rgba(0,0,0,0.2)] flex items-center justify-center gap-1.5"
                  >
                    {loadingPlan === "yearly" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Crown className="w-3.5 h-3.5" />
                    )}
                    {loadingPlan === "yearly" ? "處理中…" : "年費訂閱"}
                  </button>
                </div>
              </div>

            </div>
            <p className="text-center text-[10px] text-gray-400 mt-3">
              安全付款 · 隨時取消 · 到期前有效
            </p>
          </div>
        </div>

        {/* ── Mobile sticky footer CTA (sm and below) ── */}
        <div className="sm:hidden flex-shrink-0 border-t border-gray-100 bg-white px-4 py-3">
          <button
            onClick={() => handleUpgrade("yearly")}
            disabled={loadingPlan !== null}
            className="w-full py-3 rounded-xl bg-[#1A1A1A] text-white hover:bg-[#333333] text-xs font-bold tracking-widest uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loadingPlan ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Crown className="w-4 h-4" />
            )}
            {loadingPlan ? "處理中…" : "立即升級 VIP（年費 HK$25/月）"}
          </button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
