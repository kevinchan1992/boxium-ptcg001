import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Link as LinkIcon, FileText, Sparkles, Check, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

export function GenerateArticle() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  
  const [inputType, setInputType] = useState<"url" | "text">("url");
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("zh-TW");
  const [style, setStyle] = useState("analysis");
  const [generationId, setGenerationId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate article mutation
  const generateMutation = trpc.articleGeneration.generate.useMutation({
    onSuccess: (data) => {
      setGenerationId(data.generationId);
      toast.success("文章生成已開始");
    },
    onError: (error) => {
      toast.error(`生成失敗：${error.message}`);
      setIsGenerating(false);
    },
  });

  // Get generation result
  const { data: generationResult, refetch: refetchResult } = trpc.articleGeneration.getResult.useQuery(
    { generationId: generationId! },
    {
      enabled: generationId !== null,
      refetchInterval: (query) => {
        // Keep polling if status is pending or processing
        const data = query.state.data;
        if (data?.status === "pending" || data?.status === "processing") {
          return 2000; // Poll every 2 seconds
        }
        return false; // Stop polling
      },
    }
  );

  // Save as draft mutation
  const saveAsDraftMutation = trpc.articleGeneration.saveAsDraft.useMutation({
    onSuccess: (data) => {
      toast.success("已保存為草稿");
      setLocation(`/admin/blog/edit/${data.postId}`);
    },
    onError: (error) => {
      toast.error(`保存失敗：${error.message}`);
    },
  });

  const handleGenerate = async () => {
    const inputContent = inputType === "url" ? urlInput : textInput;

    if (!inputContent.trim()) {
      toast.error("請輸入內容");
      return;
    }

    setIsGenerating(true);
    setGenerationId(null);

    generateMutation.mutate({
      inputType,
      inputContent,
      targetLanguage,
      style,
    });
  };

  const handleSaveAsDraft = () => {
    if (!generationId) return;
    saveAsDraftMutation.mutate({ generationId });
  };

  const handleReset = () => {
    setGenerationId(null);
    setIsGenerating(false);
    setUrlInput("");
    setTextInput("");
  };

  // Check if generation is complete
  const isComplete = generationResult?.status === "completed";
  const isFailed = generationResult?.status === "failed";
  const isProcessing = generationResult?.status === "pending" || generationResult?.status === "processing";

  // Update isGenerating based on result
  if (isGenerating && (isComplete || isFailed)) {
    setIsGenerating(false);
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI 文章生成</h1>
        <p className="text-gray-600">
          貼上 URL 或文章內容，AI 將自動分析並生成符合平台風格的原創文章
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>輸入來源</CardTitle>
            <CardDescription>選擇輸入方式並提供內容</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={inputType} onValueChange={(v) => setInputType(v as "url" | "text")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url">
                  <LinkIcon className="w-4 h-4 mr-2" />
                  URL
                </TabsTrigger>
                <TabsTrigger value="text">
                  <FileText className="w-4 h-4 mr-2" />
                  文本
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-4">
                <div>
                  <Label htmlFor="url-input">網址</Label>
                  <Input
                    id="url-input"
                    placeholder="https://example.com/article"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    disabled={isGenerating}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    支援日文/英文/中文網站
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="text" className="space-y-4">
                <div>
                  <Label htmlFor="text-input">文章內容</Label>
                  <Textarea
                    id="text-input"
                    placeholder="貼上文章內容..."
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    rows={8}
                    disabled={isGenerating}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    支援日文/英文/中文內容
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-4">
              <div>
                <Label htmlFor="target-language">目標語言</Label>
                <Select value={targetLanguage} onValueChange={setTargetLanguage} disabled={isGenerating}>
                  <SelectTrigger id="target-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh-TW">繁體中文</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ja">日本語</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="style">文章風格</Label>
                <Select value={style} onValueChange={setStyle} disabled={isGenerating}>
                  <SelectTrigger id="style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="analysis">市場分析</SelectItem>
                    <SelectItem value="news">新聞報導</SelectItem>
                    <SelectItem value="guide">投資指南</SelectItem>
                    <SelectItem value="review">卡牌評測</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  開始生成
                </>
              )}
            </Button>

            {generationId && (
              <Button
                onClick={handleReset}
                variant="outline"
                className="w-full"
                disabled={isGenerating}
              >
                重新生成
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Result Section */}
        <Card>
          <CardHeader>
            <CardTitle>生成結果</CardTitle>
            <CardDescription>
              {isProcessing && "AI 正在分析並生成文章..."}
              {isComplete && "生成完成！"}
              {isFailed && "生成失敗"}
              {!generationId && "等待開始生成"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isProcessing && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
                <p className="text-sm text-gray-500">
                  {generationResult?.status === "pending" && "準備中..."}
                  {generationResult?.status === "processing" && "生成中，請稍候..."}
                </p>
              </div>
            )}

            {isFailed && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <AlertCircle className="w-12 h-12 text-red-500" />
                <p className="text-sm text-red-600">
                  {generationResult?.errorMessage || "生成失敗"}
                </p>
                <Button onClick={handleReset} variant="outline">
                  重試
                </Button>
              </div>
            )}

            {isComplete && generationResult && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600 mb-4">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">生成成功</span>
                </div>

                <div>
                  <Label>標題</Label>
                  <div className="p-3 bg-gray-50 rounded-md">
                    <p className="font-medium">{generationResult.generatedTitle}</p>
                  </div>
                </div>

                <div>
                  <Label>摘要</Label>
                  <div className="p-3 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-700">{generationResult.generatedExcerpt}</p>
                  </div>
                </div>

                <div>
                  <Label>內容預覽</Label>
                  <div className="p-3 bg-gray-50 rounded-md max-h-64 overflow-y-auto">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                      {generationResult.generatedContent?.substring(0, 500)}...
                    </pre>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">檢測語言：</span> {generationResult.detectedLanguage}
                  </div>
                  <div>
                    <span className="font-medium">處理時間：</span>{" "}
                    {generationResult.processingTimeMs ? `${(generationResult.processingTimeMs / 1000).toFixed(1)}s` : "N/A"}
                  </div>
                </div>

                <Button
                  onClick={handleSaveAsDraft}
                  disabled={saveAsDraftMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {saveAsDraftMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    "保存為草稿"
                  )}
                </Button>
              </div>
            )}

            {!generationId && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Sparkles className="w-12 h-12 mb-4" />
                <p className="text-sm">點擊「開始生成」來創建文章</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
