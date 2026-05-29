import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronDown, ChevronUp, ShoppingCart, Gavel, DollarSign, Shield, AlertTriangle, CheckCircle, ArrowRight, ArrowLeft, Package, CreditCard, RotateCcw, Clock, Scale, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";

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

export default function AuctionTerms() {
  const { t } = useTranslation();
  const [tocOpen, setTocOpen] = useState(false);
  const [openSectionId, setOpenSectionId] = useState<string | null>("overview");
  const handleToggle = (id: string) => setOpenSectionId(prev => prev === id ? null : id);
  const { data: feeTiersData, isLoading: feeTiersLoading } = trpc.marketplace.getFeeTiers.useQuery();
  const [, navigate] = useLocation();
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate("/");
    }
  };

  const TOC = [
    { id: "overview", label: t("auctionTerms.toc.overview") },
    { id: "buy-now", label: t("auctionTerms.toc.buyNow") },
    { id: "auction", label: t("auctionTerms.toc.auction") },
    { id: "fees", label: t("auctionTerms.toc.fees") },
    { id: "payment", label: t("auctionTerms.toc.payment") },
    { id: "shipping", label: t("auctionTerms.toc.shipping") },
    { id: "returns", label: t("auctionTerms.toc.returns") },
    { id: "conduct", label: t("auctionTerms.toc.conduct") },
    { id: "liability", label: t("auctionTerms.toc.liability") },
  ];

  // Build display tiers from API data or fall back to defaults
  const displayTiers = feeTiersData ? feeTiersData.map((tier, i) => {
    const ratePercent = (tier.rate * 100).toFixed(1).replace(/\.0$/, '') + '%';
    const tierColors = [
      { color: 'bg-amber-50', badge: 'bg-amber-100 text-amber-800' },
      { color: 'bg-blue-50', badge: 'bg-blue-100 text-blue-800' },
      { color: 'bg-green-50', badge: 'bg-green-100 text-green-800' },
    ];
    const tierNames = [
      t("auctionTerms.fees.tier1"),
      t("auctionTerms.fees.tier2"),
      t("auctionTerms.fees.tier3"),
    ];
    const tierRanges = [
      tier.maxAmount ? t("auctionTerms.fees.rangeBelow", { amount: tier.maxAmount.toLocaleString() }) : t("auctionTerms.fees.rangeAbove", { amount: "10,001" }),
      feeTiersData[0]?.maxAmount && feeTiersData[1]?.maxAmount
        ? `HKD ${(feeTiersData[0].maxAmount + 1).toLocaleString()} – HKD ${feeTiersData[1].maxAmount.toLocaleString()}`
        : 'HKD 5,001 – HKD 10,000',
      feeTiersData[1]?.maxAmount ? t("auctionTerms.fees.rangeAbove", { amount: (feeTiersData[1].maxAmount + 1).toLocaleString() }) : t("auctionTerms.fees.rangeAbove", { amount: "10,001" }),
    ];
    const exampleAmounts = [1000, 8000, 15000];
    const exAmt = exampleAmounts[i] || 1000;
    const exFee = Math.round(exAmt * tier.rate);
    const exReceive = exAmt - exFee;
    const example = t("auctionTerms.fees.example", { amount: exAmt.toLocaleString(), fee: exFee.toLocaleString(), receive: exReceive.toLocaleString() });
    return {
      tier: tierNames[i] || `${t("auctionTerms.fees.tierLabel")}${i+1}`,
      range: tierRanges[i],
      rate: ratePercent,
      color: (tierColors[i] || tierColors[0]).color,
      badge: (tierColors[i] || tierColors[0]).badge,
      example,
    };
  }) : [
    { tier: t("auctionTerms.fees.tier1"), range: t("auctionTerms.fees.rangeBelow", { amount: "5,000" }), rate: '5.5%', color: 'bg-amber-50', badge: 'bg-amber-100 text-amber-800', example: t("auctionTerms.fees.example", { amount: "1,000", fee: "55", receive: "945" }) },
    { tier: t("auctionTerms.fees.tier2"), range: 'HKD 5,001 – HKD 10,000', rate: '5%', color: 'bg-blue-50', badge: 'bg-blue-100 text-blue-800', example: t("auctionTerms.fees.example", { amount: "8,000", fee: "400", receive: "7,600" }) },
    { tier: t("auctionTerms.fees.tier3"), range: t("auctionTerms.fees.rangeAbove", { amount: "10,001" }), rate: '4.5%', color: 'bg-green-50', badge: 'bg-green-100 text-green-800', example: t("auctionTerms.fees.example", { amount: "15,000", fee: "675", receive: "14,325" }) },
  ];

  const scrollTo = (id: string) => {
    setOpenSectionId(id);
    setTocOpen(false);
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
        {/* Back button */}
        <div className="relative max-w-3xl mx-auto px-4 pt-4">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("auctionTerms.back")}
          </button>
        </div>
        <div className="relative max-w-3xl mx-auto px-4 pb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4"
            style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}>
            <Shield className="w-3 h-3" />
            {t("auctionTerms.officialBadge")}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3 leading-tight">
            {t("auctionTerms.heroTitle")}
          </h1>
          <p className="text-white/70 text-sm max-w-xl mx-auto">
            {t("auctionTerms.heroDesc")}
          </p>
          <p className="text-white/40 text-xs mt-4">{t("auctionTerms.lastUpdated")}</p>
        </div>
      </div>

      {/* Sticky TOC (mobile) */}
      <div className="sticky top-14 z-30 bg-white border-b border-blue-100 shadow-sm sm:hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold"
          style={{ color: BRAND_BLUE }}
          onClick={() => setTocOpen(v => !v)}
        >
          <span>{t("auctionTerms.tocTitle")}</span>
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
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{t("auctionTerms.tocTitle")}</p>
          <div className="grid grid-cols-3 gap-2">
            {TOC.map(item => (
              <button key={item.id} onClick={() => scrollTo(item.id)}
                className="text-left text-sm px-3 py-2 rounded-xl hover:bg-blue-50 text-[#06038D] font-medium transition-colors flex items-center gap-1.5">
                <ArrowRight className="w-3 h-3 opacity-50" />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 1: Platform Overview */}
        <Section id="overview" icon={<Package className="w-5 h-5" />} title={t("auctionTerms.s1.title")} isOpen={openSectionId === "overview"} onToggle={handleToggle}>
          <p dangerouslySetInnerHTML={{ __html: t("auctionTerms.s1.intro") }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <div className="rounded-xl p-4 border border-blue-100 bg-blue-50">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="w-4 h-4" style={{ color: BRAND_BLUE }} />
                <span className="font-bold text-sm" style={{ color: BRAND_BLUE }}>{t("auctionTerms.s1.buyNowMode")}</span>
              </div>
              <p className="text-xs text-gray-600">{t("auctionTerms.s1.buyNowDesc")}</p>
            </div>
            <div className="rounded-xl p-4 border border-blue-100 bg-blue-50">
              <div className="flex items-center gap-2 mb-2">
                <Gavel className="w-4 h-4" style={{ color: BRAND_BLUE }} />
                <span className="font-bold text-sm" style={{ color: BRAND_BLUE }}>{t("auctionTerms.s1.auctionMode")}</span>
              </div>
              <p className="text-xs text-gray-600">{t("auctionTerms.s1.auctionDesc")}</p>
            </div>
          </div>
          <InfoBox type="info">
            <span dangerouslySetInnerHTML={{ __html: t("auctionTerms.s1.infoBox") }} />
          </InfoBox>
        </Section>

        {/* Section 2: Buy Now Flow */}
        <Section id="buy-now" icon={<ShoppingCart className="w-5 h-5" />} title={t("auctionTerms.s2.title")} badge={t("auctionTerms.s2.badge")} isOpen={openSectionId === "buy-now"} onToggle={handleToggle}>
          <div className="space-y-3">
            <p className="font-semibold text-[#06038D]">{t("auctionTerms.s2.buyerFlow")}</p>
            <div className="space-y-3">
              <Rule num="1" title={t("auctionTerms.s2.b1title")}>{t("auctionTerms.s2.b1desc")}</Rule>
              <Rule num="2" title={t("auctionTerms.s2.b2title")}>{t("auctionTerms.s2.b2desc")}</Rule>
              <Rule num="3" title={t("auctionTerms.s2.b3title")}>{t("auctionTerms.s2.b3desc")}</Rule>
              <Rule num="4" title={t("auctionTerms.s2.b4title")}>{t("auctionTerms.s2.b4desc")}</Rule>
            </div>
            <div className="border-t border-gray-100 pt-3 mt-3">
              <p className="font-semibold text-[#06038D] mb-3">{t("auctionTerms.s2.sellerFlow")}</p>
              <div className="space-y-3">
                <Rule num="1" title={t("auctionTerms.s2.s1title")}>{t("auctionTerms.s2.s1desc")}</Rule>
                <Rule num="2" title={t("auctionTerms.s2.s2title")}>{t("auctionTerms.s2.s2desc")}</Rule>
                <Rule num="3" title={t("auctionTerms.s2.s3title")}>{t("auctionTerms.s2.s3desc")}</Rule>
                <Rule num="4" title={t("auctionTerms.s2.s4title")}>{t("auctionTerms.s2.s4desc")}</Rule>
              </div>
            </div>
            <InfoBox type="warning">
              {t("auctionTerms.s2.warningBox")}
            </InfoBox>
          </div>
        </Section>

        {/* Section 3: Auction Flow */}
        <Section id="auction" icon={<Gavel className="w-5 h-5" />} title={t("auctionTerms.s3.title")} badge={t("auctionTerms.s3.badge")} isOpen={openSectionId === "auction"} onToggle={handleToggle}>
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-[#06038D] mb-3">{t("auctionTerms.s3.flowTitle")}</p>
              <div className="space-y-3">
                <Rule num="1" title={t("auctionTerms.s3.a1title")}>{t("auctionTerms.s3.a1desc")}</Rule>
                <Rule num="2" title={t("auctionTerms.s3.a2title")}>{t("auctionTerms.s3.a2desc")}</Rule>
                <Rule num="3" title={t("auctionTerms.s3.a3title")}>{t("auctionTerms.s3.a3desc")}</Rule>
                <Rule num="4" title={t("auctionTerms.s3.a4title")}><span dangerouslySetInnerHTML={{ __html: t("auctionTerms.s3.a4desc") }} /></Rule>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-blue-100">
              <div className="px-4 py-2.5 text-xs font-bold text-white" style={{ background: BRAND_BLUE }}>{t("auctionTerms.s3.rulesTitle")}</div>
              <div className="divide-y divide-gray-100">
                {[
                  { icon: "🔒", title: t("auctionTerms.s3.r1title"), desc: t("auctionTerms.s3.r1desc") },
                  { icon: "⏱️", title: t("auctionTerms.s3.r2title"), desc: t("auctionTerms.s3.r2desc") },
                  { icon: "🔔", title: t("auctionTerms.s3.r3title"), desc: t("auctionTerms.s3.r3desc") },
                  { icon: "⏰", title: t("auctionTerms.s3.r4title"), desc: t("auctionTerms.s3.r4desc") },
                  { icon: "❌", title: t("auctionTerms.s3.r5title"), desc: t("auctionTerms.s3.r5desc") },
                  { icon: "🏆", title: t("auctionTerms.s3.r6title"), desc: t("auctionTerms.s3.r6desc") },
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
              {t("auctionTerms.s3.warningBox")}
            </InfoBox>
          </div>
        </Section>

        {/* Section 4: Fees */}
        <Section id="fees" icon={<DollarSign className="w-5 h-5" />} title={t("auctionTerms.s4.title")} badge={t("auctionTerms.s4.badge")} isOpen={openSectionId === "fees"} onToggle={handleToggle}>
          <div className="space-y-4">
            <p dangerouslySetInnerHTML={{ __html: t("auctionTerms.s4.intro") }} />

            {/* Fee Tier Table */}
            <div className="rounded-xl overflow-hidden border border-blue-100 shadow-sm">
              <div className="px-4 py-3 text-sm font-bold text-white flex items-center gap-2" style={{ background: BRAND_BLUE }}>
                <DollarSign className="w-4 h-4" />
                {t("auctionTerms.s4.tableTitle")}
              </div>
              <div className="divide-y divide-blue-50">
                {feeTiersLoading ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">{t("auctionTerms.s4.loading")}</div>
                ) : displayTiers.map((tier, i) => (
                  <div key={i} className={`px-4 py-3.5 ${tier.color}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tier.badge}`}>{tier.tier}</span>
                        <span className="text-sm font-medium text-gray-700">{tier.range}</span>
                      </div>
                      <span className="text-lg font-black" style={{ color: BRAND_BLUE }}>{tier.rate}</span>
                    </div>
                    <p className="text-xs text-gray-500 pl-0.5">{tier.example}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4 border border-blue-100 bg-blue-50 space-y-2">
              <p className="text-sm font-bold" style={{ color: BRAND_BLUE }}>{t("auctionTerms.s4.notesTitle")}</p>
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li className="flex gap-2"><span className="text-blue-400 mt-0.5">•</span>{t("auctionTerms.s4.note1")}</li>
                <li className="flex gap-2"><span className="text-blue-400 mt-0.5">•</span><span dangerouslySetInnerHTML={{ __html: t("auctionTerms.s4.note2") }} /></li>
                <li className="flex gap-2"><span className="text-blue-400 mt-0.5">•</span>{t("auctionTerms.s4.note3")}</li>
                <li className="flex gap-2"><span className="text-blue-400 mt-0.5">•</span>{t("auctionTerms.s4.note4")}</li>
              </ul>
            </div>

            <InfoBox type="success">
              {t("auctionTerms.s4.successBox")}
            </InfoBox>
          </div>
        </Section>

        {/* Section 5: Payment */}
        <Section id="payment" icon={<CreditCard className="w-5 h-5" />} title={t("auctionTerms.s5.title")} isOpen={openSectionId === "payment"} onToggle={handleToggle}>
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-[#06038D] mb-2">{t("auctionTerms.s5.buyerPayment")}</p>
              <div className="space-y-2">
                <Rule num="1" title={t("auctionTerms.s5.p1title")}>{t("auctionTerms.s5.p1desc")}</Rule>
                <Rule num="2" title={t("auctionTerms.s5.p2title")}>{t("auctionTerms.s5.p2desc")}</Rule>
                <Rule num="3" title={t("auctionTerms.s5.p3title")}>{t("auctionTerms.s5.p3desc")}</Rule>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <p className="font-semibold text-[#06038D] mb-2">{t("auctionTerms.s5.sellerPayout")}</p>
              <div className="space-y-2">
                <Rule num="1" title={t("auctionTerms.s5.sp1title")}>{t("auctionTerms.s5.sp1desc")}</Rule>
                <Rule num="2" title={t("auctionTerms.s5.sp2title")}>{t("auctionTerms.s5.sp2desc")}</Rule>
                <Rule num="3" title={t("auctionTerms.s5.sp3title")}><span dangerouslySetInnerHTML={{ __html: t("auctionTerms.s5.sp3desc") }} /></Rule>
                <Rule num="4" title={t("auctionTerms.s5.sp4title")}>{t("auctionTerms.s5.sp4desc")}</Rule>
                <Rule num="5" title={t("auctionTerms.s5.sp5title")}>{t("auctionTerms.s5.sp5desc")}</Rule>
              </div>
            </div>

            {/* Payout Flow Diagram */}
            <div className="rounded-xl overflow-hidden border border-blue-100">
              <div className="px-4 py-2.5 text-xs font-bold text-white flex items-center gap-2" style={{ background: BRAND_BLUE }}>
                <Clock className="w-3.5 h-3.5" />
                {t("auctionTerms.s5.timelineTitle")}
              </div>
              <div className="p-4">
                <div className="relative">
                  <div className="absolute top-[5px] left-[6px] right-[6px] h-0.5 bg-gray-200" />
                  <div className="relative flex justify-between mb-2">
                    {[
                      { color: "bg-blue-500" },
                      { color: "bg-amber-500" },
                      { color: "bg-green-500" },
                    ].map((item, i) => (
                      <div key={i} className={`w-3 h-3 rounded-full flex-shrink-0 ${item.color} relative z-10`} />
                    ))}
                  </div>
                  <div className="flex justify-between">
                    {[
                      { step: t("auctionTerms.s5.tl1step"), sub: t("auctionTerms.s5.tl1sub") },
                      { step: t("auctionTerms.s5.tl2step"), sub: t("auctionTerms.s5.tl2sub") },
                      { step: t("auctionTerms.s5.tl3step"), sub: t("auctionTerms.s5.tl3sub") },
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
              {t("auctionTerms.s5.infoBox")}
            </InfoBox>
          </div>
        </Section>

        {/* Section 6: Shipping */}
        <Section id="shipping" icon={<Package className="w-5 h-5" />} title={t("auctionTerms.s6.title")} isOpen={openSectionId === "shipping"} onToggle={handleToggle}>
          <div className="space-y-3">
            <p dangerouslySetInnerHTML={{ __html: t("auctionTerms.s6.intro") }} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  icon: "🚚",
                  title: t("auctionTerms.s6.sf.title"),
                  desc: t("auctionTerms.s6.sf.desc")
                },
                {
                  icon: "📮",
                  title: t("auctionTerms.s6.hkpost.title"),
                  desc: t("auctionTerms.s6.hkpost.desc")
                },
              ].map((m, i) => (
                <div key={i} className="rounded-xl p-3.5 border border-blue-100 bg-blue-50">
                  <div className="text-2xl mb-1.5">{m.icon}</div>
                  <p className="text-sm font-bold text-[#06038D] mb-1">{m.title}</p>
                  <p className="text-xs text-gray-500">{m.desc}</p>
                </div>
              ))}
            </div>
            <InfoBox type="warning">
              {t("auctionTerms.s6.warningBox")}
            </InfoBox>
          </div>
        </Section>

        {/* Section 7: Returns */}
        <Section id="returns" icon={<RotateCcw className="w-5 h-5" />} title={t("auctionTerms.s7.title")} isOpen={openSectionId === "returns"} onToggle={handleToggle}>
          <div className="space-y-3">
            <p>{t("auctionTerms.s7.intro")}</p>
            <div className="rounded-xl overflow-hidden border border-blue-100">
              <div className="px-4 py-2.5 text-xs font-bold text-white" style={{ background: BRAND_BLUE }}>{t("auctionTerms.s7.acceptTitle")}</div>
              <div className="divide-y divide-gray-100">
                {[
                  { icon: "✅", title: t("auctionTerms.s7.a1title"), desc: t("auctionTerms.s7.a1desc") },
                  { icon: "✅", title: t("auctionTerms.s7.a2title"), desc: t("auctionTerms.s7.a2desc") },
                  { icon: "✅", title: t("auctionTerms.s7.a3title"), desc: t("auctionTerms.s7.a3desc") },
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
              <div className="px-4 py-2.5 text-xs font-bold text-white bg-red-500">{t("auctionTerms.s7.rejectTitle")}</div>
              <div className="divide-y divide-gray-100">
                {[
                  { icon: "❌", title: t("auctionTerms.s7.r1title"), desc: t("auctionTerms.s7.r1desc") },
                  { icon: "❌", title: t("auctionTerms.s7.r2title"), desc: t("auctionTerms.s7.r2desc") },
                  { icon: "❌", title: t("auctionTerms.s7.r3title"), desc: t("auctionTerms.s7.r3desc") },
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
              <span dangerouslySetInnerHTML={{ __html: t("auctionTerms.s7.infoBox") }} />
            </InfoBox>
          </div>
        </Section>

        {/* Section 8: Conduct */}
        <Section id="conduct" icon={<Scale className="w-5 h-5" />} title={t("auctionTerms.s8.title")} isOpen={openSectionId === "conduct"} onToggle={handleToggle}>
          <div className="space-y-3">
            <p>{t("auctionTerms.s8.intro")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: "🚫", title: t("auctionTerms.s8.c1title"), desc: t("auctionTerms.s8.c1desc") },
                { icon: "🚫", title: t("auctionTerms.s8.c2title"), desc: t("auctionTerms.s8.c2desc") },
                { icon: "🚫", title: t("auctionTerms.s8.c3title"), desc: t("auctionTerms.s8.c3desc") },
                { icon: "🚫", title: t("auctionTerms.s8.c4title"), desc: t("auctionTerms.s8.c4desc") },
                { icon: "✅", title: t("auctionTerms.s8.c5title"), desc: t("auctionTerms.s8.c5desc") },
                { icon: "✅", title: t("auctionTerms.s8.c6title"), desc: t("auctionTerms.s8.c6desc") },
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
              <div className="px-4 py-2.5 text-xs font-bold text-white" style={{ background: BRAND_BLUE }}>{t("auctionTerms.s8.penaltyTitle")}</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-50">
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-[#06038D]">{t("auctionTerms.s8.penaltyCount")}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-[#06038D]">{t("auctionTerms.s8.penaltyAction")}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-[#06038D]">{t("auctionTerms.s8.penaltyDuration")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      { count: t("auctionTerms.s8.p1count"), action: t("auctionTerms.s8.p1action"), duration: t("auctionTerms.s8.p1duration"), color: "text-emerald-600" },
                      { count: t("auctionTerms.s8.p2count"), action: t("auctionTerms.s8.p2action"), duration: t("auctionTerms.s8.p2duration"), color: "text-amber-600" },
                      { count: t("auctionTerms.s8.p3count"), action: t("auctionTerms.s8.p3action"), duration: t("auctionTerms.s8.p3duration"), color: "text-orange-600" },
                      { count: t("auctionTerms.s8.p4count"), action: t("auctionTerms.s8.p4action"), duration: t("auctionTerms.s8.p4duration"), color: "text-red-600" },
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
              {t("auctionTerms.s8.warningBox")}
            </InfoBox>
          </div>
        </Section>

        {/* Section 9: Liability */}
        <Section id="liability" icon={<FileText className="w-5 h-5" />} title={t("auctionTerms.s9.title")} isOpen={openSectionId === "liability"} onToggle={handleToggle}>
          <div className="space-y-3">
            <div className="space-y-2">
              <Rule num="1" title={t("auctionTerms.s9.l1title")}>{t("auctionTerms.s9.l1desc")}</Rule>
              <Rule num="2" title={t("auctionTerms.s9.l2title")}>{t("auctionTerms.s9.l2desc")}</Rule>
              <Rule num="3" title={t("auctionTerms.s9.l3title")}>{t("auctionTerms.s9.l3desc")}</Rule>
              <Rule num="4" title={t("auctionTerms.s9.l4title")}>{t("auctionTerms.s9.l4desc")}</Rule>
              <Rule num="5" title={t("auctionTerms.s9.l5title")}>{t("auctionTerms.s9.l5desc")}</Rule>
              <Rule num="6" title={t("auctionTerms.s9.l6title")}>{t("auctionTerms.s9.l6desc")}</Rule>
            </div>
            <InfoBox type="info">
              {t("auctionTerms.s9.infoBox")}
            </InfoBox>
          </div>
        </Section>

        {/* Key Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {[
            { icon: Shield, title: t("auctionTerms.highlights.h1title"), desc: t("auctionTerms.highlights.h1desc") },
            { icon: Scale, title: t("auctionTerms.highlights.h2title"), desc: t("auctionTerms.highlights.h2desc") },
            { icon: Clock, title: t("auctionTerms.highlights.h3title"), desc: t("auctionTerms.highlights.h3desc") },
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
            <p className="text-[#FEDD00] text-xs font-bold uppercase tracking-widest mb-2">BOXIUM TCG</p>
            <h3 className="text-white font-black text-xl mb-2">{t("auctionTerms.cta.title")}</h3>
            <p className="text-white/60 text-sm mb-6">{t("auctionTerms.cta.desc")}</p>
            <div className="flex flex-row flex-wrap gap-3 justify-center">
              <Link href="/marketplace">
                <button className="px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 justify-center transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                  style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}>
                  <ShoppingCart className="w-4 h-4" />
                  {t("auctionTerms.cta.browse")}
                </button>
              </Link>
              <Link href="/seller">
                <button className="px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 justify-center border-2 border-white/30 text-white transition-all hover:bg-white/10 whitespace-nowrap">
                  <Gavel className="w-4 h-4" />
                  {t("auctionTerms.cta.sell")}
                </button>
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 pb-4">
          © 2025 Boxium PTCG. {t("auctionTerms.copyright")} ·{" "}
          <Link href="/privacy" className="hover:underline">{t("auctionTerms.privacyLink")}</Link>
        </p>
      </div>
    </div>
  );
}
