import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { TrendingUp, Search, BarChart3, Trophy, Facebook, Instagram, User, LogOut, Flame, ChevronRight, ShoppingBag, ScanSearch, LineChart, Award, Store, ArrowRight, MessageSquare, Shield, Zap, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import Footer from "@/components/Footer";
import { MarketplaceMarquee } from "@/components/MarketplaceMarquee";
import StructuredData from "@/components/StructuredData";
import { formatCurrency, formatPriceChange } from "@/lib/formatCurrency";
import { getProxiedImageUrl } from "@/lib/utils";
import PageHead from "@/components/PageHead";



// Rank medal config — professional metallic palette
const RANK_CONFIG: Record<number, { gradient: string; textColor: string; borderColor: string; label: string }> = {
  1: {
    gradient: "linear-gradient(135deg, #f5c518 0%, #e8a900 50%, #c8860a 100%)",
    textColor: "#5a3a00",
    borderColor: "rgba(248,197,24,0.6)",
    label: "1",
  },
  2: {
    gradient: "linear-gradient(135deg, #e8e8e8 0%, #c8c8c8 50%, #a0a0a0 100%)",
    textColor: "#3a3a3a",
    borderColor: "rgba(192,192,192,0.6)",
    label: "2",
  },
  3: {
    gradient: "linear-gradient(135deg, #e8a87c 0%, #cd7f32 50%, #a0520a 100%)",
    textColor: "#fff",
    borderColor: "rgba(205,127,50,0.6)",
    label: "3",
  },
  4: {
    gradient: "linear-gradient(135deg, #4a5568 0%, #2d3748 100%)",
    textColor: "#e2e8f0",
    borderColor: "rgba(74,85,104,0.5)",
    label: "4",
  },
  5: {
    gradient: "linear-gradient(135deg, #4a5568 0%, #2d3748 100%)",
    textColor: "#e2e8f0",
    borderColor: "rgba(74,85,104,0.5)",
    label: "5",
  },
};

function TrendingCardRow({ gameId, logoUrl, logoAlt, accentColor, badgeBg }: {
  gameId: number;
  logoUrl: string;
  logoAlt: string;
  accentColor: string;
  badgeBg: string;
}) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { data: trendingCards = [], isLoading } = trpc.cards.getTrending.useQuery({ limit: 5, gameId });
  const logSearchMutation = trpc.cards.logSearch.useMutation();

  return (
    <div className="mb-8 md:mb-10">
      {/* Section header with game logo */}
      <div className="flex items-center gap-3 mb-4">
        {/* Left accent bar */}
        <div
          className="h-6 w-[3px] rounded-full flex-shrink-0"
          style={{ background: accentColor }}
        />
        {/* Game logo */}
        <img
          src={logoUrl}
          alt={logoAlt}
          className="h-7 sm:h-9 md:h-11 w-auto object-contain flex-shrink-0"
          loading="lazy"
        />
        {/* Thin divider line */}
        <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${accentColor}40, transparent)` }} />
      </div>

      {isLoading ? (
        // Skeleton: 5-column card grid matching actual card layout
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 md:gap-3 lg:gap-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl overflow-hidden shadow border border-gray-100">
              <div className="aspect-[2.5/3.5] bg-gray-200 animate-pulse" />
              <div className="p-1 sm:p-1.5 md:p-2 space-y-1">
                <div className="h-2.5 bg-gray-200 animate-pulse rounded w-full" />
                <div className="h-2 bg-gray-200 animate-pulse rounded w-3/4" />
                <div className="h-3 bg-gray-200 animate-pulse rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : trendingCards.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm">{t("home.noTrendingCards")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 md:gap-3 lg:gap-5">
          {trendingCards.map((card: any, index: number) => {
            const rankNum = card.rank ?? (index + 1);
            const rc = RANK_CONFIG[rankNum] || RANK_CONFIG[5];
            return (
              <div
                key={card.id}
                onClick={() => {
                  logSearchMutation.mutate({ cardId: card.id, source: "home_page" });
                  setLocation(`/card/${card.id}`);
                }}
                className="group bg-white rounded-xl overflow-hidden shadow hover:shadow-xl transition-all duration-200 cursor-pointer border border-gray-100 hover:border-[#FEDD00]"
              >
                {/* Card Image */}
                <div className="aspect-[2.5/3.5] bg-gray-50 relative overflow-hidden">
                  {card.imageUrl ? (
                    <img
                      src={getProxiedImageUrl(card.imageUrl) ?? ""}
                       alt={`${card.name}${card.cardNumber ? ` ${card.cardNumber}` : ''} ${t("home.cardImageAlt")}${card.series ? ` - ${card.series}` : ''}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <span className="text-xs">{t("home.noImage")}</span>
                    </div>
                  )}

                  {/* Rank Medal — top-left: circular metallic badge */}
                  <div
                    className="absolute top-1 left-1 flex items-center justify-center rounded-full font-black shadow-md select-none"
                    style={{
                      background: rc.gradient,
                      color: rc.textColor,
                      border: `1.5px solid ${rc.borderColor}`,
                      fontSize: "clamp(7px, 1.6vw, 12px)",
                      width: "clamp(16px, 3.8vw, 24px)",
                      height: "clamp(16px, 3.8vw, 24px)",
                      letterSpacing: "-0.02em",
                      lineHeight: 1,
                    }}
                  >
                    {rc.label}
                  </div>

                  {/* Price Change Badge — top-right */}
                  <div
                    className="absolute top-1 right-1 text-white font-bold shadow-md rounded"
                    style={{
                      background: badgeBg,
                      fontSize: "clamp(6px, 1.4vw, 11px)",
                      padding: "1px 4px",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {card.priceChangeFormatted}
                  </div>
                </div>

                {/* Card Info */}
                <div className="p-1 sm:p-1.5 md:p-2">
                  <h3
                    className="font-semibold text-[8px] sm:text-[10px] md:text-[11px] lg:text-xs mb-0.5 line-clamp-2 leading-tight"
                    style={{ color: "#06038d" }}
                  >
                    {card.name}
                  </h3>
                  {card.nameJa && (
                    <p className="text-[7px] sm:text-[8px] md:text-[9px] text-gray-400 mb-0.5 line-clamp-1">
                      {card.nameJa}
                    </p>
                  )}
                  <div style={{ color: "#06038d" }}>
                    <p className="text-[8px] sm:text-[9px] md:text-[10px] font-semibold leading-tight">
                      HKD
                    </p>
                    <p className="text-[9px] sm:text-[11px] md:text-xs lg:text-sm font-bold tabular-nums leading-tight">
                      {(() => { const v = card.currentPrice; const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0); return isNaN(n) ? '0.00' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); })()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const POKEMON_LOGO = "/manus-storage/pokemon-logo_8b934176.avif";
const ONEPIECE_LOGO = "/manus-storage/onepiece-logo_d5c27900.avif";
const YUGIOH_LOGO = "/manus-storage/yugioh-logo_de4317ba.webp";

function TrendingCardsGrid() {
  return (
    <div>
      <TrendingCardRow
        gameId={1}
        logoUrl={POKEMON_LOGO}
        logoAlt="Pokémon TCG"
        accentColor="#06038d"
        badgeBg="linear-gradient(135deg, #e63946, #c1121f)"
      />
      <TrendingCardRow
        gameId={2}
        logoUrl={ONEPIECE_LOGO}
        logoAlt="One Piece Card Game"
        accentColor="#dc2626"
        badgeBg="linear-gradient(135deg, #dc2626, #991b1b)"
      />
      <TrendingCardRow
        gameId={3}
        logoUrl={YUGIOH_LOGO}
        logoAlt="Yu-Gi-Oh! TCG"
        accentColor="#7c3aed"
        badgeBg="linear-gradient(135deg, #7c3aed, #5b21b6)"
      />
    </div>
  );
}

// ─── useCountUp hook: animates a number from 0 to target on mount ─────────────
function useCountUp(target: number | undefined, duration = 1800) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === undefined || target === 0) return;
    startRef.current = null;
    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return display;
}

