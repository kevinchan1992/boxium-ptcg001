import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandButton } from "@/components/ui/brand-button";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, Edit, X, Calendar, Tag, Sparkles, Wand2, Loader2, FileText, MessageSquare, Layout, Search, ImageIcon, Save, History, RotateCcw, FileImage } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { trpc } from "@/lib/trpc";
import { formatHKDate, formatHKLocale } from "@/lib/formatDate";
import { toast } from "sonner";
import { CardImagePicker } from "@/components/CardImagePicker";
import { ImageLibrary } from "@/components/ImageLibrary";
import { SEOScorePanel } from "@/components/SEOScorePanel";

interface ArticlePreviewProps {
  article: {
    id?: number;
    title: string;
    excerpt?: string;
    content: string;
    featuredImage?: string;
    category?: string;
    tags?: string;
    seoKeywords?: string;
    dataSource?: string;
  };
  onPublish: (article: ArticlePreviewProps['article']) => void;
  onEdit: () => void;
  onCancel: () => void;
  initialEditMode?: boolean;
}

export function ArticlePreview({ article, onPublish, onEdit, onCancel, initialEditMode = false }: ArticlePreviewProps) {
  const [currentArticle, setCurrentArticle] = useState(article);
  // Sync article prop changes (e.g., when AI generates a new article and parent updates the prop)
  useEffect(() => {
    setCurrentArticle(article);
  }, [article.title, article.content]);
  const [showAIEditDialog, setShowAIEditDialog] = useState(false);
  const [editInstruction, setEditInstruction] = useState('');
  const [isAIEditing, setIsAIEditing] = useState(false);
  const [isEditMode, setIsEditMode] = useState(initialEditMode);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showImageLibrary, setShowImageLibrary] = useState(false);

  // Draft auto-save key
  const draftKey = `article-draft-${article.id || 'new'}`;

  // Load draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft && !article.id) {
      // Only show draft dialog for new articles
      setShowDraftDialog(true);
    }
  }, []);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!isEditMode) return;

    const interval = setInterval(() => {
      localStorage.setItem(draftKey, JSON.stringify(currentArticle));
      console.log('[Draft] Auto-saved at', new Date().toLocaleTimeString());
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [currentArticle, isEditMode, draftKey]);

  // Clear draft when published or cancelled
  const clearDraft = () => {
    localStorage.removeItem(draftKey);
  };

  // Restore draft
  const restoreDraft = () => {
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        setCurrentArticle(draft);
        toast.success('草稿已恢復');
      } catch (error) {
        toast.error('草稿恢復失敗');
      }
    }
    setShowDraftDialog(false);
  };

  const editWithAIMutation = trpc.blog.editArticleWithAI.useMutation({
    onSuccess: (data: { title: string; excerpt: string; content: string }) => {
      setCurrentArticle({
        ...currentArticle,
        title: data.title,
        excerpt: data.excerpt,
        content: data.content,
      });
      toast.success('AI 編輯完成！');
      setShowAIEditDialog(false);
      setEditInstruction('');
      setIsAIEditing(false);
    },
    onError: (error: any) => {
      toast.error(`AI 編輯失敗：${error.message}`);
      setIsAIEditing(false);
    },
  });

  const handleAIEdit = () => {
    if (!editInstruction.trim()) {
      toast.error('請輸入修改要求');
      return;
    }
    setIsAIEditing(true);
    editWithAIMutation.mutate({
      article: {
        title: currentArticle.title,
        excerpt: currentArticle.excerpt || '',
        content: currentArticle.content,
      },
      instruction: editInstruction,
    });
  };

  const handlePublish = () => {
    clearDraft();
    onPublish(currentArticle);
  };

  const handleCancel = () => {
    clearDraft();
    onCancel();
  };

  return (
    <>
      {/* Draft Restore Dialog */}
      <BottomSheet
        open={showDraftDialog}
        onOpenChange={setShowDraftDialog}
        title="發現未完成的草稿"
        description="檢測到您有一篇未完成的文章草稿，是否要恢復？"
        className="bg-zinc-900 border-zinc-800 text-white"
      >
        <div className="flex gap-2 justify-end pt-2">
          <Button
            variant="outline"
            onClick={() => setShowDraftDialog(false)}
            className="border-zinc-700 text-white hover:bg-zinc-800 flex-1"
          >
            不恢復
          </Button>
          <BrandButton onClick={restoreDraft} className="flex-1">
            恢復草稿
          </BrandButton>
        </div>
      </BottomSheet>

      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-[#FEDD00]" />
            文章預覽
          </h2>
          <p className="text-sm text-gray-400 mt-1">確認文章內容後發布</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="border-zinc-700 text-white hover:bg-zinc-800"
          >
            <X className="w-4 h-4 mr-2" />
            取消
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsEditMode(!isEditMode)}
            className="border-zinc-700 text-white hover:bg-zinc-800"
          >
            {isEditMode ? (
              <>
                <Eye className="w-4 h-4 mr-2" />
                預覽
              </>
            ) : (
              <>
                <Edit className="w-4 h-4 mr-2" />
                編輯
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowAIEditDialog(true)}
            className="border-zinc-700 text-white hover:bg-zinc-800"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            AI 編輯
          </Button>
          {article.id && (
            <Button
              variant="outline"
              onClick={() => setShowHistoryDialog(true)}
              className="border-zinc-700 text-white hover:bg-zinc-800"
            >
              <History className="w-4 h-4 mr-2" />
              查看歷史
            </Button>
          )}
          <BrandButton onClick={handlePublish}>
            <Sparkles className="w-4 h-4 mr-2" />
            發布文章
          </BrandButton>
        </div>
      </div>

      {/* Preview/Edit Card - 使用白色底色配合 Blog 頁面風格 */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="space-y-4">
          {/* Featured Image */}
          {currentArticle.featuredImage && (
            <div className="w-full aspect-video rounded-lg overflow-hidden bg-gray-100">
              <img
                src={currentArticle.featuredImage}
                alt={currentArticle.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{formatHKDate(new Date())}</span>
            </div>
            {currentArticle.category && (
              <Badge className="bg-[#0033CC] text-white hover:bg-[#0033CC]/90">
                {currentArticle.category}
              </Badge>
            )}
            {currentArticle.dataSource === 'ai-generated' && (
              <Badge variant="outline" className="border-purple-500 text-purple-600">
                <Sparkles className="w-3 h-3 mr-1" />
                AI 生成
              </Badge>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-[#0033CC] leading-tight">
            {currentArticle.title}
          </h1>

          {/* Excerpt */}
          {currentArticle.excerpt && (
            <p className="text-lg text-gray-600 leading-relaxed border-l-4 border-[#FEDD00] pl-4 py-2 bg-yellow-50">
              {currentArticle.excerpt}
            </p>
          )}

          {/* Tags */}
          {currentArticle.tags && (
            <div className="flex flex-wrap items-center gap-2">
              <Tag className="w-4 h-4 text-gray-400" />
              {currentArticle.tags.split(',').map((tag, index) => (
                <Badge key={index} variant="secondary" className="bg-gray-100 text-gray-700">
                  {tag.trim()}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent className="prose prose-lg max-w-none">
          {isEditMode ? (
            /* Edit Mode */
            <div className="space-y-4">
              {/* Title */}
              <div>
                <Label htmlFor="edit-title" className="text-gray-700">標題 *</Label>
                <Input
                  id="edit-title"
                  value={currentArticle.title}
                  onChange={(e) => setCurrentArticle({ ...currentArticle, title: e.target.value })}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="輸入文章標題..."
                />
              </div>

              {/* Excerpt */}
              <div>
                <Label htmlFor="edit-excerpt" className="text-gray-700">摘要</Label>
                <Textarea
                  id="edit-excerpt"
                  value={currentArticle.excerpt || ''}
                  onChange={(e) => setCurrentArticle({ ...currentArticle, excerpt: e.target.value })}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="輸入文章摘要（150-200字）..."
                  rows={3}
                />
              </div>

              {/* SEO Score Panel */}
              <SEOScorePanel
                title={currentArticle.title}
                excerpt={currentArticle.excerpt || ''}
                content={currentArticle.content}
                seoKeywords={currentArticle.seoKeywords || ''}
              />

              {/* Content with Image Upload Buttons */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="edit-content" className="text-gray-700">內容 * (Markdown)</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-gray-300 text-gray-700 hover:bg-gray-100"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (!file) return;
                          
                          // Check file size (max 10MB)
                          if (file.size > 10 * 1024 * 1024) {
                            toast.error('圖片大小不能超過 10MB');
                            return;
                          }
                          
                          try {
                            toast.info('正在上傳圖片...');
                            
                            // Upload to S3
                            const formData = new FormData();
                            formData.append('file', file);
                            
                            const uploadResponse = await fetch('/api/upload-blog-image', {
                              method: 'POST',
                              body: formData,
                            });
                            
                            if (!uploadResponse.ok) {
                              throw new Error('圖片上傳失敗');
                            }
                            
                            const { url } = await uploadResponse.json();
                            
                            // Insert markdown image syntax
                            const imageName = file.name.replace(/\.[^/.]+$/, '');
                            const markdownImage = `![${imageName}](${url})`;
                            setCurrentArticle({ 
                              ...currentArticle, 
                              content: currentArticle.content + '\n\n' + markdownImage 
                            });
                            
                            toast.success('圖片上傳成功');
                          } catch (error) {
                            toast.error(`圖片上傳失敗：${error instanceof Error ? error.message : '未知錯誤'}`);
                          }
                        };
                        input.click();
                      }}
                    >
                      <ImageIcon className="w-4 h-4 mr-2" />
                      上傳圖片
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowImageLibrary(true)}
                    >
                      <FileImage className="w-4 h-4 mr-2" />
                      選擇圖片
                    </Button>
                    <CardImagePicker
                      variant="light"
                      onInsert={(imageUrl, cardName) => {
                        const markdownImage = `![${cardName}](${imageUrl})`;
                        setCurrentArticle({ 
                          ...currentArticle, 
                          content: currentArticle.content + '\n\n' + markdownImage 
                        });
                      }}
                    />
                  </div>
                </div>
                <Textarea
                  id="edit-content"
                  value={currentArticle.content}
                  onChange={(e) => setCurrentArticle({ ...currentArticle, content: e.target.value })}
                  className="bg-white border-gray-300 text-gray-900 font-mono"
                  placeholder="輸入文章內容（支援 Markdown 格式）..."
                  rows={20}
                />
              </div>

              {/* Article Theme Image */}
              <div>
                <Label htmlFor="edit-featuredImage" className="text-gray-700">文章主題圖片</Label>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      id="edit-featuredImage"
                      value={currentArticle.featuredImage || ''}
                      onChange={(e) => setCurrentArticle({ ...currentArticle, featuredImage: e.target.value })}
                      className="bg-white border-gray-300 text-gray-900"
                      placeholder="https://..."
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-300 text-gray-700 hover:bg-gray-100"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file) return;
                        
                        // Check file size (max 10MB)
                        if (file.size > 10 * 1024 * 1024) {
                          toast.error('圖片大小不能超過 10MB');
                          return;
                        }
                        
                        try {
                          toast.info('正在上傳圖片...');
                          
                          // Upload to S3
                          const formData = new FormData();
                          formData.append('file', file);
                          
                          const uploadResponse = await fetch('/api/upload-blog-image', {
                            method: 'POST',
                            body: formData,
                          });
                          
                          if (!uploadResponse.ok) {
                            throw new Error('圖片上傳失敗');
                          }
                          
                          const { url, urls } = await uploadResponse.json();
                          // Save multi-size URLs as JSON string (for backward compatibility, also save medium URL)
                          const featuredImageData = urls ? JSON.stringify(urls) : url;
                          setCurrentArticle({ ...currentArticle, featuredImage: featuredImageData });
                          
                          toast.success('圖片上傳成功');
                        } catch (error) {
                          toast.error(`圖片上傳失敗：${error instanceof Error ? error.message : '未知錯誤'}`);
                        }
                      };
                      input.click();
                    }}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    上傳
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-300 text-gray-700 hover:bg-gray-100"
                    onClick={async () => {
                      try {
                        toast.info('AI 正在生成圖片，這可能需要 10-20 秒...');
                        
                        // Generate prompt based on article title and excerpt
                        const prompt = `Create a professional and visually appealing featured image for a Pokémon TCG blog article titled "${currentArticle.title}". ${currentArticle.excerpt ? `The article is about: ${currentArticle.excerpt}` : ''} The image should be eye-catching, modern, and related to Pokémon trading cards. Include vibrant colors and a clean design suitable for a blog header.`;
                        
                        // Call tRPC API to generate image
                        const response = await fetch('/api/trpc/blog.generateThemeImage', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            json: { prompt },
                          }),
                        });
                        
                        if (!response.ok) {
                          throw new Error('AI 圖片生成失敗');
                        }
                        
                        const { result } = await response.json();
                        setCurrentArticle({ ...currentArticle, featuredImage: result.data.url });
                        
                        toast.success('AI 圖片生成成功！');
                      } catch (error: any) {
                        toast.error(`AI 圖片生成失敗：${error.message}`);
                      }
                    }}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI 生成
                  </Button>
                </div>
              </div>

              {/* Category */}
              <div>
                <Label htmlFor="edit-category" className="text-gray-700">分類</Label>
                <select
                  id="edit-category"
                  value={currentArticle.category || ''}
                  onChange={(e) => setCurrentArticle({ ...currentArticle, category: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0033CC]"
                >
                  <option value="">選擇分類...</option>
                  <option value="市場分析">市場分析</option>
                  <option value="卡牌價格">卡牌價格</option>
                  <option value="投資指南">投資指南</option>
                  <option value="新品發布">新品發布</option>
                  <option value="收藏心得">收藏心得</option>
                  <option value="賽事報導">賽事報導</option>
                  <option value="開箱評測">開箱評測</option>
                  <option value="交易技巧">交易技巧</option>
                </select>
              </div>

              {/* Tags */}
              <div>
                <Label htmlFor="edit-tags" className="text-gray-700">標籤</Label>
                <Input
                  id="edit-tags"
                  value={currentArticle.tags || ''}
                  onChange={(e) => setCurrentArticle({ ...currentArticle, tags: e.target.value })}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="用逗號分隔，例如：寶可夢, TCG, 投資"
                />
              </div>

              {/* SEO Keywords */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="edit-seoKeywords" className="text-gray-700">SEO 關鍵字</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-blue-300 text-blue-700 hover:bg-blue-50"
                    onClick={async () => {
                      try {
                        toast.info('正在生成分類、標籤和 SEO 關鍵字...');
                        
                        // Call tRPC API to generate metadata
                        const response = await fetch('/api/trpc/blog.generateMetadata', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            json: {
                              title: currentArticle.title,
                              excerpt: currentArticle.excerpt,
                              content: currentArticle.content,
                            },
                          }),
                        });
                        
                        if (!response.ok) throw new Error('生成失敗');
                        
                        const data = await response.json();
                        const result = data.result.data.json;
                        
                        // Update article with generated metadata
                        setCurrentArticle({
                          ...currentArticle,
                          category: result.category || currentArticle.category,
                          tags: result.tags ? result.tags.join(', ') : currentArticle.tags,
                          seoKeywords: result.seoKeywords ? result.seoKeywords.join(', ') : currentArticle.seoKeywords,
                        });
                        
                        toast.success('生成成功！');
                      } catch (error: any) {
                        toast.error(`生成失敗：${error.message}`);
                      }
                    }}
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    AI 自動填寫
                  </Button>
                </div>
                <Input
                  id="edit-seoKeywords"
                  value={currentArticle.seoKeywords || ''}
                  onChange={(e) => setCurrentArticle({ ...currentArticle, seoKeywords: e.target.value })}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="例如：Pokémon TCG, 卡牌價格, 市場分析（以逗號分隔）"
                />
                <p className="text-xs text-gray-500 mt-1">用於搜尋引擎優化，幫助文章被更多人找到</p>
              </div>
            </div>
          ) : (
            /* Preview Mode - Content - Markdown 渲染 */
            <div className="text-gray-800 leading-relaxed">
            <ReactMarkdown
              components={{
                h1: ({ node, ...props }) => <h1 className="text-3xl font-bold text-[#0033CC] mt-8 mb-4" {...props} />,
                h2: ({ node, ...props }) => <h2 className="text-2xl font-bold text-[#0033CC] mt-6 mb-3 pb-2 border-b-2 border-[#FEDD00]" {...props} />,
                h3: ({ node, ...props }) => <h3 className="text-xl font-bold text-[#0033CC] mt-4 mb-2" {...props} />,
                p: ({ node, ...props }) => <p className="text-lg leading-relaxed mb-4" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-4 space-y-2" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-4 space-y-2" {...props} />,
                li: ({ node, ...props }) => <li className="text-lg leading-relaxed" {...props} />,
                blockquote: ({ node, ...props }) => (
                  <blockquote className="border-l-4 border-[#FEDD00] pl-4 py-2 my-4 bg-yellow-50 italic text-gray-700" {...props} />
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
              {currentArticle.content}
            </ReactMarkdown>
          </div>
          )}
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
          onClick={() => setIsEditMode(!isEditMode)}
          className="border-zinc-700 text-white hover:bg-zinc-800"
        >
          {isEditMode ? (
            <>
              <Eye className="w-4 h-4 mr-2" />
              預覽
            </>
          ) : (
            <>
              <Edit className="w-4 h-4 mr-2" />
              編輯
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowAIEditDialog(true)}
          className="border-zinc-700 text-white hover:bg-zinc-800"
        >
          <Wand2 className="w-4 h-4 mr-2" />
          AI 編輯
        </Button>
        <BrandButton onClick={handlePublish}>
          <Sparkles className="w-4 h-4 mr-2" />
          發布文章
        </BrandButton>
      </div>

      {/* AI Edit BottomSheet */}
      <BottomSheet
        open={showAIEditDialog}
        onOpenChange={setShowAIEditDialog}
        title={
          <span className="flex items-center gap-2 text-white">
            <Wand2 className="w-5 h-5 text-[#FEDD00]" />
            AI 編輯文章
          </span>
        }
        description="向 AI 描述你想要的修改，AI 會根據你的要求修正文章內容"
        className="bg-zinc-900 border-zinc-800 text-white sm:max-w-2xl"
      >

          <div className="space-y-4 mt-4">
            {/* Quick Options */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">
                快速選項
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditInstruction('讓標題更吸引人，增加一些關鍵字和數字')}
                  className="border-zinc-700 text-white hover:bg-zinc-800 text-xs"
                  disabled={isAIEditing}
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  優化標題
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditInstruction('擴充文章內容，增加更多細節、數據和例子，讓文章更豐富')}
                  className="border-zinc-700 text-white hover:bg-zinc-800 text-xs"
                  disabled={isAIEditing}
                >
                  <FileText className="w-3 h-3 mr-1" />
                  擴充內容
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditInstruction('調整文章語氣，讓它更專業、正式，適合商業場合')}
                  className="border-zinc-700 text-white hover:bg-zinc-800 text-xs"
                  disabled={isAIEditing}
                >
                  <MessageSquare className="w-3 h-3 mr-1" />
                  調整語氣
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditInstruction('改善文章可讀性，簡化複雜句子，使用更清晰的段落結構')}
                  className="border-zinc-700 text-white hover:bg-zinc-800 text-xs"
                  disabled={isAIEditing}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  改善可讀性
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditInstruction('優化文章結構，重新組織段落順序，讓邏輯更清晰')}
                  className="border-zinc-700 text-white hover:bg-zinc-800 text-xs"
                  disabled={isAIEditing}
                >
                  <Layout className="w-3 h-3 mr-1" />
                  優化結構
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditInstruction('增強文章的 SEO 優化，添加相關關鍵字和內部連結建議')}
                  className="border-zinc-700 text-white hover:bg-zinc-800 text-xs"
                  disabled={isAIEditing}
                >
                  <Search className="w-3 h-3 mr-1" />
                  SEO 優化
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">
                修改要求（可直接編輯或使用上方快速選項）
              </label>
              <Textarea
                value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                placeholder="例如：&#10;- 讓標題更吸引人&#10;- 在第二段增加更多細節&#10;- 改寫結尾段落，讓它更有力&#10;- 調整語氣，讓它更專業/輕鬆/正式"
                className="bg-zinc-800 border-zinc-700 text-white min-h-[150px]"
                disabled={isAIEditing}
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Sparkles className="w-4 h-4" />
              <span>AI 會保留文章的原有風格和結構，只根據你的要求進行修改</span>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAIEditDialog(false);
                  setEditInstruction('');
                }}
                className="border-zinc-700 text-white hover:bg-zinc-800"
                disabled={isAIEditing}
              >
                取消
              </Button>
              <BrandButton onClick={handleAIEdit} disabled={isAIEditing}>
                {isAIEditing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    AI 編輯中...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    開始編輯
                  </>
                )}
              </BrandButton>
            </div>
          </div>
      </BottomSheet>

      {/* History Dialog */}
      <HistoryDialog 
        postId={article.id} 
        open={showHistoryDialog} 
        onOpenChange={setShowHistoryDialog}
        onRestore={(version) => {
          setCurrentArticle({
            ...currentArticle,
            title: version.title,
            excerpt: version.excerpt || '',
            content: version.content,
            featuredImage: version.featuredImage || '',
            category: version.category || '',
            seoKeywords: version.metaKeywords || '',
            tags: version.tags || '',
          });
          toast.success('已恢復到歷史版本');
          setShowHistoryDialog(false);
        }}
      />

      {/* Image Library Dialog */}
      <ImageLibrary
        open={showImageLibrary}
        onClose={() => setShowImageLibrary(false)}
        onSelectImage={(imageUrl) => {
          const markdownImage = `![Image](${imageUrl})`;
          setCurrentArticle({ 
            ...currentArticle, 
            content: currentArticle.content + '\n\n' + markdownImage 
          });
          toast.success('圖片已插入');
        }}
      />
      </div>
    </>
  );
}

