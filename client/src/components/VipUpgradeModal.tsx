/**
 * VipUpgradeModal — VIP 升級彈窗
 * 顯示 VIP 功能清單 + 月費/年費方案選擇 + Stripe Checkout 跳轉
 */
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Crown, TrendingUp, Camera, Download, Check, X, Loader2,
  BarChart3, Star,
} from "lucide-react";

const BRAND_BLUE = "#06038d";
const BRAND_YELLOW = "#FEDD00";

const VIP_FEATURES = [
  {
    icon: <TrendingUp className="w-4 h-4" />,
    title: "持倉走勢圖",
    desc: "完整時間範圍切換（1M / 3M / 6M / 1Y / ALL），追蹤資產成本與市值變化",
  },
  {
    icon: <TrendingUp className="w-4 h-4" />,
    title: "長期價格走勢圖",
    desc: "解鎖 3M / 6M / 1Y / 2Y / Max 長期區間（會員僅限 7 日 / 1 個月），洞察長線趨勢",
  },
  {
    icon: <Camera className="w-4 h-4" />,
    title: "智能入庫無限次",
    desc: "拍照自動辨識卡片並入庫，會員每月僅限 25 次，VIP 無限使用",
  },
  {
    icon: <Download className="w-4 h-4" />,
    title: "CSV 匯出",
    desc: "將完整持倉資料匯出為 CSV，方便在 Excel 或 Google Sheets 進行自訂分析",
  },
  {
    icon: <BarChart3 className="w-4 h-4" />,
    title: "系列分析",
    desc: "按卡片系列分組，一目了然查看各系列持倉成本、市值及盈虧比例",
    comingSoon: true,
  },
  {
    icon: <Star className="w-4 h-4" />,
    title: "每週 P&L 報告",
    desc: "每週一早上自動發送持倉盈虧摘要郵件，包含漲幅前三及跌幅前三卡片",
    comingSoon: true,
  },
];

interface VipUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VipUpgradeModal({ open, onOpenChange }: VipUpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly");
  const [isLoading, setIsLoading] = useState(false);

  const createCheckout = trpc.vip.createCheckout.useMutation();

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      const origin = window.location.origin;
      const result = await createCheckout.mutateAsync({
        plan: selectedPlan,
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
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
        {/* Header */}
        <div
          className="relative px-6 pt-8 pb-6 text-center"
          style={{
            background: `linear-gradient(135deg, ${BRAND_YELLOW} 0%, #FFB800 100%)`,
          }}
        >
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-black/10"
          >
            <X className="w-4 h-4 text-black/60" />
          </button>
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: "rgba(255,255,255,0.3)" }}
          >
            <Crown className="w-7 h-7" style={{ color: BRAND_BLUE }} />
          </div>
          <h2 className="text-xl font-bold" style={{ color: BRAND_BLUE }}>升級 VIP 會員</h2>
          <p className="text-sm mt-1" style={{ color: `${BRAND_BLUE}CC` }}>
            解鎖全部進階功能，提升你的收藏管理體驗
          </p>
        </div>

        {/* Features */}
        <div className="px-6 py-4 bg-white">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">VIP 專屬功能</p>
          <div className="space-y-3">
            {VIP_FEATURES.map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${BRAND_YELLOW}30`, color: BRAND_BLUE }}
                >
                  {f.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{f.title}</span>
                    {f.comingSoon && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                        即將推出
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
                <Check className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: "#10B981" }} />
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-3">
            {/* Monthly */}
            <button
              onClick={() => setSelectedPlan("monthly")}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                selectedPlan === "monthly"
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <p className="text-xs text-gray-500 mb-1">月費方案</p>
              <p className="text-2xl font-bold" style={{ color: BRAND_BLUE }}>HK$38</p>
              <p className="text-xs text-gray-400">/ 月</p>
            </button>

            {/* Yearly */}
            <button
              onClick={() => setSelectedPlan("yearly")}
              className={`p-4 rounded-xl border-2 text-left transition-all relative ${
                selectedPlan === "yearly"
                  ? "border-yellow-400 bg-yellow-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div
                className="absolute -top-2.5 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}
              >
                省 34%
              </div>
              <p className="text-xs text-gray-500 mb-1">年費方案</p>
              <p className="text-2xl font-bold" style={{ color: BRAND_BLUE }}>HK$25</p>
              <p className="text-xs text-gray-400">/ 月 · 年付 HK$298</p>
            </button>
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 pt-3 bg-white">
          <Button
            className="w-full h-12 text-base font-bold rounded-xl"
            style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}
            onClick={handleUpgrade}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Crown className="w-5 h-5 mr-2" />
            )}
            立即升級 VIP（{selectedPlan === "yearly" ? "年費" : "月費"}）
          </Button>
          <p className="text-center text-xs text-gray-400 mt-2">
            安全付款 · 隨時取消 · 到期前有效
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
