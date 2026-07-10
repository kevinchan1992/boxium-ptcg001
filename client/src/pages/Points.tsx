import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { RefreshCw, ChevronLeft, Gift } from "lucide-react";

// ─── Point packages (HK$1 = 1 point) ────────────────────────────────────────
const PACKAGES = [
  { points: 500,    hkd: 25.10,   bonus: 25,   label: "入門包",  icon: "🪙", popular: false },
  { points: 1000,   hkd: 50.19,   bonus: 50,   label: "基礎包",  icon: "💰", popular: false },
  { points: 5000,   hkd: 250.95,  bonus: 250,  label: "進階包",  icon: "💎", popular: true  },
  { points: 10000,  hkd: 501.90,  bonus: 500,  label: "豪華包",  icon: "👑", popular: false },
  { points: 20000,  hkd: 1003.81, bonus: 1000, label: "至尊包",  icon: "🏆", popular: false },
  { points: 50000,  hkd: 2509.52, bonus: 2500, label: "傳說包",  icon: "⚡", popular: false },
];

// ─── Confetti particle ───────────────────────────────────────────────────────
function ConfettiParticle({ delay, x, color }: { delay: number; x: number; color: string }) {
  return (
    <div
      className="absolute top-0 w-2 h-2 rounded-sm opacity-0"
      style={{
        left: `${x}%`,
        backgroundColor: color,
        animation: `confetti-fall 1.2s ease-in ${delay}ms forwards`,
      }}
    />
  );
}

