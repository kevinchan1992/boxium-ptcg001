import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Eye, EyeOff, FileText, Image as ImageIcon, Sparkles } from "lucide-react";

export function AdminBlogManagement() {
  const [activeView, setActiveView] = useState<'list' | 'create' | 'edit' | 'generate'>('list');
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');

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

  const handleDelete = (id: number) => {
    if (confirm('確定要刪除這篇文章嗎？')) {
      deletePostMutation.mutate({ id });
    }
  };

  const handleTogglePublish = (id: number) => {
    togglePublishMutation.mutate({ id });
  };

  const handleEdit = (post: any) => {
    setSelectedPost(post);
    setActiveView('edit');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">博客管理</h2>
          <p className="text-gray-400 mt-1">管理文章、創建內容、AI 自動生成</p>
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
          <Button
            onClick={() => {
              setSelectedPost(null);
              setActiveView('create');
            }}
            className="bg-[#06038d] hover:bg-[#06038d]/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            創建文章
          </Button>
        </div>
      </div>

      {/* List View */}
      {activeView === 'list' && (
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
      )}

      {/* Create/Edit View */}
      {(activeView === 'create' || activeView === 'edit') && (
        <PostEditor
          post={selectedPost}
          categories={categories || []}
          onCancel={() => setActiveView('list')}
          onSuccess={() => {
            setActiveView('list');
            refetch();
          }}
        />
      )}

      {/* AI Generate View */}
      {activeView === 'generate' && (
        <AIArticleGenerator
          categories={categories || []}
          onCancel={() => setActiveView('list')}
          onSuccess={(generatedArticle) => {
            // Fill the editor with generated content
            setSelectedPost({
              title: generatedArticle.title,
              excerpt: generatedArticle.excerpt,
              content: generatedArticle.content,
              featuredImage: generatedArticle.featuredImageUrl || '',
              metaTitle: generatedArticle.seoMetadata.metaTitle,
              metaDescription: generatedArticle.seoMetadata.metaDescription,
              metaKeywords: generatedArticle.seoMetadata.keywords.join(', '),
              dataSource: 'ai-generated',
            });
            setActiveView('create');
          }}
        />
      )}
    </div>
  );
}

