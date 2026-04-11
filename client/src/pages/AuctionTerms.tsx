import { useState } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronUp, ShoppingCart, Gavel, DollarSign, Shield, AlertTriangle, CheckCircle, ArrowRight, Package, CreditCard, RotateCcw, Clock, Scale, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";

const BRAND_BLUE = "#06038D";
const BRAND_YELLOW = "#FEDD00";

interface SectionProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: (id: string) => void;
}

function Section({ id, icon, title, badge, children, isOpen, onToggle }: SectionProps) {
  return (
    <div id={id} className="border border-blue-100 rounded-2xl overflow-hidden shadow-sm mb-4 scroll-mt-20">
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors"
        style={{ background: isOpen ? BRAND_BLUE : "#fff" }}
        onClick={() => onToggle(id)}
      >
        <span
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
          style={isOpen ? { background: "rgba(255,255,255,0.2)", color: "#fff" } : { background: BRAND_BLUE, color: "#fff" }}
        >
          {icon}
        </span>
        <span className={`flex-1 font-bold text-base ${isOpen ? "text-white" : "text-[#06038D]"}`}>{title}</span>
        {badge && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mr-2"
            style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}>{badge}</span>
        )}
        <span className={isOpen ? "text-white/70" : "text-gray-400"}>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      {isOpen && (
        <div className="px-5 py-5 bg-white text-sm text-gray-700 leading-relaxed space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

function Rule({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center mt-0.5"
        style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}>{num}</span>
      <div>
        <p className="font-semibold text-[#06038D] mb-0.5">{title}</p>
        <p className="text-gray-600 text-sm">{children}</p>
      </div>
    </div>
  );
}

function InfoBox({ type, children }: { type: "info" | "warning" | "success"; children: React.ReactNode }) {
  const styles = {
    info: { bg: "bg-blue-50", border: "border-blue-200", icon: <Shield className="w-4 h-4 text-blue-600" /> },
    warning: { bg: "bg-amber-50", border: "border-amber-200", icon: <AlertTriangle className="w-4 h-4 text-amber-600" /> },
    success: { bg: "bg-green-50", border: "border-green-200", icon: <CheckCircle className="w-4 h-4 text-green-600" /> },
  };
  const s = styles[type];
  return (
    <div className={`flex gap-2.5 p-3.5 rounded-xl border ${s.bg} ${s.border}`}>
      <span className="flex-shrink-0 mt-0.5">{s.icon}</span>
      <p className="text-sm text-gray-700">{children}</p>
    </div>
  );
}

const TOC = [
  { id: "overview", label: "平台概覽" },
  { id: "buy-now", label: "直購流程" },
  { id: "auction", label: "拍賣流程" },
  { id: "fees", label: "平台收費" },
  { id: "payment", label: "付款與結算" },
  { id: "shipping", label: "交收安排" },
  { id: "returns", label: "退款政策" },
  { id: "conduct", label: "行為守則" },
  { id: "liability", label: "免責聲明" },
];

export default function AuctionTerms() {
  const [tocOpen, setTocOpen] = useState(false);
  const [openSectionId, setOpenSectionId] = useState<string | null>("overview");
  const handleToggle = (id: string) => setOpenSectionId(prev => prev === id ? null : id);
  const { data: feeTiersData, isLoading: feeTiersLoading } = trpc.marketplace.getFeeTiers.useQuery();

  // Build display tiers from API data or fall back to defaults
  const displayTiers = feeTiersData ? feeTiersData.map((t, i) => {
    const ratePercent = (t.rate * 100).toFixed(1).replace(/\.0$/, '') + '%';
    const tierColors = [
      { color: 'bg-amber-50', badge: 'bg-amber-100 text-amber-800' },
      { color: 'bg-blue-50', badge: 'bg-blue-100 text-blue-800' },
      { color: 'bg-green-50', badge: 'bg-green-100 text-green-800' },
    ];
    const tierNames = ['第一級', '第二級', '第三級'];
    const tierRanges = [
      t.maxAmount ? `HKD ${t.maxAmount.toLocaleString()} 或以下` : 'HKD 10,001 或以上',
      feeTiersData[0]?.maxAmount && feeTiersData[1]?.maxAmount
        ? `HKD ${(feeTiersData[0].maxAmount + 1).toLocaleString()} – HKD ${feeTiersData[1].maxAmount.toLocaleString()}`
        : 'HKD 5,001 – HKD 10,000',
      feeTiersData[1]?.maxAmount ? `HKD ${(feeTiersData[1].maxAmount + 1).toLocaleString()} 或以上` : 'HKD 10,001 或以上',
    ];
    // Example calculations
    const exampleAmounts = [1000, 8000, 15000];
    const exAmt = exampleAmounts[i] || 1000;
    const exFee = Math.round(exAmt * t.rate);
    const exReceive = exAmt - exFee;
    const example = `成交 HKD ${exAmt.toLocaleString()} → 服務費 HKD ${exFee.toLocaleString()}，實收 HKD ${exReceive.toLocaleString()}`;
    return {
      tier: tierNames[i] || `第${i+1}級`,
      range: tierRanges[i],
      rate: ratePercent,
      color: (tierColors[i] || tierColors[0]).color,
      badge: (tierColors[i] || tierColors[0]).badge,
      example,
    };
  }) : [
    { tier: '第一級', range: 'HKD 5,000 或以下', rate: '5.5%', color: 'bg-amber-50', badge: 'bg-amber-100 text-amber-800', example: '成交 HKD 1,000 → 服務費 HKD 55，實收 HKD 945' },
    { tier: '第二級', range: 'HKD 5,001 – HKD 10,000', rate: '5%', color: 'bg-blue-50', badge: 'bg-blue-100 text-blue-800', example: '成交 HKD 8,000 → 服務費 HKD 400，實收 HKD 7,600' },
    { tier: '第三級', range: 'HKD 10,001 或以上', rate: '4.5%', color: 'bg-green-50', badge: 'bg-green-100 text-green-800', example: '成交 HKD 15,000 → 服務費 HKD 675，實收 HKD 14,325' },
  ];

  const scrollTo = (id: string) => {
    setOpenSectionId(id);
    setTocOpen(false);
    // Wait a tick for the section to expand before scrolling
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #1a0a9e 100%)` }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white transform translate-x-1/3 -translate-y-1/3" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-white transform -translate-x-1/3 translate-y-1/3" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 py-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4"
            style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}>
            <Shield className="w-3 h-3" />
            BOXIUM PTCG 官方條款
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3 leading-tight">
            買賣條款及細則
          </h1>
          <p className="text-white/70 text-sm max-w-xl mx-auto">
            本條款適用於 Boxium PTCG 平台上的所有買賣交易，包括直購及拍賣商品。請於交易前仔細閱讀，使用本平台即表示你同意以下所有條款。
          </p>
          <p className="text-white/40 text-xs mt-4">最後更新：2025 年 4 月</p>
        </div>
      </div>

      {/* Sticky TOC (mobile) */}
      <div className="sticky top-14 z-30 bg-white border-b border-blue-100 shadow-sm sm:hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold"
          style={{ color: BRAND_BLUE }}
          onClick={() => setTocOpen(v => !v)}
        >
          <span>目錄導覽</span>
          {tocOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {tocOpen && (
          <div className="px-4 pb-3 grid grid-cols-2 gap-1.5">
            {TOC.map(t => (
              <button key={t.id} onClick={() => scrollTo(t.id)}
                className="text-left text-xs px-3 py-2 rounded-lg bg-blue-50 text-[#06038D] font-medium hover:bg-blue-100 transition-colors">
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Desktop TOC */}
        <div className="hidden sm:block mb-8 p-5 rounded-2xl border-2 border-blue-100 bg-white">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">目錄</p>
          <div className="grid grid-cols-3 gap-2">
            {TOC.map(t => (
              <button key={t.id} onClick={() => scrollTo(t.id)}
                className="text-left text-sm px-3 py-2 rounded-xl hover:bg-blue-50 text-[#06038D] font-medium transition-colors flex items-center gap-1.5">
                <ArrowRight className="w-3 h-3 opacity-50" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 1: Platform Overview */}
        <Section id="overview" icon={<Package className="w-5 h-5" />} title="一、平台概覽" isOpen={openSectionId === "overview"} onToggle={handleToggle}>
          <p>
            Boxium PTCG（下稱「本平台」）是一個專為集換式卡牌（TCG）愛好者而設的香港買賣平台，提供<strong>直購</strong>及<strong>拍賣</strong>兩種交易模式，讓買賣雙方能夠安全、便捷地進行卡牌交易。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <div className="rounded-xl p-4 border border-blue-100 bg-blue-50">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="w-4 h-4" style={{ color: BRAND_BLUE }} />
                <span className="font-bold text-sm" style={{ color: BRAND_BLUE }}>直購模式</span>
              </div>
              <p className="text-xs text-gray-600">賣家設定固定售價，買家即時購買，交易即時確認。</p>
            </div>
            <div className="rounded-xl p-4 border border-blue-100 bg-blue-50">
              <div className="flex items-center gap-2 mb-2">
                <Gavel className="w-4 h-4" style={{ color: BRAND_BLUE }} />
                <span className="font-bold text-sm" style={{ color: BRAND_BLUE }}>拍賣模式</span>
              </div>
              <p className="text-xs text-gray-600">賣家設定起拍價，買家競標，限時結束後最高出價者得標。</p>
            </div>
          </div>
          <InfoBox type="info">
            本平台所有交易均以<strong>港幣（HKD）</strong>計算。賣家須完成 Stripe Connect 收款帳戶設定方可上架商品。
          </InfoBox>
        </Section>

        {/* Section 2: Buy Now Flow */}
        <Section id="buy-now" icon={<ShoppingCart className="w-5 h-5" />} title="二、直購流程" badge="直購" isOpen={openSectionId === "buy-now"} onToggle={handleToggle}>
          <div className="space-y-3">
            <p className="font-semibold text-[#06038D]">買家流程</p>
            <div className="space-y-3">
              <Rule num="1" title="瀏覽及選購">在商品列表中選擇心儀商品，查閱商品詳情、品相評級及賣家評分。</Rule>
              <Rule num="2" title="加入購物車或即時購買">點擊「立即購買」或加入購物車後結帳，確認訂單詳情及總金額。</Rule>
              <Rule num="3" title="完成付款">透過 Stripe 安全支付頁面完成付款，系統即時確認訂單。</Rule>
              <Rule num="4" title="等候交收">賣家確認出貨後，根據雙方協議的交收方式完成交收。</Rule>
            </div>
            <div className="border-t border-gray-100 pt-3 mt-3">
              <p className="font-semibold text-[#06038D] mb-3">賣家流程</p>
              <div className="space-y-3">
                <Rule num="1" title="上架商品">填寫商品名稱、品相、系列、售價及商品圖片，提交審核。</Rule>
                <Rule num="2" title="等候管理員審核">所有商品須經平台管理員審核後方可公開上架，確保商品資訊準確。</Rule>
                <Rule num="3" title="處理訂單">收到訂單通知後，在規定時間內確認出貨並安排交收。</Rule>
                <Rule num="4" title="收款結算">交易完成後，平台扣除服務費後將款項結算至賣家 Stripe 帳戶。</Rule>
              </div>
            </div>
            <InfoBox type="warning">
              買家確認付款後，訂單即告成立。除符合退款政策的情況外，買家不得單方面取消訂單。
            </InfoBox>
          </div>
        </Section>

        {/* Section 3: Auction Flow */}
        <Section id="auction" icon={<Gavel className="w-5 h-5" />} title="三、拍賣流程及條款" badge="拍賣" isOpen={openSectionId === "auction"} onToggle={handleToggle}>
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-[#06038D] mb-3">拍賣流程</p>
              <div className="space-y-3">
                <Rule num="1" title="賣家設定拍賣">設定起拍價、拍賣天數（3 日或 7 日）及可選即買價，提交審核後上架。</Rule>
                <Rule num="2" title="買家出價">登入後可對進行中的拍賣出價，每次出價必須高於當前最高出價。</Rule>
                <Rule num="3" title="拍賣結束">拍賣時間結束時，最高出價者自動得標。系統即時通知買賣雙方。</Rule>
                <Rule num="4" title="付款及交收">得標買家須在 <strong>48 小時內</strong>完成付款，逾期視為放棄得標資格。</Rule>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-blue-100">
              <div className="px-4 py-2.5 text-xs font-bold text-white" style={{ background: BRAND_BLUE }}>拍賣重要規則</div>
              <div className="divide-y divide-gray-100">
                {[
                  { icon: "🔒", title: "出價具法律約束力", desc: "一旦出價，即構成購買承諾。得標後必須完成付款，否則帳號將受到限制。" },
                  { icon: "⏱️", title: "即買價機制", desc: "若賣家設有即買價，買家可隨時以即買價直接購買，拍賣即時結束。" },
                  { icon: "🔔", title: "自動通知", desc: "被超越出價時，系統將自動通知買家，讓你有機會再次出價。" },
                  { icon: "⏰", title: "防狙擊機制", desc: "拍賣結束前 5 分鐘內有新出價，拍賣時間將自動延長 5 分鐘，確保公平競標。" },
                  { icon: "❌", title: "拍賣取消限制", desc: "拍賣開始後，若已有出價，賣家不得單方面取消拍賣，違者將受到平台處分。" },
                  { icon: "🏆", title: "得標確認", desc: "拍賣結束後，系統自動向得標買家發送付款連結，請留意通知。" },
                ].map((r, i) => (
                  <div key={i} className="flex gap-3 px-4 py-3">
                    <span className="text-base flex-shrink-0">{r.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{r.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <InfoBox type="warning">
              得標買家若在 48 小時內未完成付款，平台有權將商品重新上架，並對違規帳號採取相應措施，包括限制出價資格。
            </InfoBox>
          </div>
        </Section>

        {/* Section 4: Fees */}
        <Section id="fees" icon={<DollarSign className="w-5 h-5" />} title="四、平台收費說明" badge="重要" isOpen={openSectionId === "fees"} onToggle={handleToggle}>
          <div className="space-y-4">
            <p>本平台採用<strong>階梯式服務費</strong>，按成交金額高低收取不同費率，成交金額越高，費率越低。服務費僅向<strong>賣家</strong>收取，買家無需支付額外服務費。</p>

            {/* Fee Tier Table */}
            <div className="rounded-xl overflow-hidden border border-blue-100 shadow-sm">
              <div className="px-4 py-3 text-sm font-bold text-white flex items-center gap-2" style={{ background: BRAND_BLUE }}>
                <DollarSign className="w-4 h-4" />
                賣家服務費率（以成交金額計算）
              </div>
              <div className="divide-y divide-blue-50">
                {feeTiersLoading ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">載入費率中...</div>
                ) : displayTiers.map((t, i) => (
                  <div key={i} className={`px-4 py-3.5 ${t.color}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.badge}`}>{t.tier}</span>
                        <span className="text-sm font-medium text-gray-700">{t.range}</span>
                      </div>
                      <span className="text-lg font-black" style={{ color: BRAND_BLUE }}>{t.rate}</span>
                    </div>
                    <p className="text-xs text-gray-500 pl-0.5">{t.example}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4 border border-blue-100 bg-blue-50 space-y-2">
              <p className="text-sm font-bold" style={{ color: BRAND_BLUE }}>費率補充說明</p>
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li className="flex gap-2"><span className="text-blue-400 mt-0.5">•</span>服務費於款項結算時自動扣除，賣家毋須另行繳付。</li>
                <li className="flex gap-2"><span className="text-blue-400 mt-0.5">•</span>費率以<strong>單筆成交金額</strong>計算，而非累計金額。</li>
                <li className="flex gap-2"><span className="text-blue-400 mt-0.5">•</span>平台保留調整費率的權利，並提前 7 日以公告形式通知賣家。</li>
                <li className="flex gap-2"><span className="text-blue-400 mt-0.5">•</span>買家付款時，Stripe 支付手續費由平台承擔，不另向買家收取。</li>
              </ul>
            </div>

            <InfoBox type="success">
              上架商品及瀏覽平台完全免費。平台僅於交易成功後才收取服務費，不成交不收費。
            </InfoBox>
          </div>
        </Section>

        {/* Section 5: Payment */}
        <Section id="payment" icon={<CreditCard className="w-5 h-5" />} title="五、付款與結算" isOpen={openSectionId === "payment"} onToggle={handleToggle}>
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-[#06038D] mb-2">買家付款</p>
              <div className="space-y-2">
                <Rule num="1" title="接受付款方式">本平台透過 Stripe 處理所有付款，支援 Visa、Mastercard、American Express 等主要信用卡及扣帳卡。</Rule>
                <Rule num="2" title="付款安全">所有付款均透過 Stripe 加密處理，本平台不儲存任何信用卡資料。</Rule>
                <Rule num="3" title="付款時限">直購訂單須即時完成付款；拍賣得標後須於 48 小時內付款。</Rule>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <p className="font-semibold text-[#06038D] mb-2">賣家結算與放款流程</p>
              <div className="space-y-2">
                <Rule num="1" title="Stripe Connect 帳戶">賣家須設立並連接 Stripe Connect 帳戶，方可接收款項。</Rule>
                <Rule num="2" title="買家確認收貨">買家收到商品後，須在訂單頁面點擊「確認收貨」。如買家在出貨後 14 天內未確認收貨，系統將自動完成訂單。</Rule>
                <Rule num="3" title="48 小時冷靜期">買家確認收貨（或系統自動完成訂單）後，款項進入 <strong>48 小時冷靜期保護</strong>。在此期間，買家可就商品問題提出爭議申請。</Rule>
                <Rule num="4" title="自動放款">冷靜期結束後，若無任何爭議，系統將自動將款項（扣除平台服務費後的實收金額）轉帳至賣家 Stripe Connect 帳戶。</Rule>
                <Rule num="5" title="爭議暫停放款">如冷靜期內買家提出爭議，款項將暫時凍結，直至爭議處理完畢後方可放款。</Rule>
              </div>
            </div>

            {/* Payout Flow Diagram */}
            <div className="rounded-xl overflow-hidden border border-blue-100">
              <div className="px-4 py-2.5 text-xs font-bold text-white flex items-center gap-2" style={{ background: BRAND_BLUE }}>
                <Clock className="w-3.5 h-3.5" />
                放款時間軸
              </div>
              <div className="p-4">
                {/* Timeline: full-width connector line with dots centered on it */}
                <div className="relative">
                  {/* Full-width background line */}
                  <div className="absolute top-[5px] left-[6px] right-[6px] h-0.5 bg-gray-200" />
                  {/* Dots row */}
                  <div className="relative flex justify-between mb-2">
                    {[
                      { color: "bg-blue-500" },
                      { color: "bg-amber-500" },
                      { color: "bg-green-500" },
                    ].map((item, i) => (
                      <div key={i} className={`w-3 h-3 rounded-full flex-shrink-0 ${item.color} relative z-10`} />
                    ))}
                  </div>
                  {/* Labels row */}
                  <div className="flex justify-between">
                    {[
                      { step: "買家確認收貨", sub: "或系統自動完成（14天後）" },
                      { step: "48 小時冷静期", sub: "買家可提出爭議申請" },
                      { step: "自動放款", sub: "款項轉入賣家帳戶" },
                    ].map((item, i) => (
                      <div key={i} className={`text-center ${i === 0 ? 'text-left' : i === 2 ? 'text-right' : 'text-center'}`} style={{ width: '33%' }}>
                        <p className="text-xs font-semibold text-gray-800">{item.step}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{item.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <InfoBox type="info">
              如賣家尚未設立 Stripe Connect 帳戶，款項將暫時保留，直至帳戶設立完成後方可提取。冷靜期保護機制旨在保障買家權益，同時確保賣家在無爭議的情況下能及時收款。
            </InfoBox>
          </div>
        </Section>

        {/* Section 6: Shipping */}
        <Section id="shipping" icon={<Package className="w-5 h-5" />} title="六、交收安排" isOpen={openSectionId === "shipping"} onToggle={handleToggle}>
          <div className="space-y-3">
            <p>買賣雙方須在訂單確認後，透過平台訊息功能協商交收方式。本平台目前支援以下交收方式：</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: "🤝", title: "面交", desc: "雙方協定地點及時間，親身交收。建議選擇公共場所。" },
                { icon: "📦", title: "郵寄", desc: "賣家負責安全包裝及寄出，運費由雙方協議承擔。" },
                { icon: "🏪", title: "門市自取", desc: "如賣家設有實體門市，買家可預約自取。" },
              ].map((m, i) => (
                <div key={i} className="rounded-xl p-3.5 border border-blue-100 bg-blue-50">
                  <div className="text-2xl mb-1.5">{m.icon}</div>
                  <p className="text-sm font-bold text-[#06038D] mb-1">{m.title}</p>
                  <p className="text-xs text-gray-500">{m.desc}</p>
                </div>
              ))}
            </div>
            <InfoBox type="warning">
              郵寄交收時，賣家建議使用掛號或有追蹤號碼的寄件方式，以保障雙方利益。如商品在運送途中損毀或遺失，責任歸屬由雙方協商解決，平台不承擔相關責任。
            </InfoBox>
          </div>
        </Section>

        {/* Section 7: Returns */}
        <Section id="returns" icon={<RotateCcw className="w-5 h-5" />} title="七、退款及退貨政策" isOpen={openSectionId === "returns"} onToggle={handleToggle}>
          <div className="space-y-3">
            <p>本平台的退款政策以保障買家利益為前提，同時尊重賣家的合理權益。</p>
            <div className="rounded-xl overflow-hidden border border-blue-100">
              <div className="px-4 py-2.5 text-xs font-bold text-white" style={{ background: BRAND_BLUE }}>可申請退款的情況</div>
              <div className="divide-y divide-gray-100">
                {[
                  { icon: "✅", title: "商品與描述嚴重不符", desc: "收到商品的品相、版本或狀況與賣家描述有重大差異。" },
                  { icon: "✅", title: "收到損毀商品", desc: "商品在運送過程中損毀，且非買家原因造成。" },
                  { icon: "✅", title: "賣家未能出貨", desc: "賣家在承諾時間內未能安排交收，且未有合理解釋。" },
                ].map((r, i) => (
                  <div key={i} className="flex gap-3 px-4 py-3">
                    <span className="text-base flex-shrink-0">{r.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{r.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl overflow-hidden border border-red-100">
              <div className="px-4 py-2.5 text-xs font-bold text-white bg-red-500">不接受退款的情況</div>
              <div className="divide-y divide-gray-100">
                {[
                  { icon: "❌", title: "買家個人原因", desc: "買家改變主意、重複購買或個人喜好問題，不接受退款。" },
                  { icon: "❌", title: "拍賣得標後", desc: "拍賣成交後，除商品描述嚴重不符外，一律不接受退款。" },
                  { icon: "❌", title: "已使用或改動的商品", desc: "商品經買家使用、改動或損毀後，不接受退款申請。" },
                ].map((r, i) => (
                  <div key={i} className="flex gap-3 px-4 py-3">
                    <span className="text-base flex-shrink-0">{r.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{r.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <InfoBox type="info">
              如需申請退款，請於收貨後 <strong>3 日內</strong>透過平台訊息功能聯絡賣家，並提供相關證明（如照片）。如雙方未能達成協議，可向平台客服申請介入調解。
            </InfoBox>
          </div>
        </Section>

        {/* Section 8: Conduct */}
        <Section id="conduct" icon={<Scale className="w-5 h-5" />} title="八、用戶行為守則" isOpen={openSectionId === "conduct"} onToggle={handleToggle}>
          <div className="space-y-3">
            <p>為維護平台的公平交易環境，所有用戶須遵守以下行為守則：</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: "🚫", title: "禁止虛假描述", desc: "賣家不得以虛假或誤導性資訊描述商品，包括品相、版本及真偽。" },
                { icon: "🚫", title: "禁止操控出價", desc: "禁止以多個帳號或與他人勾結的方式操控拍賣出價。" },
                { icon: "🚫", title: "禁止場外交易", desc: "禁止繞過平台進行私下交易，以規避平台服務費。" },
                { icon: "🚫", title: "禁止騷擾行為", desc: "禁止以任何形式騷擾、威脅或欺詐其他用戶。" },
                { icon: "✅", title: "誠實交易", desc: "買賣雙方須誠實、守信地完成每一筆交易。" },
                { icon: "✅", title: "及時回應", desc: "交易雙方應在合理時間內回應對方的訊息及請求。" },
              ].map((r, i) => (
                <div key={i} className="flex gap-2.5 p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <span className="text-lg flex-shrink-0">{r.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{r.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Violation Penalty Table */}
            <div className="rounded-xl overflow-hidden border border-blue-100 mt-2">
              <div className="px-4 py-2.5 text-xs font-bold text-white" style={{ background: BRAND_BLUE }}>違規懲罰制度</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-50">
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-[#06038D]">違規次數</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-[#06038D]">懲罰措施</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-[#06038D]">封禁時長</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      { count: "第 1 次", action: "書面警告，永久記錄", duration: "無封禁", color: "text-emerald-600" },
                      { count: "第 2 次", action: "封禁競標資格", duration: "7 天", color: "text-amber-600" },
                      { count: "第 3 次", action: "封禁競標資格", duration: "30 天", color: "text-orange-600" },
                      { count: "第 4 次及以上", action: "永久封禁，保留追討損失權利", duration: "永久", color: "text-red-600" },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-800 text-sm">{row.count}</td>
                        <td className="px-4 py-3 text-gray-600 text-sm">{row.action}</td>
                        <td className={`px-4 py-3 font-bold text-sm ${row.color}`}>{row.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <InfoBox type="warning">
              違反行為守則的用戶，平台有權採取相應措施，包括警告、暫停帳號或永久封禁，視乎違規嚴重程度而定。如認為違規記錄有誤，可在 7 個工作日內向平台客服提出書面申訴。
            </InfoBox>
          </div>
        </Section>

        {/* Section 9: Liability */}
        <Section id="liability" icon={<FileText className="w-5 h-5" />} title="九、免責聲明及法律條款" isOpen={openSectionId === "liability"} onToggle={handleToggle}>
          <div className="space-y-3">
            <div className="space-y-2">
              <Rule num="1" title="平台角色">本平台僅作為買賣雙方的交易媒介，不對商品的真偽、品質或狀況作出任何保證。</Rule>
              <Rule num="2" title="交易風險">買賣雙方須自行承擔交易風險。本平台對因交易產生的任何損失不承擔法律責任。</Rule>
              <Rule num="3" title="賠償上限">若本平台被裁定須就任何事項承擔責任，最高賠償責任不超過相關交易中本平台實際收取的服務費金額。</Rule>
              <Rule num="4" title="服務中斷">本平台不保證服務的持續性及穩定性，因技術故障或維護導致的服務中斷，平台不承擔責任。</Rule>
              <Rule num="5" title="條款修改">本平台保留隨時修改條款的權利，修改後的條款將在平台公告後生效。繼續使用本平台即表示接受修改後的條款。</Rule>
              <Rule num="6" title="適用法律">本條款受香港特別行政區法律管轄，任何爭議應提交香港法院解決。</Rule>
            </div>
            <InfoBox type="info">
              如對本條款有任何疑問，請透過平台客服功能聯絡我們。我們致力於為買賣雙方提供公平、安全的交易環境。
            </InfoBox>
          </div>
        </Section>

        {/* Key Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {[
            { icon: Shield, title: "平台保障", desc: "本平台作為中介，提供爭議調解服務，保障買賣雙方的合理權益。" },
            { icon: Scale, title: "公平交易", desc: "所有出價具法律約束力，防狙擊機制確保公平競標，違規行為受到相應處理。" },
            { icon: Clock, title: "時效要求", desc: "得標後 48 小時內付款，賣家付款確認後 3 個工作日內發貨，逾期將受處分。" },
          ].map((item, i) => (
            <div key={i} className="rounded-xl border border-blue-100 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <item.icon className="w-4 h-4" style={{ color: BRAND_BLUE }} />
                <span className="font-bold text-sm" style={{ color: BRAND_BLUE }}>{item.title}</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="rounded-2xl overflow-hidden border-2 border-[#FEDD00]" style={{ background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #1a0a9e 100%)` }}>
          <div className="px-6 py-8 text-center">
            <p className="text-[#FEDD00] text-xs font-bold uppercase tracking-widest mb-2">BOXIUM PTCG</p>
            <h3 className="text-white font-black text-xl mb-2">準備好開始交易了嗎？</h3>
            <p className="text-white/60 text-sm mb-6">閱讀並同意以上條款後，即可開始在 Boxium PTCG 買賣卡牌。</p>
            <div className="flex flex-row flex-wrap gap-3 justify-center">
              <Link href="/marketplace">
                <button className="px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 justify-center transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                  style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}>
                  <ShoppingCart className="w-4 h-4" />
                  瀏覽商品
                </button>
              </Link>
              <Link href="/seller">
                <button className="px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 justify-center border-2 border-white/30 text-white transition-all hover:bg-white/10 whitespace-nowrap">
                  <Gavel className="w-4 h-4" />
                  開始出售
                </button>
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 pb-4">
          © 2025 Boxium PTCG. 保留所有權利。 ·{" "}
          <Link href="/privacy" className="hover:underline">私隱政策</Link>
        </p>
      </div>
    </div>
  );
}