// ─── Success Modal ────────────────────────────────────────────────────────────
function SuccessModal({ balance, onClose }: { balance: number; onClose: () => void }) {
  const confettiColors = ["#2563EB", "#7C3AED", "#F59E0B", "#10B981", "#EF4444", "#EC4899"];
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    delay: Math.random() * 600,
    x: Math.random() * 100,
    color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ animation: "modal-backdrop-in 0.3s ease forwards" }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ animation: "modal-card-in 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards" }}
      >
        {/* Confetti container */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {particles.map(p => (
            <ConfettiParticle key={p.id} delay={p.delay} x={p.x} color={p.color} />
          ))}
        </div>

        {/* Top gradient band */}
        <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

        <div className="px-6 pt-8 pb-6 text-center">
          {/* Animated checkmark circle */}
          <div
            className="mx-auto mb-4 w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200"
            style={{ animation: "check-pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) 0.1s both" }}
          >
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
                style={{ animation: "draw-check 0.4s ease 0.4s both", strokeDasharray: 30, strokeDashoffset: 30 }}
              />
            </svg>
          </div>

          {/* Title */}
          <h2
            className="text-2xl font-black text-slate-900 mb-1"
            style={{ animation: "fade-up 0.4s ease 0.3s both" }}
          >
            充值成功！
          </h2>
          <p
            className="text-slate-500 text-sm mb-6"
            style={{ animation: "fade-up 0.4s ease 0.4s both" }}
          >
            點數已即時到帳，快去抽福袋吧！
          </p>

          {/* Balance display */}
          <div
            className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl px-5 py-4 mb-6 border border-blue-100"
            style={{ animation: "fade-up 0.4s ease 0.5s both" }}
          >
            <p className="text-blue-500 text-xs font-medium mb-1">目前點數餘額</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">🪙</span>
              <span className="font-black text-3xl text-blue-700 tabular-nums">
                {balance.toLocaleString()}
              </span>
              <span className="text-blue-400 font-medium text-sm">pt</span>
            </div>
          </div>

          {/* Action buttons */}
          <div
            className="flex gap-3"
            style={{ animation: "fade-up 0.4s ease 0.6s both" }}
          >
            <button
              onClick={() => { window.location.href = "/pools"; }}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 rounded-2xl text-sm transition-all duration-200 shadow-md shadow-blue-200 active:scale-95"
            >
              🎴 去抽福袋
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-sm transition-all duration-200 active:scale-95"
            >
              繼續充值
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Points() {
  const [, navigate] = useLocation();
  const { data: authData } = trpc.auth.me.useQuery();
  const user = authData;
  const [loadingPkg, setLoadingPkg] = useState<number | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const utils = trpc.useUtils();

  // Read ?payment= query param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("payment");
    if (status === "success") {
      // Clean URL first
      window.history.replaceState({}, "", "/points");
      // Refetch balance & transactions, then show modal
      utils.lootpool.myBalance.invalidate();
      utils.lootpool.myTransactions.invalidate();
      // Small delay so the new balance is fetched before modal shows
      setTimeout(() => setShowSuccessModal(true), 300);
    } else if (status === "cancelled") {
      window.history.replaceState({}, "", "/points");
      toast.info("已取消充值。");
    }
  }, []);

  const { data: balanceData, refetch: refetchBalance, isLoading: balanceLoading } =
    trpc.lootpool.myBalance.useQuery(undefined, { enabled: !!user });

  const { data: txData, refetch: refetchTx } =
    trpc.lootpool.myTransactions.useQuery({ limit: 10, offset: 0 }, { enabled: !!user });

  const createCheckout = trpc.lootpool.createTopupCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    },
    onError: (err) => {
      toast.error(err.message || "建立付款失敗，請稍後再試");
      setLoadingPkg(null);
    },
  });

  const handleBuy = (pkg: typeof PACKAGES[0], idx: number) => {
    if (!user) { window.location.href = "/login"; return; }
    setLoadingPkg(idx);
    createCheckout.mutate({ points: pkg.points, amountHkd: pkg.hkd, origin: window.location.origin });
  };

  const handleRefresh = () => {
    refetchBalance();
    refetchTx();
  };

  const balance = balanceData?.balance ?? 0;

  return (
    <>
      {/* ─── Success Modal ─────────────────────────────────────────────── */}
      {showSuccessModal && (
        <SuccessModal
          balance={balance}
          onClose={() => setShowSuccessModal(false)}
        />
      )}

      <div className="min-h-screen bg-white">
        {/* ─── Top Bar ───────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1 as any)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="flex-1 text-center font-bold text-slate-900 text-base">購買盲盒點數</h1>
          <div className="w-8" />
        </div>

        <div className="max-w-2xl mx-auto px-4 pb-16">
          {/* ─── Member Info & Balance ──────────────────────────────────── */}
          <div className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-xs mb-1">會員等級</p>
                <p className="font-black text-xl">
                  {user ? (user.role === "admin" ? "Diamond" : "Standard") : "訪客"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-blue-100 text-xs mb-1">持有點數</p>
                <div className="flex items-center gap-2 justify-end">
                  <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1.5">
                    <span className="text-yellow-300 text-lg">🪙</span>
                    <span className="font-black text-xl">
                      {balanceLoading ? "..." : balance.toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={handleRefresh}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/20 flex items-center gap-2">
              <span className="text-blue-100 text-xs">HK$1 = 1 點數</span>
              <span className="text-blue-100 text-xs">•</span>
              <span className="text-blue-100 text-xs">點數充值後不可退款</span>
            </div>
          </div>

          {/* ─── Payment Method ─────────────────────────────────────────── */}
          <div className="mt-5">
            <p className="text-slate-500 text-sm font-medium mb-3">付款方式</p>
            <div className="border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-900 rounded-md flex items-center justify-center">
                  <span className="text-white text-xs font-bold">💳</span>
                </div>
                <span className="font-medium text-slate-900">信用卡</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {["Visa", "MC", "AMEX", "JCB", "Apple Pay", "Google Pay"].map(m => (
                  <span key={m} className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">{m}</span>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Packages ───────────────────────────────────────────────── */}
          <div className="mt-5">
            <p className="text-slate-500 text-sm font-medium mb-3">選擇充值金額</p>
            <div className="flex flex-col gap-3">
              {PACKAGES.map((pkg, idx) => (
                <div
                  key={idx}
                  className={`relative border rounded-2xl overflow-hidden transition-all duration-200 ${
                    pkg.popular
                      ? "border-blue-400 shadow-md shadow-blue-100"
                      : "border-slate-200 hover:border-blue-300 hover:shadow-sm"
                  }`}
                >
                  {pkg.popular && (
                    <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                      最受歡迎
                    </div>
                  )}
                  <div className="flex items-center gap-4 px-4 py-4">
                    <div className="flex-shrink-0">
                      <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        pkg.popular ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"
                      }`}>
                        +{pkg.bonus.toLocaleString()}pt
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{pkg.icon}</span>
                        <div>
                          <p className="font-black text-slate-900 text-lg leading-tight">
                            {pkg.points.toLocaleString()} <span className="text-sm font-medium text-slate-500">點數</span>
                          </p>
                          <p className="text-slate-400 text-xs">約 HK${pkg.hkd.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleBuy(pkg, idx)}
                      disabled={loadingPkg !== null}
                      className={`flex-shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                        pkg.popular
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
                          : "bg-slate-900 hover:bg-slate-800 text-white"
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      {loadingPkg === idx ? (
                        <span className="flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          處理中
                        </span>
                      ) : "購買"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Recent Transactions ────────────────────────────────────── */}
          {user && txData && txData.length > 0 && (
            <div className="mt-8">
              <p className="text-slate-500 text-sm font-medium mb-3">最近交易記錄</p>
              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {txData.map((tx: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                        tx.amount > 0 ? "bg-green-100" : "bg-red-100"
                      }`}>
                        {tx.type === "topup" ? "💳" : tx.type === "draw" ? "🎴" : tx.type === "buyback" ? "💰" : "🔄"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{tx.note}</p>
                        <p className="text-xs text-slate-400">
                          {tx.createdAt ? new Date(tx.createdAt).toLocaleString("zh-HK") : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${tx.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()} pt
                      </p>
                      <p className="text-xs text-slate-400">餘額 {tx.balanceAfter?.toLocaleString()} pt</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Notes ──────────────────────────────────────────────────── */}
          <div className="mt-6 bg-slate-50 rounded-2xl p-4">
            <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Gift className="w-4 h-4 text-blue-500" />
              關於 BOXIUM 點數
            </p>
            <ul className="space-y-1.5 text-xs text-slate-500">
              <li>• HK$1 = 1 點，可用於抽取福袋</li>
              <li>• 抽到隱藏卡可選擇官方回購（點數）或實體寄出</li>
              <li>• 點數儲值後不可退款，請確認後再購買</li>
            </ul>
            {!user && (
              <button
                onClick={() => window.location.href = "/login"}
                className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
              >
                登入後購買
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
