import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { ArrowLeft, Sparkles, Upload, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CreateArticle() {
  const [, setLocation] = useLocation();
  const [imageUrl, setImageUrl] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    summary: "",
    content: "",
    category: "market_analysis" as "market_analysis" | "investment_trends" | "card_research" | "news" | "guide",
    featuredImageUrl: "",
    status: "draft" as "draft" | "published",
  });

  const generateMutation = trpc.blog.generateFromImage.useMutation();
  const createMutation = trpc.blog.create.useMutation();

  const handleGenerateFromImage = async () => {
    if (!imageUrl.trim()) {
      alert("請輸入圖片 URL");
      return;
    }

    setIsGenerating(true);
    generateMutation.mutate(
      {
        imageUrl: imageUrl.trim(),
        additionalContext: additionalContext.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          setFormData({
            title: data.title,
            summary: data.summary,
            content: data.content,
            category: data.category,
            featuredImageUrl: imageUrl.trim(),
            status: "draft",
          });
          setIsGenerating(false);
          alert("文章已成功生成！請檢查並編輯內容。");
        },
        onError: (error) => {
          setIsGenerating(false);
          alert(`生成失敗：${error.message}`);
        },
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      alert("請填寫標題和內容");
      return;
    }

    createMutation.mutate(
      formData,
      {
        onSuccess: (data) => {
          alert(formData.status === "published" ? "文章已發布" : "文章已保存為草稿");
          setLocation(`/market-insights/${data.slug}`);
        },
        onError: (error) => {
          alert(`創建失敗：${error.message}`);
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-50">
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <Button
          variant="ghost"
          className="mb-6 text-blue-900 hover:bg-blue-100"
          onClick={() => setLocation("/admin/articles")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回文章管理
        </Button>

        {/* AI Generation Section */}
        <Card className="mb-8 border-2 border-yellow-400 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-yellow-400 to-yellow-300">
            <CardTitle className="text-2xl font-bold text-blue-900 flex items-center gap-3">
              <Sparkles className="w-7 h-7" />
              AI 文章生成器
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-900">
                上傳市場快報圖片，AI 將自動分析圖片內容並生成完整的博客文章（包括標題、摘要、正文）。
              </AlertDescription>
            </Alert>

            <div>
              <Label htmlFor="imageUrl" className="text-blue-900 font-semibold">
                市場快報圖片 URL *
              </Label>
              <Input
                id="imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/market-report.jpg"
                className="border-blue-200 focus:border-yellow-400"
              />
              <p className="text-sm text-slate-500 mt-1">
                提示：您可以先將圖片上傳到圖床（如 Imgur、Cloudinary），然後複製圖片 URL
              </p>
            </div>

            <div>
              <Label htmlFor="additionalContext" className="text-blue-900 font-semibold">
                額外背景資訊（選填）
              </Label>
              <Textarea
                id="additionalContext"
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="例如：這是 2/14 的市場快報，重點關注莉莉艾和廣島禮盒的價格變化..."
                rows={3}
                className="border-blue-200 focus:border-yellow-400"
              />
            </div>

            <Button
              onClick={handleGenerateFromImage}
              disabled={isGenerating || !imageUrl.trim()}
              className="w-full bg-yellow-400 text-blue-900 hover:bg-yellow-500 font-bold text-lg py-6"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  AI 正在分析圖片並生成文章...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  使用 AI 生成文章
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Article Form */}
        <Card className="border-2 border-blue-900 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-900 to-blue-800 text-white">
            <CardTitle className="text-2xl font-bold">
              {formData.title ? "編輯生成的文章" : "手動創建文章"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div>
                <Label htmlFor="title" className="text-blue-900 font-semibold">
                  標題 *
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="輸入文章標題"
                  required
                  className="border-blue-200 focus:border-yellow-400"
                />
              </div>

              {/* Category */}
              <div>
                <Label htmlFor="category" className="text-blue-900 font-semibold">
                  分類 *
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: any) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="border-blue-200 focus:border-yellow-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market_analysis">市場分析</SelectItem>
                    <SelectItem value="investment_trends">投資趨勢</SelectItem>
                    <SelectItem value="card_research">卡牌研究</SelectItem>
                    <SelectItem value="news">最新消息</SelectItem>
                    <SelectItem value="guide">新手指南</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Summary */}
              <div>
                <Label htmlFor="summary" className="text-blue-900 font-semibold">
                  摘要
                </Label>
                <Textarea
                  id="summary"
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="輸入文章摘要（100-150字）"
                  rows={3}
                  className="border-blue-200 focus:border-yellow-400"
                />
              </div>

              {/* Content */}
              <div>
                <Label htmlFor="content" className="text-blue-900 font-semibold">
                  內容 *
                </Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="輸入文章內容"
                  rows={15}
                  required
                  className="border-blue-200 focus:border-yellow-400 font-mono text-sm"
                />
              </div>

              {/* Featured Image URL */}
              <div>
                <Label htmlFor="featuredImageUrl" className="text-blue-900 font-semibold">
                  特色圖片 URL
                </Label>
                <Input
                  id="featuredImageUrl"
                  value={formData.featuredImageUrl}
                  onChange={(e) => setFormData({ ...formData, featuredImageUrl: e.target.value })}
                  placeholder="https://example.com/featured-image.jpg"
                  className="border-blue-200 focus:border-yellow-400"
                />
              </div>

              {/* Status */}
              <div>
                <Label htmlFor="status" className="text-blue-900 font-semibold">
                  狀態 *
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger className="border-blue-200 focus:border-yellow-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="published">已發布</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/admin/articles")}
                  className="flex-1 border-blue-900 text-blue-900 hover:bg-blue-50"
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 bg-yellow-400 text-blue-900 hover:bg-yellow-500 font-bold"
                >
                  {createMutation.isPending
                    ? "創建中..."
                    : formData.status === "published"
                    ? "發布文章"
                    : "保存草稿"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
