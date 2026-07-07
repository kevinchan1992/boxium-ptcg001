import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { TypeAnimation } from 'react-type-animation';
import { CardSearchDropdown } from "@/components/CardSearchDropdown";
import { MobileSearchOverlay } from "@/components/MobileSearchOverlay";
import { CameraSearchSheet } from "@/components/CameraSearchSheet";
import { EditorialSearchBox } from "@/components/EditorialSearchBox";
import StructuredData from "@/components/StructuredData";
import { getProxiedImageUrl } from "@/lib/utils";
import PageHead from "@/components/PageHead";

// ── Collage poster wall layout positions (20 slots, % units relative to container) ──
const COLLAGE_POSITIONS: Array<{ top: string; left: string; width: string; rotate: string; z?: number }> = [
  // Row 1 — upper band
  { top: '3%',  left: '38%', width: '11%', rotate: '-1.5deg', z: 2 },
  { top: '1%',  left: '50%', width: '14%', rotate: '1deg',    z: 3 },
  { top: '4%',  left: '65%', width: '10%', rotate: '-0.8deg', z: 1 },
  { top: '2%',  left: '76%', width: '13%', rotate: '2deg',    z: 2 },
  { top: '0%',  left: '89%', width: '9%',  rotate: '-1.2deg', z: 1 },
  // Row 2 — middle band
  { top: '28%', left: '40%', width: '13%', rotate: '1.5deg',  z: 4 },
  { top: '25%', left: '54%', width: '16%', rotate: '-1deg',   z: 5 },
  { top: '30%', left: '71%', width: '11%', rotate: '0.5deg',  z: 3 },
  { top: '26%', left: '83%', width: '14%', rotate: '-2deg',   z: 4 },
  { top: '32%', left: '36%', width: '9%',  rotate: '1.8deg',  z: 2 },
  // Row 3 — lower band
  { top: '55%', left: '42%', width: '12%', rotate: '-0.5deg', z: 3 },
  { top: '52%', left: '55%', width: '15%', rotate: '1.2deg',  z: 5 },
  { top: '57%', left: '71%', width: '10%', rotate: '-1.8deg', z: 2 },
  { top: '54%', left: '82%', width: '13%', rotate: '0.8deg',  z: 4 },
  { top: '58%', left: '38%', width: '8%',  rotate: '-1deg',   z: 1 },
  // Row 4 — bottom accent
  { top: '74%', left: '44%', width: '11%', rotate: '2deg',    z: 3 },
  { top: '72%', left: '56%', width: '14%', rotate: '-0.7deg', z: 4 },
  { top: '76%', left: '71%', width: '10%', rotate: '1.5deg',  z: 2 },
  { top: '73%', left: '82%', width: '12%', rotate: '-1.5deg', z: 3 },
  { top: '78%', left: '40%', width: '9%',  rotate: '0.5deg',  z: 1 },
];