// ─── CTA Section with scroll-in animation & hover icon scale ───────────────
function CtaSection() {
  const { t } = useTranslation();

  const headerRef = useRef<HTMLDivElement>(null);
  const panel1Ref = useRef<HTMLAnchorElement>(null);
  const panel2Ref = useRef<HTMLAnchorElement>(null);
  const panel3Ref = useRef<HTMLAnchorElement>(null);

  const [headerVisible, setHeaderVisible] = useState(false);
  const [panel1Visible, setPanel1Visible] = useState(false);
  const [panel2Visible, setPanel2Visible] = useState(false);
  const [panel3Visible, setPanel3Visible] = useState(false);

  useEffect(() => {
    const makeObserver = (setter: (v: boolean) => void, delay = 0) =>
      new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setTimeout(() => setter(true), delay);
        },
        { threshold: 0.15 }
      );

    const obs0 = makeObserver(setHeaderVisible, 0);
    const obs1 = makeObserver(setPanel1Visible, 80);
    const obs2 = makeObserver(setPanel2Visible, 200);
    const obs3 = makeObserver(setPanel3Visible, 320);

    if (headerRef.current) obs0.observe(headerRef.current);
    if (panel1Ref.current) obs1.observe(panel1Ref.current);
    if (panel2Ref.current) obs2.observe(panel2Ref.current);
    if (panel3Ref.current) obs3.observe(panel3Ref.current);

    return () => { obs0.disconnect(); obs1.disconnect(); obs2.disconnect(); obs3.disconnect(); };
  }, []);

  const slideIn = (visible: boolean): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(40px)",
    transition: "opacity 0.55s ease, transform 0.55s ease",
  });

  return (
    <section className="overflow-hidden">
      {/* Section header */}
      <div ref={headerRef} className="py-6 md:py-10 px-4 text-center bg-white" style={slideIn(headerVisible)}>
        <h2 className="text-base sm:text-lg md:text-xl font-bold mb-1.5 md:mb-2" style={{ color: "#06038d" }}>
          {t("home.readyToStart")}
        </h2>
        <p className="text-gray-600 text-[11px] sm:text-xs md:text-sm leading-relaxed max-w-xl mx-auto">
          {t("home.readyToStartDesc")}
        </p>
      </div>

      {/* Three color panels */}
      <div className="relative flex flex-col w-full">
        <div className="w-full" style={{ height: "3px", backgroundColor: "#06038d" }} />
        <div className="relative flex flex-row w-full overflow-hidden" style={{ minHeight: "180px" }}>

          {/* Panel 1: Search — deep navy */}
          <Link
            ref={panel1Ref}
            href="/research"
            className="group relative flex flex-col justify-between cursor-pointer transition-all duration-200 active:brightness-90 select-none"
            style={{
              backgroundColor: "#06038d",
              width: "calc(33.333% + 28px)",
              clipPath: "polygon(0 0, 100% 0, calc(100% - 28px) 100%, 0 100%)",
              paddingLeft: "4%",
              paddingRight: "calc(4% + 32px)",
              paddingTop: "clamp(16px, 4vw, 40px)",
              paddingBottom: "clamp(16px, 4vw, 40px)",
              zIndex: 3,
              ...slideIn(panel1Visible),
            }}
          >
            <svg className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <rect x="10" y="15" width="50" height="70" rx="4" fill="none" stroke="white" strokeWidth="2"/>
              <rect x="140" y="-10" width="50" height="70" rx="4" fill="none" stroke="white" strokeWidth="2"/>
              <rect x="60" y="110" width="50" height="70" rx="4" fill="none" stroke="white" strokeWidth="2"/>
              <rect x="-10" y="90" width="30" height="42" rx="3" fill="none" stroke="white" strokeWidth="1.5"/>
              <rect x="160" y="130" width="50" height="70" rx="4" fill="none" stroke="white" strokeWidth="2"/>
            </svg>
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-all duration-200" />
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#FEDD00] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left z-20" />
            {/* Icon circle — scale-110 on hover */}
            <div className="relative z-10 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-[#FEDD00] group-hover:scale-110 transition-all duration-200">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-[#FEDD00] group-hover:text-[#06038d] transition-colors duration-200" />
            </div>
            <div className="relative z-10 mt-2 sm:mt-3">
              <h3 className="text-white font-bold text-xs sm:text-sm md:text-lg leading-tight">{t("home.startSearching")}</h3>
            </div>
            <div className="relative z-10 mt-1 sm:mt-2 flex-1">
              <p className="text-white/65 text-[10px] sm:text-xs md:text-sm leading-snug">{t("home.searchCardsDesc", "搜尋卡片、查看價格走勢與市場數據")}</p>
            </div>
            <div className="relative z-10 mt-3 sm:mt-4 flex items-center gap-1 text-[#FEDD00]/80 text-[10px] sm:text-xs font-semibold">
              <span>{t("home.exploreNow", "立即探索")}</span>
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </div>
          </Link>

          {/* Panel 2: Market Pricing — white */}
          <Link
            ref={panel2Ref}
            href="/pricing"
            className="group relative flex flex-col justify-between cursor-pointer transition-all duration-200 active:brightness-90 select-none"
            style={{
              backgroundColor: "#ffffff",
              width: "calc(33.333% + 56px)",
              clipPath: "polygon(28px 0, 100% 0, calc(100% - 28px) 100%, 0 100%)",
              marginLeft: "-28px",
              paddingLeft: "calc(4% + 32px)",
              paddingRight: "calc(4% + 32px)",
              paddingTop: "clamp(16px, 4vw, 40px)",
              paddingBottom: "clamp(16px, 4vw, 40px)",
              zIndex: 2,
              ...slideIn(panel2Visible),
            }}
          >
            <svg className="absolute inset-0 w-full h-full opacity-[0.05] pointer-events-none" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <rect x="20" y="20" width="50" height="70" rx="4" fill="none" stroke="#06038d" strokeWidth="2"/>
              <rect x="130" y="5" width="50" height="70" rx="4" fill="none" stroke="#06038d" strokeWidth="2"/>
              <rect x="70" y="120" width="50" height="70" rx="4" fill="none" stroke="#06038d" strokeWidth="2"/>
              <rect x="0" y="100" width="30" height="42" rx="3" fill="none" stroke="#06038d" strokeWidth="1.5"/>
              <rect x="170" y="140" width="50" height="70" rx="4" fill="none" stroke="#06038d" strokeWidth="2"/>
            </svg>
            <div className="absolute inset-0 group-hover:bg-[#06038d]/5 transition-all duration-200" />
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#06038d] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left z-20" />
            {/* Icon circle — scale-110 on hover */}
            <div
              className="relative z-10 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-[#06038d] transition-all duration-200"
              style={{ backgroundColor: "rgba(6,3,141,0.08)" }}
            >
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 group-hover:text-white transition-colors duration-200" style={{ color: "#06038d" }} />
            </div>
            <div className="relative z-10 mt-2 sm:mt-3">
              <h3 className="font-bold text-xs sm:text-sm md:text-lg leading-tight" style={{ color: "#06038d" }}>{t("home.viewMarketTrends")}</h3>
            </div>
            <div className="relative z-10 mt-1 sm:mt-2 flex-1">
              <p className="text-[10px] sm:text-xs md:text-sm leading-snug" style={{ color: "#06038d", opacity: 0.6 }}>{t("home.marketTrendsDesc", "查看市場價格走勢、比較各平台行情")}</p>
            </div>
            <div className="relative z-10 mt-3 sm:mt-4 flex items-center gap-1 text-[10px] sm:text-xs font-semibold" style={{ color: "#06038d" }}>
              <span>{t("home.viewTrends", "查看行情")}</span>
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </div>
          </Link>

          {/* Panel 3: Marketplace — yellow */}
          <Link
            ref={panel3Ref}
            href="/marketplace"
            className="group relative flex flex-col justify-between cursor-pointer transition-all duration-200 active:brightness-90 select-none"
            style={{
              backgroundColor: "#FEDD00",
              width: "calc(33.333% + 28px)",
              clipPath: "polygon(28px 0, 100% 0, 100% 100%, 0 100%)",
              marginLeft: "-28px",
              paddingLeft: "calc(4% + 32px)",
              paddingRight: "4%",
              paddingTop: "clamp(16px, 4vw, 40px)",
              paddingBottom: "clamp(16px, 4vw, 40px)",
              zIndex: 1,
              ...slideIn(panel3Visible),
            }}
          >
            <svg className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <rect x="15" y="10" width="50" height="70" rx="4" fill="none" stroke="#06038d" strokeWidth="2"/>
              <rect x="135" y="-5" width="50" height="70" rx="4" fill="none" stroke="#06038d" strokeWidth="2"/>
              <rect x="65" y="115" width="50" height="70" rx="4" fill="none" stroke="#06038d" strokeWidth="2"/>
              <rect x="-5" y="95" width="30" height="42" rx="3" fill="none" stroke="#06038d" strokeWidth="1.5"/>
              <rect x="165" y="135" width="50" height="70" rx="4" fill="none" stroke="#06038d" strokeWidth="2"/>
            </svg>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all duration-200" />
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#06038d] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left z-20" />
            {/* Icon circle — scale-110 on hover */}
            <div
              className="relative z-10 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-[#06038d] transition-all duration-200"
              style={{ backgroundColor: "rgba(6,3,141,0.12)" }}
            >
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 group-hover:text-[#FEDD00] transition-colors duration-200" style={{ color: "#06038d" }} />
            </div>
            <div className="relative z-10 mt-2 sm:mt-3">
              <h3 className="font-bold text-xs sm:text-sm md:text-lg leading-tight" style={{ color: "#06038d" }}>{t("home.goToMarketplace")}</h3>
            </div>
            <div className="relative z-10 mt-1 sm:mt-2 flex-1">
              <p className="text-[10px] sm:text-xs md:text-sm leading-snug" style={{ color: "#06038d", opacity: 0.65 }}>{t("home.marketplaceDesc", "瀏覽市集商品、參與拍賣、安全交易")}</p>
            </div>
            <div className="relative z-10 mt-3 sm:mt-4 flex items-center gap-1 text-[10px] sm:text-xs font-semibold" style={{ color: "#06038d" }}>
              <span>{t("home.browseNow", "立即瀏覽")}</span>
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </div>
          </Link>
        </div>
        <div className="w-full h-1" style={{ backgroundColor: "#FEDD00" }} />
      </div>
    </section>
  );
}

// ─── HeroQuickAccess: magazine-style horizontal nav bar ──────────────────────────────────────────────────────
function HeroQuickAccess() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  const { data: stats } = trpc.cards.getStats.useQuery();

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVis(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Format numbers dynamically from DB stats
  const cardCountDesc = stats?.totalCards
    ? `${stats.totalCards.toLocaleString()}+ ${t("home.cardDatabase")}`
    : `55,000+ ${t("home.cardDatabase")}`;
  const priceRecordDesc = stats?.totalPriceRecords
    ? `${Math.round(stats.totalPriceRecords / 10000)}${t("home.globalTransactions")}`
    : `121${t("home.globalTransactions")}`;

  const items = [
    { tag: "SEARCH",  href: "/research",    label: t("home.cardSearch"), desc: cardCountDesc },
    { tag: "PRICING", href: "/pricing",     label: t("home.priceComparison"), desc: priceRecordDesc },
    { tag: "GRADING", href: "/grading",     label: t("home.psaGrading"), desc: t("home.gradingDesc") },
    { tag: "MARKET",  href: "/marketplace", label: t("home.marketplace"), desc: t("home.marketplaceDesc2") },
  ];

  return (
    <div
      ref={containerRef}
      className="w-full mt-0"
      style={{
        opacity: vis ? 1 : 0,
        transform: vis ? "translateY(0)" : "translateY(24px)",
        transition: "opacity 0.55s ease, transform 0.55s ease",
      }}
    >
      {/* Top rule */}
      <div style={{ height: "1px", background: "rgba(255,255,255,0.15)" }} />
      <div className="flex w-full" style={{ background: "rgba(0,0,0,0.2)" }}>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group relative flex-1 flex flex-col justify-center px-5 md:px-7 py-4 md:py-5 cursor-pointer select-none transition-colors duration-200"
              style={{
                borderRight: !isLast ? "none" : undefined,
              }}
            >
              {/* Hover fill */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: "rgba(255,255,255,0.04)" }} />
              {/* Slash divider (after each item except last) */}
              {!isLast && (
                <span
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-white/20 font-light select-none pointer-events-none z-10"
                  style={{ fontSize: "22px", lineHeight: 1 }}
                >/</span>
              )}
              {/* EN tag */}
              <span
                className="relative z-10 text-[9px] md:text-[10px] font-bold tracking-[0.14em] uppercase mb-1 transition-colors duration-200"
                style={{ color: "rgba(255,255,255,0.32)" }}
              >{item.tag}</span>
              {/* Main label */}
              <span
                className="relative z-10 font-extrabold leading-tight transition-all duration-200 group-hover:text-[#FEDD00] group-hover:tracking-[0.01em]"
                style={{ fontSize: "clamp(14px, 2vw, 20px)", color: "white", letterSpacing: "-0.01em" }}
              >{item.label}</span>
              {/* Desc */}
              <span
                className="relative z-10 mt-1 hidden sm:block transition-colors duration-200"
                style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}
              >{item.desc}</span>
            </Link>
          );
        })}
      </div>
      {/* Bottom rule */}
      <div style={{ height: "1px", background: "rgba(255,255,255,0.15)" }} />
    </div>
  );
}


