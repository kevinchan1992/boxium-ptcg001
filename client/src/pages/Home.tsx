import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { TrendingUp, Search, BarChart3, Trophy, Facebook, Instagram, User, LogOut, Flame, ChevronRight, ShoppingBag, Clock, Award } from "lucide-react";
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

// ─── HeroQuickAccess: 4 feature cards with staggered entrance animation ──────
function HeroQuickAccess() {
  const cardRefs = [useRef<HTMLAnchorElement>(null), useRef<HTMLAnchorElement>(null), useRef<HTMLAnchorElement>(null), useRef<HTMLAnchorElement>(null)];
  const [visible, setVisible] = useState([false, false, false, false]);

  useEffect(() => {
    const observers = cardRefs.map((ref, i) => {
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setTimeout(() => setVisible((prev) => { const next = [...prev]; next[i] = true; return next; }), i * 80);
            obs.disconnect();
          }
        },
        { threshold: 0.1 }
      );
      if (ref.current) obs.observe(ref.current);
      return obs;
    });
    return () => observers.forEach((o) => o.disconnect());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = [
    { href: "/research", emoji: "🔍", label: "卡牌搜尋", desc: "55,000+ 張卡牌", bg: "rgba(255,255,255,0.08)", hoverBg: "rgba(254,221,0,0.15)" },
    { href: "/pricing", emoji: "📈", label: "市場格價", desc: "121萬+ 記錄", bg: "rgba(255,255,255,0.05)", hoverBg: "rgba(254,221,0,0.12)" },
    { href: "/grading", emoji: "🏅", label: "PSA 鑑定", desc: "代客鑑定服務", bg: "rgba(255,255,255,0.08)", hoverBg: "rgba(254,221,0,0.15)" },
    { href: "/marketplace", emoji: "🛒", label: "市集", desc: "安全交易", bg: "rgba(254,221,0,0.12)", hoverBg: "rgba(254,221,0,0.25)" },
  ];

  return (
    <div className="w-full max-w-3xl pt-2 md:pt-4">
      <div className="grid grid-cols-4 gap-0 rounded-xl overflow-hidden border border-white/20 shadow-2xl">
        {items.map((item, i) => (
          <Link
            key={item.href}
            ref={cardRefs[i]}
            href={item.href}
            className="group relative flex flex-col items-center justify-center gap-1 md:gap-2 py-4 md:py-5 px-1 md:px-3 cursor-pointer select-none"
            style={{
              background: item.bg,
              borderRight: i < 3 ? "1px solid rgba(255,255,255,0.12)" : undefined,
              opacity: visible[i] ? 1 : 0,
              transform: visible[i] ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.45s ease, transform 0.45s ease",
            }}
          >
            {/* Hover overlay */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: item.hoverBg }} />
            {/* Bottom accent line */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center" style={{ background: "#FEDD00" }} />
            {/* Emoji icon */}
            <span className="relative z-10 text-xl md:text-2xl leading-none group-hover:scale-110 transition-transform duration-200">{item.emoji}</span>
            {/* Label */}
            <span className="relative z-10 text-white font-bold text-[11px] sm:text-xs md:text-sm leading-tight text-center">{item.label}</span>
            {/* Sub-desc */}
            <span className="relative z-10 text-white/50 text-[9px] sm:text-[10px] md:text-xs leading-tight text-center group-hover:text-[#FEDD00]/80 transition-colors duration-200">{item.desc}</span>
            {/* Arrow */}
            <ChevronRight className="relative z-10 w-3 h-3 text-white/30 group-hover:text-[#FEDD00] group-hover:translate-x-0.5 transition-all duration-200" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── BatchCountdown: PSA grading batch deadline banner ──────────────────────
function BatchCountdownBanner() {
  const { data: nextBatch } = trpc.grading.getNextBatch.useQuery();
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });

  useEffect(() => {
    if (!nextBatch?.cutoffDate) return;
    const deadline = new Date(nextBatch.cutoffDate).getTime();
    const tick = () => {
      const now = Date.now();
      const diff = deadline - now;
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ days, hours, minutes, seconds, expired: false });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextBatch?.cutoffDate]);

  if (!nextBatch || timeLeft.expired) return null;

  const isUrgent = timeLeft.days < 3;

  return (
    <Link href="/grading">
      <div
        className="w-full max-w-3xl mx-auto mt-3 md:mt-4 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl cursor-pointer group transition-all duration-200 hover:brightness-110 select-none"
        style={{
          background: isUrgent
            ? "linear-gradient(135deg, rgba(239,68,68,0.25) 0%, rgba(220,38,38,0.15) 100%)"
            : "linear-gradient(135deg, rgba(254,221,0,0.18) 0%, rgba(254,221,0,0.08) 100%)",
          border: isUrgent ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(254,221,0,0.3)",
        }}
      >
        {/* Left: icon + label */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: isUrgent ? "rgba(239,68,68,0.3)" : "rgba(254,221,0,0.2)" }}
          >
            {isUrgent ? (
              <Clock className="w-3.5 h-3.5" style={{ color: isUrgent ? "#fca5a5" : "#FEDD00" }} />
            ) : (
              <Award className="w-3.5 h-3.5" style={{ color: "#FEDD00" }} />
            )}
          </div>
          <div>
            <div className="text-white font-bold text-[11px] sm:text-xs leading-tight">
              {nextBatch.name} 截止報名
            </div>
            <div className="text-white/55 text-[9px] sm:text-[10px] leading-tight">
              PSA 代客鑑定 · 立即申請
            </div>
          </div>
        </div>

        {/* Center: countdown */}
        <div className="flex items-center gap-1.5 flex-1 justify-center">
          {[
            { val: timeLeft.days, unit: "天" },
            { val: timeLeft.hours, unit: "時" },
            { val: timeLeft.minutes, unit: "分" },
            { val: timeLeft.seconds, unit: "秒" },
          ].map(({ val, unit }, i) => (
            <div key={unit} className="flex items-center gap-1">
              {i > 0 && <span className="text-white/30 text-xs font-bold">:</span>}
              <div className="flex flex-col items-center">
                <span
                  className="font-black text-sm sm:text-base md:text-lg tabular-nums leading-none"
                  style={{ color: isUrgent ? "#fca5a5" : "#FEDD00" }}
                >
                  {String(val).padStart(2, "0")}
                </span>
                <span className="text-white/40 text-[8px] sm:text-[9px] leading-tight">{unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Right: CTA arrow */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <span
            className="text-[10px] sm:text-xs font-semibold hidden sm:inline"
            style={{ color: isUrgent ? "#fca5a5" : "#FEDD00" }}
          >
            立即申請
          </span>
          <ChevronRight
            className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200"
            style={{ color: isUrgent ? "#fca5a5" : "#FEDD00" }}
          />
        </div>
      </div>
    </Link>
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

  // Count-up animations for hero stats
  const animatedCards = useCountUp(stats?.totalCards);
  const animatedPriceRecords = useCountUp(stats?.totalPriceRecords);

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
                <div className="text-base md:text-2xl font-bold text-[#FEDD00] mb-0.5">
                  {animatedCards.toLocaleString()}+
                </div>
                <div className="text-white/80 text-[9px] md:text-xs">{t("home.trackedCards")}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-5 border border-white/20 text-center">
                <div className="text-base md:text-2xl font-bold text-[#FEDD00] mb-0.5">
                  {stats?.totalPriceRecords
                    ? `${Math.round(animatedPriceRecords / 10000)}萬+`
                    : '—'}
                </div>
                <div className="text-white/80 text-[9px] md:text-xs">{t("home.priceDataPoints")}</div>
              </div>
            </div>

            {/* Hero Quick Access — 4 feature cards with staggered entrance animation */}
            <HeroQuickAccess />

            {/* PSA Grading Batch Countdown Banner */}
            <BatchCountdownBanner />
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

      {/* CTA Section - Full-width 3-color panels with scroll-in animation */}
      <CtaSection />


      {/* Footer */}
      <Footer />
      </div>
    </>
  );
}
