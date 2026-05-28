import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import PageHead from "@/components/PageHead";

function getProxiedImageUrl(url: string | null) {
  if (!url) return null;
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

export default function SetBrowse() {
  const params = useParams<{ setCode: string }>();
  const setCode = params.setCode || "";
  const [, setLocation] = useLocation();
  const [offset, setOffset] = useState(0);
  const limit = 100;

  const { data, isLoading } = trpc.cards.getBySetCode.useQuery(
    { setCode, limit, offset },
    { enabled: !!setCode }
  );

  const cards = data?.cards ?? [];
  const total = data?.total ?? 0;
  const setInfo = data?.setInfo;
  const hasMore = offset + limit < total;
  const hasPrev = offset > 0;

  const pageTitle = setInfo
    ? `${setInfo.setCode} - ${setInfo.series || "系列瀏覽"} | BOXIUM PTCG`
    : `${setCode} 系列卡牌 | BOXIUM PTCG`;
  const pageDescription = setInfo
    ? `瀏覽 ${setInfo.series || setCode} 系列全部 ${setInfo.totalCards} 張卡牌的即時價格、圖鑑和市場行情。${setCode} 擴充包完整卡牌列表。`
    : `瀏覽 ${setCode} 系列的所有卡牌價格和圖鑑資訊。`;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <PageHead
        title={pageTitle}
        description={pageDescription}
        keywords={`${setCode}, ${setInfo?.series || ''}, PTCG, 寶可夢卡牌, 價格, 圖鑑, Pokemon TCG`}
      />

      <div className="container max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-zinc-400 mb-6">
          <a href="/" onClick={(e) => { e.preventDefault(); setLocation("/"); }} className="hover:text-yellow-400 transition-colors">
            主頁
          </a>
          <span>/</span>
          <a href="/sets" onClick={(e) => { e.preventDefault(); setLocation("/sets"); }} className="hover:text-yellow-400 transition-colors">
            系列一覽
          </a>
          <span>/</span>
          <span className="text-white">{setCode}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            {setCode} {setInfo?.series ? `- ${setInfo.series}` : ""}
          </h1>
          {setInfo && (
            <p className="text-zinc-400">
              共 {setInfo.totalCards} 張卡牌
            </p>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-lg bg-zinc-800 animate-pulse" />
            ))}
          </div>
        )}

        {/* Cards Grid */}
        {!isLoading && cards.length > 0 && (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {cards.map((card: any) => (
              <a
                key={card.id}
                href={`/card/${card.id}`}
                onClick={(e) => { e.preventDefault(); setLocation(`/card/${card.id}`); }}
                className="group flex flex-col gap-1.5 text-left hover:scale-[1.03] transition-transform duration-200"
                title={`${card.name}${card.cardNumber ? ` ${card.cardNumber}` : ''} 價格資訊`}
              >
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-zinc-800">
                  {card.imageUrl ? (
                    <img
                      src={getProxiedImageUrl(card.imageUrl) ?? ""}
                      alt={`${card.name}${card.cardNumber ? ` ${card.cardNumber}` : ''} 卡牌圖像 - ${setCode}`}
                      className="w-full h-full object-cover group-hover:brightness-110 transition-all duration-200"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-zinc-600 text-xs">無圖</span>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight line-clamp-2 group-hover:text-yellow-400 transition-colors">
                  {card.cardNumber || card.name.split(/[\[\(]/)[0].trim()}
                </p>
                {card.rarity && (
                  <p className="text-[9px] text-zinc-500">{card.rarity}</p>
                )}
              </a>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && cards.length === 0 && (
          <div className="text-center py-20">
            <p className="text-zinc-400 text-lg">找不到 {setCode} 系列的卡牌</p>
            <button
              onClick={() => setLocation("/sets")}
              className="mt-4 text-yellow-400 hover:text-yellow-300 text-sm"
            >
              返回系列一覽
            </button>
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={!hasPrev}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-sm text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
            >
              上一頁
            </button>
            <span className="text-sm text-zinc-400">
              {Math.floor(offset / limit) + 1} / {Math.ceil(total / limit)}
            </span>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={!hasMore}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-sm text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
            >
              下一頁
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
