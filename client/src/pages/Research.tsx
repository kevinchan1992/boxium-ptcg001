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
      <div className="relative z-10 flex flex-col" style={{ height: 'calc(100dvh - 3.5rem)', overflow: 'hidden' }}>

        {/* ── HERO: Asymmetric editorial layout ── */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row md:items-center px-6 sm:px-10 md:px-12 pt-8 md:pt-0 pb-4 md:pb-0 gap-0 md:gap-0">

          {/* LEFT: Editorial headline */}
          <div className="md:w-[40%] md:pr-8 flex flex-col justify-center">
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
                fontSize: 'clamp(36px, 6.5vw, 88px)',
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

          {/* RIGHT: Card gallery — Desktop: Gallery Wall / Mobile: 5-card row */}
          {/* Desktop: flex column taking up the right portion, vertically centered */}
          <div className="hidden md:flex md:w-[60%] items-center justify-center h-full">
            {isLoading ? (
              <div className="flex items-center gap-6">
                {[0,1,2,3,4].map((i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden bg-white/5 animate-pulse flex-shrink-0"
                    style={{ width: i===2 ? '10rem' : '7.5rem', aspectRatio: '3/4' }} />
                ))}
              </div>
            ) : popularCards.length > 0 ? (
              <div className="flex items-end gap-4 xl:gap-6 w-full justify-center">
                {popularCards.slice(0, 5).map((card: any, i: number) => {
                  // Asymmetric offsets — capped so cards stay within viewport
                  const offsets = ['-2rem', '1.5rem', '0', '1.5rem', '-1.5rem'];
                  const sizes: Array<"sm" | "md" | "lg"> = ['md', 'lg', 'lg', 'lg', 'md'];
                  return (
                    <div key={card.id} className="flex flex-col items-center gap-2"
                      style={{ transform: `translateY(${offsets[i] || '0'})` }}>
                      <HoloCard
                        card={card}
                        onClick={() => handleCardClick(card.id)}
                        size={sizes[i] || 'md'}
                      />
                      {/* Gallery label: card number + price */}
                      <div className="flex items-center justify-between w-full px-0.5 gap-2">
                        {card.cardNumber && (
                          <span className="text-[8px] uppercase tracking-[0.12em] truncate"
                            style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>
                            {card.cardNumber}
                          </span>
                        )}
                        {card.currentPrice ? (
                          <span className="text-[9px] flex-shrink-0 flex items-center gap-0.5"
                            style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                            {card.currentPrice >= 1000
                              ? `$${(card.currentPrice/1000).toFixed(1)}k`
                              : `$${Math.round(card.currentPrice)}`}
                            {card.priceChange7d !== null && card.priceChange7d !== 0 && (
                              <span style={{
                                color: card.priceChange7d > 0 ? '#2ecc71' : '#8B1A1A',
                                fontSize: '8px',
                              }}>
                                {card.priceChange7d > 0 ? '↑' : '↓'}
                              </span>
                            )}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Mobile: 5-card even row — sits naturally below search, no extra flex stretch */}
          <div className="md:hidden mt-6 pb-4">
            {isLoading ? (
              <div className="flex items-end justify-between gap-2 px-1">
                {[0,1,2,3,4].map((i) => (
                  <div key={i} className="relative rounded overflow-hidden bg-white/5 animate-pulse flex-shrink-0"
                    style={{ flex: '1', aspectRatio: '3/4' }} />
                ))}
              </div>
            ) : popularCards.length > 0 ? (
              <div className="flex items-end justify-between gap-2 px-1">
                {popularCards.slice(0, 5).map((card: any, i: number) => {
                  const mobileOffsets = ['0', '-0.75rem', '-1.25rem', '-0.75rem', '0'];
                  return (
                    <div key={card.id} className="flex flex-col gap-1 flex-1 min-w-0"
                      style={{ transform: `translateY(${mobileOffsets[i]})` }}>
                      <button
                        onClick={() => handleCardClick(card.id)}
                        className="relative rounded overflow-hidden w-full"
                        style={{
                          aspectRatio: '3/4',
                          boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
                        }}
                      >
                        <img
                          src={getProxiedImageUrl(card.imageUrl) ?? ''}
                          alt={card.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </button>
                      {/* Label: card number + price */}
                      <div className="flex flex-col gap-0.5 px-0.5">
                        {card.cardNumber && (
                          <span className="text-[6px] uppercase tracking-[0.08em] truncate block"
                            style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>
                            {card.cardNumber}
                          </span>
                        )}
                        {card.currentPrice ? (
                          <span className="text-[7px] flex items-center gap-0.5"
                            style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>
                            {card.currentPrice >= 1000
                              ? `$${(card.currentPrice/1000).toFixed(1)}k`
                              : `$${Math.round(card.currentPrice)}`}
                            {card.priceChange7d !== null && card.priceChange7d !== 0 && (
                              <span style={{ color: card.priceChange7d > 0 ? '#2ecc71' : '#8B1A1A', fontSize: '6px' }}>
                                {card.priceChange7d > 0 ? '↑' : '↓'}
                              </span>
                            )}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8" style={{ color: '#444444' }}>
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