// ── Holographic overlay on card hover ──────────────────────────────────────
function HoloCard({
  card,
  onClick,
  size = "md",
}: {
  card: any;
  onClick: () => void;
  size?: "sm" | "md" | "lg";
}) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [holoPos, setHoloPos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = (e.clientX - rect.left) / rect.width;
    const cy = (e.clientY - rect.top) / rect.height;
    setTilt({ x: (cy - 0.5) * 18, y: (cx - 0.5) * -18 });
    setHoloPos({ x: cx * 100, y: cy * 100 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setHoloPos({ x: 50, y: 50 });
    setIsHovered(false);
  };

  const widthClass = size === "lg" ? "w-36 sm:w-44" : size === "sm" ? "w-20 sm:w-24" : "w-28 sm:w-32";

  return (
    <button
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      className={`group relative ${widthClass} flex-shrink-0`}
      style={{
        perspective: '800px',
        transform: 'translateZ(0)',
      }}
    >
      <div
        className="relative aspect-[3/4] rounded-lg overflow-hidden"
        style={{
          transform: isHovered
            ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.04)`
            : 'rotateX(0deg) rotateY(0deg) scale(1)',
          transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.4s ease-out',
          boxShadow: isHovered
            ? '0 20px 60px rgba(0,0,0,0.7), 0 0 30px rgba(255,255,255,0.06)'
            : '0 8px 30px rgba(0,0,0,0.5)',
        }}
      >
        {/* Card image */}
        <img
          src={getProxiedImageUrl(card.imageUrl) ?? "https://via.placeholder.com/128x176?text=No+Image"}
          alt={card.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Holographic overlay */}
        {isHovered && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `
                radial-gradient(circle at ${holoPos.x}% ${holoPos.y}%,
                  rgba(255,255,255,0.15) 0%,
                  rgba(120,80,255,0.08) 25%,
                  rgba(0,200,255,0.06) 50%,
                  rgba(255,180,0,0.05) 75%,
                  transparent 100%
                )
              `,
              mixBlendMode: 'screen',
            }}
          />
        )}
        {/* Subtle shine streak */}
        {isHovered && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(
                ${105 + tilt.y * 2}deg,
                transparent 30%,
                rgba(255,255,255,0.06) 50%,
                transparent 70%
              )`,
            }}
          />
        )}
      </div>
      {/* Gallery label */}
      {card.cardNumber && (
        <div className="mt-1.5 text-center">
          <p
            className="font-mono text-[9px] uppercase tracking-[0.12em] truncate"
            style={{ color: '#555555', letterSpacing: '0.1em' }}
          >
            {card.cardNumber}
          </p>
        </div>
      )}
    </button>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const searchParams = useSearch();
  const initialQuery = new URLSearchParams(searchParams).get('q') || '';
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [, setLocation] = useLocation();
  const [showCameraSheet, setShowCameraSheet] = useState(false);

  // Sync search query when URL param changes
  useEffect(() => {
    const q = new URLSearchParams(searchParams).get('q') || '';
    setSearchQuery(q);
  }, [searchParams]);

  // Fetch trending cards (top 20 for mobile lookbook scroll)
  const { data: trendingCards = [], isLoading } = trpc.cards.getTrending.useQuery(
    { limit: 20 },
    { retry: 1 }
  );

  // Fetch random card names for placeholder rotation
  const { data: randomCardNames = [] } = trpc.cards.getRandomCardNames.useQuery(
    { count: 10 },
    { retry: 1 }
  );

  // Map trending cards to card format for display
  const popularCards = trendingCards.map((card: any) => ({
    id: card.id,
    name: card.name,
    imageUrl: card.imageUrl,
    cardNumber: card.cardNumber || null,
    series: card.series || null,
    currentPrice: card.currentPrice || null,
    priceChange7d: card.priceChange7d ?? null,
  }));

  const handleCardClick = (cardId: number) => {
    setLocation(`/card/${cardId}`);
  };

  // Generate WebSite with SearchAction structured data for SEO
  const generateSearchActionData = () => {
    return {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "BOXIUM TCG",
      "url": "https://boxiumptcg.manus.space/",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://boxiumptcg.manus.space/search?q={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    };
  };

  return (
    <>
      {/* JSON-LD Structured Data for SEO */}
      <StructuredData data={generateSearchActionData()} />
      <PageHead
        title="卡牌查詢 - BOXIUM TCG | TCG 卡牌價格走勢查詢"
        description="搜尋 Pokémon、One Piece、遊戲王等 TCG 卡牌，查看即時市場價格、PSA 10 成交記錄及價格走勢分析。"
        keywords="TCG 卡牌查詢, Pokémon 卡牌價格, PSA 10 價格, BOXIUM TCG"
      />

      {/* ── Noise texture overlay (grain / film feel) ── */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.035'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px',
          opacity: 0.6,
        }}
      />

      {/* ── Ambient light blobs ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Top-left amber glow */}
        <div
          className="absolute"
          style={{
            top: '-15%',
            left: '-10%',
            width: '50vw',
            height: '50vw',
            background: 'radial-gradient(circle, rgba(180,120,20,0.07) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        {/* Bottom-right deep violet glow */}
        <div
          className="absolute"
          style={{
            bottom: '-20%',
            right: '-10%',
            width: '55vw',
            height: '55vw',
            background: 'radial-gradient(circle, rgba(80,40,160,0.08) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        {/* Center subtle blue */}
        <div
          className="absolute"
          style={{
            top: '30%',
            left: '35%',
            width: '30vw',
            height: '30vw',
            background: 'radial-gradient(circle, rgba(20,60,120,0.05) 0%, transparent 70%)',
            filter: 'blur(50px)',
          }}
        />
      </div>

      {/* ── Main layout ── */}
      {/* Desktop: h-screen no-scroll / Mobile: min-h-screen allow scroll */}
      <div className="relative z-10 flex flex-col"
        style={{ height: 'calc(100dvh - 3.5rem)', overflow: 'hidden' }}
      >

        {/* ── HERO: Asymmetric editorial layout ── */}
        <div className="flex-1 min-h-0 relative flex flex-col md:flex-row md:items-center px-6 sm:px-10 md:px-16 pt-8 md:pt-0 pb-4 md:pb-0 gap-4 md:gap-0">

          {/* LEFT: Editorial headline */}
          <div className="md:w-1/2 md:pr-12 flex flex-col justify-center">
            {/* Eyebrow label */}
            <p
              className="text-[9px] uppercase tracking-[0.3em] font-semibold mb-4 md:mb-6"
              style={{ color: '#666666', fontFamily: 'monospace' }}
            >
              B O X I U M &nbsp;&nbsp; R E S E A R C H
            </p>

            {/* Main headline — Playfair Display */}
            <h1
              className="leading-[1.05] mb-5 md:mb-8"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 'clamp(32px, 5.5vw, 72px)',
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '-0.02em',
              }}
            >
              THE ART OF<br />
              <span style={{ color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>
                SPECULATION.
              </span>
            </h1>

            {/* Divider rule */}
            <div
              className="mb-5 md:mb-8"
              style={{ width: '40px', height: '1px', background: 'rgba(255,255,255,0.2)' }}
            />

            {/* Search box — Editorial expandable (desktop) */}
            <div className="hidden md:block max-w-md">
              <EditorialSearchBox
                value={searchQuery}
                onChange={setSearchQuery}
                onSubmit={(q) => {
                  if (q.trim()) setLocation(`/search?q=${encodeURIComponent(q)}`);
                }}
                cardLinkPrefix="card"
                hint={t("research.searchPlaceholder")}
                showCameraButton
                onCameraClick={() => setShowCameraSheet(true)}
                randomCardNames={randomCardNames}
              />
            </div>

            {/* Mobile search overlay trigger */}
            <div className="md:hidden">
              <MobileSearchOverlay
                initialQuery={searchQuery}
                cardNames={randomCardNames}
                placeholder={t("research.searchPlaceholder")}
                onSearch={(q) => {
                  setSearchQuery(q);
                  setLocation(`/search?q=${encodeURIComponent(q)}`);
                }}
                cardLinkPrefix="card"
                onCameraClick={() => setShowCameraSheet(true)}
              />
            </div>
          </div>

          {/* ── DESKTOP: Collage poster wall (absolute positioned, 20 cards) ── */}
          <div className="hidden md:block absolute inset-0 pointer-events-none">
            {/* Left text protection gradient */}
            <div className="absolute left-0 top-0 bottom-0 w-[42%] z-10 pointer-events-none"
              style={{ background: 'linear-gradient(to right, #0d0d0f 55%, transparent 100%)' }} />
            {/* Collage container */}
            <div className="absolute inset-0 pointer-events-auto">
              {isLoading ? (
                // Skeleton placeholders
                <>
                  {[0,1,2,3,4,5,6,7,8,9].map((i) => (
                    <div key={i}
                      className="absolute rounded-lg bg-white/5 animate-pulse"
                      style={COLLAGE_POSITIONS[i] ? {
                        top: COLLAGE_POSITIONS[i].top,
                        left: COLLAGE_POSITIONS[i].left,
                        width: COLLAGE_POSITIONS[i].width,
                        aspectRatio: '3/4',
                        transform: `rotate(${COLLAGE_POSITIONS[i].rotate})`,
                      } : {}}
                    />
                  ))}
                </>
              ) : popularCards.slice(0, 20).map((card: any, i: number) => {
                const pos = COLLAGE_POSITIONS[i % COLLAGE_POSITIONS.length];
                return (
                  <button
                    key={card.id}
                    onClick={() => handleCardClick(card.id)}
                    className="absolute group"
                    style={{
                      top: pos.top,
                      left: pos.left,
                      width: pos.width,
                      zIndex: pos.z ?? 1,
                      transform: `rotate(${pos.rotate})`,
                      transition: 'transform 0.25s ease, z-index 0s',
                    }}
                  >
                    <div className="relative w-full overflow-hidden rounded-sm"
                      style={{ aspectRatio: '3/4', boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}>
                      <img
                        src={getProxiedImageUrl(card.imageUrl) ?? ''}
                        alt={card.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      {/* Micro price tag — bottom edge tape label */}
                      {card.currentPrice && (
                        <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1"
                          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}>
                          <div className="flex items-center justify-between">
                            {card.cardNumber && (
                              <span className="text-[6px] uppercase tracking-[0.1em] truncate"
                                style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
                                {card.cardNumber}
                              </span>
                            )}
                            <span className="text-[7px] flex-shrink-0 flex items-center gap-0.5"
                              style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>
                              {card.currentPrice >= 1000
                                ? `$${(card.currentPrice/1000).toFixed(1)}k`
                                : `$${Math.round(card.currentPrice)}`}
                              {card.priceChange7d !== null && card.priceChange7d !== 0 && (
                                <span style={{
                                  color: card.priceChange7d > 0 ? '#2ecc71' : '#8B1A1A',
                                  fontSize: '6px',
                                }}>
                                  {card.priceChange7d > 0 ? '↑' : '↓'}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── MOBILE: Asymmetric dual-column waterfall ── */}
          <div className="md:hidden w-full px-4 pb-6">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[0,1,2,3,4,5].map((i) => (
                  <div key={i}
                    className="relative rounded-lg overflow-hidden bg-white/5 animate-pulse"
                    style={{ aspectRatio: '3/4', marginTop: i % 2 === 1 ? '2rem' : '0' }}
                  />
                ))}
              </div>
            ) : popularCards.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                {popularCards.map((card: any, i: number) => {
                  // Alternating column offsets for waterfall effect
                  const isRightCol = i % 2 === 1;
                  const offsetMt = isRightCol ? '2.5rem' : '0';
                  return (
                    <button
                      key={card.id}
                      onClick={() => handleCardClick(card.id)}
                      className="relative group text-left"
                      style={{ marginTop: offsetMt }}
                    >
                      <div className="relative w-full overflow-hidden rounded-sm"
                        style={{ aspectRatio: '3/4', boxShadow: '0 6px 20px rgba(0,0,0,0.6)' }}>
                        <img
                          src={getProxiedImageUrl(card.imageUrl) ?? ''}
                          alt={card.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {/* Micro tape label */}
                        {card.currentPrice && (
                          <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1"
                            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}>
                            <div className="flex items-center justify-between">
                              {card.cardNumber && (
                                <span className="text-[6px] uppercase tracking-[0.08em] truncate"
                                  style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                                  {card.cardNumber}
                                </span>
                              )}
                              <span className="text-[7px] flex-shrink-0 flex items-center gap-0.5"
                                style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace' }}>
                                {card.currentPrice >= 1000
                                  ? `$${(card.currentPrice/1000).toFixed(1)}k`
                                  : `$${Math.round(card.currentPrice)}`}
                                {card.priceChange7d !== null && card.priceChange7d !== 0 && (
                                  <span style={{
                                    color: card.priceChange7d > 0 ? '#2ecc71' : '#8B1A1A',
                                    fontSize: '6px',
                                  }}>
                                    {card.priceChange7d > 0 ? '↑' : '↓'}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12" style={{ color: '#444444' }}>
                <p className="text-sm">{t("research.noResults")}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom editorial footnote ── */}
        <div
          className="px-6 sm:px-10 md:px-16 py-3 md:py-4 flex-shrink-0 flex items-center justify-between"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <p
            className="text-[9px] uppercase tracking-[0.2em]"
            style={{ color: '#333333', fontFamily: 'monospace' }}
          >
            TCG MARKET INTELLIGENCE
          </p>
          <p
            className="text-[9px] uppercase tracking-[0.2em]"
            style={{ color: '#333333', fontFamily: 'monospace' }}
          >
            PSA 10 · SNKRDUNK · HKD
          </p>
        </div>
      </div>

      {/* Camera Search Sheet — desktop camera button triggers this */}
      <CameraSearchSheet
        open={showCameraSheet}
        onOpenChange={setShowCameraSheet}
        cardLinkPrefix="card"
      />
    </>
  );
}