// History Dialog Component
interface HistoryDialogProps {
  postId?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (version: any) => void;
}

function HistoryDialog({ postId, open, onOpenChange, onRestore }: HistoryDialogProps) {
  const { data: versions, isLoading } = trpc.blog.getPostVersions.useQuery(
    { postId: postId! },
    { enabled: !!postId && open }
  );
  const restoreMutation = trpc.blog.restorePostVersion.useMutation({
    onSuccess: () => {
      toast.success('版本恢復成功');
    },
    onError: (error) => {
      toast.error(`版本恢復失敗：${error.message}`);
    },
  });

  const handleRestore = async (versionId: number) => {
    if (!postId) return;
    
    await restoreMutation.mutateAsync({ postId, versionId });
    const version = versions?.find(v => v.id === versionId);
    if (version) {
      onRestore(version);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="歷史版本"
      description="查看文章的所有歷史版本，點擊「恢復」可以回到之前的版本"
      className="max-w-4xl bg-zinc-900 border-zinc-800 text-white sm:max-w-4xl"
    >

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : versions && versions.length > 0 ? (
          <div className="space-y-4">
            {versions.map((version) => (
              <Card key={version.id} className="bg-zinc-800 border-zinc-700">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-2">{version.title}</h3>
                      {version.excerpt && (
                        <p className="text-sm text-zinc-400 mb-2">{version.excerpt}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatHKLocale(version.createdAt)}
                        </span>
                        {version.createdByName && (
                          <span>編輯者：{version.createdByName}</span>
                        )}
                        {version.category && (
                          <Badge variant="outline" className="text-xs">
                            {version.category}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(version.id)}
                      disabled={restoreMutation.isPending}
                      className="border-zinc-700 text-white hover:bg-zinc-700"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      恢復
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-zinc-400">
            沒有歷史版本
          </div>
        )}
    </BottomSheet>
  );
}
