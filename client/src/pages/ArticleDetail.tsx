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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <Button
            variant="ghost"
            className="text-white hover:bg-white/10 mb-4"
            onClick={() => setLocation("/market-insights")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回列表
          </Button>
        </div>
      </div>

      {/* Article Content */}
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Card>
          <CardContent className="p-8">
            {/* Category Badge */}
            <div className="mb-4">
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                {getCategoryLabel(article.category)}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl font-bold text-slate-900 mb-6">
              {article.title}
            </h1>

            {/* Meta Info */}
            <div className="flex items-center gap-6 text-sm text-slate-500 mb-8 pb-6 border-b">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(article.publishedAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <span>{article.viewCount} 次閱讀</span>
              </div>
              {article.authorName && (
                <div className="flex items-center gap-2">
                  <span>作者：{article.authorName}</span>
                </div>
              )}
            </div>

            {/* Featured Image */}
            {article.featuredImageUrl && (
              <div className="mb-8">
                <img
                  src={article.featuredImageUrl}
                  alt={article.title}
                  className="w-full rounded-lg shadow-lg"
                />
              </div>
            )}

            {/* Summary */}
            {article.summary && (
              <div className="bg-blue-50 border-l-4 border-blue-600 p-6 mb-8">
                <p className="text-slate-700 text-lg leading-relaxed">
                  {article.summary}
                </p>
              </div>
            )}

            {/* Content */}
            <div className="prose prose-slate max-w-none">
              <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                {article.content}
              </div>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="mt-8 pt-6 border-t">
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="w-4 h-4 text-slate-500" />
                  {tags.map((tag: string, index: number) => (
                    <span
                      key={index}
                      className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm"
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
