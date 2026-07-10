import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { RotateCcw, ArrowLeft } from "lucide-react";

// Brand blue: #06038D (BOXIUM LOGO colour)
const BRAND = "#06038D";
const BRAND_HOVER = "#0805b8";

// ─── Point packages ──────────────────────────────────────────────────────────
const PACKAGES = [
  { points: 500,    hkd: 25.10,   bonus: 25,   label: "STARTER",  popular: false },
  { points: 1000,   hkd: 50.19,   bonus: 50,   label: "BASIC",    popular: false },
  { points: 5000,   hkd: 250.95,  bonus: 250,  label: "ADVANCED", popular: true  },
  { points: 10000,  hkd: 501.90,  bonus: 500,  label: "PREMIUM",  popular: false },
  { points: 20000,  hkd: 1003.81, bonus: 1000, label: "ELITE",    popular: false },
  { points: 50000,  hkd: 2509.52, bonus: 2500, label: "LEGEND",   popular: false },
];

// ─── Confetti particle ───────────────────────────────────────────────────────
function ConfettiParticle({ delay, x, color }: { delay: number; x: number; color: string }) {
  return (
    <div
      className="absolute top-0 w-2 h-2 opacity-0"
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
  const confettiColors = [BRAND, "#7C3AED", "#F59E0B", "#10B981", "#EF4444", "#EC4899"];
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white w-full max-w-sm overflow-hidden"
        style={{ animation: "modal-card-in 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards" }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {particles.map(p => (
            <ConfettiParticle key={p.id} delay={p.delay} x={p.x} color={p.color} />
          ))}
        </div>
        {/* Top rainbow bar — keep gradient for celebratory feel */}
        <div className="h-0.5 bg-gradient-to-r from-[#06038D] via-purple-500 to-pink-500" />
        <div className="px-8 pt-10 pb-8 text-center">
          <div
            className="mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: BRAND,
              animation: "check-pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) 0.1s both",
            }}
          >
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"
                style={{ animation: "draw-check 0.4s ease 0.4s both", strokeDasharray: 30, strokeDashoffset: 30 }} />
            </svg>
          </div>
          <p className="text-xs tracking-[0.3em] text-slate-400 uppercase mb-1" style={{ animation: "fade-up 0.4s ease 0.3s both" }}>
            PAYMENT CONFIRMED
          </p>
          <h2 className="text-2xl font-bold text-slate-900 mb-6" style={{ animation: "fade-up 0.4s ease 0.4s both" }}>
            充值成功
          </h2>
          <div className="border-t border-b border-slate-100 py-5 mb-6" style={{ animation: "fade-up 0.4s ease 0.5s both" }}>
            <p className="text-xs tracking-widest text-slate-400 uppercase mb-2">CURRENT BALANCE</p>
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-4xl font-light text-slate-900 tabular-nums">{balance.toLocaleString()}</span>
              <span className="text-sm tracking-widest text-slate-400 uppercase">pts</span>
            </div>
          </div>
          <div className="flex gap-3" style={{ animation: "fade-up 0.4s ease 0.6s both" }}>
            <button
              onClick={() => { window.location.href = "/pools"; }}
              className="flex-1 text-white text-xs tracking-widest uppercase py-3.5 transition-colors duration-300 font-medium"
              style={{ backgroundColor: BRAND }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = BRAND)}
            >
              OPEN PACKS
            </button>
            <button
              onClick={onClose}
              className="flex-1 border border-slate-200 hover:border-slate-400 text-slate-600 text-xs tracking-widest uppercase py-3.5 transition-colors duration-300"
            >
              CONTINUE
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("payment");
    if (status === "success") {
      window.history.replaceState({}, "", "/points");
      utils.lootpool.myBalance.invalidate();
      utils.lootpool.myTransactions.invalidate();
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

  const handleRefresh = () => { refetchBalance(); refetchTx(); };
  const balance = balanceData?.balance ?? 0;

  return (
    <>
      {showSuccessModal && (
        <SuccessModal balance={balance} onClose={() => setShowSuccessModal(false)} />
      )}

      <div className="min-h-screen bg-slate-50">

        {/* ─── Top Nav Bar ─────────────────────────────────────────────── */}
        <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1 as any)}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs tracking-widest uppercase">Back</span>
          </button>
          <span className="text-xs tracking-[0.4em] text-slate-300 uppercase font-light">
            BOXIUM · POINTS
          </span>
          <div className="w-16" />
        </div>

        <div className="max-w-5xl mx-auto px-6 md:px-10">

          {/* ─── Membership Header ───────────────────────────────────────── */}
          <div className="py-12 md:py-16 border-b border-slate-200">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">

              {/* Left: Membership label + tier */}
              <div>
                <p className="text-xs tracking-[0.4em] text-slate-300 uppercase font-light mb-3">
                  MEMBERSHIP
                </p>
                <h1 className="text-5xl md:text-6xl font-extralight tracking-widest text-slate-900 uppercase">
                  {user ? (user.role === "admin" ? "DIAMOND" : "STANDARD") : "GUEST"}
                </h1>
                <div className="mt-3 flex items-center gap-3">
                  {/* Brand-blue accent line */}
                  <div className="h-px w-8" style={{ backgroundColor: BRAND }} />
                  <span
                    className="text-xs tracking-widest uppercase font-medium"
                    style={{ color: BRAND }}
                  >
                    {user ? user.email : "Not signed in"}
                  </span>
                </div>
              </div>

              {/* Right: Balance */}
              <div className="md:text-right">
                <p className="text-xs tracking-[0.4em] text-slate-300 uppercase font-light mb-2">
                  BALANCE
                </p>
                <div className="flex items-baseline gap-3 md:justify-end">
                  <span className="text-5xl md:text-6xl font-light text-slate-900 tabular-nums leading-none">
                    {balanceLoading ? (
                      <span className="text-slate-200 animate-pulse">—</span>
                    ) : balance.toLocaleString()}
                  </span>
                  <span className="text-sm tracking-widest text-slate-400 uppercase">pts</span>
                  <button
                    onClick={handleRefresh}
                    className="ml-1 text-slate-300 transition-colors"
                    style={{}}
                    onMouseEnter={e => (e.currentTarget.style.color = BRAND)}
                    onMouseLeave={e => (e.currentTarget.style.color = "")}
                    title="Refresh balance"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
                <p className="mt-1 text-xs tracking-wide text-slate-400">HK$1 = 1 pt · Non-refundable</p>
              </div>
            </div>
          </div>

          {/* ─── Section Title ────────────────────────────────────────────── */}
          <div className="pt-12 md:pt-16 pb-8 md:pb-10 flex items-end justify-between">
            <div>
              <p className="text-xs tracking-[0.4em] text-slate-300 uppercase font-light mb-2">
                TOP UP
              </p>
              <h2 className="text-2xl md:text-3xl font-extralight tracking-wide text-slate-900">
                Select a Package
              </h2>
            </div>
            {/* Payment methods */}
            <div className="hidden md:flex items-center gap-1.5">
              {["Visa", "MC", "AMEX", "JCB", "Apple Pay"].map(m => (
                <span key={m} className="text-xs text-slate-300 tracking-wide">{m}</span>
              ))}
            </div>
          </div>

          {/* ─── Pricing Grid ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 pb-16 md:pb-20">
            {PACKAGES.map((pkg, idx) => (
              <div
                key={idx}
                className="relative bg-white group transition-all duration-300 rounded-none"
                style={pkg.popular ? {
                  boxShadow: `0 4px 40px rgba(6,3,141,0.10)`,
                  outline: `1px solid rgba(6,3,141,0.20)`,
                } : {
                  boxShadow: "0 2px 30px rgba(0,0,0,0.04)",
                }}
              >
                {/* Top accent line */}
                <div
                  className="h-0.5 w-full transition-colors duration-300"
                  style={pkg.popular
                    ? { backgroundColor: BRAND }
                    : { backgroundColor: "#e2e8f0" }
                  }
                />

                <div className="p-6 md:p-7">
                  {/* Label row */}
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-xs tracking-[0.3em] text-slate-400 uppercase font-medium">
                      {pkg.label}
                    </span>
                    {pkg.popular && (
                      <span
                        className="text-[10px] tracking-[0.25em] uppercase px-2 py-0.5 font-medium"
                        style={{ border: `1px solid ${BRAND}`, color: BRAND }}
                      >
                        MOST POPULAR
                      </span>
                    )}
                  </div>

                  {/* Points */}
                  <div className="mb-1">
                    <span className="text-3xl font-bold tracking-tight text-slate-900">
                      {pkg.points.toLocaleString()}
                    </span>
                    <span className="ml-1.5 text-sm tracking-widest text-slate-400 uppercase font-light">pts</span>
                  </div>

                  {/* Bonus */}
                  <p className="text-xs tracking-wide font-mono mb-1" style={{ color: BRAND }}>
                    ＋{pkg.bonus.toLocaleString()} bonus pts
                  </p>

                  {/* Price */}
                  <p className="font-mono text-sm text-slate-400 mb-7">
                    HK$ {pkg.hkd.toFixed(2)}
                  </p>

                  {/* Divider */}
                  <div className="h-px bg-slate-100 mb-5" />

                  {/* CTA Button */}
                  <button
                    onClick={() => handleBuy(pkg, idx)}
                    disabled={loadingPkg !== null}
                    className="w-full py-3.5 text-xs tracking-widest uppercase font-medium transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                    style={{ backgroundColor: BRAND }}
                    onMouseEnter={e => { if (loadingPkg === null) e.currentTarget.style.backgroundColor = BRAND_HOVER; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = BRAND; }}
                  >
                    {loadingPkg === idx ? (
                      <span className="flex items-center justify-center gap-2">
                        <RotateCcw className="w-3 h-3 animate-spin" />
                        PROCESSING
                      </span>
                    ) : "PURCHASE"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ─── Recent Transactions ──────────────────────────────────────── */}
          {user && txData && txData.length > 0 && (
            <div className="border-t border-slate-200 pt-12 pb-16">
              <p className="text-xs tracking-[0.4em] text-slate-300 uppercase font-light mb-8">
                TRANSACTION HISTORY
              </p>
              <div className="divide-y divide-slate-100">
                {txData.map((tx: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tx.amount > 0 ? BRAND : "#cbd5e1" }}
                      />
                      <div>
                        <p className="text-sm text-slate-700 tracking-wide">{tx.note || "—"}</p>
                        <p className="text-xs text-slate-400 tracking-wide mt-0.5">
                          {tx.createdAt ? new Date(tx.createdAt).toLocaleString("zh-HK") : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p
                        className="text-sm font-mono font-medium"
                        style={{ color: tx.amount > 0 ? BRAND : "#94a3b8" }}
                      >
                        {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()} pt
                      </p>
                      <p className="text-xs text-slate-300 font-mono mt-0.5">
                        {tx.balanceAfter?.toLocaleString()} pt
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Footer Notes ─────────────────────────────────────────────── */}
          <div className="border-t border-slate-100 py-10">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <p className="text-xs tracking-[0.3em] text-slate-300 uppercase font-light">TERMS</p>
                <ul className="space-y-1">
                  {[
                    "HK$1 = 1 pt · applicable to all blind box draws",
                    "Points are non-refundable after purchase",
                    "Winning cards can be redeemed or shipped physically",
                  ].map((t, i) => (
                    <li key={i} className="text-xs tracking-wide text-slate-400 leading-relaxed">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              {!user && (
                <button
                  onClick={() => window.location.href = "/login"}
                  className="self-start text-white text-xs tracking-widest uppercase px-6 py-3 transition-colors duration-300 font-medium"
                  style={{ backgroundColor: BRAND }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = BRAND)}
                >
                  SIGN IN TO PURCHASE
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
