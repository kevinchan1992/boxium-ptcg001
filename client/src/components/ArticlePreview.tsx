import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Sparkles, Edit, Check, X, Loader2 } from "lucide-react";
import { Streamdown } from "streamdown";

interface ArticlePreviewProps {
  article: {
    title: string;
    excerpt: string;
    content: string;
    featuredImageUrl?: string;
    seoMetadata?: {
      metaTitle?: string;
      metaDescription?: string;
      keywords?: string[];
    };
  };
  onAccept: () => void;
  onCancel: () => void;
  onRevise: (revisedArticle: any) => void;
}

export function ArticlePreview({ article, onAccept, onCancel, onRevise }: ArticlePreviewProps) {
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [revisionRequest, setRevisionRequest] = useState("");
  const [currentArticle, setCurrentArticle] = useState(article);

  const reviseMutation = trpc.articleGeneration.revise.useMutation({
    onSuccess: (data) => {
      toast.success("文章已根據您的要求修改！");
      const revisedArticle = {
        title: data.title,
        excerpt: data.excerpt,
        content: data.content,
        featuredImageUrl: currentArticle.featuredImageUrl,
        seoMetadata: currentArticle.seoMetadata,
      };
      setCurrentArticle(revisedArticle);
      onRevise(revisedArticle);
      setShowRevisionDialog(false);
      setRevisionRequest("");
    },
    onError: (error) => {
      toast.error(`修改失敗：${error.message}`);
    },
  });

  const handleRevise = () => {
    if (!revisionRequest.trim()) {
      toast.error("請輸入修改要求");
      return;
    }

    reviseMutation.mutate({
      originalTitle: currentArticle.title,
      originalContent: currentArticle.content,
      originalExcerpt: currentArticle.excerpt,
      revisionRequest: revisionRequest.trim(),
      targetLanguage: "zh-TW",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">文章預覽</h2>
          <p className="text-gray-400 mt-1">檢查生成的文章，可以使用 AI 修改或直接發布</p>
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
          <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="border-purple-600 text-purple-400 hover:bg-purple-600/10"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                AI 修改
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800">
              <DialogHeader>
                <DialogTitle className="text-white">AI 輔助修改</DialogTitle>
                <DialogDescription>
                  告訴 AI 您想要修改的內容，例如：「標題太長，縮短到 30 字以內」、「加入更多價格數據」
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="revision-request" className="text-white">修改要求</Label>
                  <Textarea
                    id="revision-request"
                    value={revisionRequest}
                    onChange={(e) => setRevisionRequest(e.target.value)}
                    placeholder="例如：標題太長，請縮短到 30 字以內；加入更多具體的價格數據和市場分析"
                    className="bg-zinc-800 border-zinc-700 text-white min-h-[100px]"
                    disabled={reviseMutation.isPending}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRevisionDialog(false);
                      setRevisionRequest("");
                    }}
                    disabled={reviseMutation.isPending}
                    className="border-zinc-700 text-white hover:bg-zinc-800"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleRevise}
                    disabled={reviseMutation.isPending || !revisionRequest.trim()}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {reviseMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        修改中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        開始修改
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            onClick={onAccept}
            className="bg-green-600 hover:bg-green-700"
          >
            <Check className="w-4 h-4 mr-2" />
            確認並編輯
          </Button>
        </div>
      </div>

      {/* Preview Card */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-3xl">{currentArticle.title}</CardTitle>
          {currentArticle.excerpt && (
            <p className="text-gray-400 text-lg mt-2">{currentArticle.excerpt}</p>
          )}
        </CardHeader>
        <CardContent>
          {currentArticle.featuredImageUrl && (
            <div className="mb-6">
              <img
                src={currentArticle.featuredImageUrl}
                alt={currentArticle.title}
                className="w-full h-auto rounded-lg"
              />
            </div>
          )}
          <div className="prose prose-invert max-w-none">
            <Streamdown>{currentArticle.content}</Streamdown>
          </div>
        </CardContent>
      </Card>

      {/* SEO Metadata */}
      {currentArticle.seoMetadata && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-sm">SEO 元數據</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {currentArticle.seoMetadata.metaTitle && (
              <div>
                <span className="text-gray-400">Meta 標題：</span>
                <span className="text-white ml-2">{currentArticle.seoMetadata.metaTitle}</span>
              </div>
            )}
            {currentArticle.seoMetadata.metaDescription && (
              <div>
                <span className="text-gray-400">Meta 描述：</span>
                <span className="text-white ml-2">{currentArticle.seoMetadata.metaDescription}</span>
              </div>
            )}
            {currentArticle.seoMetadata.keywords && currentArticle.seoMetadata.keywords.length > 0 && (
              <div>
                <span className="text-gray-400">關鍵詞：</span>
                <span className="text-white ml-2">{currentArticle.seoMetadata.keywords.join(", ")}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
