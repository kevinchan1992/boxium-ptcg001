import { Check, Clock, CreditCard, Package, Truck, CheckCircle2, XCircle, AlertTriangle, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

// ─── Types ───────────────────────────────────────────────────────────────────
type StepState = "completed" | "active" | "upcoming";

interface StepDef {
  key: string;
  buyerLabel: string;
  sellerLabel: string;
  buyerDesc?: string;
  sellerDesc?: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
}

export interface OrderTimestamps {
  createdAt?: Date | string | null;
  paidAt?: Date | string | null;
  shippedAt?: Date | string | null;
  deliveredAt?: Date | string | null;
  completedAt?: Date | string | null;
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const SHIPPING_STEPS: StepDef[] = [
  {
    key: "pending_payment",
    buyerLabel: "待付款",
    sellerLabel: "待付款",
    buyerDesc: "等待完成付款",
    sellerDesc: "等待買家付款",
    icon: <Clock className="w-4 h-4" />,
    activeIcon: <Clock className="w-4 h-4" />,
  },
  {
    key: "paid_held",
    buyerLabel: "已付款",
    sellerLabel: "待出貨",
    buyerDesc: "付款已確認",
    sellerDesc: "請盡快安排出貨",
    icon: <CreditCard className="w-4 h-4" />,
    activeIcon: <CreditCard className="w-4 h-4" />,
  },
  {
    key: "shipped",
    buyerLabel: "運送中",
    sellerLabel: "已出貨",
    buyerDesc: "商品正在運送",
    sellerDesc: "等待買家確認收貨",
    icon: <Truck className="w-4 h-4" />,
    activeIcon: <Truck className="w-4 h-4" />,
  },
  {
    key: "delivered",
    buyerLabel: "待確認",
    sellerLabel: "已送達",
    buyerDesc: "請確認收貨",
    sellerDesc: "等待買家確認",
    icon: <Package className="w-4 h-4" />,
    activeIcon: <Package className="w-4 h-4" />,
  },
  {
    key: "completed",
    buyerLabel: "已完成",
    sellerLabel: "已完成",
    buyerDesc: "訂單已完成",
    sellerDesc: "交易完成",
    icon: <CheckCircle2 className="w-4 h-4" />,
    activeIcon: <CheckCircle2 className="w-4 h-4" />,
  },
];


// Map raw orderStatus → canonical step key
function toCanonical(status: string): string {
  if (["paid_held", "payment_received", "processing"].includes(status)) return "paid_held";
  if (status === "delivered") return "delivered";
  return status;
}

// Format timestamp
function formatTs(ts: Date | string | null | undefined, short = false): string | null {
  if (!ts) return null;
  const d = typeof ts === "string" ? new Date(ts) : ts;
  if (isNaN(d.getTime())) return null;
  if (short) {
    return d.toLocaleDateString("zh-HK", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Get timestamp for a step key
function getStepTimestamp(stepKey: string, timestamps?: OrderTimestamps): string | null {
  if (!timestamps) return null;
  switch (stepKey) {
    case "pending_payment": return formatTs(timestamps.createdAt, true);
    case "paid_held": return formatTs(timestamps.paidAt, true);
    case "shipped": return formatTs(timestamps.shippedAt, true);
    case "delivered": return formatTs(timestamps.deliveredAt, true);
    case "completed": return formatTs(timestamps.completedAt, true);
    default: return null;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface OrderStatusStepperProps {
  orderStatus: string;
  shippingMethod?: string | null;
  role?: "buyer" | "seller";
  size?: "sm" | "lg";
  timestamps?: OrderTimestamps;
}

export function OrderStatusStepper({
  orderStatus,
  shippingMethod,
  role = "buyer",
  size = "sm",
  timestamps,
}: OrderStatusStepperProps) {
  const { t } = useTranslation();
  const isCancelled = orderStatus === "cancelled";
  const isDisputed = orderStatus === "disputed";
  const isRefunded = orderStatus === "refunded";
  const isLg = size === "lg";

  // ── Terminal / special states ──────────────────────────────────────────────
  if (isCancelled) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 ${isLg ? "py-4" : ""}`}>
        <div className={`rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 ${isLg ? "w-10 h-10" : "w-7 h-7"}`}>
          <XCircle className={`text-gray-500 ${isLg ? "w-5 h-5" : "w-4 h-4"}`} />
        </div>
        <div>
          <p className={`font-semibold text-gray-600 ${isLg ? "text-sm" : "text-xs"}`}>{t("orderStatusStepper.cancelled.title")}</p>
          <p className={`text-gray-400 mt-0.5 ${isLg ? "text-xs" : "text-[10px]"}`}>{t("orderStatusStepper.cancelled.description")}</p>
        </div>
      </div>
    );
  }

  if (isDisputed) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 ${isLg ? "py-4" : ""}`}>
        <div className={`rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 ${isLg ? "w-10 h-10" : "w-7 h-7"}`}>
          <AlertTriangle className={`text-red-500 ${isLg ? "w-5 h-5" : "w-4 h-4"}`} />
        </div>
        <div>
          <p className={`font-semibold text-red-700 ${isLg ? "text-sm" : "text-xs"}`}>{t("orderStatusStepper.disputed.title")}</p>
          <p className={`text-red-500 mt-0.5 ${isLg ? "text-xs" : "text-[10px]"}`}>{t("orderStatusStepper.disputed.description")}</p>
        </div>
      </div>
    );
  }

  if (isRefunded) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-teal-50 border border-teal-200 ${isLg ? "py-4" : ""}`}>
        <div className={`rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 ${isLg ? "w-10 h-10" : "w-7 h-7"}`}>
          <RotateCcw className={`text-teal-600 ${isLg ? "w-5 h-5" : "w-4 h-4"}`} />
        </div>
        <div>
          <p className={`font-semibold text-teal-700 ${isLg ? "text-sm" : "text-xs"}`}>{t("orderStatusStepper.refunded.title")}</p>
          <p className={`text-teal-500 mt-0.5 ${isLg ? "text-xs" : "text-[10px]"}`}>{t("orderStatusStepper.refunded.description")}</p>
        </div>
      </div>
    );
  }

  // ── Normal flow ────────────────────────────────────────────────────────────
  const steps = SHIPPING_STEPS;
  const canonical = toCanonical(orderStatus);
  const activeIdx = steps.findIndex((s) => s.key === canonical);
  const safeActiveIdx = activeIdx === -1 ? 0 : activeIdx;

  // ── Large (vertical timeline) layout ──────────────────────────────────────
  if (isLg) {
    return (
      <div className="relative">
        <style>{`
          @keyframes oss-checkmark-pop {
            0% { transform: scale(0) rotate(-10deg); opacity: 0; }
            60% { transform: scale(1.3) rotate(5deg); opacity: 1; }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
          }
          @keyframes oss-pulse-ring {
            0% { box-shadow: 0 0 0 0 rgba(6,3,141,0.35); }
            70% { box-shadow: 0 0 0 9px rgba(6,3,141,0); }
            100% { box-shadow: 0 0 0 0 rgba(6,3,141,0); }
          }
          @keyframes oss-fade-in {
            0% { opacity: 0; transform: translateX(-6px); }
            100% { opacity: 1; transform: translateX(0); }
          }
          .oss-done { animation: oss-checkmark-pop 0.4s cubic-bezier(0.175,0.885,0.32,1.275) both; }
          .oss-pulse { animation: oss-pulse-ring 2s ease-in-out infinite; }
          .oss-content { animation: oss-fade-in 0.3s ease-out both; }
        `}</style>

        {steps.map((step, idx) => {
          let state: StepState;
          if (idx < safeActiveIdx) state = "completed";
          else if (idx === safeActiveIdx) state = "active";
          else state = "upcoming";

          const label = role === "seller" ? step.sellerLabel : step.buyerLabel;
          const desc = role === "seller" ? step.sellerDesc : step.buyerDesc;
          const ts = getStepTimestamp(step.key, timestamps);
          const isLast = idx === steps.length - 1;

          return (
            <div key={step.key} className="flex gap-4" style={{ animationDelay: `${idx * 0.07}s` }}>
              {/* Left: circle + connector */}
              <div className="flex flex-col items-center">
                {/* Circle */}
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all duration-300
                    ${state === "completed"
                      ? "bg-[#06038d] border-[#06038d] text-white oss-done"
                      : state === "active"
                        ? "bg-[#06038d] border-[#06038d] text-white oss-pulse"
                        : "bg-white border-gray-200 text-gray-300"
                    }
                  `}
                  style={state === "completed" ? { animationDelay: `${idx * 0.1}s` } : undefined}
                >
                  {state === "completed" ? (
                    <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3 8l3.5 3.5L13 5"
                        stroke="white"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          strokeDasharray: 14,
                          strokeDashoffset: 0,
                          animation: `oss-checkmark-draw 0.35s ease-out ${idx * 0.1}s both`,
                        }}
                      />
                      <style>{`
                        @keyframes oss-checkmark-draw {
                          0% { stroke-dashoffset: 14; }
                          100% { stroke-dashoffset: 0; }
                        }
                      `}</style>
                    </svg>
                  ) : (
                    <span className={state === "active" ? "text-white" : "text-gray-300"}>
                      {step.icon}
                    </span>
                  )}
                </div>

                {/* Connector line */}
                {!isLast && (
                  <div
                    className={`w-0.5 flex-1 mt-1 min-h-[28px] transition-all duration-500 ${
                      state === "completed" ? "bg-[#06038d]/40" : "bg-gray-200"
                    }`}
                    style={state === "completed" ? { animationDelay: `${idx * 0.1 + 0.25}s` } : undefined}
                  />
                )}
              </div>

              {/* Right: content */}
              <div
                className={`flex-1 oss-content ${isLast ? "pb-0" : "pb-5"}`}
                style={{ animationDelay: `${idx * 0.07 + 0.04}s` }}
              >
                <div className="flex items-start justify-between gap-2 pt-1.5">
                  <div>
                    <p className={`font-semibold text-sm transition-colors duration-300 ${
                      state === "upcoming" ? "text-gray-400" : "text-gray-900"
                    }`}>
                      {label}
                      {state === "active" && (
                        <span className="ml-2 inline-flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#06038d] inline-block animate-bounce" style={{ animationDelay: "0s" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#06038d] inline-block animate-bounce" style={{ animationDelay: "0.15s" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#06038d] inline-block animate-bounce" style={{ animationDelay: "0.3s" }} />
                        </span>
                      )}
                    </p>
                    {desc && (
                      <p className={`text-xs mt-0.5 ${state === "upcoming" ? "text-gray-300" : "text-gray-500"}`}>
                        {desc}
                      </p>
                    )}
                  </div>
                  {/* Timestamp: only show for completed/active steps */}
                  {ts && state !== "upcoming" && (
                    <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5 tabular-nums">
                      {ts}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Small (horizontal) layout ──────────────────────────────────────────────
  return (
    <div className="px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm">
      {/* Step row */}
      <div className="relative flex items-start">
        {/* Background connector line */}
        <div
          className="absolute top-[13px] h-[2px] bg-gray-100 z-0"
          style={{ left: "13px", right: "13px" }}
        />
        {/* Filled progress line */}
        {safeActiveIdx > 0 && (
          <div
            className="absolute top-[13px] h-[2px] z-0 transition-all duration-500 ease-out"
            style={{
              background: "linear-gradient(90deg, #06038d 0%, #3b30d4 100%)",
              left: "13px",
              width: `calc(${(safeActiveIdx / (steps.length - 1)) * 100}% - 26px)`,
            }}
          />
        )}

        {steps.map((step, idx) => {
          let state: StepState;
          if (idx < safeActiveIdx) state = "completed";
          else if (idx === safeActiveIdx) state = "active";
          else state = "upcoming";

          const label = role === "seller" ? step.sellerLabel : step.buyerLabel;
          const ts = getStepTimestamp(step.key, timestamps);

          return (
            <div key={step.key} className="flex flex-col items-center flex-1 z-10 gap-1">
              {/* Circle node */}
              <div
                className={`
                  w-[26px] h-[26px] rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300
                  ${state === "completed"
                    ? "bg-[#06038d] text-white shadow-sm"
                    : state === "active"
                      ? "bg-[#06038d] text-white shadow-[0_0_0_3px_rgba(6,3,141,0.15)] ring-2 ring-[#06038d]/20"
                      : "bg-white text-gray-300 border-2 border-gray-200"
                  }
                `}
              >
                {state === "completed" ? (
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : (
                  <span className={state === "active" ? "text-white" : "text-gray-300"}>
                    {step.icon}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-center leading-tight font-medium transition-colors duration-300 text-[10px]`}
                style={{ color: state === "upcoming" ? "#b0b8c1" : "#06038d", maxWidth: 56 }}
              >
                {label}
              </span>

              {/* Timestamp (sm mode) */}
              {ts && state !== "upcoming" && (
                <span className="text-[9px] text-gray-400 text-center leading-tight tabular-nums" style={{ maxWidth: 56 }}>
                  {ts}
                </span>
              )}

              {/* Active pulse dot */}
              {state === "active" && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#FEDD00] shadow-sm" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