// ─── AboutUsSection: brand story + values + contact CTA ─────────────────────
function AboutUsSection() {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVis(true); obs.disconnect(); } },
      { threshold: 0.08 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  const values = [
    {
      icon: Zap,
      title: t("home.realtimeDataTitle"),
      desc: t("home.realtimeDataDesc"),
    },
    {
      icon: Shield,
      title: t("home.safeTrading"),
      desc: t("home.safeTradingDesc"),
    },
    {
      icon: Users,
      title: t("home.playerCommunity"),
      desc: t("home.playerCommunityDesc"),
    },
  ];

  return (
    <section
      ref={sectionRef}
      className="w-full py-14 md:py-20 px-4"
      style={{ backgroundColor: "#f0f2ff" }}
    >
      <div
        className="max-w-6xl mx-auto"
        style={{
          opacity: vis ? 1 : 0,
          transform: vis ? "translateY(0)" : "translateY(32px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
      >
        {/* Section header */}
        <div className="text-center mb-10 md:mb-14">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest mb-4"
            style={{ backgroundColor: "#06038d", color: "#FEDD00" }}
          >
            About Us
          </div>
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-3 leading-tight"
            style={{ color: "#06038d" }}
          >
            {t("home.aboutBoxium")}
          </h2>
          <p className="text-gray-600 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            {t("home.aboutBoxiumDesc")}
          </p>
        </div>

        {/* Two-column: story + values */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Left: brand story */}
          <div className="bg-white rounded-2xl p-7 md:p-9 shadow-sm border border-[#06038d]/10">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
              style={{ backgroundColor: "#06038d" }}
            >
              <img src="/boxium-logo.png" alt="BOXIUM" className="h-7 object-contain" />
            </div>
            <h3 className="text-lg font-bold mb-3" style={{ color: "#06038d" }}>
              {t("home.ourStory")}
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              {t("home.ourStoryDesc1")}
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              {t("home.ourStoryDesc2")}
            </p>
            <div className="flex flex-wrap gap-2">
              {["Pokémon TCG", "One Piece", t("home.yugioh", "遊戲王"), t("common.grading")].map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ backgroundColor: "#06038d15", color: "#06038d" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Right: values + contact CTA */}
          <div className="space-y-4">
            {values.map((v) => (
              <div
                key={v.title}
                className="bg-white rounded-xl p-5 shadow-sm border border-[#06038d]/10 flex items-start gap-4"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "#06038d" }}
                >
                  <v.icon className="w-5 h-5 text-[#FEDD00]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold mb-1" style={{ color: "#06038d" }}>
                    {v.title}
                  </h4>
                  <p className="text-gray-600 text-xs leading-relaxed">{v.desc}</p>
                </div>
              </div>
            ))}

            {/* Contact CTA card */}
            <div
              className="rounded-xl p-5 flex items-center justify-between gap-4"
              style={{ backgroundColor: "#06038d" }}
            >
              <div>
                <div className="text-[#FEDD00] text-xs font-bold uppercase tracking-widest mb-1">{t("home.contactUs")}</div>
                <p className="text-white/80 text-sm">{t("home.contactUsDesc")}</p>
              </div>
              <Link
                href="/contact"
                className="flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-lg flex-shrink-0 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#FEDD00", color: "#06038d" }}
              >
                <MessageSquare className="w-4 h-4" />
                {t("home.contact")}
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom: quick links to about page */}
        <div className="mt-8 text-center">
          <Link
            href="/about"
            className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:underline"
            style={{ color: "#06038d" }}
          >
            {t("home.learnMoreAboutBoxium")}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { t } = useTranslation();
  
  // Structured Data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "BOXIUM TCG",
    "description": "整合全球 TCG 市場數據，為集換式卡牌愛好者提供即時、準確的價格資訊與市場分析",
    "url": "https://boxiumptcg.manus.space",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://boxiumptcg.manus.space/research?q={search_term_string}",
      "query-input": "required name=search_term_string"
    },
    "publisher": {
      "@type": "Organization",
      "name": "BOXIUM",
      "logo": {
        "@type": "ImageObject",
        "url": "https://boxiumptcg.manus.space/boxium-logo.png"
      }
    }
  };
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Fetch real card count from database
  const { data: stats } = trpc.cards.getStats.useQuery();

  // Count-up animations for hero stats
  const animatedCards = useCountUp(stats?.totalCards ?? undefined);
  const animatedPriceRecords = useCountUp(stats?.totalPriceRecords ?? undefined);

  return (
    <>
      <StructuredData data={structuredData} />
      <PageHead
        title="BOXIUM TCG | 卡牌價格查詢與市集"
        description="BOXIUM TCG 提供 Pokémon、One Piece、遊戲王等 TCG 卡牌的即時價格查詢、PSA 10 成交記錄、價格走勢分析及市集交易平台。"
        keywords="TCG 卡牌, Pokémon 卡牌價格, PSA 10, BOXIUM TCG, 卡牌市集"
      />
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f8f9fa" }}>
        {/* ═══ Hero Section — 100vh Collage Wall ═══ */}
        <section
          className="relative overflow-hidden flex flex-col"
          style={{
            height: "100dvh",
            minHeight: "600px",
            background: "radial-gradient(ellipse at 50% 40%, #0a0a1a 0%, #050508 60%, #000000 100%)",
          }}
        >
          {/* ── Noise texture overlay ── */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E")`,
              backgroundRepeat: "repeat",
              backgroundSize: "256px 256px",
              zIndex: 1,
            }}
          />

          {/* ── Editorial crosshair grid (z-index 2) ── */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2, opacity: 0.08 }}>
            <svg width="100%" height="100%" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
              {/* Horizontal center rule */}
              <line x1="0" y1="450" x2="1440" y2="450" stroke="white" strokeWidth="0.5" strokeDasharray="4 8"/>
              {/* Vertical center rule */}
              <line x1="720" y1="0" x2="720" y2="900" stroke="white" strokeWidth="0.5" strokeDasharray="4 8"/>
              {/* Corner crosshairs */}
              <g stroke="white" strokeWidth="1">
                <line x1="40" y1="30" x2="70" y2="30"/><line x1="55" y1="15" x2="55" y2="45"/>
                <line x1="1370" y1="30" x2="1400" y2="30"/><line x1="1385" y1="15" x2="1385" y2="45"/>
                <line x1="40" y1="855" x2="70" y2="855"/><line x1="55" y1="840" x2="55" y2="870"/>
                <line x1="1370" y1="855" x2="1400" y2="855"/><line x1="1385" y1="840" x2="1385" y2="870"/>
              </g>
            </svg>
          </div>

          {/* ══════════════════════════════════════════════════════
               BACKGROUND LAYER — small blurred cards, opacity-15
          ══════════════════════════════════════════════════════ */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
            {/* BG card 1 — Surfing Pikachu Bullet Train */}
            <div style={{ position:"absolute", top:"5%", left:"2%", width:"9vw", minWidth:"70px", opacity:0.15, filter:"blur(1.2px)", transform:"rotate(-4deg)" }}>
              <img src={getProxiedImageUrl("https://cdn.snkrdunk.com/upload_bg_removed/7302799.webp") ?? ""} alt="" className="w-full rounded-lg" style={{ boxShadow:"0 0 18px rgba(100,140,255,0.12)" }} loading="lazy"/>
            </div>
            {/* BG card 2 — Master Key */}
            <div style={{ position:"absolute", top:"55%", left:"5%", width:"8vw", minWidth:"60px", opacity:0.13, filter:"blur(1px)", transform:"rotate(3deg)" }}>
              <img src={getProxiedImageUrl("https://cdn.snkrdunk.com/upload_bg_removed/20220901045104-0.webp") ?? ""} alt="" className="w-full rounded-lg" style={{ boxShadow:"0 0 15px rgba(100,140,255,0.1)" }} loading="lazy"/>
            </div>
            {/* BG card 3 — Lugia LEGEND */}
            <div style={{ position:"absolute", top:"10%", right:"3%", width:"9vw", minWidth:"70px", opacity:0.15, filter:"blur(1.2px)", transform:"rotate(5deg)" }}>
              <img src={getProxiedImageUrl("https://cdn.snkrdunk.com/upload_bg_removed/20220901064220-0.webp") ?? ""} alt="" className="w-full rounded-lg" style={{ boxShadow:"0 0 18px rgba(100,140,255,0.12)" }} loading="lazy"/>
            </div>
            {/* BG card 4 — Mewtwo GX Promo */}
            <div style={{ position:"absolute", top:"60%", right:"4%", width:"8vw", minWidth:"60px", opacity:0.13, filter:"blur(1px)", transform:"rotate(-3deg)" }}>
              <img src={getProxiedImageUrl("https://cdn.snkrdunk.com/upload_bg_removed/20220831092420-0.webp") ?? ""} alt="" className="w-full rounded-lg" style={{ boxShadow:"0 0 15px rgba(100,140,255,0.1)" }} loading="lazy"/>
            </div>
            {/* BG card 5 — Monkey D Luffy L Serial */}
            <div style={{ position:"absolute", top:"30%", left:"0%", width:"7vw", minWidth:"55px", opacity:0.12, filter:"blur(1.5px)", transform:"rotate(2deg)" }}>
              <img src={getProxiedImageUrl("https://cdn.snkrdunk.com/upload_bg_removed/20221107034212-1.webp") ?? ""} alt="" className="w-full rounded-lg" loading="lazy"/>
            </div>
            {/* BG card 6 — Shining Mew */}
            <div style={{ position:"absolute", top:"35%", right:"1%", width:"7vw", minWidth:"55px", opacity:0.12, filter:"blur(1.5px)", transform:"rotate(-2deg)" }}>
              <img src={getProxiedImageUrl("https://cdn.snkrdunk.com/upload_bg_removed/7302949.webp") ?? ""} alt="" className="w-full rounded-lg" loading="lazy"/>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
               MIDGROUND LAYER — medium cards, opacity-25, sharp
          ══════════════════════════════════════════════════════ */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 4 }}>
            {/* MID card 1 — Dark Magician Girl SE */}
            <div style={{ position:"absolute", top:"8%", left:"12%", width:"14vw", minWidth:"100px", opacity:0.25, transform:"rotate(-3deg)", transition:"opacity 0.3s, transform 0.3s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity="0.42"; (e.currentTarget as HTMLElement).style.transform="rotate(-3deg) scale(1.04)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity="0.25"; (e.currentTarget as HTMLElement).style.transform="rotate(-3deg)"; }}>
              <img src={getProxiedImageUrl("https://cdn.snkrdunk.com/upload_bg_removed/7102205.webp") ?? ""} alt="" className="w-full rounded-lg" style={{ boxShadow:"0 0 22px rgba(100,140,255,0.15), -6px 6px 20px rgba(0,0,0,0.6)" }} loading="lazy"/>
            </div>
            {/* MID card 2 — Pikachu 1ED Old Back */}
            <div style={{ position:"absolute", top:"48%", left:"10%", width:"13vw", minWidth:"90px", opacity:0.25, transform:"rotate(2deg)", transition:"opacity 0.3s, transform 0.3s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity="0.42"; (e.currentTarget as HTMLElement).style.transform="rotate(2deg) scale(1.04)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity="0.25"; (e.currentTarget as HTMLElement).style.transform="rotate(2deg)"; }}>
              <img src={getProxiedImageUrl("https://cdn.snkrdunk.com/upload_bg_removed/7302991.webp") ?? ""} alt="" className="w-full rounded-lg" style={{ boxShadow:"0 0 22px rgba(100,140,255,0.15), 6px 6px 20px rgba(0,0,0,0.6)" }} loading="lazy"/>
            </div>
            {/* MID card 3 — Luffy P Championship 2023 */}
            <div style={{ position:"absolute", top:"6%", right:"14%", width:"14vw", minWidth:"100px", opacity:0.25, transform:"rotate(3deg)", transition:"opacity 0.3s, transform 0.3s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity="0.42"; (e.currentTarget as HTMLElement).style.transform="rotate(3deg) scale(1.04)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity="0.25"; (e.currentTarget as HTMLElement).style.transform="rotate(3deg)"; }}>
              <img src={getProxiedImageUrl("https://cdn.snkrdunk.com/upload_bg_removed/20250821113101-1.webp") ?? ""} alt="" className="w-full rounded-lg" style={{ boxShadow:"0 0 22px rgba(100,140,255,0.15), 6px -6px 20px rgba(0,0,0,0.6)" }} loading="lazy"/>
            </div>
            {/* MID card 4 — Cyber Dragon GMR Serial */}
            <div style={{ position:"absolute", top:"50%", right:"12%", width:"13vw", minWidth:"90px", opacity:0.25, transform:"rotate(-2deg)", transition:"opacity 0.3s, transform 0.3s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity="0.42"; (e.currentTarget as HTMLElement).style.transform="rotate(-2deg) scale(1.04)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity="0.25"; (e.currentTarget as HTMLElement).style.transform="rotate(-2deg)"; }}>
              <img src={getProxiedImageUrl("https://cdn.snkrdunk.com/upload_bg_removed/7e272a98-d39b-49cb-bbbb-185de1322fb1.webp") ?? ""} alt="" className="w-full rounded-lg" style={{ boxShadow:"0 0 22px rgba(100,140,255,0.15), -6px 6px 20px rgba(0,0,0,0.6)" }} loading="lazy"/>
            </div>
            {/* MID card 5 — Cal Mewtwo Old Back */}
            <div style={{ position:"absolute", top:"25%", left:"3%", width:"11vw", minWidth:"80px", opacity:0.22, transform:"rotate(-1deg)", transition:"opacity 0.3s, transform 0.3s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity="0.38"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity="0.22"; }}>
              <img src={getProxiedImageUrl("https://cdn.snkrdunk.com/upload_bg_removed/20220901091323-0.webp") ?? ""} alt="" className="w-full rounded-lg" style={{ boxShadow:"0 0 18px rgba(255,200,50,0.1)" }} loading="lazy"/>
            </div>
            {/* MID card 6 — The Masked Royal Promo */}
            <div style={{ position:"absolute", top:"22%", right:"3%", width:"11vw", minWidth:"80px", opacity:0.22, transform:"rotate(1deg)", transition:"opacity 0.3s, transform 0.3s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity="0.38"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity="0.22"; }}>
              <img src={getProxiedImageUrl("https://cdn.snkrdunk.com/upload_bg_removed/20220901073221-0.webp") ?? ""} alt="" className="w-full rounded-lg" style={{ boxShadow:"0 0 18px rgba(255,200,50,0.1)" }} loading="lazy"/>
            </div>
            {/* MID card 7 — Mew ex 25th Holo */}
            <div style={{ position:"absolute", bottom:"12%", left:"15%", width:"12vw", minWidth:"85px", opacity:0.22, transform:"rotate(4deg)", transition:"opacity 0.3s, transform 0.3s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity="0.38"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity="0.22"; }}>
              <img src={getProxiedImageUrl("https://cdn.snkrdunk.com/upload_bg_removed/pkmn-tcg-25thCD-09.webp") ?? ""} alt="" className="w-full rounded-lg" style={{ boxShadow:"0 0 18px rgba(100,140,255,0.12)" }} loading="lazy"/>
            </div>
            {/* MID card 8 — M Sachiko EX Promo */}
            <div style={{ position:"absolute", bottom:"10%", right:"15%", width:"12vw", minWidth:"85px", opacity:0.22, transform:"rotate(-4deg)", transition:"opacity 0.3s, transform 0.3s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity="0.38"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity="0.22"; }}>
              <img src={getProxiedImageUrl("https://cdn.snkrdunk.com/upload_bg_removed/20220901031439-0.webp") ?? ""} alt="" className="w-full rounded-lg" style={{ boxShadow:"0 0 18px rgba(100,140,255,0.12)" }} loading="lazy"/>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
               FOREGROUND LAYER — 3 large sharp cards, opacity-40
               These slightly overlap the center logo edges
          ══════════════════════════════════════════════════════ */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 6 }}>
            {/* FG card 1 — Surfing Pikachu Bullet Train PSA10 #1, top-left large */}
            <div style={{ position:"absolute", top:"5%", left:"18%", width:"20vw", minWidth:"130px", maxWidth:"260px", opacity:0.4, transform:"rotate(-2deg)", transition:"opacity 0.3s, transform 0.3s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity="0.65"; (e.currentTarget as HTMLElement).style.transform="rotate(-2deg) scale(1.05)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity="0.4"; (e.currentTarget as HTMLElement).style.transform="rotate(-2deg)"; }}>
              <img src={getProxiedImageUrl("https://cdn.snkrdunk.com/upload_bg_removed/7302799.webp") ?? ""} alt="Surfing Pikachu" className="w-full rounded-xl" style={{ boxShadow:"0 0 30px rgba(255,220,0,0.25), -10px 10px 30px rgba(0,0,0,0.7)" }} loading="lazy"/>
            </div>
            {/* FG card 2 — Monkey D Luffy L Serial, top-right large */}
            <div style={{ position:"absolute", top:"5%", right:"18%", width:"19vw", minWidth:"120px", maxWidth:"240px", opacity:0.4, transform:"rotate(2deg)", transition:"opacity 0.3s, transform 0.3s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity="0.65"; (e.currentTarget as HTMLElement).style.transform="rotate(2deg) scale(1.05)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity="0.4"; (e.currentTarget as HTMLElement).style.transform="rotate(2deg)"; }}>
              <img src={getProxiedImageUrl("https://cdn.snkrdunk.com/upload_bg_removed/20221107034212-1.webp") ?? ""} alt="Monkey D Luffy" className="w-full rounded-xl" style={{ boxShadow:"0 0 30px rgba(220,50,50,0.2), 10px 10px 30px rgba(0,0,0,0.7)" }} loading="lazy"/>
            </div>
            {/* FG card 3 — Charizard 1ED e5, bottom-left */}
            <div style={{ position:"absolute", bottom:"12%", left:"20%", width:"17vw", minWidth:"110px", maxWidth:"220px", opacity:0.38, transform:"rotate(3deg)", transition:"opacity 0.3s, transform 0.3s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity="0.6"; (e.currentTarget as HTMLElement).style.transform="rotate(3deg) scale(1.05)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity="0.38"; (e.currentTarget as HTMLElement).style.transform="rotate(3deg)"; }}>
              <img src={getProxiedImageUrl("https://cdn.snkrdunk.com/upload_bg_removed/20250728030118-1.webp") ?? ""} alt="Charizard" className="w-full rounded-xl" style={{ boxShadow:"0 0 28px rgba(255,140,0,0.2), 8px -8px 25px rgba(0,0,0,0.65)" }} loading="lazy"/>
            </div>
            {/* FG card 4 — Pikachu PCG Gift Box, bottom-right */}
            <div style={{ position:"absolute", bottom:"12%", right:"20%", width:"16vw", minWidth:"100px", maxWidth:"200px", opacity:0.38, transform:"rotate(-3deg)", transition:"opacity 0.3s, transform 0.3s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity="0.6"; (e.currentTarget as HTMLElement).style.transform="rotate(-3deg) scale(1.05)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity="0.38"; (e.currentTarget as HTMLElement).style.transform="rotate(-3deg)"; }}>
              <img src={getProxiedImageUrl("https://cdn.snkrdunk.com/upload_bg_removed/7306806.webp") ?? ""} alt="Pikachu" className="w-full rounded-xl" style={{ boxShadow:"0 0 28px rgba(255,220,0,0.18), -8px -8px 25px rgba(0,0,0,0.65)" }} loading="lazy"/>
            </div>
          </div>

          {/* ── Radial vignette from center (light source effect) ── */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 55% 55% at 50% 48%, transparent 0%, rgba(0,0,0,0.55) 100%)",
              zIndex: 5,
            }}
          />

          {/* ══════════════════════════════════════════════════════
               FOREGROUND CONTENT — Logo + Stats (z-index 10)
          ══════════════════════════════════════════════════════ */}
          <div
            className="relative flex-1 flex flex-col items-center justify-center px-4"
            style={{ zIndex: 10, paddingTop: "3.5rem" }}
          >
            {/* BOXIUM Logo */}
            <div
              className="w-full rounded-2xl"
              style={{
                maxWidth: "min(460px, 68vw)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                background: "rgba(0,0,0,0.08)",
                padding: "clamp(8px, 2vw, 20px)",
              }}
            >
              <img
                src="/boxium-logo.png"
                alt="BOXIUM Logo"
                className="w-full h-auto"
                style={{ filter: "drop-shadow(0 0 24px rgba(254,221,0,0.25))" }}
              />
            </div>

            {/* Stats — glassmorphism boxes */}
            <div className="grid grid-cols-2 gap-2 md:gap-3 mt-3 md:mt-4 w-full" style={{ maxWidth: "min(400px, 78vw)" }}>
              <div
                className="rounded-xl p-2 md:p-3 text-center border"
                style={{
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  background: "rgba(255,255,255,0.03)",
                  borderColor: "rgba(255,255,255,0.1)",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
              >
                <div className="text-sm md:text-lg font-bold" style={{ color: "#FEDD00" }}>
                  {animatedCards.toLocaleString()}+
                </div>
                <div className="text-white/60 text-[9px] md:text-[10px] mt-0.5">{t("home.trackedCards")}</div>
              </div>
              <div
                className="rounded-xl p-2 md:p-3 text-center border"
                style={{
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  background: "rgba(255,255,255,0.03)",
                  borderColor: "rgba(255,255,255,0.1)",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
              >
                <div className="text-sm md:text-lg font-bold" style={{ color: "#FEDD00" }}>
                  {stats?.totalPriceRecords
                    ? `${Math.round(animatedPriceRecords / 10000)}${t("home.tenThousandUnit")}+`
                    : '—'}
                </div>
                <div className="text-white/60 text-[9px] md:text-[10px] mt-0.5">{t("home.priceDataPoints")}</div>
              </div>
            </div>
          </div>

          {/* ── Bottom gradient for nav readability ── */}
          <div
            className="absolute bottom-0 left-0 right-0 pointer-events-none"
            style={{
              height: "120px",
              background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)",
              zIndex: 9,
            }}
          />

          {/* Hero Quick Access — glassmorphism bottom nav bar */}
          <div className="relative" style={{ zIndex: 10 }}>
            <HeroQuickAccess />
          </div>
        </section>



      {/* Marketplace Marquee Section */}
      <MarketplaceMarquee />

      {/* Trending Cards Section */}
      <section className="py-6 md:py-12 px-4 sm:px-6" style={{ backgroundColor: "#f8f9fa" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-5 md:mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Flame className="w-6 h-6 md:w-8 md:h-8" style={{ color: "#ff4500" }} />
              <h2 className="text-base sm:text-lg md:text-xl font-bold" style={{ color: "#06038d" }}>
                {t("home.trendingCards")}
              </h2>
            </div>
            <p className="text-gray-600 text-xs md:text-sm max-w-2xl mx-auto px-2 font-semibold">
              {t("home.trendingCardsDesc")}
            </p>
          </div>

          <TrendingCardsGrid />
        </div>
      </section>

      {/* Data Sources Section */}
      <section className="py-6 md:py-12 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-5 md:mb-8">
            <h2 className="text-base sm:text-lg md:text-xl font-bold mb-1.5" style={{ color: "#06038d" }}>
              {t("home.dataSources")}
            </h2>
            <p className="text-gray-600 text-xs md:text-sm max-w-2xl mx-auto px-2">
              {t("home.dataSourcesDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            {/* SNKRDUNK */}
            <div className="bg-white rounded-xl p-6 md:p-8 shadow-md border-l-4" style={{ borderColor: "#06038d" }}>
              <img src="/snkrdunk-logo.png" alt="SNKRDUNK" className="h-8 md:h-10 mb-4 max-w-[120px] md:max-w-[180px] object-contain" />
              <p className="text-gray-600 mb-6 text-sm md:text-base leading-relaxed">
                {t("home.snkrdunkDesc")}
              </p>
              <div className="space-y-2 text-xs md:text-sm text-gray-600">
                <div>✓ {t("home.realtimeData")}</div>
                <div>✓ {t("home.psaSupport")}</div>
                <div>✓ {t("home.jpyPrice")}</div>
              </div>
            </div>

            {/* eBay */}
            <div className="bg-white rounded-xl p-6 md:p-8 shadow-md border-l-4" style={{ borderColor: "#FEDD00" }}>
              <img src="/ebay-logo.png" alt="eBay" className="h-8 md:h-10 mb-4 max-w-[120px] md:max-w-[180px] object-contain" />
              <p className="text-gray-600 mb-6 text-sm md:text-base leading-relaxed">
                {t("home.ebayDesc")}
              </p>
              <div className="space-y-2 text-xs md:text-sm text-gray-600">
                <div>✓ {t("home.globalMarket")}</div>
                <div>✓ {t("home.psaSupport")}</div>
                <div>✓ {t("home.usdPrice")}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <AboutUsSection />

      {/* CTA Section - Full-width 3-color panels with scroll-in animation */}
      <CtaSection />


      {/* Footer */}
      <Footer />
      </div>
    </>
  );
}
