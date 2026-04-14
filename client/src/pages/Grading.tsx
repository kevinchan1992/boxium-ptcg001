import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Shield,
  Package,
  Bell,
  Award,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertCircle,
  Truck,
} from "lucide-react";

// Countdown timer component
function CountdownTimer({ deadline }: { deadline: Date }) {
  const [now, setNow] = useState(new Date());
  const diff = deadline.getTime() - now.getTime();
  const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  const hours = Math.max(0, Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
  const minutes = Math.max(0, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));

  // Update every minute
  useState(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  });

  if (diff <= 0) return <span className="text-red-500 font-bold">已截止</span>;

  return (
    <div className="flex gap-3 justify-center">
      {[
        { value: days, label: "天" },
        { value: hours, label: "時" },
        { value: minutes, label: "分" },
      ].map(({ value, label }) => (
        <div key={label} className="flex flex-col items-center">
          <div className="bg-[#06038d] text-white text-2xl font-bold w-14 h-14 flex items-center justify-center rounded-lg">
            {String(value).padStart(2, "0")}
          </div>
          <span className="text-xs text-gray-500 mt-1">{label}</span>
        </div>
      ))}
    </div>
  );
}

const STEPS = [
  {
    step: 1,
    title: "線上提交申請",
    desc: "在平台填寫卡牌資料，選擇服務層級，確認費用及條款",
    icon: FileText,
    highlight: true,
  },
  {
    step: 2,
    title: "收到確認通知",
    desc: "系統自動發送確認通知（站內訊息 + Email），包含 BOXIUM 送件地址及截止日期",
    icon: Bell,
  },
  {
    step: 3,
    title: "打印申請單並寄卡",
    desc: "打印申請單，連同卡牌自費寄至 BOXIUM 指定地址（順豐站 852Z351）",
    icon: Package,
    highlight: true,
  },
  {
    step: 4,
    title: "BOXIUM 代辦申報",
    desc: "BOXIUM 確認收件後，代辦 PSA 申報及專業包裝，每月 2 次出團直送美國 PSA",
    icon: Shield,
  },
  {
    step: 5,
    title: "PSA 鑑定中",
    desc: "卡牌送往美國 PSA 進行官方鑑定，全程追蹤進度並即時通知",
    icon: Clock,
  },
  {
    step: 6,
    title: "鑑定完成，完成付款",
    desc: "鑑定完成後通知您評分結果，請於 30 天內完成付款",
    icon: DollarSign,
    highlight: true,
  },
  {
    step: 7,
    title: "寄回卡牌",
    desc: "付款確認後，BOXIUM 安排將鑑定完成的卡牌寄回給您",
    icon: Truck,
  },
];

const FEATURES = [
  {
    icon: Shield,
    title: "安全可靠",
    desc: "專業包裝保護，全程妥善保管，BOXIUM 收件後負責任何處理過程中的損壞",
  },
  {
    icon: Package,
    title: "一條龍服務",
    desc: "代辦 PSA 申報、專業包裝、直送美國，您只需寄卡，其餘全包",
  },
  {
    icon: Bell,
    title: "即時通知",
    desc: "每個關鍵節點均透過站內訊息及 Email 即時通知，隨時掌握鑑定進度",
  },
  {
    icon: Award,
    title: "PSA 官方認可",
    desc: "直送美國 PSA 官方鑑定中心，確保鑑定結果的真實性與公信力",
  },
];

const FAQS = [
  {
    q: "什麼卡片可以送 PSA 鑑定？",
    a: "PSA 接受各類集換式卡牌遊戲，包括 Pokémon TCG、遊戲王、Magic: The Gathering、One Piece TCG 等。如有疑問，歡迎提交前先聯絡我們確認。",
  },
  {
    q: "如何選擇服務層級？",
    a: "主要考慮兩個因素：(1) 卡牌市值 — 選擇最高申報價值高於您卡牌市值的層級；(2) 所需時間 — 如需快速鑑定可選 Express。一般收藏用途建議 Value Bulk，高價值卡牌建議 Regular 或以上。",
  },
  {
    q: "寄件後如何追蹤進度？",
    a: "每個狀態更新（收件確認、出團、鑑定完成等）均會透過站內訊息及 Email 通知您。您也可以隨時登入平台查看申請詳情頁面的即時狀態。",
  },
  {
    q: "鑑定完成後何時需要付款？",
    a: "鑑定完成後，系統會通知您評分結果及付款金額，請於 30 天內完成付款。逾期未付款，平台保留對相關卡片自行處理之權利。",
  },
  {
    q: "卡片評分不如預期怎麼辦？",
    a: "PSA 鑑定結果為最終結果，BOXIUM 無法干預評分。如對評分有異議，可透過 PSA 官方渠道申請複審（需額外費用）。",
  },
  {
    q: "卡片遺失或損壞如何處理？",
    a: "客人寄件至 BOXIUM 的過程由客人自行承擔風險，建議使用有追蹤號碼的寄件方式。BOXIUM 收件後如因我方疏忽導致損壞，最高賠償以服務費用為上限。",
  },
  {
    q: "可以取消申請嗎？",
    a: "卡片一經提交 PSA 後不可取消。若在 BOXIUM 收件後 48 小時內以書面通知取消，需支付 HK$50 行政費。",
  },
];

