import { useEffect, useState, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { BrandButton } from "@/components/ui/brand-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Calendar, Eye, ArrowLeft, Share2, Sparkles, Facebook } from "lucide-react";
import { toast } from "sonner";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";

export default function BlogPost() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug || "";

  // Query post by slug
  const { data: post, isLoading } = trpc.blog.getPostBySlug.useQuery({ slug }, {
    enabled: !!slug,
  });

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  // Helper function to get localized post content
  const getLocalizedContent = (field: 'title' | 'excerpt' | 'content') => {
    if (!post) return '';
    if (currentLang === 'en' && post[`${field}En`]) {
      return post[`${field}En`];
    }
    if (currentLang === 'ja' && post[`${field}Ja`]) {
      return post[`${field}Ja`];
    }
    return post[field]; // Fallback to Chinese
  };
  


  // Social share functions
  const handleShareFacebook = () => {
    const url = window.location.href;
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      '_blank',
      'width=600,height=400'
    );
  };

  const handleShareWhatsApp = () => {
    const url = window.location.href;
    const text = post?.title || '';
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
      '_blank'
    );
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('連結已複製到剪貼簿');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#06038d]"></div>
          <p className="text-gray-400 mt-4">載入中...</p>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-4">文章不存在</h1>
          <p className="text-gray-400 mb-8">找不到您要查看的文章</p>
          <Link href="/blog">
            <BrandButton>
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回博客
            </BrandButton>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-[#06038d]/20 to-black border-b border-zinc-800">
        <div className="container mx-auto px-4 py-6 md:py-8">
          <Link href="/blog">
            <Button variant="ghost" className="text-gray-400 hover:text-white mb-4 md:mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回博客
            </Button>
          </Link>

          <div className="max-w-4xl mx-auto">
            {/* Title - 手機版縮小字體 */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6 leading-tight">
              {getLocalizedContent('title')}
            </h1>

            {/* Excerpt - 手機版縮小字體 */}
            {post.excerpt && (
              <p className="text-base sm:text-lg md:text-xl text-gray-300 mb-4 md:mb-6">
                {getLocalizedContent('excerpt')}
              </p>
            )}

            {/* Meta Info - 手機版調整間距和字體 */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-sm md:text-base text-gray-400 mb-6 md:mb-8">
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                {new Date(post.publishedAt || post.createdAt).toLocaleDateString('zh-TW', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-2">
                <Eye className="w-4 h-4 md:w-5 md:h-5" />
                {post.viewCount} 次瀏覽
              </span>
            </div>


            {/* Share Buttons - 手機版改為垂直排列 */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-gray-400 text-sm md:text-base">分享：</span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShareFacebook}
                  className="border-zinc-700 text-white hover:bg-zinc-800 text-xs md:text-sm"
                >
                  <Facebook className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Facebook
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShareWhatsApp}
                  className="border-zinc-700 text-white hover:bg-zinc-800 text-xs md:text-sm"
                >
                  <Share2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="border-zinc-700 text-white hover:bg-zinc-800 text-xs md:text-sm"
                >
                  複製連結
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Image - 手機版調整間距 */}
      {post.featuredImage && (
        <div className="container mx-auto px-4 py-6 md:py-8">
          <div className="max-w-4xl mx-auto">
            <img
              src={post.featuredImage}
              alt={post.title}
              className="w-full rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Article Content - 手機版優化排版 */}
      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-zinc-900 border-zinc-800 p-4 sm:p-6 md:p-8 lg:p-12">
            <article className="prose prose-invert max-w-none">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // 手機版縮小標題字體
                  h1: ({ ...props }: any) => (
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mt-6 md:mt-10 mb-4 md:mb-6" {...props} />
                  ),
                  h2: ({ ...props }: any) => (
                    <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white mt-5 md:mt-8 mb-3 md:mb-5" {...props} />
                  ),
                  h3: ({ ...props }: any) => (
                    <h3 className="text-base sm:text-lg md:text-xl font-bold text-white mt-4 md:mt-6 mb-3 md:mb-4" {...props} />
                  ),
                  // 手機版優化段落字體和行高
                  p: ({ ...props }: any) => (
                    <p className="text-gray-300 mb-4 md:mb-6 leading-relaxed md:leading-[1.8] text-sm sm:text-base md:text-[17px]" {...props} />
                  ),
                  // 手機版優化列表
                  ul: ({ ...props }: any) => (
                    <ul className="list-disc list-inside text-gray-300 mb-4 md:mb-6 space-y-2 md:space-y-3 ml-2 md:ml-4 text-sm sm:text-base" {...props} />
                  ),
                  ol: ({ ...props }: any) => (
                    <ol className="list-decimal list-inside text-gray-300 mb-4 md:mb-6 space-y-2 md:space-y-3 ml-2 md:ml-4 text-sm sm:text-base" {...props} />
                  ),
                  li: ({ ...props }: any) => (
                    <li className="text-gray-300 leading-relaxed md:leading-[1.8] text-sm sm:text-base" {...props} />
                  ),
                  a: ({ ...props }: any) => (
                    <a className="text-[#06038d] hover:underline break-words" {...props} />
                  ),
                  blockquote: ({ ...props }: any) => (
                    <blockquote className="border-l-4 border-[#06038d] pl-3 md:pl-6 py-2 md:py-3 italic text-gray-400 my-4 md:my-6 bg-zinc-800/50 rounded-r text-sm sm:text-base" {...props} />
                  ),
                  code: ({ node, inline, ...props }: any) =>
                    inline ? (
                      <code className="bg-zinc-800 px-1.5 md:px-2 py-0.5 md:py-1 rounded text-xs md:text-sm text-purple-400" {...props} />
                    ) : (
                      <code className="block bg-zinc-800 p-3 md:p-5 rounded text-xs md:text-sm text-gray-300 overflow-x-auto my-4 md:my-6 leading-relaxed md:leading-[1.6]" {...props} />
                    ),
                  // 手機版優化表格
                  table: ({ ...props }: any) => (
                    <div className="overflow-x-auto my-4 md:my-8 -mx-4 sm:mx-0">
                      <table className="w-full border-collapse border border-zinc-700 text-sm md:text-base" {...props} />
                    </div>
                  ),
                  th: ({ ...props }: any) => (
                    <th className="border border-zinc-700 bg-zinc-800 px-2 md:px-4 py-1.5 md:py-2 text-left text-white font-semibold text-xs md:text-base" {...props} />
                  ),
                  td: ({ ...props }: any) => (
                    <td className="border border-zinc-700 px-2 md:px-4 py-1.5 md:py-2 text-gray-300 text-xs md:text-base" {...props} />
                  ),
                  // 手機版優化圖片
                  img: ({ ...props }: any) => (
                    <img className="w-full h-auto rounded-lg my-4 md:my-6" {...props} />
                  ),
                }}
              >
                {getLocalizedContent('content')}
              </Markdown>
            </article>
          </Card>

          {/* Share Again at Bottom - 手機版優化佈局 */}
          <div className="mt-6 md:mt-8 p-4 md:p-6 bg-zinc-900 border border-zinc-800 rounded-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <p className="text-white font-semibold text-sm md:text-base">覺得這篇文章有幫助嗎？分享給朋友吧！</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShareFacebook}
                  className="border-zinc-700 text-white hover:bg-zinc-800 text-xs md:text-sm"
                >
                  <Facebook className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Facebook
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShareWhatsApp}
                  className="border-zinc-700 text-white hover:bg-zinc-800 text-xs md:text-sm"
                >
                  <Share2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="border-zinc-700 text-white hover:bg-zinc-800 text-xs md:text-sm"
                >
                  複製連結
                </Button>
              </div>
            </div>
          </div>

          {/* Back to Blog - 手機版調整間距 */}
          <div className="mt-6 md:mt-8 text-center">
            <Link href="/blog">
              <BrandButton>
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回博客
              </BrandButton>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
