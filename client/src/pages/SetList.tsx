import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import PageHead from "@/components/PageHead";
import { useTranslation } from "react-i18next";

export default function SetList() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { data: sets, isLoading } = trpc.cards.getAllSetCodes.useQuery();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <PageHead
        title={t("setList.pageTitle")}
        description={t("setList.pageDesc")}
        keywords={t("setList.pageKeywords")}
      />

      <div className="container max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-zinc-400 mb-6">
          <a href="/" onClick={(e) => { e.preventDefault(); setLocation("/"); }} className="hover:text-yellow-400 transition-colors">
            {t("common.home")}
          </a>
          <span>/</span>
          <span className="text-white">{t("setList.title")}</span>
        </nav>

        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6">
          {t("setList.title")}
        </h1>
        <p className="text-zinc-400 mb-8">
          {t("setList.subtitle")}
        </p>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-zinc-800 animate-pulse" />
            ))}
          </div>
        )}

        {/* Sets Grid */}
        {!isLoading && sets && sets.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sets.map((set: any) => (
              <a
                key={set.setCode}
                href={`/set/${set.setCode}`}
                onClick={(e) => { e.preventDefault(); setLocation(`/set/${set.setCode}`); }}
                className="group block p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-yellow-500/50 hover:bg-zinc-800/80 transition-all duration-200"
                title={`${set.setCode} - ${set.series || t("setList.series")} ${t("setList.allCards")}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-yellow-400 group-hover:text-yellow-300">
                    {set.setCode}
                  </span>
                  <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                    {t("setList.cardCount", { n: set.cardCount })}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 line-clamp-2 group-hover:text-zinc-300 transition-colors">
                  {set.series || t("setList.uncategorized")}
                </p>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
