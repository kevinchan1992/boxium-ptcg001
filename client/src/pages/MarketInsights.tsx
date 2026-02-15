import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Eye, Tag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function MarketInsights() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(0);
  const limit = 12;

  // Fetch blog articles
  const { data, isLoading } = trpc.blog.getArticles.useQuery({
    limit,
    offset: page * limit,
    category: selectedCategory,
  });

  const categories = [
    { value: undefined, label: "全部" },
    { value: "market_analysis", label: "市場分析" },
    { value: "investment_trends", label: "投資趨勢" },
    { value: "card_research", label: "卡牌研究" },
    { value: "news", label: "最新消息" },
    { value: "guide", label: "新手指南" },
  ];

  const getCategoryLabel = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat?.label || category;
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-bold mb-4">市場洞察</h1>
          <p className="text-xl text-blue-100">深入分析 PTCG 市場趨勢，掌握投資先機</p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex gap-2 overflow-x-auto">
            {categories.map((cat) => (
              <Button
                key={cat.value || "all"}
                variant={selectedCategory === cat.value ? "default" : "outline"}
                onClick={() => {
                  setSelectedCategory(cat.value);
                  setPage(0);
                }}
                className="whitespace-nowrap"
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Articles Grid */}
      <div className="container mx-auto px-4 py-12">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardContent className="p-6 space-y-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : data && data.articles.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {data.articles.map((article) => (
                <Card
                  key={article.id}
                  className="overflow-hidden hover:shadow-xl transition-shadow cursor-pointer group"
                  onClick={() => setLocation(`/market-insights/${article.slug}`)}
                >
                  {/* Featured Image */}
                  {article.featuredImageUrl && (
                    <div className="relative h-48 overflow-hidden bg-slate-200">
                      <img
                        src={article.featuredImageUrl}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {/* Category Badge */}
                      <div className="absolute top-4 left-4">
                        <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                          {getCategoryLabel(article.category)}
                        </span>
                      </div>
                    </div>
                  )}

                  <CardContent className="p-6">
                    {/* Date */}
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(article.publishedAt)}</span>
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-bold text-slate-900 mb-3 line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {article.title}
                    </h2>

                    {/* Summary */}
                    {article.summary && (
                      <p className="text-slate-600 text-sm line-clamp-3 mb-4">
                        {article.summary}
                      </p>
                    )}

                    {/* Meta Info */}
                    <div className="flex items-center gap-4 text-sm text-slate-500 pt-4 border-t">
                      <div className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        <span>{article.viewCount}</span>
                      </div>
                      {article.authorName && (
                        <div className="flex items-center gap-1">
                          <span>作者：{article.authorName}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {data.total > limit && (
              <div className="flex justify-center gap-4 mt-12">
                <Button
                  variant="outline"
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                >
                  上一頁
                </Button>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>第 {page + 1} 頁</span>
                  <span>/</span>
                  <span>共 {Math.ceil(data.total / limit)} 頁</span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setPage(page + 1)}
                  disabled={!data.hasMore}
                >
                  下一頁
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <div className="text-slate-400 text-lg mb-4">暫無文章</div>
            <p className="text-slate-500 text-sm">敬請期待更多市場洞察內容</p>
          </div>
        )}
      </div>
    </div>
  );
}
