import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { formatHKDate } from "@/lib/formatDate";
import { Button } from "@/components/ui/button";
import { BrandButton } from "@/components/ui/brand-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus, Trash2, Eye, EyeOff, FileText, Image as ImageIcon,
  Sparkles, Languages, Share2, Facebook, MessageCircle, Link2,
  TrendingUp, PenLine, Globe, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, Check, X, Search, MoreHorizontal,
  ExternalLink, Clock, BarChart3, Tag, FolderOpen
} from "lucide-react";

import { ArticlePreview } from "@/components/ArticlePreview";
import { CardSelectionDialog } from "@/components/CardSelectionDialog";
import { TopicClusterView } from "@/components/TopicClusterView";

// ─── Share Statistics (Collapsible) ─────────────────────────────
function ShareStatisticsCard() {
  const { data: shareStats, isLoading } = trpc.blog.getAllPostsShareStats.useQuery();
  const [isExpanded, setIsExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<'total' | 'facebook' | 'whatsapp' | 'copyLink'>('total');

  const sortedStats = shareStats ? [...shareStats].sort((a, b) => b[sortBy] - a[sortBy]) : [];
  const totalShares = sortedStats.reduce((sum, s) => sum + s.total, 0);

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Share2 className="w-5 h-5 text-[#FEDD00]" />
            <div>
              <CardTitle className="text-white text-base">分享統計</CardTitle>
              <CardDescription className="text-xs">
                總分享 {totalShares} 次 · {sortedStats.length} 篇文章有分享記錄
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isExpanded && totalShares > 0 && (
              <div className="flex gap-3 text-xs text-gray-400 mr-4">
                <span className="flex items-center gap-1"><Facebook className="w-3 h-3 text-blue-400" />{sortedStats.reduce((s, x) => s + x.facebook, 0)}</span>
                <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3 text-green-400" />{sortedStats.reduce((s, x) => s + x.whatsapp, 0)}</span>
                <span className="flex items-center gap-1"><Link2 className="w-3 h-3 text-yellow-400" />{sortedStats.reduce((s, x) => s + x.copyLink, 0)}</span>
              </div>
            )}
            {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          {isLoading ? (
            <div className="text-center py-6 text-gray-400">載入中...</div>
          ) : sortedStats.length > 0 ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-zinc-800 p-3 rounded-lg border border-zinc-700">
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1"><TrendingUp className="w-3.5 h-3.5" />總分享</div>
                  <div className="text-xl font-bold text-white">{totalShares}</div>
                </div>
                <div className="bg-zinc-800 p-3 rounded-lg border border-blue-800/30">
                  <div className="flex items-center gap-1.5 text-blue-400 text-xs mb-1"><Facebook className="w-3.5 h-3.5" />Facebook</div>
                  <div className="text-xl font-bold text-white">{sortedStats.reduce((s, x) => s + x.facebook, 0)}</div>
                </div>
                <div className="bg-zinc-800 p-3 rounded-lg border border-green-800/30">
                  <div className="flex items-center gap-1.5 text-green-400 text-xs mb-1"><MessageCircle className="w-3.5 h-3.5" />WhatsApp</div>
                  <div className="text-xl font-bold text-white">{sortedStats.reduce((s, x) => s + x.whatsapp, 0)}</div>
                </div>
                <div className="bg-zinc-800 p-3 rounded-lg border border-yellow-800/30">
                  <div className="flex items-center gap-1.5 text-yellow-400 text-xs mb-1"><Link2 className="w-3.5 h-3.5" />複製連結</div>
                  <div className="text-xl font-bold text-white">{sortedStats.reduce((s, x) => s + x.copyLink, 0)}</div>
                </div>
              </div>

              {/* Sort */}
              <div className="flex justify-end">
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="w-36 bg-zinc-800 border-zinc-700 text-white text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">按總分享排序</SelectItem>
                    <SelectItem value="facebook">按 Facebook</SelectItem>
                    <SelectItem value="whatsapp">按 WhatsApp</SelectItem>
                    <SelectItem value="copyLink">按複製連結</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#FEDD00] text-[#06038d]">
                      <th className="px-3 py-2 text-left font-semibold">#</th>
                      <th className="px-3 py-2 text-left font-semibold">文章標題</th>
                      <th className="px-3 py-2 text-center font-semibold">總計</th>
                      <th className="px-3 py-2 text-center font-semibold"><Facebook className="w-3.5 h-3.5 inline" /></th>
                      <th className="px-3 py-2 text-center font-semibold"><MessageCircle className="w-3.5 h-3.5 inline" /></th>
                      <th className="px-3 py-2 text-center font-semibold"><Link2 className="w-3.5 h-3.5 inline" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStats.slice(0, 10).map((stat, i) => (
                      <tr key={stat.postId} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                        <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                        <td className="px-3 py-2 text-white">
                          <a href={`/blog/${stat.slug}`} target="_blank" rel="noopener noreferrer" className="hover:text-[#FEDD00] transition-colors line-clamp-1">
                            {stat.title}
                          </a>
                        </td>
                        <td className="px-3 py-2 text-center"><Badge className="bg-[#FEDD00] text-[#06038d] hover:bg-[#FEDD00]/90">{stat.total}</Badge></td>
                        <td className="px-3 py-2 text-center text-blue-400">{stat.facebook}</td>
                        <td className="px-3 py-2 text-center text-green-400">{stat.whatsapp}</td>
                        <td className="px-3 py-2 text-center text-yellow-400">{stat.copyLink}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <Share2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">還沒有分享數據</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export function AdminBlogManagement() {
  const [activeView, setActiveView] = useState<'list' | 'cluster' | 'generate' | 'preview' | 'edit-translation'>('list');
  const [previewArticle, setPreviewArticle] = useState<any>(null);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [initialBrief, setInitialBrief] = useState<{ topic?: string; outline?: string[]; titleOptions?: string[] } | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedPostIds, setSelectedPostIds] = useState<number[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Queries
  const { data: posts, isLoading, refetch } = trpc.blog.getPosts.useQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: searchQuery || undefined,
    sortBy: 'newest',
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
  });
  const { data: categories } = trpc.blog.getCategories.useQuery();

  const totalPages = posts ? Math.ceil(posts.total / pageSize) : 1;

  // Mutations
  const deletePostMutation = trpc.blog.deletePost.useMutation({
    onSuccess: () => { toast.success('文章已刪除'); refetch(); },
    onError: (e) => toast.error(`刪除失敗：${e.message}`),
  });
  const togglePublishMutation = trpc.blog.togglePublish.useMutation({
    onSuccess: () => { toast.success('狀態已更新'); refetch(); },
    onError: (e) => toast.error(`更新失敗：${e.message}`),
  });
  const translatePostMutation = trpc.blog.translatePost.useMutation({
    onSuccess: (data) => {
      toast.success(`AI 翻譯完成！\n英文：${data.translations.en.title}\n日文：${data.translations.ja.title}`);
      refetch();
    },
    onError: (e) => toast.error(`AI 翻譯失敗：${e.message}`),
  });
  const createPostMutation = trpc.blog.createPost.useMutation({
    onSuccess: () => { toast.success('文章發布成功！'); refetch(); },
    onError: (e) => toast.error(`發布失敗：${e.message}`),
  });
  const updatePostMutation = trpc.blog.updatePost.useMutation({
    onSuccess: () => { toast.success('文章更新成功！'); refetch(); },
    onError: (e) => toast.error(`更新失敗：${e.message}`),
  });

  // Handlers
  const handleDelete = (id: number) => {
    if (confirm('確定要刪除這篇文章嗎？此操作無法復原！')) deletePostMutation.mutate({ id });
  };
  const handleTogglePublish = (id: number) => togglePublishMutation.mutate({ id });
  const handleTranslate = (id: number) => {
    toast.info('AI 翻譯中，請稍候...');
    translatePostMutation.mutate({ id });
  };
  const handleEdit = (post: any) => {
    setPreviewArticle({
      id: post.id,
      title: post.title,
      excerpt: post.excerpt || '',
      content: post.content,
      featuredImage: post.featuredImage,
      tags: post.tags,
      categoryId: post.categoryId,
      status: post.status,
      slug: post.slug,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      seoKeywords: post.seoKeywords,
    });
    setActiveView('preview');
  };
  const handlePreview = (post: any) => handleEdit(post);
  const handleTranslationEdit = (post: any) => {
    setSelectedPost(post);
    setActiveView('edit-translation');
  };

  const handleAISuccess = (article: any) => {
    setPreviewArticle(article);
    setActiveView('preview');
  };

  const handleSaveArticle = async (article: any) => {
    if (article.id) {
      await updatePostMutation.mutateAsync({
        id: article.id,
        title: article.title,
        excerpt: article.excerpt,
        content: article.content,
        featuredImage: article.featuredImage,
        tags: article.tags,
        categoryId: article.categoryId,
        status: article.status,
        metaTitle: article.seoTitle,
        metaDescription: article.seoDescription,
        metaKeywords: article.seoKeywords,
      });
    } else {
      await createPostMutation.mutateAsync({
        title: article.title,
        excerpt: article.excerpt,
        content: article.content,
        featuredImage: article.featuredImage,
        tags: article.tags,
        categoryId: article.categoryId,
        status: article.status || 'draft',
        dataSource: 'ai-generated' as const,
        metaTitle: article.seoTitle,
        metaDescription: article.seoDescription,
        metaKeywords: article.seoKeywords,
      });
    }
    setActiveView('list');
    refetch();
  };

  const filteredPosts = useMemo(() => {
    if (!posts?.posts) return [];
    if (categoryFilter === 'all') return posts.posts;
    return posts.posts.filter((p: any) => String(p.categoryId) === categoryFilter);
  }, [posts, categoryFilter]);

  const toggleSelectPost = (id: number) => {
    setSelectedPostIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Listen for brief-to-write events from ContentWorkflowCenter
  useEffect(() => {
    const handler = (e: Event) => {
      const brief = (e as CustomEvent).detail;
      setInitialBrief(brief);
      setActiveView('generate');
    };
    window.addEventListener('brief-to-write', handler);
    return () => window.removeEventListener('brief-to-write', handler);
  }, []);
  if (activeView === 'generate') {
    return (
      <AIArticleGenerator
        categories={categories || []}
        onCancel={() => { setActiveView('list'); setInitialBrief(undefined); }}
        onSuccess={(article) => { setInitialBrief(undefined); handleAISuccess(article); }}
        initialBrief={initialBrief}
      />
    );
  }

  if (activeView === 'preview' && previewArticle) {
    return (
      <ArticlePreview
        article={previewArticle}
        onPublish={handleSaveArticle}
        onEdit={() => {}}
        onCancel={() => setActiveView('list')}
        initialEditMode={!previewArticle.id}
      />
    );
  }

  if (activeView === 'edit-translation' && selectedPost) {
    return (
      <TranslationEditor
        post={selectedPost}
        onCancel={() => setActiveView('list')}
        onSuccess={() => { setActiveView('list'); refetch(); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <ShareStatisticsCard />

      {/* Header */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-white">文章管理</CardTitle>
              <CardDescription>共 {posts?.total || 0} 篇文章</CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => setActiveView(activeView === 'cluster' ? 'list' : 'cluster')}
                variant="outline"
                className={`border-zinc-600 text-sm ${activeView === 'cluster' ? 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700' : 'text-gray-300 hover:bg-zinc-700'}`}
                size="sm"
              >
                <FolderOpen className="w-4 h-4 mr-1.5" />
                集群視圖
              </Button>
              <Button
                onClick={() => setActiveView('generate')}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                size="sm"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                AI 內容工廠
              </Button>
              <Button
                onClick={() => { setPreviewArticle(null); setActiveView('preview'); }}
                className="bg-[#FEDD00] hover:bg-[#FEDD00]/90 text-[#06038d] font-semibold"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                新增文章
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Cluster View */}
          {activeView === 'cluster' && (
            <div className="mb-4">
              <TopicClusterView
                onArticleClick={(id) => {
                  const post = posts?.posts?.find((p: any) => p.id === id);
                  if (post) handleEdit(post);
                }}
              />
            </div>
          )}

          {/* Filters - only show in list mode */}
          {activeView !== 'cluster' && (
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜尋文章標題..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="bg-zinc-800 border-zinc-700 text-white pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: any) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-32 bg-zinc-800 border-zinc-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="published">已發布</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-36 bg-zinc-800 border-zinc-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分類</SelectItem>
                {(categories || []).map((cat: any) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}

          {/* Post List - only show in list mode */}
          {activeView !== 'cluster' && isLoading ? (
            <div className="text-center py-12 text-gray-400">載入中...</div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>沒有找到文章</p>
              <Button onClick={() => setActiveView('generate')} className="mt-4 bg-purple-600 hover:bg-purple-700" size="sm">
                <Sparkles className="w-4 h-4 mr-1.5" /> 用 AI 生成第一篇文章
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPosts.map((post: any) => (
                <div
                  key={post.id}
                  className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg border border-zinc-700 hover:border-zinc-500 transition-colors group cursor-pointer"
                  onClick={(e) => {
                    // Only trigger if not clicking a button
                    if ((e.target as HTMLElement).closest('button')) return;
                    handleEdit(post);
                  }}
                >
                  {isSelectMode && (
                    <input type="checkbox" checked={selectedPostIds.includes(post.id)}
                      onChange={() => toggleSelectPost(post.id)}
                      className="w-4 h-4 accent-[#FEDD00]"
                      onClick={(e) => e.stopPropagation()} />
                  )}
                  {post.featuredImage && (
                    <img src={post.featuredImage} alt="" className="w-12 h-12 object-cover rounded-lg flex-shrink-0 hidden sm:block" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge className={post.status === 'published' ? 'bg-green-600 text-white text-[10px] px-1.5 py-0' : 'bg-zinc-600 text-gray-300 text-[10px] px-1.5 py-0'}>
                        {post.status === 'published' ? '已發布' : '草稿'}
                      </Badge>
                      {post.category && (
                        <Badge className="bg-zinc-700 text-gray-300 text-[10px] px-1.5 py-0">{post.category.name}</Badge>
                      )}
                    </div>
                    <p className="text-white text-sm font-medium line-clamp-1">{post.title}</p>
                    <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-2 flex-wrap">
                      <Clock className="w-3 h-3" />
                      {formatHKDate(post.publishedAt || post.createdAt)}
                      {post.viewCount > 0 && <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.viewCount}</span>}
                      {post.status === 'published' && (() => {
                        const daysSince = Math.floor((Date.now() - new Date(post.updatedAt || post.publishedAt || post.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                        if (daysSince >= 90) return <span className="inline-flex items-center gap-0.5 text-[10px] bg-red-900/40 text-red-300 border border-red-700/30 px-1.5 py-0.5 rounded">⚠ 需刷新 {daysSince}天</span>;
                        if (daysSince >= 30) return <span className="inline-flex items-center gap-0.5 text-[10px] bg-yellow-900/40 text-yellow-300 border border-yellow-700/30 px-1.5 py-0.5 rounded">↻ 建議更新</span>;
                        return null;
                      })()}
                    </p>
                  </div>
                  {/* Action buttons — always visible (not hover-only) for touch devices */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleEdit(post); }}
                      className="h-7 px-2 border-zinc-600 text-gray-300 hover:bg-zinc-700 text-xs">
                      <PenLine className="w-3 h-3 sm:mr-1" /><span className="hidden sm:inline">編輯</span>
                    </Button>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleTogglePublish(post.id); }}
                      className="h-7 px-2 border-zinc-600 text-gray-300 hover:bg-zinc-700 text-xs">
                      {post.status === 'published' ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleTranslate(post.id); }}
                      className="h-7 px-2 border-zinc-600 text-gray-300 hover:bg-zinc-700 text-xs hidden sm:flex"
                      disabled={translatePostMutation.isPending}>
                      <Globe className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }}
                      className="h-7 px-2 text-xs">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1} className="border-zinc-700 text-white hover:bg-zinc-800">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-gray-400 text-sm">{currentPage} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages} className="border-zinc-700 text-white hover:bg-zinc-800">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Workflow Step Indicator ─────────────────────────────────────
function WorkflowStepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { id: 1, label: '輸入素材', icon: FileText },
    { id: 2, label: '內容策略', icon: TrendingUp },
    { id: 3, label: '文章大綱', icon: BarChart3 },
    { id: 4, label: '生成全文', icon: Sparkles },
    { id: 5, label: 'AI 校對', icon: Check },
  ];
  return (
    <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center gap-1 flex-shrink-0">
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
            currentStep === step.id
              ? 'bg-purple-600 text-white'
              : currentStep > step.id
              ? 'bg-green-600/20 text-green-400 border border-green-600/30'
              : 'bg-zinc-800 text-gray-500'
          }`}>
            {currentStep > step.id ? (
              <Check className="w-3 h-3" />
            ) : (
              <step.icon className="w-3 h-3" />
            )}
            <span className="hidden sm:inline">{step.label}</span>
            <span className="sm:hidden">{step.id}</span>
          </div>
          {i < steps.length - 1 && (
            <ChevronRight className={`w-3 h-3 flex-shrink-0 ${currentStep > step.id ? 'text-green-500' : 'text-zinc-600'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

/// ─── AI Article Generator (Multi-Step Workflow) ──────────────────
function AIArticleGenerator({
  categories, onCancel, onSuccess, initialBrief,
}: {
  categories: any[];
  onCancel: () => void;
  onSuccess: (article: any) => void;
  initialBrief?: { topic?: string; outline?: string[]; titleOptions?: string[] };
}) {
  // ── Workflow State ──
  const [workflowStep, setWorkflowStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [strategy, setStrategy] = useState<any>(null);
  const [outline, setOutline] = useState<any>(null);
  const [generatedArticle, setGeneratedArticle] = useState<any>(null);
  const [proofreadResult, setProofreadResult] = useState<any>(null);
  const [selectedTitleIndex, setSelectedTitleIndex] = useState(0);
  // ── Step 1: Input State ──
  const [inputMethod, setInputMethod] = useState<'topic' | 'url' | 'image' | 'text'>('topic');
  const [articleType, setArticleType] = useState<string>('card-analysis');
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  // Pre-fill from research brief if provided
  const briefOutlineText = initialBrief?.outline?.map((s, i) => `${i + 1}. ${s}`).join('\n') || '';
  const [textContent, setTextContent] = useState(briefOutlineText ? `【來自研究 Brief 的大綱】\n${briefOutlineText}` : '');
  const [urlInput, setUrlInput] = useState('');
  const [topic, setTopic] = useState(initialBrief?.topic || '');
  const [targetAudience, setTargetAudience] = useState('香港及台灣 TCG 玩家和收藏家');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [targetLanguage, setTargetLanguage] = useState<'zh-TW' | 'en' | 'ja'>('zh-TW');
  const [isUploading, setIsUploading] = useState(false);
  const [cardSelectionDialogOpen, setCardSelectionDialogOpen] = useState(false);

  const handleCardDataInsert = (cardData: string) => {
    setTextContent(prev => prev ? prev + '\n\n' + cardData : cardData);
  };

  // ── Mutations ──
  const strategyMutation = trpc.blogAi.generateStrategy.useMutation({
    onSuccess: (data) => { setStrategy(data); setWorkflowStep(2); toast.success('內容策略已生成！'); },
    onError: (e) => toast.error(`策略生成失敗：${e.message}`),
  });
  const outlineMutation = trpc.blogAi.generateOutline.useMutation({
    onSuccess: (data) => { setOutline(data); setWorkflowStep(3); toast.success('文章大綱已生成！'); },
    onError: (e) => toast.error(`大綱生成失敗：${e.message}`),
  });
  const generateMutation = trpc.blog.generateArticle.useMutation({
    onSuccess: (data) => { setGeneratedArticle(data); setWorkflowStep(4); toast.success('文章生成成功！'); },
    onError: (e) => toast.error(`生成失敗：${e.message}`),
  });
  const proofreadMutation = trpc.blogAi.proofreadArticle.useMutation({
    onSuccess: (data) => { setProofreadResult(data); setWorkflowStep(5); toast.success('校對完成！'); },
    onError: (e) => toast.error(`校對失敗：${e.message}`),
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of files) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newUrls.push(base64);
      }
      setUploadedImages([...uploadedImages, ...files]);
      setUploadedImageUrls([...uploadedImageUrls, ...newUrls]);
      toast.success(`已添加 ${files.length} 張圖片`);
    } catch { toast.error('圖片上傳失敗'); }
    finally { setIsUploading(false); }
  };
  const removeImage = (index: number) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== index));
    setUploadedImageUrls(uploadedImageUrls.filter((_, i) => i !== index));
  };

  // ── Step 1 → 2: Generate Strategy ──
  const handleGenerateStrategy = () => {
    if (inputMethod === 'topic' && !topic) { toast.error('請輸入文章主題'); return; }
    if (inputMethod === 'url' && !urlInput) { toast.error('請輸入網址'); return; }
    if (inputMethod === 'image' && uploadedImageUrls.length === 0) { toast.error('請上傳至少一張圖片'); return; }
    if (inputMethod === 'text' && !textContent) { toast.error('請輸入文字內容'); return; }
    const topicText = inputMethod === 'topic' ? topic
      : inputMethod === 'url' ? `分析網址：${urlInput}`
      : inputMethod === 'text' ? (topic || textContent.substring(0, 200))
      : '圖片素材分析';
    strategyMutation.mutate({ topic: topicText, targetAudience, seoKeywords, language: targetLanguage });
  };

  // ── Step 2 → 3: Generate Outline ──
  const handleGenerateOutline = () => {
    if (!strategy) return;
    const selectedTitle = strategy.titleOptions?.[selectedTitleIndex] || strategy.titleOptions?.[0] || topic;
    outlineMutation.mutate({
      title: selectedTitle,
      articleType: strategy.articleType || articleType,
      contentAngle: strategy.contentAngle,
      keyPoints: strategy.keyPoints,
      targetAudience: strategy.targetAudience,
      estimatedLength: strategy.estimatedLength,
    });
  };

  // ── Step 3 → 4: Generate Full Article ──
  const handleGenerateArticle = () => {
    const input: any = { articleType };
    if (inputMethod === 'url') {
      input.urlInput = { url: urlInput, targetLanguage };
    } else if (inputMethod === 'image') {
      input.imageInput = { imageUrls: uploadedImageUrls };
      if (uploadedImageUrls.length > 0) input.featuredImageUrl = uploadedImageUrls[0];
    } else {
      const outlineText = outline ? `文章標題：${outline.h1}\n文章大綱：\n${outline.sections?.map((s: any, i: number) =>
        `${i+1}. ## ${s.h2}\n   說明：${s.description}${s.subsections?.map((sub: any) => `\n   - ### ${sub.h3}：${sub.description}`).join('') || ''}`
      ).join('\n')}\nFAQ：${outline.faq?.map((f: any) => `Q: ${f.question}`).join('、')}\n結語：${outline.cta}` : topic;
      const dataContent = inputMethod === 'text' ? textContent : '';
      input.textInput = {
        content: dataContent ? `${outlineText}\n\n參考資料：\n${dataContent}` : outlineText,
        topic: outline?.h1 || topic
      };
    }
    generateMutation.mutate(input);
  };

  // ── Step 4 → 5: Proofread ──
  const handleProofread = () => {
    if (!generatedArticle) return;
    proofreadMutation.mutate({
      title: generatedArticle.title,
      excerpt: generatedArticle.excerpt || '',
      content: generatedArticle.content,
      seoKeywords,
    });
  };

  const handleAccept = () => {
    if (generatedArticle) onSuccess(generatedArticle);
  };

  const isAnyLoading = strategyMutation.isPending || outlineMutation.isPending || generateMutation.isPending || proofreadMutation.isPending;

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            AI 內容工廠
          </CardTitle>
          <Button variant="outline" onClick={onCancel} className="border-zinc-700 text-white hover:bg-zinc-800" size="sm">
            <ChevronLeft className="w-4 h-4 mr-1" /> 返回
          </Button>
        </div>
        <CardDescription>專業 AI 內容運營系統：策略 → 大綱 → 生成 → 校對</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <WorkflowStepIndicator currentStep={workflowStep} />

        {/* ── STEP 1: 輸入素材 ── */}
        {workflowStep === 1 && (
          <div className="space-y-4">
            <div className="p-3 bg-purple-900/20 border border-purple-700/30 rounded-lg">
              <p className="text-purple-300 text-xs font-medium mb-1">📋 步驟 1：提供素材</p>
              <p className="text-gray-400 text-xs">選擇輸入方式，提供文章主題或參考資料。AI 將分析並制定內容策略。</p>
            </div>

            {/* Input Mode Tabs */}
            <div>
              <Label className="text-white mb-2 block text-sm">輸入方式</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { key: 'topic' as const, icon: PenLine, label: '主題' },
                  { key: 'url' as const, icon: ExternalLink, label: '網址' },
                  { key: 'image' as const, icon: ImageIcon, label: '圖片' },
                  { key: 'text' as const, icon: FileText, label: '文字' },
                ].map(({ key, icon: Icon, label }) => (
                  <Button key={key} variant={inputMethod === key ? 'default' : 'outline'}
                    onClick={() => setInputMethod(key)}
                    className={inputMethod === key ? 'bg-purple-600 hover:bg-purple-700' : 'border-zinc-700 text-white hover:bg-zinc-800'}
                    size="sm">
                    <Icon className="w-3.5 h-3.5 mr-1" />{label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Article Type */}
            <div>
              <Label className="text-white text-sm">文章類型</Label>
              <Select value={articleType} onValueChange={setArticleType}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="news">📰 新聞快訊</SelectItem>
                  <SelectItem value="daily-report">📊 每日市場快報</SelectItem>
                  <SelectItem value="card-analysis">🔬 卡牌深度研究</SelectItem>
                  <SelectItem value="market-trend">📈 市場趨勢報告</SelectItem>
                  <SelectItem value="collection-guide">📚 收藏指南</SelectItem>
                  <SelectItem value="price-tracking">💰 價格追蹤報告</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Topic Input */}
            {inputMethod === 'topic' && (
              <div>
                <Label className="text-white text-sm">文章主題 <span className="text-red-400">*</span></Label>
                <Input value={topic} onChange={(e) => setTopic(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white mt-1"
                  placeholder="例如：Charizard PSA 10 近期市場分析、2024 年最值得收藏的 Pokemon 卡牌" />
              </div>
            )}

            {/* URL Input */}
            {inputMethod === 'url' && (
              <div className="space-y-3">
                <div>
                  <Label className="text-white text-sm">參考網址</Label>
                  <Input placeholder="https://example.com/article" value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white mt-1" />
                  <p className="text-xs text-gray-500 mt-1">支援日文/英文/中文網站，AI 將自動抓取並分析內容</p>
                </div>
                <div>
                  <Label className="text-white text-sm">目標語言</Label>
                  <Select value={targetLanguage} onValueChange={(v) => setTargetLanguage(v as 'zh-TW' | 'en' | 'ja')}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1"><SelectValue /></SelectTrigger>
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
              <div className="space-y-3">
                <div>
                  <Label className="text-white mb-2 block text-sm">上傳圖片</Label>
                  <div className="border-2 border-dashed border-zinc-700 rounded-lg p-5 text-center hover:border-purple-500 transition-colors">
                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" id="image-upload" disabled={isUploading} />
                    <label htmlFor="image-upload" className="cursor-pointer">
                      <ImageIcon className="w-10 h-10 mx-auto mb-3 text-gray-500" />
                      <p className="text-white text-sm mb-1">點擊上傳圖片</p>
                      <p className="text-xs text-gray-500">支援 JPG、PNG、WEBP 格式</p>
                    </label>
                  </div>
                </div>
                {uploadedImageUrls.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {uploadedImageUrls.map((url, i) => (
                      <div key={i} className="relative group">
                        <img src={url} alt="" className="w-full h-20 object-cover rounded-lg border border-zinc-700" />
                        {i === 0 && <Badge className="absolute top-1 left-1 bg-purple-600 text-[10px]">主題圖</Badge>}
                        <Button size="sm" variant="destructive" onClick={() => removeImage(i)}
                          className="absolute top-1 right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100">
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Text Input */}
            {inputMethod === 'text' && (
              <div className="space-y-3">
                <div>
                  <Label className="text-white text-sm">主題（選填）</Label>
                  <Input value={topic} onChange={(e) => setTopic(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white mt-1"
                    placeholder="例如：Pikachu 價格飆升、市場動態等" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-white text-sm">參考資料 / 數據</Label>
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => setCardSelectionDialogOpen(true)}
                      className="h-7 text-xs border-[#FEDD00] text-[#FEDD00] hover:bg-[#FEDD00]/10">
                      🎴 插入卡牌資料
                    </Button>
                  </div>
                  <Textarea value={textContent} onChange={(e) => setTextContent(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder={`輸入參考資料或數據...\n\n例如：\n- Charizard PSA 10 今日成交：HKD 45,000\n- 過去 30 天均價：HKD 38,500\n- 交易量：+45%\n\n提示：點擊「插入卡牌資料」可從資料庫選擇卡牌並插入真實價格資料`}
                    rows={8} />
                </div>
              </div>
            )}

            {/* Strategy Options */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white text-xs">目標讀者</Label>
                <Input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white mt-1 text-xs" />
              </div>
              <div>
                <Label className="text-white text-xs">SEO 關鍵字（選填）</Label>
                <Input value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white mt-1 text-xs"
                  placeholder="PSA 10, 卡牌市場, 香港 PTCG" />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-700">
              <Button onClick={handleGenerateStrategy} disabled={strategyMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                <TrendingUp className="w-4 h-4 mr-1.5" />
                {strategyMutation.isPending ? '分析中...' : '生成內容策略 →'}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: 內容策略 ── */}
        {workflowStep === 2 && strategy && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
              <p className="text-blue-300 text-xs font-medium mb-1">🎯 步驟 2：確認內容策略</p>
              <p className="text-gray-400 text-xs">AI 已分析你的主題並制定策略。選擇最合適的標題，然後生成大綱。</p>
            </div>

            {/* Search Intent */}
            <div className="p-3 bg-zinc-800 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">搜尋意圖分析</p>
              <p className="text-white text-sm">{strategy.searchIntent}</p>
            </div>

            {/* Title Options */}
            <div>
              <Label className="text-white text-sm mb-2 block">選擇標題方案</Label>
              <div className="space-y-2">
                {strategy.titleOptions?.map((title: string, i: number) => (
                  <button key={i} onClick={() => setSelectedTitleIndex(i)}
                    className={`w-full text-left p-3 rounded-lg border text-sm transition-all ${
                      selectedTitleIndex === i
                        ? 'border-purple-500 bg-purple-900/20 text-white'
                        : 'border-zinc-700 bg-zinc-800 text-gray-300 hover:border-zinc-500'
                    }`}>
                    <span className={`inline-block w-5 h-5 rounded-full text-xs text-center leading-5 mr-2 ${
                      selectedTitleIndex === i ? 'bg-purple-600 text-white' : 'bg-zinc-700 text-gray-400'
                    }`}>{i + 1}</span>
                    {title}
                  </button>
                ))}
              </div>
            </div>

            {/* Strategy Details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-zinc-800 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">內容切入角度</p>
                <p className="text-white text-xs">{strategy.contentAngle}</p>
              </div>
              <div className="p-3 bg-zinc-800 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">內容集群</p>
                <p className="text-white text-xs">{strategy.contentCluster}</p>
              </div>
            </div>

            {strategy.keyPoints?.length > 0 && (
              <div className="p-3 bg-zinc-800 rounded-lg">
                <p className="text-xs text-gray-400 mb-2">必須涵蓋重點</p>
                <div className="flex flex-wrap gap-1.5">
                  {strategy.keyPoints.map((point: string, i: number) => (
                    <Badge key={i} className="bg-zinc-700 text-gray-200 text-xs">{point}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-zinc-700">
              <Button variant="outline" onClick={() => setWorkflowStep(1)}
                className="border-zinc-700 text-white hover:bg-zinc-800" size="sm">
                <ChevronLeft className="w-4 h-4 mr-1" /> 返回
              </Button>
              <Button onClick={handleGenerateOutline} disabled={outlineMutation.isPending}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                <BarChart3 className="w-4 h-4 mr-1.5" />
                {outlineMutation.isPending ? '生成大綱中...' : '生成文章大綱 →'}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: 文章大綱 ── */}
        {workflowStep === 3 && outline && (
          <div className="space-y-4">
            <div className="p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
              <p className="text-green-300 text-xs font-medium mb-1">📋 步驟 3：確認文章大綱</p>
              <p className="text-gray-400 text-xs">AI 已生成結構化大綱。確認無誤後，AI 將按大綱生成完整文章。</p>
            </div>

            {/* Title */}
            <div className="p-3 bg-zinc-800 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">文章標題</p>
              <p className="text-white font-semibold">{outline.h1}</p>
              <p className="text-xs text-gray-500 mt-1">預估字數：{outline.estimatedWordCount}</p>
            </div>

            {/* Sections */}
            <div className="space-y-2">
              {outline.sections?.map((section: any, i: number) => (
                <div key={i} className="p-3 bg-zinc-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400 text-xs font-mono mt-0.5">H2</span>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{section.h2}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{section.description}</p>
                      {section.hasImage && (
                        <Badge className="mt-1 bg-blue-900/40 text-blue-300 text-[10px] border border-blue-700/30">
                          📷 {section.imageNote || '建議插圖'}
                        </Badge>
                      )}
                      {section.subsections?.map((sub: any, j: number) => (
                        <div key={j} className="mt-2 ml-3 pl-3 border-l border-zinc-600">
                          <p className="text-gray-300 text-xs font-medium">{sub.h3}</p>
                          <p className="text-gray-500 text-xs">{sub.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* FAQ Preview */}
            {outline.faq?.length > 0 && (
              <div className="p-3 bg-zinc-800 rounded-lg">
                <p className="text-xs text-gray-400 mb-2">FAQ（{outline.faq.length} 個問題）</p>
                {outline.faq.map((f: any, i: number) => (
                  <p key={i} className="text-gray-300 text-xs mb-1">Q{i+1}: {f.question}</p>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-zinc-700">
              <Button variant="outline" onClick={() => setWorkflowStep(2)}
                className="border-zinc-700 text-white hover:bg-zinc-800" size="sm">
                <ChevronLeft className="w-4 h-4 mr-1" /> 返回
              </Button>
              <Button onClick={handleGenerateArticle} disabled={generateMutation.isPending}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                <Sparkles className="w-4 h-4 mr-1.5" />
                {generateMutation.isPending ? '生成全文中...' : '按大綱生成全文 →'}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: 生成全文 ── */}
        {workflowStep === 4 && generatedArticle && (
          <div className="space-y-4">
            <div className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
              <p className="text-yellow-300 text-xs font-medium mb-1">✍️ 步驟 4：文章已生成</p>
              <p className="text-gray-400 text-xs">文章已按大綱生成完成。建議進行 AI 校對，或直接接受並進入編輯器。</p>
            </div>

            {/* Article Preview */}
            <div className="p-4 bg-zinc-800 rounded-lg space-y-2">
              <p className="text-xs text-gray-400">標題</p>
              <p className="text-white font-semibold">{generatedArticle.title}</p>
              {generatedArticle.excerpt && (
                <>
                  <p className="text-xs text-gray-400 mt-2">摘要</p>
                  <p className="text-gray-300 text-sm">{generatedArticle.excerpt}</p>
                </>
              )}
              <p className="text-xs text-gray-400 mt-2">內容預覽</p>
              <p className="text-gray-300 text-xs line-clamp-6 font-mono">{generatedArticle.content?.substring(0, 400)}...</p>
              <p className="text-xs text-gray-500">約 {generatedArticle.content?.length || 0} 字元</p>
            </div>

            <div className="flex justify-between pt-2 border-t border-zinc-700">
              <Button variant="outline" onClick={() => setWorkflowStep(3)}
                className="border-zinc-700 text-white hover:bg-zinc-800" size="sm">
                <ChevronLeft className="w-4 h-4 mr-1" /> 返回
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleProofread} disabled={proofreadMutation.isPending}
                  className="border-yellow-600 text-yellow-400 hover:bg-yellow-900/20" size="sm">
                  <Check className="w-4 h-4 mr-1" />
                  {proofreadMutation.isPending ? 'AI 校對中...' : 'AI 校對'}
                </Button>
                <Button onClick={handleAccept}
                  className="bg-gradient-to-r from-[#FEDD00] to-yellow-500 hover:from-yellow-400 hover:to-yellow-600 text-black font-semibold">
                  <PenLine className="w-4 h-4 mr-1.5" /> 接受並編輯
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 5: AI 校對結果 ── */}
        {workflowStep === 5 && proofreadResult && (
          <div className="space-y-4">
            <div className="p-3 bg-zinc-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-semibold text-sm">整體評分：{proofreadResult.overallScore}</p>
                <div className="flex gap-2 text-xs">
                  <Badge className={`${
                    proofreadResult.aiDetectionRisk === '低' ? 'bg-green-900/40 text-green-300 border-green-700/30'
                    : proofreadResult.aiDetectionRisk === '中' ? 'bg-yellow-900/40 text-yellow-300 border-yellow-700/30'
                    : 'bg-red-900/40 text-red-300 border-red-700/30'
                  } border`}>AI 痕跡：{proofreadResult.aiDetectionRisk}</Badge>
                  <Badge className="bg-zinc-700 text-gray-200 border-zinc-600 border">可讀性：{proofreadResult.readabilityScore}/10</Badge>
                </div>
              </div>
              <p className="text-gray-300 text-xs">{proofreadResult.overallComment}</p>
            </div>

            {/* Quick Fixes */}
            {proofreadResult.quickFixes?.length > 0 && (
              <div className="p-3 bg-orange-900/20 border border-orange-700/30 rounded-lg">
                <p className="text-orange-300 text-xs font-medium mb-2">⚡ 快速修改建議</p>
                <ul className="space-y-1">
                  {proofreadResult.quickFixes.map((fix: string, i: number) => (
                    <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5">
                      <span className="text-orange-400 mt-0.5">•</span>{fix}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Issues */}
            {proofreadResult.issues?.length > 0 && (
              <div className="space-y-2">
                <p className="text-white text-sm font-medium">發現 {proofreadResult.issues.length} 個問題</p>
                {proofreadResult.issues.slice(0, 5).map((issue: any, i: number) => (
                  <div key={i} className={`p-3 rounded-lg border ${
                    issue.severity === '高' ? 'bg-red-900/20 border-red-700/30'
                    : issue.severity === '中' ? 'bg-yellow-900/20 border-yellow-700/30'
                    : 'bg-zinc-800 border-zinc-700'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-[10px] ${
                        issue.severity === '高' ? 'bg-red-600' : issue.severity === '中' ? 'bg-yellow-600' : 'bg-zinc-600'
                      }`}>{issue.severity}</Badge>
                      <span className="text-gray-400 text-xs">{issue.category}</span>
                      <span className="text-gray-500 text-xs">@ {issue.location}</span>
                    </div>
                    <p className="text-gray-300 text-xs">{issue.description}</p>
                    <p className="text-blue-300 text-xs mt-1">💡 {issue.suggestion}</p>
                  </div>
                ))}
              </div>
            )}

            {/* SEO Analysis */}
            {proofreadResult.seoAnalysis && (
              <div className="p-3 bg-zinc-800 rounded-lg">
                <p className="text-xs text-gray-400 mb-2">SEO 分析</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="text-center p-2 bg-zinc-700 rounded">
                    <p className="text-white font-semibold">{proofreadResult.seoAnalysis.titleScore}/10</p>
                    <p className="text-xs text-gray-400">標題評分</p>
                  </div>
                  <div className="text-center p-2 bg-zinc-700 rounded">
                    <p className="text-white font-semibold">{proofreadResult.seoAnalysis.excerptScore}/10</p>
                    <p className="text-xs text-gray-400">摘要評分</p>
                  </div>
                </div>
                <p className="text-gray-400 text-xs">{proofreadResult.seoAnalysis.keywordDensity}</p>
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-zinc-700">
              <Button variant="outline" onClick={() => setWorkflowStep(4)}
                className="border-zinc-700 text-white hover:bg-zinc-800" size="sm">
                <ChevronLeft className="w-4 h-4 mr-1" /> 返回
              </Button>
              <Button onClick={handleAccept}
                className="bg-gradient-to-r from-[#FEDD00] to-yellow-500 hover:from-yellow-400 hover:to-yellow-600 text-black font-semibold">
                <PenLine className="w-4 h-4 mr-1.5" /> 接受並進入編輯器
              </Button>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isAnyLoading && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 text-center max-w-sm mx-4">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white font-medium">
                {strategyMutation.isPending ? '🎯 AI 正在分析內容策略...'
                  : outlineMutation.isPending ? '📋 AI 正在生成文章大綱...'
                  : generateMutation.isPending ? '✍️ AI 正在按大綱生成全文...'
                  : proofreadMutation.isPending ? '🔍 AI 正在校對文章品質...'
                  : '處理中...'}
              </p>
              <p className="text-gray-400 text-sm mt-2">Gemini 2.5 Flash 深度思考中，請稍候</p>
            </div>
          </div>
        )}
      </CardContent>
      <CardSelectionDialog
        open={cardSelectionDialogOpen}
        onOpenChange={setCardSelectionDialogOpen}
        onInsert={handleCardDataInsert}
      />
    </Card>
  );
}

// ─── Translation Editor ─────────────────────────────────────────
function TranslationEditor({
  post, onCancel, onSuccess,
}: {
  post: any;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [enTitle, setEnTitle] = useState(post.translations?.en?.title || '');
  const [enContent, setEnContent] = useState(post.translations?.en?.content || '');
  const [enExcerpt, setEnExcerpt] = useState(post.translations?.en?.excerpt || '');
  const [jaTitle, setJaTitle] = useState(post.translations?.ja?.title || '');
  const [jaContent, setJaContent] = useState(post.translations?.ja?.content || '');
  const [jaExcerpt, setJaExcerpt] = useState(post.translations?.ja?.excerpt || '');
  const [activeTab, setActiveTab] = useState<'en' | 'ja'>('en');

  const updateTranslationMutation = trpc.blog.updatePostTranslation.useMutation({
    onSuccess: () => { toast.success('翻譯已儲存！'); onSuccess(); },
    onError: (e: any) => toast.error(`儲存失敗：${e.message}`),
  });

  const handleSave = () => {
    updateTranslationMutation.mutate({
      id: post.id,
      titleEn: enTitle,
      contentEn: enContent,
      excerptEn: enExcerpt,
      titleJa: jaTitle,
      contentJa: jaContent,
      excerptJa: jaExcerpt,
    });
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Languages className="w-5 h-5 text-blue-400" />
            編輯翻譯
          </CardTitle>
          <Button variant="outline" onClick={onCancel} className="border-zinc-700 text-white hover:bg-zinc-800" size="sm">
            <ChevronLeft className="w-4 h-4 mr-1" /> 返回
          </Button>
        </div>
        <CardDescription className="line-clamp-1">{post.title}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tab Switcher */}
        <div className="flex gap-2">
          {[{ key: 'en' as const, label: '🇬🇧 English' }, { key: 'ja' as const, label: '🇯🇵 日本語' }].map(({ key, label }) => (
            <Button key={key} variant={activeTab === key ? 'default' : 'outline'}
              onClick={() => setActiveTab(key)}
              className={activeTab === key ? 'bg-blue-600 hover:bg-blue-700' : 'border-zinc-700 text-white hover:bg-zinc-800'}
              size="sm">{label}</Button>
          ))}
        </div>

        {activeTab === 'en' && (
          <div className="space-y-3">
            <div>
              <Label className="text-white text-sm">English Title</Label>
              <Input value={enTitle} onChange={(e) => setEnTitle(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white mt-1" />
            </div>
            <div>
              <Label className="text-white text-sm">English Excerpt</Label>
              <Textarea value={enExcerpt} onChange={(e) => setEnExcerpt(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white mt-1" rows={3} />
            </div>
            <div>
              <Label className="text-white text-sm">English Content</Label>
              <Textarea value={enContent} onChange={(e) => setEnContent(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white mt-1" rows={12} />
            </div>
          </div>
        )}

        {activeTab === 'ja' && (
          <div className="space-y-3">
            <div>
              <Label className="text-white text-sm">日本語タイトル</Label>
              <Input value={jaTitle} onChange={(e) => setJaTitle(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white mt-1" />
            </div>
            <div>
              <Label className="text-white text-sm">日本語概要</Label>
              <Textarea value={jaExcerpt} onChange={(e) => setJaExcerpt(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white mt-1" rows={3} />
            </div>
            <div>
              <Label className="text-white text-sm">日本語コンテンツ</Label>
              <Textarea value={jaContent} onChange={(e) => setJaContent(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white mt-1" rows={12} />
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-zinc-700">
          <Button onClick={handleSave} disabled={updateTranslationMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700">
            {updateTranslationMutation.isPending ? '儲存中...' : '儲存翻譯'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
