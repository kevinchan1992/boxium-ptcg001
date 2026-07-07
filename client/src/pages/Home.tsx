import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Search, BarChart2, TrendingUp, Award } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import StructuredData from "@/components/StructuredData";
import { getProxiedImageUrl } from "@/lib/utils";
import PageHead from "@/components/PageHead";

// ── Collage card positions (desktop) ──────────────────────────────────────────
// Each entry: { top, left/right, width, rotate, zIndex }
const COLLAGE_POSITIONS = [
  { top: '-2%',  left: '32%',  width: '13%', rotate: '-1.5deg', z: 8  },
  { top: '5%',   left: '44%',  width: '11%', rotate: '1.2deg',  z: 9  },
  { top: '-4%',  left: '54%',  width: '14%', rotate: '-0.8deg', z: 7  },
  { top: '10%',  left: '65%',  width: '12%', rotate: '2deg',    z: 10 },
  { top: '-1%',  left: '75%',  width: '10%', rotate: '-1.8deg', z: 6  },
  { top: '28%',  left: '30%',  width: '12%', rotate: '1.5deg',  z: 7  },
  { top: '22%',  left: '42%',  width: '15%', rotate: '-1deg',   z: 11 },
  { top: '18%',  left: '57%',  width: '11%', rotate: '2.2deg',  z: 8  },
  { top: '25%',  left: '67%',  width: '13%', rotate: '-0.5deg', z: 9  },
  { top: '20%',  left: '79%',  width: '10%', rotate: '1.8deg',  z: 6  },
  { top: '48%',  left: '28%',  width: '11%', rotate: '-2deg',   z: 7  },
  { top: '44%',  left: '40%',  width: '13%', rotate: '0.8deg',  z: 10 },
  { top: '42%',  left: '53%',  width: '15%', rotate: '-1.5deg', z: 12 },
  { top: '46%',  left: '67%',  width: '12%', rotate: '1.2deg',  z: 8  },
  { top: '45%',  left: '78%',  width: '11%', rotate: '-1deg',   z: 7  },
  { top: '66%',  left: '30%',  width: '12%', rotate: '1.8deg',  z: 9  },
  { top: '64%',  left: '43%',  width: '14%', rotate: '-0.8deg', z: 8  },
  { top: '62%',  left: '57%',  width: '11%', rotate: '2deg',    z: 10 },
  { top: '65%',  left: '68%',  width: '13%', rotate: '-1.5deg', z: 7  },
  { top: '63%',  left: '80%',  width: '10%', rotate: '1deg',    z: 6  },
];

// ── Nav links ─────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { tag: 'SEARCH',  label: '卡牌搜尋', href: '/research',    icon: Search    },
  { tag: 'PRICING', label: '市場格價', href: '/pricing',     icon: BarChart2 },
  { tag: 'TREND',   label: '漲幅榜',   href: '/trending',    icon: TrendingUp },
  { tag: 'GRADING', label: 'PSA 鑑定', href: '/grading',     icon: Award     },
];

