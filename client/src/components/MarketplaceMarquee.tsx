import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { CONDITION_SHORT, CONDITION_BADGE, type ConditionValue } from "@/lib/conditions";
import { getProxiedImageUrl } from "@/lib/utils";

interface ListingItem {
  id: number;
  title: string;
  priceHkd: string | null;
  condition: string;
  images: string | null;
  sellerType: string;
  status: string;
}

function parseImages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function MarqueeCard({ item }: { item: ListingItem }) {
  const conditionLabel = CONDITION_SHORT[item.condition as ConditionValue] ?? item.condition;
  const conditionBadge = CONDITION_BADGE[item.condition as ConditionValue] ?? "bg-gray-100 text-gray-600 border border-gray-200";
  const imgs = parseImages(item.images);
  const imageUrl = imgs.length > 0 ? imgs[0] : null;
  const isPlatform = item.sellerType === "platform";
  const price = item.priceHkd ? Number(item.priceHkd) : null;

  return (
    <Link href={`/marketplace/${item.id}`}>
      {/* No margin — seamless connection between cards */}
      <div className="group relative flex-shrink-0 w-[160px] sm:w-[180px] cursor-pointer">
        <div
          className="relative overflow-hidden transition-all duration-300 group-hover:brightness-95"
          style={{
            background: "#ffffff",
            borderRight: "1px solid #f0f0f5",
          }}
        >
          {/* Image area */}
          <div
            className="relative overflow-hidden"
            style={{ height: "140px", background: "#f7f8ff" }}
          >
            {imageUrl ? (
              <img
                src={getProxiedImageUrl(imageUrl) ?? ""}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-50">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400 text-xs font-bold">?</span>
                </div>
              </div>
            )}

            {/* BOXIUM Logo badge — top left */}
            {isPlatform && (
              <div
                className="absolute top-2 left-2"
                style={{
                  borderRadius: "4px",
                  overflow: "hidden",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                }}
              >
                <img
                  src="/boxium-logo.png"
                  alt="BOXIUM"
                  className="block"
                  style={{ height: "18px", width: "auto", maxWidth: "52px", display: "block" }}
                />
              </div>
            )}

            {/* Bottom gradient */}
            <div
              className="absolute bottom-0 left-0 right-0 h-6"
              style={{ background: "linear-gradient(to top, rgba(247,248,255,0.9), transparent)" }}
            />
          </div>

          {/* Info area */}
          <div className="px-3 py-2.5" style={{ background: "#ffffff" }}>
            {/* Condition badge */}
            <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md mb-1.5 ${conditionBadge}`}>
              {conditionLabel}
            </span>
            {/* Card name */}
            <p
              className="text-[11px] font-medium leading-tight mb-2 line-clamp-2"
              style={{ color: "#1a1a2e", minHeight: "28px" }}
            >
              {item.title}
            </p>
            {/* Price */}
            {price != null ? (
              <p className="text-sm font-bold" style={{ color: "#06038d" }}>
                HK${price.toLocaleString()}
              </p>
            ) : (
              <p className="text-sm font-bold text-gray-400">—</p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function MarketplaceMarquee() {
  const { data, isLoading } = trpc.marketplace.getListings.useQuery({
    page: 1,
    pageSize: 30,
    sortBy: "newest",
  });

  const listings = (data?.listings ?? []).filter(
    (l) => l.status === "active"
  ) as ListingItem[];

  if (isLoading) {
    return (
      <section className="py-8 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full bg-[#06038d]" />
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-[160px] sm:w-[180px] h-[215px] bg-gray-100 animate-pulse"
              style={{ borderRight: "1px solid #f0f0f5" }}
            />
          ))}
        </div>
      </section>
    );
  }

  if (listings.length === 0) return null;

  // Duplicate for seamless infinite loop
  const doubled = [...listings, ...listings];
  const duration = Math.max(25, listings.length * 2.5);

  return (
    <section className="py-8 bg-white border-b border-gray-100">
      {/* Section header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Accent bar */}
            <div className="w-1 h-6 rounded-full bg-[#06038d]" />
            <div className="flex items-center gap-2">
              {/* BOXIUM Logo in header — blue-yellow original logo */}
              <div
                style={{
                  borderRadius: "5px",
                  overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  flexShrink: 0,
                }}
              >
                <img
                  src="/boxium-logo.png"
                  alt="BOXIUM"
                  style={{ height: "22px", width: "auto", maxWidth: "64px", display: "block" }}
                />
              </div>
              <h2 className="text-sm sm:text-base font-bold tracking-wide" style={{ color: "#1a1a2e" }}>
                商城精選商品
              </h2>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full ml-1"
                style={{
                  background: "rgba(6,3,141,0.08)",
                  color: "#06038d",
                  border: "1px solid rgba(6,3,141,0.15)",
                }}
              >
                {listings.length} 件在售
              </span>
            </div>
          </div>
          <Link href="/marketplace">
            <div
              className="flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer group"
              style={{ color: "#06038d" }}
            >
              查看全部
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        </div>
      </div>

      {/* Marquee track — seamless, no gaps */}
      <div
        className="relative overflow-hidden"
        style={{
          borderTop: "1px solid #f0f0f5",
          borderBottom: "1px solid #f0f0f5",
          maskImage: "linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)",
        }}
      >
        <div
          className="flex"
          style={{
            animation: `boxium-marquee ${duration}s linear infinite`,
            width: "max-content",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.animationPlayState = "paused";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.animationPlayState = "running";
          }}
        >
          {doubled.map((item, idx) => (
            <MarqueeCard key={`${item.id}-${idx}`} item={item} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes boxium-marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
