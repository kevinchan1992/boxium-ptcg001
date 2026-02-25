import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { BrandButton } from "@/components/ui/brand-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Eye, EyeOff, FileText, Image as ImageIcon, Sparkles, Languages, Share2, Facebook, MessageCircle, Link2, TrendingUp } from "lucide-react";

import { CardImagePicker } from "@/components/CardImagePicker";
import { ArticlePreview } from "@/components/ArticlePreview";

// Share Statistics Card Component
function ShareStatisticsCard() {
  const { data: shareStats, isLoading } = trpc.blog.getAllPostsShareStats.useQuery();
  const [sortBy, setSortBy] = useState<'total' | 'facebook' | 'whatsapp' | 'copyLink'>('total');

  const sortedStats = shareStats ? [...shareStats].sort((a, b) => {
    return b[sortBy] - a[sortBy];
  }) : [];

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Share2 className="w-5 h-5 text-[#ffed00]" />
              分享統計
            </CardTitle>
            <CardDescription>追蹤文章分享數據，了解內容傳播效果</CardDescription>
          </div>
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="total">總分享數</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="copyLink">複製連結</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-gray-400">載入中...</div>
        ) : sortedStats && sortedStats.length > 0 ? (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 p-4 rounded-lg border border-zinc-700">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                  <TrendingUp className="w-4 h-4" />
                  總分享
                </div>
                <div className="text-2xl font-bold text-white">
                  {sortedStats.reduce((sum, s) => sum + s.total, 0)}
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-900/20 to-zinc-900 p-4 rounded-lg border border-blue-800/30">
                <div className="flex items-center gap-2 text-blue-400 text-sm mb-2">
                  <Facebook className="w-4 h-4" />
                  Facebook
                </div>
                <div className="text-2xl font-bold text-white">
                  {sortedStats.reduce((sum, s) => sum + s.facebook, 0)}
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-900/20 to-zinc-900 p-4 rounded-lg border border-green-800/30">
                <div className="flex items-center gap-2 text-green-400 text-sm mb-2">
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </div>
                <div className="text-2xl font-bold text-white">
                  {sortedStats.reduce((sum, s) => sum + s.whatsapp, 0)}
                </div>
              </div>
              <div className="bg-gradient-to-br from-yellow-900/20 to-zinc-900 p-4 rounded-lg border border-yellow-800/30">
                <div className="flex items-center gap-2 text-yellow-400 text-sm mb-2">
                  <Link2 className="w-4 h-4" />
                  複製連結
                </div>
                <div className="text-2xl font-bold text-white">
                  {sortedStats.reduce((sum, s) => sum + s.copyLink, 0)}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#ffed00] text-[#06038d]">
                    <th className="px-4 py-3 text-left font-semibold">文章標題</th>
                    <th className="px-4 py-3 text-center font-semibold">總分享</th>
                    <th className="px-4 py-3 text-center font-semibold">
                      <Facebook className="w-4 h-4 inline" />
                    </th>
                    <th className="px-4 py-3 text-center font-semibold">
                      <MessageCircle className="w-4 h-4 inline" />
                    </th>
                    <th className="px-4 py-3 text-center font-semibold">
                      <Link2 className="w-4 h-4 inline" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStats.slice(0, 10).map((stat, index) => (
                    <tr
                      key={stat.postId}
                      className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-white">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-sm">#{index + 1}</span>
                          <a
                            href={`/blog/${stat.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[#ffed00] transition-colors"
                          >
                            {stat.title}
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className="bg-[#ffed00] text-[#06038d] hover:bg-[#ffed00]/90">
                          {stat.total}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-blue-400">
                        {stat.facebook}
                      </td>
                      <td className="px-4 py-3 text-center text-green-400">
                        {stat.whatsapp}
                      </td>
                      <td className="px-4 py-3 text-center text-yellow-400">
                        {stat.copyLink}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Share2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>還沒有分享數據</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminBlogManagement() {
  const [activeView, setActiveView] = useState<'list' | 'create' | 'edit' | 'generate' | 'preview' | 'edit-translation'>('list');
  const [previewArticle, setPreviewArticle] = useState<any>(null);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [autoTranslateEnabled, setAutoTranslateEnabled] = useState(true);

  // Query posts
  const { data: posts, isLoading, refetch } = trpc.blog.getPosts.useQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: searchQuery || undefined,
    sortBy: 'newest',
    limit: 50,
  });

  // Query categories
  const { data: categories } = trpc.blog.getCategories.useQuery();

  // Mutations
  const deletePostMutation = trpc.blog.deletePost.useMutation({
    onSuccess: () => {
      toast.success('文章已刪除');
      refetch();
    },
    onError: (error) => {
      toast.error(`刪除失敗：${error.message}`);
    },
  });

  const togglePublishMutation = trpc.blog.togglePublish.useMutation({
    onSuccess: () => {
      toast.success('狀態已更新');
      refetch();
    },
    onError: (error) => {
      toast.error(`更新失敗：${error.message}`);
    },
  });

  const translatePostMutation = trpc.blog.translatePost.useMutation({
    onSuccess: (data) => {
      toast.success(`AI 翻譯完成！\n英文標題：${data.translations.en.title}\n日文標題：${data.translations.ja.title}`);
      refetch();
    },
    onError: (error) => {
      toast.error(`AI 翻譯失敗：${error.message}`);
    },
  });

  const createPostMutation = trpc.blog.createPost.useMutation({
    onSuccess: () => {
      toast.success('文章發布成功！');
      refetch();
    },
    onError: (error) => {
      toast.error(`發布失敗：${error.message}`);
    },
  });

  const updatePostMutation = trpc.blog.updatePost.useMutation({
    onSuccess: () => {
      toast.success('文章更新成功！');
      refetch();
    },
    onError: (error) => {
      toast.error(`更新失敗：${error.message}`);
    },
  });

  const handleDelete = (id: number) => {
    if (confirm('確定要刪除這篇文章嗎？')) {
      deletePostMutation.mutate({ id });
    }
  };

  const handleTogglePublish = (id: number) => {
    togglePublishMutation.mutate({ id });
  };

  const handleTranslate = (id: number) => {
    toast.info('AI 翻譯中，請稍候...');
    translatePostMutation.mutate({ id });
  };

  const handleEdit = (post: any) => {
    // 將文章數據轉換為 ArticlePreview 所需的格式
    setPreviewArticle({
      id: post.id,
      title: post.title,
      excerpt: post.excerpt || '',
      content: post.content,
      featuredImage: post.featuredImage || '',
      category: post.category || '',
      tags: post.tags ? post.tags.join(', ') : '',
      dataSource: post.dataSource || 'manual',
    });
    setSelectedPost(post);
    setActiveView('preview'); // 使用 preview 視圖，但會預設為編輯模式
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white">博客管理</h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">管理文章、創建內容、AI 自動生成</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setSelectedPost(null);
              setActiveView('generate');
            }}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            AI 生成文章
          </Button>
          <BrandButton
            onClick={() => {
              // 使用 ArticlePreview 組件新增文章（無 id，預設為預覽模式）
              setPreviewArticle({
                title: '',
                excerpt: '',
                content: '',
                featuredImage: '',
                category: '',
                tags: '',
                dataSource: 'manual',
              });
              setSelectedPost(null);
              setActiveView('preview');
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            新增文章
          </BrandButton>
        </div>
      </div>

      {/* List View */}
      {activeView === 'list' && (
        <>
        {/* Share Statistics Card */}
        <ShareStatisticsCard />
        
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">文章列表</CardTitle>
                <CardDescription>共 {posts?.length || 0} 篇文章</CardDescription>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="搜尋文章..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 bg-zinc-800 border-zinc-700 text-white"
                />
                <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                  <SelectTrigger className="w-32 bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="published">已發布</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-400">載入中...</div>
            ) : posts && posts.length > 0 ? (
              <div className="space-y-4">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-white font-semibold">{post.title}</h3>
                        <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                          {post.status === 'published' ? '已發布' : '草稿'}
                        </Badge>
                        {post.dataSource === 'ai-generated' && (
                          <Badge variant="outline" className="border-purple-500 text-purple-400">
                            <Sparkles className="w-3 h-3 mr-1" />
                            AI 生成
                          </Badge>
                        )}
                      </div>
                      {post.excerpt && (
                        <p className="text-gray-400 text-sm line-clamp-2">{post.excerpt}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>瀏覽：{post.viewCount}</span>
                        <span>
                          {post.publishedAt
                            ? new Date(post.publishedAt).toLocaleDateString('zh-TW')
                            : new Date(post.createdAt).toLocaleDateString('zh-TW')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTogglePublish(post.id)}
                        className="text-gray-400 hover:text-white"
                      >
                        {post.status === 'published' ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTranslate(post.id)}
                        className="text-gray-400 hover:text-purple-400"
                        disabled={translatePostMutation.isPending}
                        title="AI 翻譯"
                      >
                        <Languages className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedPost(post);
                          setActiveView('edit-translation');
                        }}
                        className="text-gray-400 hover:text-blue-400"
                        title="編輯翻譯"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(post)}
                        className="text-gray-400 hover:text-white"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(post.id)}
                        className="text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>還沒有文章，點擊「創建文章」或「AI 生成文章」開始吧！</p>
              </div>
            )}
          </CardContent>
        </Card>
        </>
      )}

      {/* Create/Edit View - 已移除，統一使用 ArticlePreview */}



      {/* Preview View */}
      {activeView === 'preview' && previewArticle && (
        <ArticlePreview
          article={previewArticle}
          initialEditMode={!!previewArticle.id} // 如果有 id 表示是編輯現有文章，預設為編輯模式
          onPublish={async () => {
            try {
              // 解析 tags 字串為陣列
              const tagsArray = previewArticle.tags 
                ? previewArticle.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
                : [];

              if (previewArticle.id) {
                // 編輯現有文章 - 調用 updatePost API
                await updatePostMutation.mutateAsync({
                  id: previewArticle.id,
                  title: previewArticle.title,
                  excerpt: previewArticle.excerpt || '',
                  content: previewArticle.content,
                  featuredImage: previewArticle.featuredImage,
                  status: 'published',
                  tags: tagsArray,
                  metaKeywords: previewArticle.seoKeywords,
                });
              } else {
                // 新增文章 - 調用 createPost API
                await createPostMutation.mutateAsync({
                  title: previewArticle.title,
                  excerpt: previewArticle.excerpt || '',
                  content: previewArticle.content,
                  featuredImage: previewArticle.featuredImage,
                  status: 'published',
                  dataSource: previewArticle.dataSource as 'manual' | 'ai-generated' | 'mixed' || 'ai-generated',
                  tags: tagsArray,
                  metaKeywords: previewArticle.seoKeywords,
                });
              }

              // 成功提示已在 mutation.onSuccess 中處理
              setActiveView('list');
            } catch (error: any) {
              // 錯誤提示已在 mutation.onError 中處理
            }
          }}
          onEdit={() => {
            // onEdit 回調不再需要，因為編輯模式已經在 ArticlePreview 內部處理
          }}
          onCancel={() => setActiveView('list')}
        />
      )}

      {/* AI Generate View */}
      {activeView === 'generate' && (
        <AIArticleGenerator
          categories={categories || []}
          onCancel={() => setActiveView('list')}
          onSuccess={(generatedArticle) => {
            // Show preview first
            setPreviewArticle(generatedArticle);
            setActiveView('preview');
          }}
        />
      )}
      
      {/* Translation Editor View */}
      {activeView === 'edit-translation' && selectedPost && (
        <TranslationEditor
          post={selectedPost}
          onCancel={() => setActiveView('list')}
          onSuccess={() => {
            setActiveView('list');
            refetch();
          }}
        />
      )}
    </div>
  );
}

// AI Article Generator Component
function AIArticleGenerator({
  categories,
  onCancel,
  onSuccess,
}: {
  categories: any[];
  onCancel: () => void;
  onSuccess: (article: any) => void;
}) {
  const [inputMethod, setInputMethod] = useState<'image' | 'text' | 'url'>('url');
  const [articleType, setArticleType] = useState<'daily-report' | 'card-analysis' | 'market-trend' | 'news'>('news');
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [textContent, setTextContent] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [topic, setTopic] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('zh-TW');
  const [isUploading, setIsUploading] = useState(false);
  const [generationId, setGenerationId] = useState<number | null>(null);

  // Original blog generate mutation (for image/text input)
  const generateMutation = trpc.blog.generateArticle.useMutation({
    onSuccess: (data) => {
      toast.success('文章生成成功！');
      onSuccess(data);
    },
    onError: (error) => {
      toast.error(`生成失敗：${error.message}`);
    },
  });

  // Note: articleGeneration API has been disabled
  // Using direct LLM generation instead

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    const newUploadedUrls: string[] = [];

    try {
      for (const file of files) {
        // Convert file to base64 for preview
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const base64 = await base64Promise;
        newUploadedUrls.push(base64);
      }

      setUploadedImages([...uploadedImages, ...files]);
      setUploadedImageUrls([...uploadedImageUrls, ...newUploadedUrls]);
      toast.success(`已添加 ${files.length} 張圖片`);
    } catch (error) {
      toast.error('圖片上傳失敗');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== index));
    setUploadedImageUrls(uploadedImageUrls.filter((_, i) => i !== index));
  };

  const handleGenerate = () => {
    // URL input method has been disabled
    if (inputMethod === 'url') {
      toast.error('網址輸入功能暫時停用');
      return;
    }

    // Handle image/text input with original API
    if (inputMethod === 'image' && uploadedImageUrls.length === 0) {
      toast.error('請上傳至少一張圖片');
      return;
    }
    if (inputMethod === 'text' && !textContent) {
      toast.error('請輸入文字內容');
      return;
    }

    const input: any = {
      articleType,
    };

    if (inputMethod === 'image') {
      input.imageInput = {
        imageUrls: uploadedImageUrls,
      };
      if (uploadedImageUrls && uploadedImageUrls.length > 0) {
        input.featuredImageUrl = uploadedImageUrls[0];
      }
    } else if (inputMethod === 'text') {
      input.textInput = {
        content: textContent,
        topic: topic || '市場快訊',
      };
    }

    generateMutation.mutate(input);
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          AI 自動生成文章
        </CardTitle>
        <CardDescription>上傳圖片或輸入文字，讓 AI 幫你生成專業文章</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Method Selection */}
        <div>
          <Label className="text-white mb-2 block">輸入方式</Label>
          <div className="grid grid-cols-3 gap-4">
            <Button
              variant={inputMethod === 'url' ? 'default' : 'outline'}
              onClick={() => setInputMethod('url')}
              className={inputMethod === 'url' ? 'bg-purple-600 hover:bg-purple-700' : 'border-zinc-700 text-white hover:bg-zinc-800'}
            >
              <FileText className="w-4 h-4 mr-2" />
              網址
            </Button>
            <Button
              variant={inputMethod === 'image' ? 'default' : 'outline'}
              onClick={() => setInputMethod('image')}
              className={inputMethod === 'image' ? 'bg-purple-600 hover:bg-purple-700' : 'border-zinc-700 text-white hover:bg-zinc-800'}
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              圖片
            </Button>
            <Button
              variant={inputMethod === 'text' ? 'default' : 'outline'}
              onClick={() => setInputMethod('text')}
              className={inputMethod === 'text' ? 'bg-purple-600 hover:bg-purple-700' : 'border-zinc-700 text-white hover:bg-zinc-800'}
            >
              <FileText className="w-4 h-4 mr-2" />
              文字
            </Button>
          </div>
        </div>

        {/* Article Type Selection */}
        <div>
          <Label htmlFor="articleType" className="text-white">文章類型</Label>
          <Select value={articleType} onValueChange={(value: any) => setArticleType(value)}>
            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="news">新聞快訊</SelectItem>
              <SelectItem value="daily-report">每日市場快報</SelectItem>
              <SelectItem value="card-analysis">卡牌深度研究</SelectItem>
              <SelectItem value="market-trend">市場趨勢報告</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* URL Input */}
        {inputMethod === 'url' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="url-input" className="text-white">網址</Label>
              <Input
                id="url-input"
                placeholder="https://example.com/article"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
                disabled={true}
              />
              <p className="text-xs text-gray-500 mt-1">支援日文/英文/中文網站，AI 將自動抓取並分析內容</p>
            </div>
            <div>
              <Label htmlFor="target-language" className="text-white">目標語言</Label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage} disabled={true}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh-TW">繁體中文</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Image Input */}
        {inputMethod === 'image' && (
          <div className="space-y-4">
            <div>
              <Label className="text-white mb-2 block">上傳圖片</Label>
              <div className="border-2 border-dashed border-zinc-700 rounded-lg p-6 text-center hover:border-purple-500 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                  disabled={isUploading}
                />
                <label htmlFor="image-upload" className="cursor-pointer">
                  <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                  <p className="text-white mb-2">點擊上傳圖片</p>
                  <p className="text-xs text-gray-500">支援 JPG、PNG、WEBP 格式</p>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">AI 將自動提取圖片中的文字和卡牌資訊，第一張圖片將作為文章主題圖片</p>
            </div>

            {/* Image Preview */}
            {uploadedImageUrls.length > 0 && (
              <div>
                <Label className="text-white mb-2 block">已上傳的圖片 ({uploadedImageUrls.length})</Label>
                <div className="grid grid-cols-3 gap-4">
                  {uploadedImageUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Uploaded ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-zinc-700"
                      />
                      {index === 0 && (
                        <Badge className="absolute top-2 left-2 bg-purple-600">主題圖片</Badge>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Text Input */}
        {inputMethod === 'text' && (
          <>
            <div>
              <Label htmlFor="topic" className="text-white">主題/分類</Label>
              <Input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="例如：Pikachu 價格飆升、市場動態等"
              />
            </div>
            <div>
              <Label htmlFor="textContent" className="text-white">文字內容</Label>
              <Textarea
                id="textContent"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="輸入您想要生成文章的資訊...&#10;&#10;例如：&#10;- Pikachu PROMO 今日價格從 HKD 10,000 升至 HKD 13,500&#10;- 交易量增加 200%&#10;- 市場熱度創新高"
                rows={10}
              />
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-700">
          <p className="text-sm text-gray-400">
            {generateMutation.isPending ? '正在生成文章，請稍候...' : 'AI 將根據您提供的資訊生成專業文章'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} className="border-zinc-700 text-white hover:bg-zinc-800">
              取消
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {generateMutation.isPending ? '生成中...' : 'AI 生成文章'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Translation Editor Component
function TranslationEditor({
  post,
  onCancel,
  onSuccess,
}: {
  post: any;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    titleEn: post?.titleEn || '',
    titleJa: post?.titleJa || '',
    excerptEn: post?.excerptEn || '',
    excerptJa: post?.excerptJa || '',
    contentEn: post?.contentEn || '',
    contentJa: post?.contentJa || '',
  });

  const updateTranslationMutation = trpc.blog.updatePostTranslation.useMutation({
    onSuccess: () => {
      toast.success('翻譯已更新');
      onSuccess();
    },
    onError: (error) => {
      toast.error(`更新失敗：${error.message}`);
    },
  });

  const handleSubmit = () => {
    updateTranslationMutation.mutate({
      id: post.id,
      ...formData,
    });
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-white">編輯翻譯</CardTitle>
        <CardDescription className="text-gray-400">
          修改 AI 生成的翻譯，確保專業術語準確性
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Original Content */}
        <div className="space-y-4 p-4 bg-zinc-800 rounded-lg">
          <h3 className="text-white font-semibold">原文（中文）</h3>
          <div>
            <Label className="text-gray-400">標題</Label>
            <p className="text-white mt-1">{post.title}</p>
          </div>
          <div>
            <Label className="text-gray-400">摘要</Label>
            <p className="text-white mt-1">{post.excerpt}</p>
          </div>
        </div>

        {/* English Translation */}
        <div className="space-y-4">
          <h3 className="text-white font-semibold">英文翻譯</h3>
          <div>
            <Label htmlFor="titleEn" className="text-white">標題 (English)</Label>
            <Input
              id="titleEn"
              value={formData.titleEn}
              onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-white"
              placeholder="English title"
            />
          </div>
          <div>
            <Label htmlFor="excerptEn" className="text-white">摘要 (English)</Label>
            <Textarea
              id="excerptEn"
              value={formData.excerptEn}
              onChange={(e) => setFormData({ ...formData, excerptEn: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-white"
              placeholder="English excerpt"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="contentEn" className="text-white">內容 (English)</Label>
            <Textarea
              id="contentEn"
              value={formData.contentEn}
              onChange={(e) => setFormData({ ...formData, contentEn: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-white font-mono text-sm"
              placeholder="English content (Markdown)"
              rows={10}
            />
          </div>
        </div>

        {/* Japanese Translation */}
        <div className="space-y-4">
          <h3 className="text-white font-semibold">日文翻譯</h3>
          <div>
            <Label htmlFor="titleJa" className="text-white">標題 (日本語)</Label>
            <Input
              id="titleJa"
              value={formData.titleJa}
              onChange={(e) => setFormData({ ...formData, titleJa: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-white"
              placeholder="日本語タイトル"
            />
          </div>
          <div>
            <Label htmlFor="excerptJa" className="text-white">摘要 (日本語)</Label>
            <Textarea
              id="excerptJa"
              value={formData.excerptJa}
              onChange={(e) => setFormData({ ...formData, excerptJa: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-white"
              placeholder="日本語概要"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="contentJa" className="text-white">內容 (日本語)</Label>
            <Textarea
              id="contentJa"
              value={formData.contentJa}
              onChange={(e) => setFormData({ ...formData, contentJa: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-white font-mono text-sm"
              placeholder="日本語コンテンツ (Markdown)"
              rows={10}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-zinc-700">
          <Button variant="outline" onClick={onCancel} className="border-zinc-700 text-white hover:bg-zinc-800">
            取消
          </Button>
          <BrandButton
            onClick={handleSubmit}
            disabled={updateTranslationMutation.isPending}
          >
            {updateTranslationMutation.isPending ? '保存中...' : '保存翻譯'}
          </BrandButton>
        </div>
      </CardContent>
    </Card>
  );
}
