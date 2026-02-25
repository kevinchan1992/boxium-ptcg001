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
import { ResponsiveBlogImage } from "@/components/ResponsiveBlogImage";

export default function BlogPost() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug || "";

  // Query post by slug
  const { data: post, isLoading } = trpc.blog.getPostBySlug.useQuery({ slug }, {
    enabled: !!slug,
  });

  // Increment view count mutation
  const incrementViewCount = trpc.blog.incrementViewCount.useMutation();

  // Record share mutation
  const recordShare = trpc.blog.recordShare.useMutation();

  // Scroll to top on mount and increment view count
  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Increment view count when post is loaded
    if (slug && post) {
      incrementViewCount.mutate({ slug });
    }
  }, [slug, post]);

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
    // Record share event
    recordShare.mutate({ slug, shareType: 'facebook' });
  };

  const handleShareWhatsApp = () => {
    const url = window.location.href;
    const text = post?.title || '';
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
      '_blank'
    );
    // Record share event
    recordShare.mutate({ slug, shareType: 'whatsapp' });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('連結已複製到剪貼簿');
    // Record share event
    recordShare.mutate({ slug, shareType: 'copy_link' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#0033CC]"></div>
          <p className="text-gray-600 mt-6 text-lg">載入中...</p>
        </div>
      </div>
    );
  };

  if (!post) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">文章不存在</h1>
          <p className="text-gray-600 mb-8 text-lg">找不到您要查看的文章</p>
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
    <div className="min-h-screen bg-white">
      {/* Hero Section - 白色底色 + 藍色漸變 */}
      <div className="bg-gradient-to-br from-blue-50 via-white to-yellow-50 border-b border-gray-200">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <Link href="/blog">
            <Button variant="ghost" className="text-gray-600 hover:text-[#0033CC] hover:bg-blue-50 mb-6 md:mb-8">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回博客
            </Button>
          </Link>

          <div className="max-w-4xl mx-auto">
            {/* Badges */}
            {post.dataSource === 'ai-generated' && (
              <div className="mb-4">
                <Badge variant="outline" className="border-purple-500 text-purple-600 bg-purple-50">
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI 生成文章
                </Badge>
              </div>
            )}

            {/* Title - 專業大標題 */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#0033CC] mb-6 md:mb-8 leading-tight">
              {getLocalizedContent('title')}
            </h1>

            {/* Excerpt - 副標題 */}
            {post.excerpt && (
              <p className="text-lg sm:text-xl md:text-2xl text-gray-600 mb-6 md:mb-8 leading-relaxed">
                {getLocalizedContent('excerpt')}
              </p>
            )}

            {/* Meta Info - 專業設計 */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 text-base md:text-lg text-gray-600 mb-8 md:mb-10">
              <span className="flex items-center gap-2">
                <Calendar className="w-5 h-5 md:w-6 md:h-6 text-[#0033CC]" />
                {new Date(post.publishedAt || post.createdAt).toLocaleDateString('zh-TW', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-2">
                <Eye className="w-5 h-5 md:w-6 md:h-6 text-[#0033CC]" />
                {post.viewCount} 次瀏覽
              </span>
            </div>

            {/* Share Buttons - 專業設計 */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-gray-700 font-semibold text-base md:text-lg">分享文章：</span>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleShareFacebook}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-[#0033CC] hover:text-[#0033CC] transition-all"
                >
                  <Facebook className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                  Facebook
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleShareWhatsApp}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-green-50 hover:border-green-600 hover:text-green-600 transition-all"
                >
                  <Share2 className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                  WhatsApp
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-yellow-50 hover:border-[#FFD700] hover:text-gray-900 transition-all"
                >
                  複製連結
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Image */}
      {post.featuredImage && (
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="max-w-5xl mx-auto">
            <ResponsiveBlogImage
              imageData={post.featuredImage}
              size="medium"
              alt={post.title}
              className="w-full rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Article Content - 專業 blog 排版 */}
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          <article className="prose prose-lg md:prose-xl max-w-none">
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                // 專業標題設計
                h1: ({ ...props }: any) => (
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#0033CC] mt-12 md:mt-16 mb-6 md:mb-8 leading-tight" {...props} />
                ),
                h2: ({ ...props }: any) => (
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#0033CC] mt-10 md:mt-14 mb-5 md:mb-7 leading-tight border-b-4 border-[#FFD700] pb-3" {...props} />
                ),
                h3: ({ ...props }: any) => (
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mt-8 md:mt-12 mb-4 md:mb-6 leading-tight" {...props} />
                ),
                h4: ({ ...props }: any) => (
                  <h4 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mt-6 md:mt-10 mb-3 md:mb-5 leading-tight" {...props} />
                ),
                // 專業段落設計 - 更大字體、更好行距
                p: ({ ...props }: any) => (
                  <p className="text-gray-700 mb-6 md:mb-8 leading-[1.8] md:leading-[2] text-base sm:text-lg md:text-xl" {...props} />
                ),
                // 專業列表設計
                ul: ({ ...props }: any) => (
                  <ul className="list-disc list-outside text-gray-700 mb-6 md:mb-8 space-y-3 md:space-y-4 ml-6 md:ml-8 text-base sm:text-lg md:text-xl" {...props} />
                ),
                ol: ({ ...props }: any) => (
                  <ol className="list-decimal list-outside text-gray-700 mb-6 md:mb-8 space-y-3 md:space-y-4 ml-6 md:ml-8 text-base sm:text-lg md:text-xl" {...props} />
                ),
                li: ({ ...props }: any) => (
                  <li className="text-gray-700 leading-[1.8] md:leading-[2] text-base sm:text-lg md:text-xl pl-2" {...props} />
                ),
                // 連結設計 - 使用 logo 藍色
                a: ({ ...props }: any) => (
                  <a className="text-[#0033CC] hover:text-[#0055FF] underline decoration-2 underline-offset-4 break-words font-medium transition-colors" {...props} />
                ),
                // 引用區塊設計 - 使用 logo 黃色
                blockquote: ({ ...props }: any) => (
                  <blockquote className="border-l-8 border-[#FFD700] pl-6 md:pl-8 py-4 md:py-6 italic text-gray-600 my-8 md:my-10 bg-yellow-50 rounded-r-lg text-base sm:text-lg md:text-xl leading-relaxed" {...props} />
                ),
                // 程式碼設計
                code: ({ node, inline, ...props }: any) =>
                  inline ? (
                    <code className="bg-gray-100 px-2 md:px-3 py-1 md:py-1.5 rounded text-sm md:text-base text-[#0033CC] font-mono border border-gray-300" {...props} />
                  ) : (
                    <code className="block bg-gray-900 p-4 md:p-6 rounded-lg text-sm md:text-base text-gray-100 overflow-x-auto my-6 md:my-8 leading-relaxed md:leading-[1.8] font-mono shadow-lg" {...props} />
                  ),
                // 表格設計
                table: ({ ...props }: any) => (
                  <div className="overflow-x-auto my-8 md:my-10 -mx-4 sm:mx-0 shadow-lg rounded-lg">
                    <table className="w-full border-collapse border-2 border-gray-300 text-base md:text-lg" {...props} />
                  </div>
                ),
                th: ({ ...props }: any) => (
                  <th className="border-2 border-gray-300 bg-[#0033CC] px-4 md:px-6 py-3 md:py-4 text-left text-white font-bold text-base md:text-lg" {...props} />
                ),
                td: ({ ...props }: any) => (
                  <td className="border-2 border-gray-300 px-4 md:px-6 py-3 md:py-4 text-gray-700 text-base md:text-lg bg-white" {...props} />
                ),
                // 圖片設計
                img: ({ ...props }: any) => (
                  <img className="w-full h-auto rounded-xl my-8 md:my-10 shadow-xl" {...props} />
                ),
                // 分隔線設計
                hr: ({ ...props }: any) => (
                  <hr className="my-10 md:my-14 border-t-4 border-[#FFD700]" {...props} />
                ),
                // 強調文字設計
                strong: ({ ...props }: any) => (
                  <strong className="font-bold text-[#0033CC]" {...props} />
                ),
                em: ({ ...props }: any) => (
                  <em className="italic text-gray-800" {...props} />
                ),
              }}
            >
              {getLocalizedContent('content')}
            </Markdown>
          </article>

          {/* Share Again at Bottom - 專業設計 */}
          <div className="mt-12 md:mt-16 p-6 md:p-8 bg-gradient-to-br from-blue-50 to-yellow-50 border-2 border-gray-200 rounded-2xl shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <p className="text-gray-900 font-bold text-lg md:text-xl mb-2">覺得這篇文章有幫助嗎？</p>
                <p className="text-gray-600 text-base md:text-lg">分享給朋友，讓更多人受益！</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleShareFacebook}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-[#0033CC] hover:text-[#0033CC] transition-all"
                >
                  <Facebook className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                  Facebook
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleShareWhatsApp}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-green-50 hover:border-green-600 hover:text-green-600 transition-all"
                >
                  <Share2 className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                  WhatsApp
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-yellow-50 hover:border-[#FFD700] hover:text-gray-900 transition-all"
                >
                  複製連結
                </Button>
              </div>
            </div>
          </div>

          {/* Back to Blog */}
          <div className="mt-10 md:mt-14 text-center">
            <Link href="/blog">
              <BrandButton className="px-8 py-4 text-lg shadow-lg hover:shadow-xl transition-shadow">
                <ArrowLeft className="w-5 h-5 mr-2" />
                返回博客
              </BrandButton>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
