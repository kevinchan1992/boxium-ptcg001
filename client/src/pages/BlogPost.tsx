import { useEffect } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Calendar, Eye, ArrowLeft, Share2, Sparkles, Facebook } from "lucide-react";
import { toast } from "sonner";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function BlogPost() {
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">文章不存在</h1>
          <p className="text-gray-400 mb-8">找不到您要查看的文章</p>
          <Link href="/blog">
            <Button className="bg-[#06038d] hover:bg-[#06038d]/90">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回博客
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-[#06038d]/20 to-black border-b border-zinc-800">
        <div className="container mx-auto px-4 py-8">
          <Link href="/blog">
            <Button variant="ghost" className="text-gray-400 hover:text-white mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回博客
            </Button>
          </Link>

          <div className="max-w-4xl mx-auto">
            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              {post.title}
            </h1>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-xl text-gray-300 mb-6">
                {post.excerpt}
              </p>
            )}

            {/* Meta Info */}
            <div className="flex items-center gap-6 text-gray-400 mb-8">
              <span className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                {new Date(post.publishedAt || post.createdAt).toLocaleDateString('zh-TW', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                {post.viewCount} 次瀏覽
              </span>
            </div>

            {/* Share Buttons */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 mr-2">分享：</span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleShareFacebook}
                className="border-zinc-700 text-white hover:bg-zinc-800"
              >
                <Facebook className="w-4 h-4 mr-2" />
                Facebook
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleShareWhatsApp}
                className="border-zinc-700 text-white hover:bg-zinc-800"
              >
                <Share2 className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyLink}
                className="border-zinc-700 text-white hover:bg-zinc-800"
              >
                複製連結
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Image */}
      {post.featuredImage && (
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <img
              src={post.featuredImage}
              alt={post.title}
              className="w-full rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Article Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-zinc-900 border-zinc-800 p-8 md:p-12">
            <article className="prose prose-invert prose-lg max-w-none">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ ...props }: any) => <h1 className="text-3xl font-bold text-white mt-10 mb-6" {...props} />,
                  h2: ({ ...props }: any) => <h2 className="text-2xl font-bold text-white mt-8 mb-5" {...props} />,
                  h3: ({ ...props }: any) => <h3 className="text-xl font-bold text-white mt-6 mb-4" {...props} />,
                  p: ({ ...props }: any) => <p className="text-gray-300 mb-6 leading-[1.8] text-[17px]" {...props} />,
                  ul: ({ ...props }: any) => <ul className="list-disc list-inside text-gray-300 mb-6 space-y-3 ml-4" {...props} />,
                  ol: ({ ...props }: any) => <ol className="list-decimal list-inside text-gray-300 mb-6 space-y-3 ml-4" {...props} />,
                  li: ({ ...props }: any) => <li className="text-gray-300 leading-[1.8]" {...props} />,
                  a: ({ ...props }: any) => <a className="text-[#06038d] hover:underline" {...props} />,
                  blockquote: ({ ...props }: any) => (
                    <blockquote className="border-l-4 border-[#06038d] pl-6 py-3 italic text-gray-400 my-6 bg-zinc-800/50 rounded-r" {...props} />
                  ),
                  code: ({ node, inline, ...props }: any) =>
                    inline ? (
                      <code className="bg-zinc-800 px-2 py-1 rounded text-sm text-purple-400" {...props} />
                    ) : (
                      <code className="block bg-zinc-800 p-5 rounded text-sm text-gray-300 overflow-x-auto my-6 leading-[1.6]" {...props} />
                    ),
                  table: ({ ...props }: any) => (
                    <div className="overflow-x-auto my-8">
                      <table className="w-full border-collapse border border-zinc-700" {...props} />
                    </div>
                  ),
                  th: ({ ...props }: any) => (
                    <th className="border border-zinc-700 bg-zinc-800 px-4 py-2 text-left text-white font-semibold" {...props} />
                  ),
                  td: ({ ...props }: any) => (
                    <td className="border border-zinc-700 px-4 py-2 text-gray-300" {...props} />
                  ),
                }}
              >
                {post.content}
              </Markdown>
            </article>
          </Card>

          {/* Share Again at Bottom */}
          <div className="mt-8 p-6 bg-zinc-900 border border-zinc-800 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold">覺得這篇文章有幫助嗎？分享給朋友吧！</p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShareFacebook}
                  className="border-zinc-700 text-white hover:bg-zinc-800"
                >
                  <Facebook className="w-4 h-4 mr-2" />
                  Facebook
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShareWhatsApp}
                  className="border-zinc-700 text-white hover:bg-zinc-800"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="border-zinc-700 text-white hover:bg-zinc-800"
                >
                  複製連結
                </Button>
              </div>
            </div>
          </div>

          {/* Back to Blog */}
          <div className="mt-8 text-center">
            <Link href="/blog">
              <Button className="bg-[#06038d] hover:bg-[#06038d]/90">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回博客
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
