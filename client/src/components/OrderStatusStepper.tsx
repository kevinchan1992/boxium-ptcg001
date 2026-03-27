import { Check, Clock, CreditCard, Package, Truck, CheckCircle2, XCircle, AlertTriangle, RotateCcw, Users } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type StepState = "completed" | "active" | "upcoming";

interface StepDef {
  key: string;
  buyerLabel: string;
  sellerLabel: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const SHIPPING_STEPS: StepDef[] = [
  {
    key: "pending_payment",
    buyerLabel: "待付款",
    sellerLabel: "待付款",
    icon: <Clock className="w-4 h-4" />,
    activeIcon: <Clock className="w-4 h-4" />,
  },
  {
    key: "paid_held",
    buyerLabel: "已付款",
    sellerLabel: "待出貨",
    icon: <CreditCard className="w-4 h-4" />,
    activeIcon: <CreditCard className="w-4 h-4" />,
  },
  {
    key: "shipped",
    buyerLabel: "運送中",
    sellerLabel: "已出貨",
    icon: <Truck className="w-4 h-4" />,
    activeIcon: <Truck className="w-4 h-4" />,
  },
  {
    key: "delivered",
    buyerLabel: "待確認",
    sellerLabel: "已送達",
    icon: <Package className="w-4 h-4" />,
    activeIcon: <Package className="w-4 h-4" />,
  },
  {
    key: "completed",
    buyerLabel: "已完成",
    sellerLabel: "已完成",
    icon: <CheckCircle2 className="w-4 h-4" />,
    activeIcon: <CheckCircle2 className="w-4 h-4" />,
  },
];

const MEETUP_STEPS: StepDef[] = [
  {
    key: "pending_payment",
    buyerLabel: "待付款",
    sellerLabel: "待付款",
    icon: <Clock className="w-4 h-4" />,
    activeIcon: <Clock className="w-4 h-4" />,
  },
  {
    key: "paid_held",
    buyerLabel: "已付款",
    sellerLabel: "待確認",
    icon: <CreditCard className="w-4 h-4" />,
    activeIcon: <CreditCard className="w-4 h-4" />,
  },
  {
    key: "completed",
    buyerLabel: "面交完成",
    sellerLabel: "面交完成",
    icon: <Users className="w-4 h-4" />,
    activeIcon: <Users className="w-4 h-4" />,
  },
];

// Map raw orderStatus → canonical step key
function toCanonical(status: string): string {
  if (["paid_held", "payment_received", "processing"].includes(status)) return "paid_held";
  return status;
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface OrderStatusStepperProps {
  orderStatus: string;
  shippingMethod?: string | null;
  role?: "buyer" | "seller";
}

export function OrderStatusStepper({
  orderStatus,
  shippingMethod,
  role = "buyer",
}: OrderStatusStepperProps) {
  const isMeetup = shippingMethod === "meetup";
  const isCancelled = orderStatus === "cancelled";
  const isDisputed = orderStatus === "disputed";
  const isRefunded = orderStatus === "refunded";

  // ── Terminal / special states ──────────────────────────────────────────────
  if (isCancelled) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
          <XCircle className="w-4 h-4 text-gray-500" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-600">訂單已取消</p>
          <p className="text-[10px] text-gray-400 mt-0.5">此訂單已被取消，不會繼續處理</p>
        </div>
      </div>
    );
  }

  if (isDisputed) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200">
        <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-500" />
        </div>
        <div>
          <p className="text-xs font-semibold text-red-700">爭議處理中</p>
          <p className="text-[10px] text-red-500 mt-0.5">平台正在介入處理，請耐心等候</p>
        </div>
      </div>
    );
  }

  if (isRefunded) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-teal-50 border border-teal-200">
        <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
          <RotateCcw className="w-4 h-4 text-teal-600" />
        </div>
        <div>
          <p className="text-xs font-semibold text-teal-700">退款已完成</p>
          <p className="text-[10px] text-teal-500 mt-0.5">款項已退回至原付款方式</p>
        </div>
      </div>
    );
  }

  // ── Normal flow ────────────────────────────────────────────────────────────
  const steps = isMeetup ? MEETUP_STEPS : SHIPPING_STEPS;
  const canonical = toCanonical(orderStatus);
  const activeIdx = steps.findIndex((s) => s.key === canonical);
  const safeActiveIdx = activeIdx === -1 ? 0 : activeIdx;

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

          return (
            <div key={step.key} className="flex flex-col items-center flex-1 z-10 gap-1.5">
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
                className={`text-center leading-tight font-medium transition-colors duration-300 ${
                  state === "completed"
                    ? "text-[10px] text-[#06038d]"
                    : state === "active"
                      ? "text-[10px] text-[#06038d]"
                      : "text-[10px] text-gray-350"
                }`}
                style={{ color: state === "upcoming" ? "#b0b8c1" : undefined, maxWidth: 56 }}
              >
                {label}
              </span>

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
