import React from "react";
import {
  Crown, Check, TrendingUp, BarChart2, Camera, Download,
  Mail, ChevronRight, Calendar, CreditCard, ExternalLink
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const BRAND_BLUE = "#06038d";
const BRAND_YELLOW = "#FEDD00";

const VIP_FEATURES = [
  { icon: <TrendingUp className="w-4 h-4" />, title: "持倉走勢圖", desc: "完整時間範圍切換（1M / 3M / 6M / 1Y / ALL），追蹤資產成本與市值變化" },
  { icon: <TrendingUp className="w-4 h-4" />, title: "長期價格走勢圖", desc: "解鎖 3M / 6M / 1Y / ALL 長期區間，洞察長線趨勢" },
  { icon: <Camera className="w-4 h-4" />, title: "智能入庫無限次", desc: "拍照自動辨識卡片並入庫，會員每月僅限 25 次，VIP 無限使用" },
  { icon: <Download className="w-4 h-4" />, title: "CSV 匯出", desc: "將完整持倉資料匯出為 CSV，方便在 Excel 或 Google Sheets 進行自訂分析" },
  { icon: <Mail className="w-4 h-4" />, title: "每週 P&L 報告", desc: "每週一早上自動發送持倉盈虧摘要郵件，包含漲幅前三及跌幅前三卡片" },
];

interface VipProfileSectionProps {
  isVip: boolean;
  vipPlan: string | null;
  vipExpiresAt: Date | null;
  onUpgrade: () => void;
}

export function VipProfileSection({ isVip, vipPlan, vipExpiresAt, onUpgrade }: VipProfileSectionProps) {
  const cancelMutation = trpc.vip.cancelSubscription.useMutation({
    onSuccess: () => {
      toast.success("訂閱已取消，到期前仍可使用 VIP 功能");
    },
    onError: (err) => {
      toast.error(err.message || "取消失敗，請稍後再試");
    },
  });

  const manageMutation = trpc.vip.createPortalSession.useMutation({
    onSuccess: (data: any) => {
      window.open(data.url, "_blank");
    },
    onError: (err) => {
      toast.error(err.message || "無法開啟管理頁面");
    },
  });

  const formatDate = (d: Date | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" });
  };

  const planLabel = vipPlan === "yearly" ? "年費方案 (HK$298/年)" : vipPlan === "monthly" ? "月費方案 (HK$38/月)" : null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* VIP Status Card */}
      {isVip ? (
        <div
          className="rounded-2xl p-6"
          style={{
            background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #0a06b5 100%)`,
            border: `2px solid ${BRAND_YELLOW}`,
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: BRAND_YELLOW }}
                >
                  <Crown className="w-4 h-4" style={{ color: BRAND_BLUE }} />
                </div>
                <span className="text-lg font-bold text-white">VIP 會員</span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}
                >
                  有效中
                </span>
              </div>
              {planLabel && (
                <p className="text-white/80 text-sm flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  {planLabel}
                </p>
              )}
              {vipExpiresAt && (
                <p className="text-white/60 text-xs flex items-center gap-1.5 mt-1">
                  <Calendar className="w-3 h-3" />
                  {vipPlan === "yearly" ? "下次續費：" : "到期日："}
                  {formatDate(vipExpiresAt)}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex gap-2 flex-wrap">
            <button
              onClick={() => manageMutation.mutate()}
              disabled={manageMutation.isPending}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all"
              style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              管理訂閱
            </button>
            <button
              onClick={() => {
                if (confirm("確定要取消 VIP 訂閱嗎？到期前仍可繼續使用 VIP 功能。")) {
                  cancelMutation.mutate();
                }
              }}
              disabled={cancelMutation.isPending}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl transition-all"
              style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              取消訂閱
            </button>
          </div>
        </div>
      ) : (
        <div
          className="rounded-2xl p-6"
          style={{ background: "#F9F9F9", border: "1px solid #E5E5E5" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: `${BRAND_BLUE}12` }}
            >
              <Crown className="w-5 h-5" style={{ color: BRAND_BLUE }} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">升級 VIP 會員</h3>
              <p className="text-sm text-gray-500">解鎖全部進階功能，提升你的收藏管理體驗</p>
            </div>
          </div>
          <div className="flex gap-3 mt-2">
            <div className="flex-1 rounded-xl p-3 text-center" style={{ background: "#F0F0F0", border: "1px solid #E0E0E0" }}>
              <p className="text-xs text-gray-500 mb-0.5">月費方案</p>
              <p className="text-xl font-bold" style={{ color: BRAND_BLUE }}>HK$38</p>
              <p className="text-xs text-gray-400">/月</p>
            </div>
            <div
              className="flex-1 rounded-xl p-3 text-center relative"
              style={{ background: `${BRAND_BLUE}08`, border: `2px solid ${BRAND_BLUE}` }}
            >
              <span
                className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: BRAND_BLUE, color: "white" }}
              >
                省 34%
              </span>
              <p className="text-xs text-gray-500 mb-0.5">年費方案</p>
              <p className="text-xl font-bold" style={{ color: BRAND_BLUE }}>HK$25</p>
              <p className="text-xs text-gray-400">/月 · 年付 HK$298</p>
            </div>
          </div>
          <button
            onClick={onUpgrade}
            className="w-full mt-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
            style={{ background: BRAND_BLUE, color: "white" }}
          >
            <Crown className="w-4 h-4" />
            立即升級 VIP
          </button>
        </div>
      )}

      {/* Feature List */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">VIP 專屬功能</h3>
        <div className="space-y-2">
          {VIP_FEATURES.map((f, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3.5 rounded-xl"
              style={{ background: "#F9F9F9", border: "1px solid #F0F0F0" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: isVip ? `${BRAND_BLUE}12` : "#F0F0F0" }}
              >
                <span style={{ color: isVip ? BRAND_BLUE : "#AAAAAA" }}>{f.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{f.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
              {isVip ? (
                <Check className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: "#22C55E" }} />
              ) : (
                <ChevronRight className="w-4 h-4 flex-shrink-0 mt-1 text-gray-300" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