// ── Mobile card item ──────────────────────────────────────────────────────────
function MobileCard({
  card,
  onClick,
  offsetY = '0',
}: {
  card: any;
  onClick: () => void;
  offsetY?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="relative rounded overflow-hidden w-full flex-shrink-0"
      style={{
        aspectRatio: '3/4',
        transform: `translateY(${offsetY})`,
        boxShadow: '0 8px 28px rgba(0,0,0,0.65)',
      }}
    >
      <img
        src={getProxiedImageUrl(card.imageUrl) ?? ''}
        alt={card.name}
        className="w-full h-full object-cover"
        loading="lazy"
      />
      {/* Subtle bottom gradient for label legibility */}
      <div
        className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)' }}
      />
      {card.cardNumber && (
        <span
          className="absolute bottom-1 left-1.5 text-[6px] uppercase tracking-[0.1em] truncate"
          style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}
        >
          {card.cardNumber}
        </span>
      )}
      {card.currentPrice ? (
        <span
          className="absolute bottom-1 right-1.5 text-[6px] flex items-center gap-0.5"
          style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}
        >
          {card.currentPrice >= 1000
            ? `$${(card.currentPrice / 1000).toFixed(1)}k`
            : `$${Math.round(card.currentPrice)}`}
          {card.priceChange7d !== null && card.priceChange7d !== 0 && (
            <span style={{ color: card.priceChange7d > 0 ? '#2ecc71' : '#8B1A1A' }}>
              {card.priceChange7d > 0 ? '↑' : '↓'}
            </span>
          )}
        </span>
      ) : null}
    </button>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  const { data: trendingCards = [], isLoading } = trpc.cards.getTrending.useQuery(
    { limit: 20 },
    { retry: 1 }
  );
  const { data: stats } = trpc.cards.getStats.useQuery();

  const popularCards = trendingCards.map((card: any) => ({
    id: card.id,
    name: card.name,
    imageUrl: card.imageUrl,
    cardNumber: card.cardNumber || null,
    currentPrice: card.currentPrice || null,
    priceChange7d: card.priceChange7d ?? null,
  }));

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "BOXIUM TCG",
    "url": "https://boxiumptcg.manus.space",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://boxiumptcg.manus.space/research?q={search_term_string}",
      "query-input": "required name=search_term_string"
    },
  };

  // Mobile masonry offsets: 5 cards, alternating
  const mobileOffsets = ['0', '-1.5rem', '0.75rem', '-1rem', '0.5rem'];

  return (
    <>
      <StructuredData data={structuredData} />
      <PageHead
        title="BOXIUM TCG | 卡牌價格查詢與市集"
        description="BOXIUM TCG 提供 Pokémon、One Piece、遊戲王等 TCG 卡牌的即時價格查詢、PSA 10 成交記錄、價格走勢分析及市集交易平台。"
        keywords="TCG 卡牌, Pokémon 卡牌價格, PSA 10, BOXIUM TCG, 卡牌市集"
      />

      {/* ── Noise texture overlay ── */}
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
        <div className="absolute" style={{ top: '-15%', left: '-10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(180,120,20,0.06) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute" style={{ bottom: '-20%', right: '-10%', width: '55vw', height: '55vw', background: 'radial-gradient(circle, rgba(80,40,160,0.07) 0%, transparent 70%)', filter: 'blur(70px)' }} />
        <div className="absolute" style={{ top: '30%', left: '40%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(0,100,200,0.04) 0%, transparent 70%)', filter: 'blur(50px)' }} />
      </div>

      {/* ── Main container: h-screen, no scroll ── */}
      <div
        className="relative z-10 flex flex-col"
        style={{ height: 'calc(100dvh - 3.5rem)', overflow: 'hidden' }}
      >

        {/* ════════════════════════════════════════════════════════════════
            DESKTOP LAYOUT
        ════════════════════════════════════════════════════════════════ */}
        <div className="hidden md:flex flex-1 min-h-0 relative">

          {/* LEFT: Editorial text column */}
          <div className="relative z-20 flex flex-col justify-between px-12 xl:px-16 py-10 xl:py-14" style={{ width: '32%', minWidth: '280px' }}>

            {/* Top: eyebrow + headline + nav links */}
            <div>
              <p
                className="text-[9px] uppercase tracking-[0.35em] mb-6"
                style={{ color: '#555555', fontFamily: 'monospace' }}
              >
                B O X I U M &nbsp;&nbsp; T C G
              </p>

              <h1
                className="leading-[1.02] mb-6"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 'clamp(38px, 3.8vw, 72px)',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  letterSpacing: '-0.02em',
                }}
              >
                THE ART<br />
                OF<br />
                <span style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                  SPECULATION.
                </span>
              </h1>

              {/* Thin divider */}
              <div className="mb-8" style={{ width: '40px', height: '1px', background: 'rgba(255,255,255,0.18)' }} />

              {/* Nav links — minimal text style */}
              <nav className="flex flex-col gap-3">
                {NAV_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-3"
                  >
                    <span
                      className="text-[8px] uppercase tracking-[0.25em] flex-shrink-0"
                      style={{ color: '#444444', fontFamily: 'monospace', width: '44px' }}
                    >
                      {item.tag}
                    </span>
                    <span
                      className="text-sm font-medium transition-colors duration-200 group-hover:text-white"
                      style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.01em' }}
                    >
                      {item.label}
                    </span>
                    <span
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-[10px]"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                    >
                      →
                    </span>
                  </Link>
                ))}
              </nav>
            </div>

            {/* Bottom: stats footnote */}
            <div>
              <div className="mb-4" style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.06)' }} />
              <div className="flex gap-8">
                {stats?.totalCards ? (
                  <div>
                    <p className="text-white font-bold" style={{ fontFamily: 'monospace', fontSize: '16px' }}>
                      {stats.totalCards.toLocaleString()}+
                    </p>
                    <p className="text-[9px] uppercase tracking-[0.15em]" style={{ color: '#444444', fontFamily: 'monospace' }}>
                      CARDS
                    </p>
                  </div>
                ) : null}
                {stats?.totalPriceRecords ? (
                  <div>
                    <p className="text-white font-bold" style={{ fontFamily: 'monospace', fontSize: '16px' }}>
                      {Math.round(stats.totalPriceRecords / 10000)}萬+
                    </p>
                    <p className="text-[9px] uppercase tracking-[0.15em]" style={{ color: '#444444', fontFamily: 'monospace' }}>
                      RECORDS
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* RIGHT: 20-card irregular collage wall */}
          <div className="flex-1 relative overflow-hidden">
            {/* Gradient fade on left edge — blends into left column */}
            <div
              className="absolute left-0 top-0 bottom-0 z-10 pointer-events-none"
              style={{ width: '120px', background: 'linear-gradient(to right, #111215 0%, transparent 100%)' }}
            />
            {/* Gradient fade on right edge */}
            <div
              className="absolute right-0 top-0 bottom-0 z-10 pointer-events-none"
              style={{ width: '60px', background: 'linear-gradient(to left, #111215 0%, transparent 100%)' }}
            />
            {/* Gradient fade on top */}
            <div
              className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
              style={{ height: '60px', background: 'linear-gradient(to bottom, #111215 0%, transparent 100%)' }}
            />
            {/* Gradient fade on bottom */}
            <div
              className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none"
              style={{ height: '80px', background: 'linear-gradient(to top, #111215 0%, transparent 100%)' }}
            />

            {/* Collage cards */}
            {isLoading
              ? COLLAGE_POSITIONS.map((pos, i) => (
                  <div
                    key={i}
                    className="absolute rounded-lg overflow-hidden bg-white/5 animate-pulse"
                    style={{
                      top: pos.top,
                      left: pos.left,
                      width: pos.width,
                      aspectRatio: '3/4',
                      transform: `rotate(${pos.rotate})`,
                      zIndex: pos.z,
                    }}
                  />
                ))
              : popularCards.slice(0, 20).map((card, i) => {
                  const pos = COLLAGE_POSITIONS[i] || COLLAGE_POSITIONS[0];
                  return (
                    <button
                      key={card.id}
                      onClick={() => setLocation(`/card/${card.id}`)}
                      className="absolute rounded-lg overflow-hidden group"
                      style={{
                        top: pos.top,
                        left: pos.left,
                        width: pos.width,
                        aspectRatio: '3/4',
                        transform: `rotate(${pos.rotate})`,
                        zIndex: pos.z,
                        boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
                        transition: 'transform 0.25s ease, box-shadow 0.25s ease, z-index 0s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = `rotate(${pos.rotate}) scale(1.06)`;
                        (e.currentTarget as HTMLElement).style.zIndex = '50';
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 60px rgba(0,0,0,0.85)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = `rotate(${pos.rotate}) scale(1)`;
                        (e.currentTarget as HTMLElement).style.zIndex = String(pos.z);
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(0,0,0,0.7)';
                      }}
                    >
                      <img
                        src={getProxiedImageUrl(card.imageUrl) ?? ''}
                        alt={card.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {/* Price micro-label on hover */}
                      {card.currentPrice ? (
                        <div
                          className="absolute bottom-0 left-0 right-0 px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}
                        >
                          <span
                            className="text-[8px] flex items-center gap-0.5"
                            style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace' }}
                          >
                            {card.currentPrice >= 1000
                              ? `$${(card.currentPrice / 1000).toFixed(1)}k`
                              : `$${Math.round(card.currentPrice)}`}
                            {card.priceChange7d !== null && card.priceChange7d !== 0 && (
                              <span style={{ color: card.priceChange7d > 0 ? '#2ecc71' : '#8B1A1A' }}>
                                {card.priceChange7d > 0 ? '↑' : '↓'}
                              </span>
                            )}
                          </span>
                        </div>
                      ) : null}
                    </button>
                  );
                })
            }
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            MOBILE LAYOUT
        ════════════════════════════════════════════════════════════════ */}
        <div className="md:hidden flex flex-col flex-1 min-h-0 px-5 pt-7 pb-3">

          {/* Eyebrow */}
          <p
            className="text-[8px] uppercase tracking-[0.3em] mb-3"
            style={{ color: '#555555', fontFamily: 'monospace' }}
          >
            B O X I U M &nbsp; T C G
          </p>

          {/* Headline */}
          <h1
            className="leading-[1.02] mb-4"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(34px, 9vw, 52px)',
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
            }}
          >
            THE ART OF<br />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
              SPECULATION.
            </span>
          </h1>

          {/* Thin divider */}
          <div className="mb-4" style={{ width: '32px', height: '1px', background: 'rgba(255,255,255,0.18)' }} />

          {/* Mobile nav links — horizontal pill row */}
          <div className="flex gap-2 flex-wrap mb-5">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.04)',
                }}
              >
                <item.icon size={10} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.5)' }} />
                <span
                  className="text-[10px]"
                  style={{ color: 'rgba(255,255,255,0.65)', fontFamily: 'monospace', letterSpacing: '0.05em' }}
                >
                  {item.label}
                </span>
              </Link>
            ))}
          </div>

          {/* 5-card Masonry — fills remaining space */}
          <div className="flex-1 min-h-0 flex items-end">
            {isLoading ? (
              <div className="flex items-end gap-2 w-full">
                {[0,1,2,3,4].map((i) => (
                  <div key={i} className="flex-1 rounded overflow-hidden bg-white/5 animate-pulse" style={{ aspectRatio: '3/4' }} />
                ))}
              </div>
            ) : popularCards.length > 0 ? (
              <div className="flex items-end gap-2 w-full">
                {popularCards.slice(0, 5).map((card, i) => (
                  <div key={card.id} className="flex-1 min-w-0">
                    <MobileCard
                      card={card}
                      onClick={() => setLocation(`/card/${card.id}`)}
                      offsetY={mobileOffsets[i] || '0'}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Bottom footnote bar (both layouts) ── */}
        <div
          className="flex-shrink-0 px-6 sm:px-10 md:px-12 py-2.5 md:py-3 flex items-center justify-between"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.04)',
            paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))',
          }}
        >
          <p className="text-[8px] uppercase tracking-[0.2em]" style={{ color: '#333333', fontFamily: 'monospace' }}>
            TCG MARKET INTELLIGENCE
          </p>
          <p className="text-[8px] uppercase tracking-[0.2em]" style={{ color: '#333333', fontFamily: 'monospace' }}>
            PSA 10 · SNKRDUNK · HKD
          </p>
        </div>

      </div>
    </>
  );
}
