import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandButton } from "@/components/ui/brand-button";
import { Badge } from "@/components/ui/badge";
import { Eye, Edit, X, Calendar, Tag, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ArticlePreviewProps {
  article: {
    title: string;
    excerpt?: string;
    content: string;
    featuredImage?: string;
    category?: string;
    tags?: string;
    dataSource?: string;
  };
  onPublish: () => void;
  onEdit: () => void;
  onCancel: () => void;
}

export function ArticlePreview({ article, onPublish, onEdit, onCancel }: ArticlePreviewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-[#ffed00]" />
            文章預覽
          </h2>
          <p className="text-sm text-gray-400 mt-1">確認文章內容後發布</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="border-zinc-700 text-white hover:bg-zinc-800"
          >
            <X className="w-4 h-4 mr-2" />
            取消
          </Button>
          <Button
            variant="outline"
            onClick={onEdit}
            className="border-zinc-700 text-white hover:bg-zinc-800"
          >
            <Edit className="w-4 h-4 mr-2" />
            編輯
          </Button>
          <BrandButton onClick={onPublish}>
            <Sparkles className="w-4 h-4 mr-2" />
            發布文章
          </BrandButton>
        </div>
      </div>

      {/* Preview Card - 使用白色底色配合 Blog 頁面風格 */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="space-y-4">
          {/* Featured Image */}
          {article.featuredImage && (
            <div className="w-full aspect-video rounded-lg overflow-hidden bg-gray-100">
              <img
                src={article.featuredImage}
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{new Date().toLocaleDateString('zh-TW')}</span>
            </div>
            {article.category && (
              <Badge className="bg-[#0033CC] text-white hover:bg-[#0033CC]/90">
                {article.category}
              </Badge>
            )}
            {article.dataSource === 'ai-generated' && (
              <Badge variant="outline" className="border-purple-500 text-purple-600">
                <Sparkles className="w-3 h-3 mr-1" />
                AI 生成
              </Badge>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-[#0033CC] leading-tight">
            {article.title}
          </h1>

          {/* Excerpt */}
          {article.excerpt && (
            <p className="text-lg text-gray-600 leading-relaxed border-l-4 border-[#FFD700] pl-4 py-2 bg-yellow-50">
              {article.excerpt}
            </p>
          )}

          {/* Tags */}
          {article.tags && (
            <div className="flex flex-wrap items-center gap-2">
              <Tag className="w-4 h-4 text-gray-400" />
              {article.tags.split(',').map((tag, index) => (
                <Badge key={index} variant="secondary" className="bg-gray-100 text-gray-700">
                  {tag.trim()}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent className="prose prose-lg max-w-none">
          {/* Content - Markdown 渲染 */}
          <div className="text-gray-800 leading-relaxed">
            <ReactMarkdown
              components={{
                h1: ({ node, ...props }) => <h1 className="text-3xl font-bold text-[#0033CC] mt-8 mb-4" {...props} />,
                h2: ({ node, ...props }) => <h2 className="text-2xl font-bold text-[#0033CC] mt-6 mb-3 pb-2 border-b-2 border-[#FFD700]" {...props} />,
                h3: ({ node, ...props }) => <h3 className="text-xl font-bold text-[#0033CC] mt-4 mb-2" {...props} />,
                p: ({ node, ...props }) => <p className="text-lg leading-relaxed mb-4" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-4 space-y-2" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-4 space-y-2" {...props} />,
                li: ({ node, ...props }) => <li className="text-lg leading-relaxed" {...props} />,
                blockquote: ({ node, ...props }) => (
                  <blockquote className="border-l-4 border-[#FFD700] pl-4 py-2 my-4 bg-yellow-50 italic text-gray-700" {...props} />
                ),
                code: ({ node, ...props }) => <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono" {...props} />,
                pre: ({ node, ...props }) => <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto mb-4" {...props} />,
                a: ({ node, ...props }) => <a className="text-[#0033CC] hover:underline" {...props} />,
                img: ({ node, ...props }) => <img className="rounded-lg my-4 w-full" {...props} />,
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="w-full border-collapse" {...props} />
                  </div>
                ),
                thead: ({ node, ...props }) => <thead className="bg-[#0033CC] text-white" {...props} />,
                th: ({ node, ...props }) => <th className="border border-gray-300 px-4 py-2 text-left" {...props} />,
                td: ({ node, ...props }) => <td className="border border-gray-300 px-4 py-2" {...props} />,
              }}
            >
              {article.content}
            </ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button
          variant="outline"
          onClick={onCancel}
          className="border-zinc-700 text-white hover:bg-zinc-800"
        >
          <X className="w-4 h-4 mr-2" />
          取消
        </Button>
        <Button
          variant="outline"
          onClick={onEdit}
          className="border-zinc-700 text-white hover:bg-zinc-800"
        >
          <Edit className="w-4 h-4 mr-2" />
          編輯
        </Button>
        <BrandButton onClick={onPublish}>
          <Sparkles className="w-4 h-4 mr-2" />
          發布文章
        </BrandButton>
      </div>
    </div>
  );
}
