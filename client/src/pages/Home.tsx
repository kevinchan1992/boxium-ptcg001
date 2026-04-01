import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { TrendingUp, Search, BarChart3, Trophy, Facebook, Instagram, User, LogOut, Flame, ChevronRight, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import Footer from "@/components/Footer";
import StructuredData from "@/components/StructuredData";
import { formatCurrency, formatPriceChange } from "@/lib/formatCurrency";



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
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: accentColor }} />
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
                      src={card.imageUrl}
                      alt={card.name}
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
                  <p
                    className="text-[9px] sm:text-[11px] md:text-xs lg:text-sm font-bold tabular-nums"
                    style={{ color: "#06038d" }}
                  >
                    {formatCurrency(card.currentPrice)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const POKEMON_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/pokemon-logo_69947aad.avif";
const ONEPIECE_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/onepiece-logo_666cea4e.avif";
const YUGIOH_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/yugioh-logo_d165899b.webp";

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

// ─── CTA Section with Intersection Observer scroll-in animation ──────────────
function CtaSection() {
  const { t } = useTranslation();

  // Refs for the header and each panel
  const headerRef = useRef<HTMLDivElement>(null);
  const panel1Ref = useRef<HTMLAnchorElement>(null);
  const panel2Ref = useRef<HTMLAnchorElement>(null);
  const panel3Ref = useRef<HTMLAnchorElement>(null);

  // Visibility state
  const [headerVisible, setHeaderVisible] = useState(false);
  const [panel1Visible, setPanel1Visible] = useState(false);
  const [panel2Visible, setPanel2Visible] = useState(false);
  const [panel3Visible, setPanel3Visible] = useState(false);

  useEffect(() => {
    const makeObserver = (setter: (v: boolean) => void, delay = 0) =>
      new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setTimeout(() => setter(true), delay);
          }
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

    return () => {
      obs0.disconnect();
      obs1.disconnect();
      obs2.disconnect();
      obs3.disconnect();
    };
  }, []);

  // Shared slide-in style helper
  const slideIn = (visible: boolean, delay = 0): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(40px)",
    transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`,
  });

  return (
    <section className="overflow-hidden">
      {/* Section header */}
      <div
        ref={headerRef}
        className="py-6 md:py-10 px-4 text-center bg-white"
        style={slideIn(headerVisible)}
      >
        <h2 className="text-base sm:text-lg md:text-xl font-bold mb-1.5 md:mb-2" style={{ color: "#06038d" }}>
          {t("home.readyToStart")}
        </h2>
        <p className="text-gray-600 text-[11px] sm:text-xs md:text-sm leading-relaxed max-w-xl mx-auto">
          {t("home.readyToStartDesc")}
        </p>
      </div>

      {/* Three color panels — diagonal clip-path dividers, full bleed */}
      <div className="relative flex flex-col w-full">
        {/* Full-width blue top border spanning all three panels */}
        <div className="w-full" style={{ height: "3px", backgroundColor: "#06038d" }} />
        <div className="relative flex flex-row w-full overflow-hidden" style={{ minHeight: "180px" }}>

          {/* Panel 1: Search — deep navy (#06038d) */}
          <Link
            ref={panel1Ref}
            href="/research"
            className="group relative flex flex-col justify-between cursor-pointer active:brightness-90 select-none"
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
            {/* TCG card texture */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <rect x="10" y="15" width="50" height="70" rx="4" fill="none" stroke="white" strokeWidth="2"/>
              <rect x="140" y="-10" width="50" height="70" rx="4" fill="none" stroke="white" strokeWidth="2"/>
              <rect x="60" y="110" width="50" height="70" rx="4" fill="none" stroke="white" strokeWidth="2"/>
              <rect x="-10" y="90" width="30" height="42" rx="3" fill="none" stroke="white" strokeWidth="1.5"/>
              <rect x="160" y="130" width="50" height="70" rx="4" fill="none" stroke="white" strokeWidth="2"/>
            </svg>
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-all duration-200" />
            {/* Hover bottom accent line — yellow */}
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#FEDD00] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left z-20" />
            {/* Icon circle — scale-110 on hover */}
            <div className="relative z-10 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-[#FEDD00] group-hover:scale-110 transition-all duration-200">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-[#FEDD00] group-hover:text-[#06038d] transition-colors duration-200" />
            </div>
            {/* Title row */}
            <div className="relative z-10 mt-2 sm:mt-3">
              <h3 className="text-white font-bold text-xs sm:text-sm md:text-lg leading-tight">{t("home.startSearching")}</h3>
            </div>
            {/* Description row */}
            <div className="relative z-10 mt-1 sm:mt-2 flex-1">
              <p className="text-white/65 text-[10px] sm:text-xs md:text-sm leading-snug">
                {t("home.searchCardsDesc", "搜尋卡片、查看價格走勢與市場數據")}
              </p>
            </div>
            {/* CTA row */}
            <div className="relative z-10 mt-3 sm:mt-4 flex items-center gap-1 text-[#FEDD00]/80 text-[10px] sm:text-xs font-semibold">
              <span>{t("home.exploreNow", "立即探索")}</span>
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </div>
          </Link>

          {/* Panel 2: Market Pricing — white with navy text */}
          <Link
            ref={panel2Ref}
            href="/pricing"
            className="group relative flex flex-col justify-between cursor-pointer active:brightness-90 select-none"
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
            {/* TCG card texture — navy on white */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.05] pointer-events-none" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <rect x="20" y="20" width="50" height="70" rx="4" fill="none" stroke="#06038d" strokeWidth="2"/>
              <rect x="130" y="5" width="50" height="70" rx="4" fill="none" stroke="#06038d" strokeWidth="2"/>
              <rect x="70" y="120" width="50" height="70" rx="4" fill="none" stroke="#06038d" strokeWidth="2"/>
              <rect x="0" y="100" width="30" height="42" rx="3" fill="none" stroke="#06038d" strokeWidth="1.5"/>
              <rect x="170" y="140" width="50" height="70" rx="4" fill="none" stroke="#06038d" strokeWidth="2"/>
            </svg>
            <div className="absolute inset-0 transition-all duration-200" style={{ backgroundColor: "rgba(6,3,141,0)" }} />
            <div className="absolute inset-0 group-hover:bg-[#06038d]/5 transition-all duration-200" />
            {/* Hover bottom accent line — navy blue */}
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#06038d] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left z-20" />
            {/* Icon circle — scale-110 on hover */}
            <div
              className="relative z-10 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-[#06038d] transition-all duration-200"
              style={{ backgroundColor: "rgba(6,3,141,0.08)" }}
            >
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 group-hover:text-white transition-colors duration-200" style={{ color: "#06038d" }} />
            </div>
            {/* Title row */}
            <div className="relative z-10 mt-2 sm:mt-3">
              <h3 className="font-bold text-xs sm:text-sm md:text-lg leading-tight" style={{ color: "#06038d" }}>{t("home.viewMarketTrends")}</h3>
            </div>
            {/* Description row */}
            <div className="relative z-10 mt-1 sm:mt-2 flex-1">
              <p className="text-[10px] sm:text-xs md:text-sm leading-snug" style={{ color: "#06038d", opacity: 0.6 }}>
                {t("home.marketTrendsDesc", "查看市場價格走勢、比較各平台行情")}
              </p>
            </div>
            {/* CTA row */}
            <div className="relative z-10 mt-3 sm:mt-4 flex items-center gap-1 text-[10px] sm:text-xs font-semibold" style={{ color: "#06038d" }}>
              <span>{t("home.viewTrends", "查看行情")}</span>
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </div>
          </Link>

          {/* Panel 3: Marketplace — yellow (#FEDD00) */}
          <Link
            ref={panel3Ref}
            href="/marketplace"
            className="group relative flex flex-col justify-between cursor-pointer active:brightness-90 select-none"
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
            {/* TCG card texture — navy on yellow */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <rect x="15" y="10" width="50" height="70" rx="4" fill="none" stroke="#06038d" strokeWidth="2"/>
              <rect x="135" y="-5" width="50" height="70" rx="4" fill="none" stroke="#06038d" strokeWidth="2"/>
              <rect x="65" y="115" width="50" height="70" rx="4" fill="none" stroke="#06038d" strokeWidth="2"/>
              <rect x="-5" y="95" width="30" height="42" rx="3" fill="none" stroke="#06038d" strokeWidth="1.5"/>
              <rect x="165" y="135" width="50" height="70" rx="4" fill="none" stroke="#06038d" strokeWidth="2"/>
            </svg>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all duration-200" />
            {/* Hover bottom accent line — deep navy */}
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#06038d] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left z-20" />
            {/* Icon circle — scale-110 on hover */}
            <div
              className="relative z-10 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-[#06038d] transition-all duration-200"
              style={{ backgroundColor: "rgba(6,3,141,0.12)" }}
            >
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 group-hover:text-[#FEDD00] transition-colors duration-200" style={{ color: "#06038d" }} />
            </div>
            {/* Title row */}
            <div className="relative z-10 mt-2 sm:mt-3">
              <h3 className="font-bold text-xs sm:text-sm md:text-lg leading-tight" style={{ color: "#06038d" }}>{t("home.goToMarketplace")}</h3>
            </div>
            {/* Description row */}
            <div className="relative z-10 mt-1 sm:mt-2 flex-1">
              <p className="text-[10px] sm:text-xs md:text-sm leading-snug" style={{ color: "#06038d", opacity: 0.65 }}>
                {t("home.marketplaceDesc", "瀏覽市集商品、參與拍賣、安全交易")}
              </p>
            </div>
            {/* CTA row */}
            <div className="relative z-10 mt-3 sm:mt-4 flex items-center gap-1 text-[10px] sm:text-xs font-semibold" style={{ color: "#06038d" }}>
              <span>{t("home.browseNow", "立即瀏覽")}</span>
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </div>
          </Link>
        </div>
        {/* Yellow 4px bottom accent bar */}
        <div className="w-full h-1" style={{ backgroundColor: "#FEDD00" }} />
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
    "name": "BOXIUM PTCG",
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
  
  return (
    <>
      <StructuredData data={structuredData} />
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f8f9fa" }}>
        {/* Hero Section */}
      <section className="pt-16 md:pt-20 pb-16 md:pb-24 px-4 sm:px-6" style={{ backgroundColor: "#06038d" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center text-center space-y-4 md:space-y-8">
            {/* LOGO - Responsive sizing */}
            <div className="w-full max-w-[280px] md:max-w-2xl">
              <img
                src="/boxium-logo.png"
                alt="BOXIUM Logo"
                className="w-full h-auto"
              />
            </div>

            {/* Content - Responsive text sizes */}
            <div className="space-y-1.5 md:space-y-3 max-w-3xl px-2">
              <h1 className="text-white text-base sm:text-lg md:text-2xl font-bold leading-tight">
                {t("home.welcome")}
              </h1>
              <p className="text-white/80 text-[11px] sm:text-xs md:text-base leading-relaxed">
                {t("home.description")}
              </p>
            </div>

            {/* Key Stats - Responsive layout */}
            <div className="grid grid-cols-2 gap-2 md:gap-5 w-full max-w-md px-2">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-5 border border-white/20 text-center">
                <div className="text-base md:text-2xl font-bold text-[#FEDD00] mb-0.5">{stats?.totalCards || 0}+</div>
                <div className="text-white/70 text-[10px] md:text-sm">{t("home.cardDatabase")}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-5 border border-white/20 text-center">
                <div className="text-base md:text-2xl font-bold text-[#FEDD00] mb-0.5">{stats?.totalCards ? Math.floor(stats.totalCards * 8.5) : 0}+</div>
                <div className="text-white/70 text-[10px] md:text-sm">{t("home.priceRecords")}</div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="w-full max-w-xl px-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (searchQuery.trim()) {
                    setLocation(`/research?q=${encodeURIComponent(searchQuery.trim())}`);
                  }
                }}
                className="flex gap-2"
              >
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("home.searchPlaceholder")}
                  className="flex-1 bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:border-[#FEDD00] text-xs md:text-sm h-9 md:h-11"
                />
                <Button
                  type="submit"
                  className="px-3 md:px-5 h-9 md:h-11 font-semibold text-xs md:text-sm"
                  style={{ backgroundColor: "#FEDD00", color: "#06038d" }}
                >
                  <Search className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </Button>
              </form>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 md:gap-4 px-2">
              <Link href="/research">
                <Button
                  className="px-8 md:px-10 py-3 md:py-4 text-base md:text-lg font-semibold rounded-lg transition-all hover:scale-105"
                  style={{ backgroundColor: "#FEDD00", color: "#06038d" }}
                >
                  {t("home.startExploring")}
                </Button>
              </Link>
              <Link href="/pricing">
                <Button
                  className="px-8 md:px-10 py-3 md:py-4 text-base md:text-lg font-semibold rounded-lg transition-all hover:scale-105 border-2 border-[#FEDD00] bg-transparent text-[#FEDD00] hover:bg-[#FEDD00]/10"
                >
                  {t("home.goToMarketplace")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>



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
                <div>✓ 美元價格</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Full-width 3-color panels */}
      <CtaSection />

      {/* Footer */}
      <Footer />
      </div>
    </>
  );
}
