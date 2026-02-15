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
          <Button 
            onClick={() => setLocation("/market-insights")}
            className="bg-yellow-400 text-blue-900 hover:bg-yellow-500 font-semibold"
          >
            返回市場洞察
          </Button>
        </div>
      </div>
    );
  }

  const tags = article.tags ? JSON.parse(article.tags) : [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header with Brand Colors */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white py-12 relative overflow-hidden">
        {/* Yellow accent elements */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-400 opacity-10 rounded-full -translate-y-24 translate-x-24"></div>
        
        <div className="container mx-auto px-4 max-w-4xl relative z-10">
          <Button
            variant="ghost"
            className="text-white hover:bg-white/20 mb-4 font-semibold border-2 border-yellow-400"
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
        <Card className="border-2 border-slate-200 shadow-2xl">
          <CardContent className="p-10 md:p-12 bg-white">
            {/* Category Badge */}
            <div className="mb-6">
              <span className="bg-yellow-400 text-blue-900 px-5 py-2 rounded-full text-sm font-bold shadow-md">
                {getCategoryLabel(article.category)}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold text-blue-900 mb-8 leading-tight">
              {article.title}
            </h1>

            {/* Meta Info */}
            <div className="flex items-center gap-8 text-base text-slate-700 mb-10 pb-8 border-b-2 border-yellow-400">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-900" />
                <span className="font-semibold">{formatDate(article.publishedAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-900" />
                <span className="font-semibold">{article.viewCount} 次閱讀</span>
              </div>
              {article.authorName && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold">作者：{article.authorName}</span>
                </div>
              )}
            </div>

            {/* Featured Image */}
            {article.featuredImageUrl && (
              <div className="mb-10">
                <img
                  src={article.featuredImageUrl}
                  alt={article.title}
                  className="w-full rounded-xl shadow-2xl border-4 border-yellow-400"
                />
              </div>
            )}

            {/* Summary */}
            {article.summary && (
              <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-l-4 border-yellow-400 p-7 mb-10 rounded-r-lg">
                <p className="text-blue-900 text-lg leading-relaxed font-semibold">
                  {article.summary}
                </p>
              </div>
            )}

            {/* Content */}
            <div className="prose prose-slate prose-lg max-w-none">
              <div className="text-slate-800 leading-relaxed whitespace-pre-wrap text-lg">
                {article.content}
              </div>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="mt-12 pt-8 border-t-2 border-yellow-400">
                <div className="flex items-center gap-3 flex-wrap">
                  <Tag className="w-5 h-5 text-blue-900" />
                  {tags.map((tag: string, index: number) => (
                    <span
                      key={index}
                      className="bg-yellow-100 text-blue-900 px-4 py-2 rounded-full text-sm font-semibold hover:bg-yellow-200 transition-colors border-2 border-yellow-400"
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