export default function Grading() {
  const { data: tiers, isLoading: tiersLoading } = trpc.grading.getServiceTiers.useQuery();
  const { data: nextBatch } = trpc.grading.getNextBatch.useQuery();

  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero Banner ── */}
      <section className="bg-[#06038d] text-white py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 border-4 border-white rounded-full" />
          <div className="absolute bottom-10 right-10 w-48 h-48 border-4 border-yellow-400 rounded-full" />
          <div className="absolute top-1/2 left-1/3 w-20 h-20 border-2 border-white rotate-45" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <Badge className="bg-yellow-400 text-[#06038d] font-bold mb-4 text-sm px-3 py-1">
            PSA 官方認可代送服務
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            BOXIUM × PSA
            <br />
            <span className="text-yellow-400">代客鑑定服務</span>
          </h1>
          <p className="text-lg md:text-xl text-blue-200 mb-8 max-w-2xl mx-auto">
            讓您的珍藏卡片獲得 PSA 官方認證，提升收藏價值。
            <br />
            一條龍代辦，省心省力，直送美國 PSA。
          </p>
          <div className="flex flex-row gap-3 justify-center">
            <Link href="/grading/submit" className="flex-1 max-w-[180px]">
              <Button size="lg" className="w-full bg-yellow-400 text-[#06038d] hover:bg-yellow-300 font-bold text-sm sm:text-base px-4 sm:px-8">
                立即提交申請
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/grading/orders" className="flex-1 max-w-[180px]">
              <Button size="lg" variant="outline" className="w-full border-white text-white hover:bg-white/10 font-bold text-sm sm:text-base px-4 sm:px-8">
                查看我的申請
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Next Batch Countdown ── */}
      {nextBatch && (
        <section className="bg-yellow-50 border-b border-yellow-200 py-8 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm font-semibold text-yellow-700 mb-2 uppercase tracking-wide">
              下次出團截止日期
            </p>
            <p className="text-lg font-bold text-gray-800 mb-4">
              {nextBatch.batchName} — {new Date(nextBatch.cutoffDate).toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <CountdownTimer deadline={new Date(nextBatch.cutoffDate)} />
            <p className="text-sm text-gray-500 mt-3">
              請於截止日期前將卡牌寄至 BOXIUM，以確保納入本次出團
            </p>
          </div>
        </section>
      )}

      {/* ── Features ── */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-3">
            為何選擇 BOXIUM 鑑定服務？
          </h2>
          <p className="text-center text-gray-500 mb-10">專業、透明、省心的一站式 PSA 代送體驗</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-[#06038d]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon className="h-6 w-6 text-[#06038d]" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Service Flow ── */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-3">
            服務流程
          </h2>
          <p className="text-center text-gray-500 mb-10">您只需完成步驟 1、3、6，其餘由 BOXIUM 全程代辦</p>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 hidden sm:block" />
            <div className="space-y-4">
              {STEPS.map(({ step, title, desc, icon: Icon, highlight }) => (
                <div
                  key={step}
                  className={`flex gap-4 p-4 rounded-xl transition-all ${
                    highlight
                      ? "bg-[#06038d] text-white shadow-lg"
                      : "bg-gray-50 text-gray-700"
                  }`}
                >
                  <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg z-10 ${
                    highlight ? "bg-yellow-400 text-[#06038d]" : "bg-white border-2 border-gray-200 text-gray-600"
                  }`}>
                    {step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-4 w-4 ${highlight ? "text-yellow-400" : "text-[#06038d]"}`} />
                      <h3 className="font-bold text-base">{title}</h3>
                      {highlight && (
                        <Badge className="bg-yellow-400 text-[#06038d] text-xs font-bold">您需操作</Badge>
                      )}
                    </div>
                    <p className={`text-sm ${highlight ? "text-blue-200" : "text-gray-500"}`}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing Table ── */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-3">
            服務層級及收費
          </h2>
          <p className="text-center text-gray-500 mb-10">所有費用已包含 BOXIUM 代辦服務費</p>

          {tiersLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <thead>
                  <tr className="bg-[#06038d] text-white">
                    <th className="text-left p-4 font-semibold">服務層級</th>
                    <th className="text-right p-4 font-semibold">代送 PSA 費用</th>
                    <th className="text-right p-4 font-semibold hidden sm:table-cell">最高申報價值</th>
                    <th className="text-right p-4 font-semibold hidden md:table-cell">預計完成時間</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers?.map((tier: any, idx: number) => (
                    <tr
                      key={tier.id}
                      className={`border-t border-gray-100 hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/50"}`}
                    >
                      <td className="p-4">
                        <div className="font-bold text-gray-900">{tier.name}</div>
                        {tier.description && (
                          <div className="text-xs text-gray-500 mt-0.5">{tier.description}</div>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-xl font-bold text-[#06038d]">HK${parseFloat(tier.feeHkd).toLocaleString()}</span>
                        <span className="text-sm text-gray-500"> / 張</span>
                      </td>
                      <td className="p-4 text-right hidden sm:table-cell">
                        <span className="text-gray-700">USD ${parseFloat(tier.maxDeclaredValueUsd).toLocaleString()}</span>
                      </td>
                      <td className="p-4 text-right hidden md:table-cell">
                        <span className="text-gray-700">
                          約 {tier.estimatedDaysMin}–{tier.estimatedDaysMax} 個月
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 space-y-1">
            <p className="text-xs text-gray-500">＊價格或會因應官方調整而更改，恕不另行通知。</p>
            <p className="text-xs text-gray-500">＊＊鑑定期以工作天計算，實際時間會根據官方實際情況而定。此時間不包括運輸時間。</p>
          </div>
        </div>
      </section>

      {/* ── Shipping Address ── */}
      <section className="py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-[#06038d] text-white rounded-2xl p-8 text-center">
            <Package className="h-10 w-10 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">BOXIUM 送件地址</h2>
            <p className="text-blue-200 text-sm mb-4">提交申請後，請將卡牌連同打印的申請單一起寄至以下地址</p>
            <div className="bg-white/10 rounded-xl p-4 text-left">
              <p className="font-bold text-yellow-400 mb-1">📦 順豐站 852Z351</p>
              <p className="text-white">香港新界離島區東涌逸東街 8 號</p>
              <p className="text-white">逸東邨逸東商場 2 樓 201 號舖</p>
            </div>
            <p className="text-xs text-blue-300 mt-4">
              ⚠️ 請務必打印申請單連同卡牌一起寄出，否則無法處理您的申請
            </p>
          </div>
        </div>
      </section>

      {/* ── Payment Notice ── */}
      <section className="py-8 px-4 bg-amber-50">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800 mb-1">重要：付款期限</p>
              <p className="text-sm text-amber-700">
                鑑定完成後，客人須於 <strong>30 天內</strong> 完成付款。如逾期未付款，BOXIUM 保留對相關卡片自行處理之權利，包括但不限於出售、捐贈或銷毀，客人將不獲任何賠償。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-10">
            常見問題
          </h2>
          <Accordion type="single" collapsible className="space-y-2">
            {FAQS.map((faq, idx) => (
              <AccordionItem
                key={idx}
                value={`faq-${idx}`}
                className="bg-white rounded-xl border border-gray-100 px-4 shadow-sm"
              >
                <AccordionTrigger className="text-left font-semibold text-gray-800 hover:no-underline py-4">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 text-sm pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── CTA Bottom ── */}
      <section className="py-16 px-4 bg-[#06038d] text-white text-center">
        <div className="max-w-2xl mx-auto">
          <CheckCircle2 className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-bold mb-3">立即開始您的 PSA 鑑定之旅</h2>
          <p className="text-blue-200 mb-8">
            提交申請只需幾分鐘，其餘交給 BOXIUM 全程代辦
          </p>
          <Link href="/grading/submit">
            <Button size="lg" className="bg-yellow-400 text-[#06038d] hover:bg-yellow-300 font-bold text-base px-10">
              立即提交申請
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
