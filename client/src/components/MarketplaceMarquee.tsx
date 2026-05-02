import { Link } from "wouter";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { CONDITION_SHORT, CONDITION_BADGE, type ConditionValue } from "@/lib/conditions";

interface ListingItem {
  id: number;
  title: string;
  priceHkd: string | null;
  condition: string;
  images: string | null; // JSON string
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
      <div
        className="group relative flex-shrink-0 w-[155px] sm:w-[175px] cursor-pointer"
        style={{ margin: "0 8px" }}
      >
        {/* Card container */}
        <div
          className="relative rounded-2xl overflow-hidden transition-all duration-300 group-hover:scale-[1.04] group-hover:shadow-2xl"
          style={{
            background: "linear-gradient(145deg, #ffffff 0%, #f8f9ff 100%)",
            boxShadow: "0 4px 20px rgba(6,3,141,0.10), 0 1px 4px rgba(0,0,0,0.06)",
            border: "1px solid rgba(6,3,141,0.08)",
          }}
        >
          {/* Image area */}
          <div
            className="relative overflow-hidden"
            style={{ height: "135px", background: "linear-gradient(135deg, #06038d0a 0%, #f0f0ff 100%)" }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag className="w-10 h-10 text-gray-300" />
              </div>
            )}
            {/* Platform badge */}
            {isPlatform && (
              <div
                className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "#06038d", color: "#fff", letterSpacing: "0.03em" }}
              >
                BOXIUM
              </div>
            )}
            {/* Bottom gradient overlay */}
            <div
              className="absolute bottom-0 left-0 right-0 h-8"
              style={{ background: "linear-gradient(to top, rgba(255,255,255,0.9), transparent)" }}
            />
          </div>

          {/* Info area */}
          <div className="px-3 py-2.5">
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
      <section
        className="py-8 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #06038d 0%, #0a05c4 50%, #1a0a8a 100%)" }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full bg-yellow-400" />
            <div className="h-5 w-32 bg-white/20 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex gap-4 px-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-[155px] sm:w-[175px] h-[215px] rounded-2xl bg-white/10 animate-pulse"
            />
          ))}
        </div>
      </section>
    );
  }

  if (listings.length === 0) return null;

  // Duplicate for seamless infinite loop
  const doubled = [...listings, ...listings];

  // Speed: ~190px/s, adjust duration based on count
  const duration = Math.max(25, listings.length * 2.5);

  return (
    <section
      className="py-8 overflow-hidden relative"
      style={{ background: "linear-gradient(135deg, #06038d 0%, #0a05c4 50%, #1a0a8a 100%)" }}
    >
      {/* Subtle dot pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Section header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-5 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full bg-yellow-400" />
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-yellow-300" />
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                商城精選商品
              </h2>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full ml-1"
                style={{
                  background: "rgba(255,220,0,0.15)",
                  color: "#FFD700",
                  border: "1px solid rgba(255,220,0,0.3)",
                }}
              >
                {listings.length} 件在售
              </span>
            </div>
          </div>
          <Link href="/marketplace">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-yellow-300 hover:text-yellow-100 transition-colors cursor-pointer group">
              查看全部
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        </div>
      </div>

      {/* Marquee track with edge fade */}
      <div
        className="relative"
        style={{
          maskImage: "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
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
