import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Calendar, Eye, ArrowLeft, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function ArticleDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();

  const { data: article, isLoading } = trpc.blog.getBySlug.useQuery(
    { slug: slug || "" },
    { enabled: !!slug }
  );

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getCategoryLabel = (category: string) => {
    const categories: Record<string, string> = {
      market_analysis: "市場分析",
      investment_trends: "投資趨勢",
      card_research: "卡牌研究",
      news: "最新消息",
      guide: "新手指南",
    };
    return categories[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      market_analysis: "bg-blue-600",
      investment_trends: "bg-emerald-600",
      card_research: "bg-purple-600",
      news: "bg-orange-600",
      guide: "bg-indigo-600",
    };
    return colors[category] || "bg-slate-600";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <Skeleton className="h-8 w-32 mb-8" />
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-6 w-64 mb-8" />
          <Skeleton className="h-96 w-full mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">文章不存在</h1>
          <Button onClick={() => setLocation("/market-insights")}>
            返回市場洞察
          </Button>
        </div>
      </div>
    );
  }

  const tags = article.tags ? JSON.parse(article.tags) : [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white py-10">
        <div className="container mx-auto px-4 max-w-4xl">
          <Button
            variant="ghost"
            className="text-white hover:bg-white/20 mb-4 font-medium"
            size="lg"
            onClick={() => setLocation("/market-insights")}
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            返回列表
          </Button>
        </div>
      </div>

      {/* Article Content */}
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <Card className="border-0 shadow-xl">
          <CardContent className="p-10 md:p-12 bg-white">
            {/* Category Badge */}
            <div className="mb-6">
              <span className={`${getCategoryColor(article.category)} text-white px-4 py-2 rounded-full text-sm font-semibold shadow-md`}>
                {getCategoryLabel(article.category)}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-8 leading-tight">
              {article.title}
            </h1>

            {/* Meta Info */}
            <div className="flex items-center gap-8 text-base text-slate-600 mb-10 pb-8 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span className="font-medium">{formatDate(article.publishedAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                <span className="font-medium">{article.viewCount} 次閱讀</span>
              </div>
              {article.authorName && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">作者：{article.authorName}</span>
                </div>
              )}
            </div>

            {/* Featured Image */}
            {article.featuredImageUrl && (
              <div className="mb-10">
                <img
                  src={article.featuredImageUrl}
                  alt={article.title}
                  className="w-full rounded-xl shadow-2xl"
                />
              </div>
            )}

            {/* Summary */}
            {article.summary && (
              <div className="bg-blue-50 border-l-4 border-blue-600 p-7 mb-10 rounded-r-lg">
                <p className="text-slate-800 text-lg leading-relaxed font-medium">
                  {article.summary}
                </p>
              </div>
            )}

            {/* Content */}
            <div className="prose prose-slate prose-lg max-w-none">
              <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-lg">
                {article.content}
              </div>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="mt-12 pt-8 border-t border-slate-200">
                <div className="flex items-center gap-3 flex-wrap">
                  <Tag className="w-5 h-5 text-slate-500" />
                  {tags.map((tag: string, index: number) => (
                    <span
                      key={index}
                      className="bg-slate-100 text-slate-700 px-4 py-2 rounded-full text-sm font-medium hover:bg-slate-200 transition-colors"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
