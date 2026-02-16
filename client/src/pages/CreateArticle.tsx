import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { ArrowLeft, Sparkles, Loader2, Save, Send } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ImageUploader } from "@/components/ImageUploader";

export default function CreateArticle() {
  const [, setLocation] = useLocation();
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [additionalContext, setAdditionalContext] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("ai");

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

  const handleGenerateFromImages = async () => {
    if (uploadedImages.length === 0) {
      alert("請至少上傳一張圖片");
      return;
    }

    setIsGenerating(true);
    
    // For now, use the first image for generation
    // TODO: Update backend to support multiple images
    generateMutation.mutate(
      {
        imageUrl: uploadedImages[0],
        additionalContext: additionalContext.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          setFormData({
            title: data.title,
            summary: data.summary,
            content: data.content,
            category: data.category,
            featuredImageUrl: uploadedImages[0],
            status: "draft",
          });
          setIsGenerating(false);
          setActiveTab("manual");
          alert("文章已成功生成！請檢查並編輯內容後保存。");
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
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button
          variant="ghost"
          className="mb-6 text-gray-900 hover:bg-gray-100"
          onClick={() => setLocation("/admin/articles")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回文章管理
        </Button>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-gray-100">
            <TabsTrigger value="ai" className="data-[state=active]:bg-white">
              <Sparkles className="w-4 h-4 mr-2" />
              AI 生成文章
            </TabsTrigger>
            <TabsTrigger value="manual" className="data-[state=active]:bg-white">
              手動創建文章
            </TabsTrigger>
          </TabsList>

          {/* AI Generation Tab */}
          <TabsContent value="ai" className="space-y-6">
            <Card className="border border-gray-200 shadow-sm bg-white">
              <CardHeader className="bg-gradient-to-r from-yellow-50 to-blue-50 border-b border-gray-200">
                <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <Sparkles className="w-7 h-7 text-yellow-500" />
                  AI 智能文章生成
                </CardTitle>
                <CardDescription className="text-gray-600 text-base">
                  上傳市場快報圖片，AI 將自動分析並生成完整的博客文章
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6 bg-white">
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertDescription className="text-gray-700">
                    <strong>使用說明：</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>上傳 1-5 張市場快報圖片（支持拖放）</li>
                      <li>可選：添加額外的背景資訊幫助 AI 更準確分析</li>
                      <li>點擊「生成文章」按鈕，AI 將分析圖片內容</li>
                      <li>生成後可在「手動創建」標籤頁中編輯並保存</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                <div>
                  <Label className="text-gray-900 font-semibold text-lg mb-3 block">
                    上傳市場快報圖片 *
                  </Label>
                  <ImageUploader
                    onImagesChange={setUploadedImages}
                    maxImages={5}
                    initialImages={uploadedImages}
                  />
                </div>

                <div>
                  <Label htmlFor="additionalContext" className="text-gray-900 font-semibold text-lg mb-2 block">
                    額外背景資訊（選填）
                  </Label>
                  <Textarea
                    id="additionalContext"
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    placeholder="例如：這是 2/14 的市場快報，重點關注莉莉艾和廣島禮盒的價格變化..."
                    rows={4}
                    className="border-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    提供更多背景資訊可以幫助 AI 生成更準確的文章內容
                  </p>
                </div>

                <Button
                  onClick={handleGenerateFromImages}
                  disabled={isGenerating || uploadedImages.length === 0}
                  className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-blue-900 hover:from-yellow-500 hover:to-yellow-600 font-bold text-lg py-6 shadow-md"
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
                      生成文章
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Manual Creation Tab */}
          <TabsContent value="manual" className="space-y-6">
            <Card className="border border-gray-200 shadow-sm bg-white">
              <CardHeader className="bg-gray-50 border-b border-gray-200">
                <CardTitle className="text-2xl font-bold text-gray-900">
                  {formData.title ? "編輯文章" : "手動創建文章"}
                </CardTitle>
                <CardDescription className="text-gray-600">
                  {formData.title ? "檢查 AI 生成的內容並進行編輯" : "手動填寫文章內容"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 bg-white">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Title */}
                  <div>
                    <Label htmlFor="title" className="text-gray-900 font-semibold text-base mb-2 block">
                      標題 *
                    </Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="輸入文章標題"
                      required
                      className="border-gray-300 focus:border-blue-400 focus:ring-blue-400 text-base"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <Label htmlFor="category" className="text-gray-900 font-semibold text-base mb-2 block">
                      分類 *
                    </Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value: any) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger className="border-gray-300 focus:border-blue-400 focus:ring-blue-400">
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
                    <Label htmlFor="summary" className="text-gray-900 font-semibold text-base mb-2 block">
                      摘要
                    </Label>
                    <Textarea
                      id="summary"
                      value={formData.summary}
                      onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                      placeholder="輸入文章摘要（100-150字）"
                      rows={3}
                      className="border-gray-300 focus:border-blue-400 focus:ring-blue-400"
                    />
                  </div>

                  {/* Content */}
                  <div>
                    <Label htmlFor="content" className="text-gray-900 font-semibold text-base mb-2 block">
                      內容 *
                    </Label>
                    <Textarea
                      id="content"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="輸入文章內容（支持 Markdown 格式）"
                      rows={20}
                      required
                      className="border-gray-300 focus:border-blue-400 focus:ring-blue-400 font-mono text-sm"
                    />
                    <p className="text-sm text-gray-500 mt-2">
                      支持 Markdown 格式：使用 **粗體**、*斜體*、[連結](URL)、## 標題 等
                    </p>
                  </div>

                  {/* Featured Image URL */}
                  <div>
                    <Label htmlFor="featuredImageUrl" className="text-gray-900 font-semibold text-base mb-2 block">
                      特色圖片 URL
                    </Label>
                    <Input
                      id="featuredImageUrl"
                      value={formData.featuredImageUrl}
                      onChange={(e) => setFormData({ ...formData, featuredImageUrl: e.target.value })}
                      placeholder="https://example.com/featured-image.jpg"
                      className="border-gray-300 focus:border-blue-400 focus:ring-blue-400"
                    />
                    {formData.featuredImageUrl && (
                      <div className="mt-3">
                        <img
                          src={formData.featuredImageUrl}
                          alt="特色圖片預覽"
                          className="max-w-md rounded-lg border border-gray-200"
                        />
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <Label htmlFor="status" className="text-gray-900 font-semibold text-base mb-2 block">
                      發布狀態 *
                    </Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger className="border-gray-300 focus:border-blue-400 focus:ring-blue-400">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">草稿</SelectItem>
                        <SelectItem value="published">已發布</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex gap-4 pt-4 border-t border-gray-200">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setLocation("/admin/articles")}
                      className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      取消
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      className={`flex-1 font-bold ${
                        formData.status === "published"
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : "bg-gray-600 hover:bg-gray-700 text-white"
                      }`}
                    >
                      {createMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          創建中...
                        </>
                      ) : formData.status === "published" ? (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          發布文章
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          保存草稿
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
