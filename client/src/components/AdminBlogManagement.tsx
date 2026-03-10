import { useState, useMemo } from "react";
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
  const [activeView, setActiveView] = useState<'list' | 'generate' | 'preview' | 'edit-translation'>('list');
  const [previewArticle, setPreviewArticle] = useState<any>(null);
  const [selectedPost, setSelectedPost] = useState<any>(null);
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
      featuredImage: post.featuredImage || '',
      category: post.category || '',
      tags: Array.isArray(post.tags) ? post.tags.map((t: any) => typeof t === 'string' ? t : t.name).join(', ') : (post.tags || ''),
      dataSource: post.dataSource || 'manual',
    });
    setSelectedPost(post);
    setActiveView('preview');
  };

  // Translation status helper
  const getTranslationStatus = (post: any) => {
    const hasEn = post.titleEn || post.contentEn;
    const hasJa = post.titleJa || post.contentJa;
    if (hasEn && hasJa) return { label: '中/英/日', color: 'bg-emerald-600' };
    if (hasEn) return { label: '中/英', color: 'bg-blue-600' };
    if (hasJa) return { label: '中/日', color: 'bg-purple-600' };
    return { label: '僅中文', color: 'bg-zinc-600' };
  };

  // Filtered posts by category (client-side since API doesn't filter by category name)
  const filteredPosts = useMemo(() => {
    if (!posts?.posts) return [];
    if (categoryFilter === 'all') return posts.posts;
    return posts.posts.filter((p: any) => p.category === categoryFilter);
  }, [posts, categoryFilter]);

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white">博客管理</h2>
          <p className="text-xs text-gray-400 mt-0.5">管理文章、AI 生成、翻譯與分享統計</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => { setSelectedPost(null); setActiveView('generate'); }}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-sm"
            size="sm"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            AI 生成
          </Button>
          <BrandButton
            onClick={() => {
              setPreviewArticle({
                title: '', excerpt: '', content: '', featuredImage: '',
                category: '', tags: '', dataSource: 'manual',
              });
              setSelectedPost(null);
              setActiveView('preview');
            }}
            className="text-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            新增文章
          </BrandButton>
        </div>
      </div>

      {/* ── List View ── */}
      {activeView === 'list' && (
        <>
          {/* Share Statistics (Collapsible) */}
          <ShareStatisticsCard />

          {/* Article List */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-white text-base">文章列表</CardTitle>
                  <CardDescription className="text-xs">共 {posts?.total || 0} 篇文章</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                    <Input
                      placeholder="搜尋文章..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className="w-48 pl-8 h-8 text-xs bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                  {/* Status Filter */}
                  <Select value={statusFilter} onValueChange={(v: any) => { setStatusFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger className="w-24 h-8 text-xs bg-zinc-800 border-zinc-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="draft">草稿</SelectItem>
                      <SelectItem value="published">已發布</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Category Filter */}
                  <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger className="w-28 h-8 text-xs bg-zinc-800 border-zinc-700 text-white">
                      <SelectValue placeholder="分類" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部分類</SelectItem>
                      {(categories || []).map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Batch Mode Toggle */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setIsSelectMode(!isSelectMode); setSelectedPostIds([]); }}
                    className={`h-8 text-xs border-zinc-700 ${isSelectMode ? 'bg-[#FEDD00] text-[#06038d] border-[#FEDD00]' : 'text-white hover:bg-zinc-800'}`}
                  >
                    {isSelectMode ? '取消選擇' : '批量操作'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? (
                <div className="text-center py-8 text-gray-400">載入中...</div>
              ) : filteredPosts.length > 0 ? (
                <div className="space-y-2">
                  {/* Batch Operations Toolbar */}
                  {isSelectMode && (
                    <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg border border-zinc-700">
                      <label className="flex items-center gap-2 text-white cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={selectedPostIds.length === filteredPosts.length && filteredPosts.length > 0}
                          onChange={(e) => {
                            setSelectedPostIds(e.target.checked ? filteredPosts.map((p: any) => p.id) : []);
                          }}
                          className="w-4 h-4 rounded"
                        />
                        全選 ({selectedPostIds.length}/{filteredPosts.length})
                      </label>
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline" size="sm"
                          onClick={() => {
                            if (selectedPostIds.length === 0) { toast.error('請選擇至少一篇文章'); return; }
                            if (confirm(`確定要發布 ${selectedPostIds.length} 篇文章嗎？`)) {
                              const drafts = filteredPosts.filter((p: any) => selectedPostIds.includes(p.id) && p.status === 'draft');
                              drafts.forEach((post: any) => togglePublishMutation.mutate({ id: post.id }));
                              setSelectedPostIds([]);
                            }
                          }}
                          className="h-7 text-xs border-zinc-700 text-green-400 hover:bg-zinc-700"
                          disabled={selectedPostIds.length === 0}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />發布
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => {
                            if (selectedPostIds.length === 0) { toast.error('請選擇至少一篇文章'); return; }
                            if (confirm(`確定要取消發布 ${selectedPostIds.length} 篇文章嗎？`)) {
                              const published = filteredPosts.filter((p: any) => selectedPostIds.includes(p.id) && p.status === 'published');
                              published.forEach((post: any) => togglePublishMutation.mutate({ id: post.id }));
                              setSelectedPostIds([]);
                            }
                          }}
                          className="h-7 text-xs border-zinc-700 text-yellow-400 hover:bg-zinc-700"
                          disabled={selectedPostIds.length === 0}
                        >
                          <EyeOff className="w-3.5 h-3.5 mr-1" />取消發布
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => {
                            if (selectedPostIds.length === 0) { toast.error('請選擇至少一篇文章'); return; }
                            if (confirm(`確定要刪除 ${selectedPostIds.length} 篇文章嗎？此操作無法復原！`)) {
                              selectedPostIds.forEach(id => deletePostMutation.mutate({ id }));
                              setSelectedPostIds([]);
                            }
                          }}
                          className="h-7 text-xs border-zinc-700 text-red-400 hover:bg-zinc-700"
                          disabled={selectedPostIds.length === 0}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />刪除
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Article Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-700 text-gray-400 text-xs">
                          {isSelectMode && <th className="px-2 py-2 w-8"></th>}
                          <th className="px-3 py-2 text-left">文章</th>
                          <th className="px-3 py-2 text-left hidden lg:table-cell">分類</th>
                          <th className="px-3 py-2 text-center hidden md:table-cell">狀態</th>
                          <th className="px-3 py-2 text-center hidden lg:table-cell">語言</th>
                          <th className="px-3 py-2 text-center hidden md:table-cell">瀏覽</th>
                          <th className="px-3 py-2 text-left hidden lg:table-cell">日期</th>
                          <th className="px-3 py-2 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPosts.map((post: any) => {
                          const translationStatus = getTranslationStatus(post);
                          return (
                            <tr
                              key={post.id}
                              className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                            >
                              {/* Checkbox */}
                              {isSelectMode && (
                                <td className="px-2 py-2.5">
                                  <input
                                    type="checkbox"
                                    checked={selectedPostIds.includes(post.id)}
                                    onChange={(e) => {
                                      setSelectedPostIds(
                                        e.target.checked
                                          ? [...selectedPostIds, post.id]
                                          : selectedPostIds.filter(id => id !== post.id)
                                      );
                                    }}
                                    className="w-4 h-4 rounded"
                                  />
                                </td>
                              )}

                              {/* Title + Excerpt + Tags */}
                              <td className="px-3 py-2.5 max-w-[320px]">
                                <div className="flex items-start gap-2">
                                  {/* Thumbnail */}
                                  {post.featuredImage && (
                                    <img
                                      src={post.featuredImage}
                                      alt=""
                                      className="w-10 h-10 rounded object-cover flex-shrink-0 mt-0.5"
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-white font-medium line-clamp-1 text-sm">{post.title}</span>
                                      {post.dataSource === 'ai-generated' && (
                                        <span title="AI 生成"><Sparkles className="w-3 h-3 text-purple-400 flex-shrink-0" /></span>
                                      )}
                                    </div>
                                    {post.excerpt && (
                                      <p className="text-gray-500 text-xs line-clamp-1 mt-0.5">{post.excerpt}</p>
                                    )}
                                    {/* Tags */}
                                    {post.tags && post.tags.length > 0 && (
                                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                                        <Tag className="w-3 h-3 text-gray-500 flex-shrink-0" />
                                        {(Array.isArray(post.tags) ? post.tags : []).slice(0, 3).map((tag: any, i: number) => (
                                          <span key={i} className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-gray-400 rounded">
                                            {typeof tag === 'string' ? tag : tag.name}
                                          </span>
                                        ))}
                                        {Array.isArray(post.tags) && post.tags.length > 3 && (
                                          <span className="text-[10px] text-gray-500">+{post.tags.length - 3}</span>
                                        )}
                                      </div>
                                    )}
                                    {/* Mobile-only info */}
                                    <div className="flex items-center gap-2 mt-1 md:hidden text-[10px] text-gray-500">
                                      <Badge variant={post.status === 'published' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                                        {post.status === 'published' ? '已發布' : '草稿'}
                                      </Badge>
                                      <span>{post.viewCount} 瀏覽</span>
                                      <span>{formatHKDate(post.publishedAt || post.createdAt)}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Category */}
                              <td className="px-3 py-2.5 hidden lg:table-cell">
                                {post.category ? (
                                  <span className="text-xs px-2 py-0.5 bg-zinc-800 text-gray-300 rounded-full flex items-center gap-1 w-fit">
                                    <FolderOpen className="w-3 h-3" />
                                    {post.category}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-600">—</span>
                                )}
                              </td>

                              {/* Status */}
                              <td className="px-3 py-2.5 text-center hidden md:table-cell">
                                <Badge
                                  variant={post.status === 'published' ? 'default' : 'secondary'}
                                  className={`text-xs ${post.status === 'published' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30' : 'bg-zinc-700 text-gray-400'}`}
                                >
                                  {post.status === 'published' ? '已發布' : '草稿'}
                                </Badge>
                              </td>

                              {/* Translation Status */}
                              <td className="px-3 py-2.5 text-center hidden lg:table-cell">
                                <Badge className={`text-[10px] ${translationStatus.color}`}>
                                  {translationStatus.label}
                                </Badge>
                              </td>

                              {/* Views */}
                              <td className="px-3 py-2.5 text-center hidden md:table-cell">
                                <span className="text-xs text-gray-400 flex items-center justify-center gap-1">
                                  <BarChart3 className="w-3 h-3" />
                                  {post.viewCount || 0}
                                </span>
                              </td>

                              {/* Date */}
                              <td className="px-3 py-2.5 hidden lg:table-cell">
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatHKDate(post.publishedAt || post.createdAt)}
                                </span>
                              </td>

                              {/* Actions */}
                              <td className="px-3 py-2.5">
                                <div className="flex items-center justify-end gap-0.5">
                                  {/* Toggle Publish */}
                                  <Button
                                    size="sm" variant="ghost"
                                    onClick={() => handleTogglePublish(post.id)}
                                    className="h-7 w-7 p-0 text-gray-400 hover:text-white"
                                    title={post.status === 'published' ? '取消發布' : '發布'}
                                  >
                                    {post.status === 'published' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </Button>
                                  {/* AI Translate */}
                                  <Button
                                    size="sm" variant="ghost"
                                    onClick={() => handleTranslate(post.id)}
                                    className="h-7 w-7 p-0 text-gray-400 hover:text-purple-400"
                                    disabled={translatePostMutation.isPending}
                                    title="AI 翻譯"
                                  >
                                    <Languages className="w-3.5 h-3.5" />
                                  </Button>
                                  {/* Edit Translation */}
                                  <Button
                                    size="sm" variant="ghost"
                                    onClick={() => { setSelectedPost(post); setActiveView('edit-translation'); }}
                                    className="h-7 w-7 p-0 text-gray-400 hover:text-blue-400"
                                    title="編輯翻譯"
                                  >
                                    <Globe className="w-3.5 h-3.5" />
                                  </Button>
                                  {/* Edit Article */}
                                  <Button
                                    size="sm" variant="ghost"
                                    onClick={() => handleEdit(post)}
                                    className="h-7 w-7 p-0 text-gray-400 hover:text-[#FEDD00]"
                                    title="編輯文章"
                                  >
                                    <PenLine className="w-3.5 h-3.5" />
                                  </Button>
                                  {/* View */}
                                  <a
                                    href={`/blog/${post.slug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center h-7 w-7 text-gray-400 hover:text-green-400 transition-colors"
                                    title="查看文章"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                  {/* Delete */}
                                  <Button
                                    size="sm" variant="ghost"
                                    onClick={() => handleDelete(post.id)}
                                    className="h-7 w-7 p-0 text-gray-400 hover:text-red-400"
                                    title="刪除"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                      <span className="text-xs text-gray-500">
                        第 {currentPage} / {totalPages} 頁，共 {posts?.total || 0} 篇
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline" size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="h-7 w-7 p-0 border-zinc-700 text-white hover:bg-zinc-800"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        {/* Page numbers */}
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let page: number;
                          if (totalPages <= 5) {
                            page = i + 1;
                          } else if (currentPage <= 3) {
                            page = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            page = totalPages - 4 + i;
                          } else {
                            page = currentPage - 2 + i;
                          }
                          return (
                            <Button
                              key={page}
                              variant={currentPage === page ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              className={`h-7 w-7 p-0 text-xs ${
                                currentPage === page
                                  ? 'bg-[#FEDD00] text-[#06038d] hover:bg-[#FEDD00]/90'
                                  : 'border-zinc-700 text-white hover:bg-zinc-800'
                              }`}
                            >
                              {page}
                            </Button>
                          );
                        })}
                        <Button
                          variant="outline" size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="h-7 w-7 p-0 border-zinc-700 text-white hover:bg-zinc-800"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">還沒有文章，點擊「新增文章」或「AI 生成」開始吧！</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Preview / Edit View ── */}
      {activeView === 'preview' && previewArticle && (
        <ArticlePreview
          article={previewArticle}
          initialEditMode={!!previewArticle.id}
          onPublish={async (article) => {
            try {
              const tagsArray = article.tags
                ? article.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
                : [];

              if (article.id) {
                await updatePostMutation.mutateAsync({
                  id: article.id,
                  title: article.title,
                  excerpt: article.excerpt || '',
                  content: article.content,
                  featuredImage: article.featuredImage,
                  category: article.category,
                  status: 'published',
                  tags: tagsArray,
                  metaKeywords: article.seoKeywords,
                });
              } else {
                await createPostMutation.mutateAsync({
                  title: article.title,
                  excerpt: article.excerpt || '',
                  content: article.content,
                  featuredImage: article.featuredImage,
                  category: article.category,
                  status: 'published',
                  dataSource: (article.dataSource as 'manual' | 'ai-generated' | 'mixed') || 'manual',
                  tags: tagsArray,
                  metaKeywords: article.seoKeywords,
                });
              }
              setActiveView('list');
            } catch (error: any) {
              // Error handled by mutation
            }
          }}
          onEdit={() => {}}
          onCancel={() => setActiveView('list')}
        />
      )}

      {/* ── AI Generate View ── */}
      {activeView === 'generate' && (
        <AIArticleGenerator
          categories={categories || []}
          onCancel={() => setActiveView('list')}
          onSuccess={(generatedArticle) => {
            setPreviewArticle({
              ...generatedArticle,
              category: generatedArticle.suggestedCategory || '',
              tags: generatedArticle.suggestedTags?.join(', ') || '',
              seoKeywords: generatedArticle.seoMetadata?.keywords?.join(', ') || '',
            });
            setActiveView('preview');
          }}
        />
      )}

      {/* ── Translation Editor View ── */}
      {activeView === 'edit-translation' && selectedPost && (
        <TranslationEditor
          post={selectedPost}
          onCancel={() => setActiveView('list')}
          onSuccess={() => { setActiveView('list'); refetch(); }}
        />
      )}
    </div>
  );
}

// ─── AI Article Generator ───────────────────────────────────────
function AIArticleGenerator({
  categories, onCancel, onSuccess,
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
  const [cardSelectionDialogOpen, setCardSelectionDialogOpen] = useState(false);

  const handleCardDataInsert = (cardData: string) => {
    setTextContent(prev => prev ? prev + '\n\n' + cardData : cardData);
  };

  const generateMutation = trpc.blog.generateArticle.useMutation({
    onSuccess: (data) => { toast.success('文章生成成功！'); onSuccess(data); },
    onError: (e) => toast.error(`生成失敗：${e.message}`),
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

  const handleGenerate = () => {
    if (inputMethod === 'url' && !urlInput) { toast.error('請輸入網址'); return; }
    if (inputMethod === 'image' && uploadedImageUrls.length === 0) { toast.error('請上傳至少一張圖片'); return; }
    if (inputMethod === 'text' && !textContent) { toast.error('請輸入文字內容'); return; }

    const input: any = { articleType };
    if (inputMethod === 'url') {
      input.urlInput = { url: urlInput, targetLanguage };
    } else if (inputMethod === 'image') {
      input.imageInput = { imageUrls: uploadedImageUrls };
      if (uploadedImageUrls.length > 0) input.featuredImageUrl = uploadedImageUrls[0];
    } else if (inputMethod === 'text') {
      input.textInput = { content: textContent, topic: topic || '市場快訊' };
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
      <CardContent className="space-y-5">
        {/* Input Method */}
        <div>
          <Label className="text-white mb-2 block text-sm">輸入方式</Label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'url' as const, icon: FileText, label: '網址' },
              { key: 'image' as const, icon: ImageIcon, label: '圖片' },
              { key: 'text' as const, icon: FileText, label: '文字' },
            ].map(({ key, icon: Icon, label }) => (
              <Button
                key={key}
                variant={inputMethod === key ? 'default' : 'outline'}
                onClick={() => setInputMethod(key)}
                className={inputMethod === key ? 'bg-purple-600 hover:bg-purple-700' : 'border-zinc-700 text-white hover:bg-zinc-800'}
                size="sm"
              >
                <Icon className="w-4 h-4 mr-1.5" />
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Article Type */}
        <div>
          <Label className="text-white text-sm">文章類型</Label>
          <Select value={articleType} onValueChange={(v: any) => setArticleType(v)}>
            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1">
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
          <div className="space-y-3">
            <div>
              <Label className="text-white text-sm">網址</Label>
              <Input
                placeholder="https://example.com/article"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">支援日文/英文/中文網站，AI 將自動抓取並分析內容</p>
            </div>
            <div>
              <Label className="text-white text-sm">目標語言</Label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1">
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
              <p className="text-xs text-gray-500 mt-1">AI 將自動提取圖片中的文字和卡牌資訊</p>
            </div>
            {uploadedImageUrls.length > 0 && (
              <div>
                <Label className="text-white mb-2 block text-sm">已上傳 ({uploadedImageUrls.length})</Label>
                <div className="grid grid-cols-4 gap-3">
                  {uploadedImageUrls.map((url, i) => (
                    <div key={i} className="relative group">
                      <img src={url} alt="" className="w-full h-24 object-cover rounded-lg border border-zinc-700" />
                      {i === 0 && <Badge className="absolute top-1 left-1 bg-purple-600 text-[10px]">主題圖</Badge>}
                      <Button size="sm" variant="destructive" onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
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
              <Label className="text-white text-sm">主題/分類</Label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white mt-1"
                placeholder="例如：Pikachu 價格飆升、市場動態等"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-white text-sm">文字內容</Label>
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => setCardSelectionDialogOpen(true)}
                  className="h-7 text-xs border-[#FEDD00] text-[#FEDD00] hover:bg-[#FEDD00]/10"
                >
                  🎴 插入卡牌資料
                </Button>
              </div>
              <Textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder={`輸入您想要生成文章的資訊...\n\n例如：\n- Pikachu PROMO 今日價格從 HKD 10,000 升至 HKD 13,500\n- 交易量增加 200%\n\n提示：點擊「插入卡牌資料」可從資料庫選擇卡牌並插入真實價格資料`}
                rows={10}
              />
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-700">
          <p className="text-xs text-gray-400">
            {generateMutation.isPending ? '正在生成文章，請稍候...' : 'AI 將根據您提供的資訊生成專業文章'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} className="border-zinc-700 text-white hover:bg-zinc-800" size="sm">
              取消
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              size="sm"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              {generateMutation.isPending ? '生成中...' : 'AI 生成文章'}
            </Button>
          </div>
        </div>
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
  const [formData, setFormData] = useState({
    titleEn: post?.titleEn || '',
    titleJa: post?.titleJa || '',
    excerptEn: post?.excerptEn || '',
    excerptJa: post?.excerptJa || '',
    contentEn: post?.contentEn || '',
    contentJa: post?.contentJa || '',
  });

  const updateTranslationMutation = trpc.blog.updatePostTranslation.useMutation({
    onSuccess: () => { toast.success('翻譯已更新'); onSuccess(); },
    onError: (e) => toast.error(`更新失敗：${e.message}`),
  });

  const handleSubmit = () => {
    updateTranslationMutation.mutate({ id: post.id, ...formData });
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-400" />
          編輯翻譯
        </CardTitle>
        <CardDescription>修改 AI 生成的翻譯，確保專業術語準確性</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Original */}
        <div className="p-3 bg-zinc-800 rounded-lg space-y-2">
          <h3 className="text-white font-semibold text-sm flex items-center gap-1.5">
            <span className="w-5 h-5 bg-red-600 rounded text-[10px] flex items-center justify-center text-white font-bold">中</span>
            原文
          </h3>
          <div>
            <Label className="text-gray-400 text-xs">標題</Label>
            <p className="text-white text-sm mt-0.5">{post.title}</p>
          </div>
          {post.excerpt && (
            <div>
              <Label className="text-gray-400 text-xs">摘要</Label>
              <p className="text-white text-sm mt-0.5 line-clamp-2">{post.excerpt}</p>
            </div>
          )}
        </div>

        {/* English */}
        <div className="space-y-3">
          <h3 className="text-white font-semibold text-sm flex items-center gap-1.5">
            <span className="w-5 h-5 bg-blue-600 rounded text-[10px] flex items-center justify-center text-white font-bold">EN</span>
            英文翻譯
          </h3>
          <div>
            <Label className="text-white text-xs">標題</Label>
            <Input value={formData.titleEn} onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="English title" />
          </div>
          <div>
            <Label className="text-white text-xs">摘要</Label>
            <Textarea value={formData.excerptEn} onChange={(e) => setFormData({ ...formData, excerptEn: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="English excerpt" rows={2} />
          </div>
          <div>
            <Label className="text-white text-xs">內容 (Markdown)</Label>
            <Textarea value={formData.contentEn} onChange={(e) => setFormData({ ...formData, contentEn: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-white font-mono text-xs mt-1" placeholder="English content" rows={8} />
          </div>
        </div>

        {/* Japanese */}
        <div className="space-y-3">
          <h3 className="text-white font-semibold text-sm flex items-center gap-1.5">
            <span className="w-5 h-5 bg-purple-600 rounded text-[10px] flex items-center justify-center text-white font-bold">JA</span>
            日文翻譯
          </h3>
          <div>
            <Label className="text-white text-xs">標題</Label>
            <Input value={formData.titleJa} onChange={(e) => setFormData({ ...formData, titleJa: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="日本語タイトル" />
          </div>
          <div>
            <Label className="text-white text-xs">摘要</Label>
            <Textarea value={formData.excerptJa} onChange={(e) => setFormData({ ...formData, excerptJa: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="日本語概要" rows={2} />
          </div>
          <div>
            <Label className="text-white text-xs">內容 (Markdown)</Label>
            <Textarea value={formData.contentJa} onChange={(e) => setFormData({ ...formData, contentJa: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-white font-mono text-xs mt-1" placeholder="日本語コンテンツ" rows={8} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-zinc-700">
          <Button variant="outline" onClick={onCancel} className="border-zinc-700 text-white hover:bg-zinc-800" size="sm">
            取消
          </Button>
          <BrandButton onClick={handleSubmit} disabled={updateTranslationMutation.isPending}>
            {updateTranslationMutation.isPending ? '保存中...' : '保存翻譯'}
          </BrandButton>
        </div>
      </CardContent>
    </Card>
  );
}