// Post Editor Component
function PostEditor({
  post,
  categories,
  onCancel,
  onSuccess,
}: {
  post: any;
  categories: any[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    title: post?.title || '',
    excerpt: post?.excerpt || '',
    content: post?.content || '',
    featuredImage: post?.featuredImage || '',
    categoryId: post?.categoryId || '',
    status: post?.status || 'draft',
    metaTitle: post?.metaTitle || '',
    metaDescription: post?.metaDescription || '',
    metaKeywords: post?.metaKeywords || '',
    tags: post?.tags || '',
  });

  const createPostMutation = trpc.blog.createPost.useMutation({
    onSuccess: () => {
      toast.success('文章已創建');
      onSuccess();
    },
    onError: (error) => {
      toast.error(`創建失敗：${error.message}`);
    },
  });

  const updatePostMutation = trpc.blog.updatePost.useMutation({
    onSuccess: () => {
      toast.success('文章已更新');
      onSuccess();
    },
    onError: (error) => {
      toast.error(`更新失敗：${error.message}`);
    },
  });

  const handleSubmit = () => {
    if (!formData.title || !formData.content) {
      toast.error('請填寫標題和內容');
      return;
    }

    const data = {
      title: formData.title,
      excerpt: formData.excerpt || undefined,
      content: formData.content,
      featuredImage: formData.featuredImage || undefined,
      categoryId: formData.categoryId ? Number(formData.categoryId) : undefined,
      status: formData.status as 'draft' | 'published',
      dataSource: (post?.dataSource || 'manual') as 'manual' | 'ai-generated' | 'mixed',
      metaTitle: formData.metaTitle || undefined,
      metaDescription: formData.metaDescription || undefined,
      metaKeywords: formData.metaKeywords || undefined,
      tags: formData.tags ? formData.tags.split(',').map((t: string) => t.trim()) : undefined,
    };

    if (post) {
      updatePostMutation.mutate({ id: post.id, ...data });
    } else {
      createPostMutation.mutate(data);
    }
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-white">{post ? '編輯文章' : '創建文章'}</CardTitle>
        <CardDescription>填寫文章資訊並發布</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="title" className="text-white">標題 *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="bg-zinc-800 border-zinc-700 text-white"
            placeholder="輸入文章標題..."
          />
        </div>

        <div>
          <Label htmlFor="excerpt" className="text-white">摘要</Label>
          <Textarea
            id="excerpt"
            value={formData.excerpt}
            onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
            className="bg-zinc-800 border-zinc-700 text-white"
            placeholder="輸入文章摘要（150-200字）..."
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="content" className="text-white">內容 * (Markdown)</Label>
          <Textarea
            id="content"
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            className="bg-zinc-800 border-zinc-700 text-white font-mono"
            placeholder="輸入文章內容（支援 Markdown 格式）..."
            rows={15}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="featuredImage" className="text-white">特色圖片 URL</Label>
            <Input
              id="featuredImage"
              value={formData.featuredImage}
              onChange={(e) => setFormData({ ...formData, featuredImage: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-white"
              placeholder="https://..."
            />
          </div>

          <div>
            <Label htmlFor="category" className="text-white">分類</Label>
            <Select value={formData.categoryId} onValueChange={(value) => setFormData({ ...formData, categoryId: value })}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                <SelectValue placeholder="選擇分類" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="tags" className="text-white">標籤（逗號分隔）</Label>
          <Input
            id="tags"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            className="bg-zinc-800 border-zinc-700 text-white"
            placeholder="價格飆升, PSA 10, 投資建議"
          />
        </div>

        <div className="border-t border-zinc-700 pt-4">
          <h3 className="text-white font-semibold mb-4">SEO 設定</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="metaTitle" className="text-white">SEO 標題</Label>
              <Input
                id="metaTitle"
                value={formData.metaTitle}
                onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="SEO 優化標題..."
              />
            </div>
            <div>
              <Label htmlFor="metaDescription" className="text-white">SEO 描述</Label>
              <Textarea
                id="metaDescription"
                value={formData.metaDescription}
                onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="SEO 描述..."
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="metaKeywords" className="text-white">SEO 關鍵字（逗號分隔）</Label>
              <Input
                id="metaKeywords"
                value={formData.metaKeywords}
                onChange={(e) => setFormData({ ...formData, metaKeywords: e.target.value })}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="關鍵字1, 關鍵字2"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-zinc-700">
          <div className="flex items-center gap-2">
            <Label htmlFor="status" className="text-white">狀態：</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger className="w-32 bg-zinc-800 border-zinc-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="published">發布</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} className="border-zinc-700 text-white hover:bg-zinc-800">
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createPostMutation.isPending || updatePostMutation.isPending}
              className="bg-[#06038d] hover:bg-[#06038d]/90"
            >
              {post ? '更新文章' : '創建文章'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
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
  const [inputMethod, setInputMethod] = useState<'image' | 'text' | 'data'>('text');
  const [articleType, setArticleType] = useState<'daily-report' | 'card-analysis' | 'market-trend' | 'news'>('news');
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [textContent, setTextContent] = useState('');
  const [topic, setTopic] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const generateMutation = trpc.blog.generateArticle.useMutation({
    onSuccess: (data) => {
      toast.success('文章生成成功！');
      onSuccess(data);
    },
    onError: (error) => {
      toast.error(`生成失敗：${error.message}`);
    },
  });

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
      // Also set the first uploaded image as featured image
      input.featuredImageUrl = uploadedImageUrls[0];
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
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant={inputMethod === 'image' ? 'default' : 'outline'}
              onClick={() => setInputMethod('image')}
              className={inputMethod === 'image' ? 'bg-purple-600 hover:bg-purple-700' : 'border-zinc-700 text-white hover:bg-zinc-800'}
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              上傳圖片
            </Button>
            <Button
              variant={inputMethod === 'text' ? 'default' : 'outline'}
              onClick={() => setInputMethod('text')}
              className={inputMethod === 'text' ? 'bg-purple-600 hover:bg-purple-700' : 'border-zinc-700 text-white hover:bg-zinc-800'}
            >
              <FileText className="w-4 h-4 mr-2" />
              輸入文字
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
