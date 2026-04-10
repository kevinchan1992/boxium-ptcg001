/**
 * TopicClusterView
 * Visualizes the content cluster structure for the blog:
 * - Shows categories as cluster hubs
 * - Shows articles as nodes within each cluster
 * - Highlights SEO gaps (categories with few articles)
 * - Color-codes articles by health status (fresh / needs update / needs refresh)
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FolderOpen, FileText, AlertTriangle, CheckCircle, Clock,
  TrendingUp, Sparkles, RefreshCw, ChevronDown, ChevronRight,
  BarChart3, Target, Zap
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ClusterNode {
  id: number;
  title: string;
  status: 'published' | 'draft';
  publishedAt: string | null;
  updatedAt: string | null;
  viewCount: number;
  healthStatus: 'fresh' | 'update-suggested' | 'needs-refresh';
  daysSinceUpdate: number;
}

interface ClusterGroup {
  id: string;
  name: string;
  color: string;
  articles: ClusterNode[];
  seoGapScore: number; // 0-100, higher = bigger gap
}

// ─── Health Status Helpers ────────────────────────────────────────────────────
function getHealthStatus(post: any): { status: 'fresh' | 'update-suggested' | 'needs-refresh'; days: number } {
  if (post.status !== 'published') return { status: 'fresh', days: 0 };
  const refDate = post.updatedAt || post.publishedAt || post.createdAt;
  const days = Math.floor((Date.now() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24));
  if (days >= 90) return { status: 'needs-refresh', days };
  if (days >= 30) return { status: 'update-suggested', days };
  return { status: 'fresh', days };
}

function HealthBadge({ status, days }: { status: string; days: number }) {
  if (status === 'needs-refresh') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] bg-red-900/40 text-red-300 border border-red-700/30 px-1 py-0.5 rounded">
        <AlertTriangle className="w-2.5 h-2.5" /> {days}天
      </span>
    );
  }
  if (status === 'update-suggested') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] bg-yellow-900/40 text-yellow-300 border border-yellow-700/30 px-1 py-0.5 rounded">
        <RefreshCw className="w-2.5 h-2.5" /> 建議更新
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] bg-green-900/40 text-green-300 border border-green-600/30 px-1 py-0.5 rounded">
      <CheckCircle className="w-2.5 h-2.5" /> 最新
    </span>
  );
}

// ─── Cluster Card ─────────────────────────────────────────────────────────────
function ClusterCard({
  cluster,
  onArticleClick,
}: {
  cluster: ClusterGroup;
  onArticleClick: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const published = cluster.articles.filter(a => a.status === 'published');
  const drafts = cluster.articles.filter(a => a.status === 'draft');
  const needsRefresh = cluster.articles.filter(a => a.healthStatus === 'needs-refresh');
  const updateSuggested = cluster.articles.filter(a => a.healthStatus === 'update-suggested');

  const gapLevel = cluster.seoGapScore >= 70 ? 'high' : cluster.seoGapScore >= 40 ? 'medium' : 'low';
  const gapColors = {
    high: 'text-red-400 bg-red-900/20 border-red-700/30',
    medium: 'text-yellow-400 bg-yellow-900/20 border-yellow-700/30',
    low: 'text-green-400 bg-green-900/20 border-green-600/30',
  };
  const gapLabels = { high: 'SEO 缺口大', medium: 'SEO 缺口中', low: 'SEO 覆蓋良好' };

  return (
    <Card className="bg-zinc-900 border-zinc-700 overflow-hidden">
      {/* Cluster Header */}
      <CardHeader
        className="pb-3 cursor-pointer select-none hover:bg-zinc-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
              style={{ backgroundColor: cluster.color }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-white text-sm font-semibold">{cluster.name}</CardTitle>
                <Badge className={`text-[9px] px-1.5 py-0 border ${gapColors[gapLevel]}`}>
                  {gapLabels[gapLevel]}
                </Badge>
              </div>
              <CardDescription className="text-xs mt-0.5 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {cluster.articles.length} 篇
                </span>
                <span className="text-green-400">{published.length} 已發布</span>
                {drafts.length > 0 && <span className="text-zinc-500">{drafts.length} 草稿</span>}
                {needsRefresh.length > 0 && (
                  <span className="text-red-400 flex items-center gap-0.5">
                    <AlertTriangle className="w-3 h-3" />{needsRefresh.length} 需刷新
                  </span>
                )}
                {updateSuggested.length > 0 && (
                  <span className="text-yellow-400">{updateSuggested.length} 建議更新</span>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* SEO Gap Indicator */}
            <div className="hidden sm:flex items-center gap-1">
              <div className="text-xs text-gray-500">SEO 覆蓋</div>
              <div className="w-16 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(5, 100 - cluster.seoGapScore)}%`,
                    backgroundColor: gapLevel === 'low' ? '#22c55e' : gapLevel === 'medium' ? '#eab308' : '#ef4444',
                  }}
                />
              </div>
            </div>
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </div>
        </div>
      </CardHeader>

      {/* Article Nodes */}
      {expanded && (
        <CardContent className="pt-0 pb-3">
          {cluster.articles.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-xs border border-dashed border-zinc-700 rounded-lg">
              <Target className="w-6 h-6 mx-auto mb-1.5 opacity-50" />
              <p>此分類尚無文章</p>
              <p className="text-[10px] mt-0.5 text-yellow-500">SEO 缺口：建議新增 3-5 篇相關文章</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {cluster.articles.map(article => (
                <button
                  key={article.id}
                  onClick={() => onArticleClick(article.id)}
                  className="text-left p-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-zinc-500 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-start gap-1.5 min-w-0">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                        style={{ backgroundColor: cluster.color }}
                      />
                      <p className="text-white text-xs line-clamp-2 group-hover:text-[#FEDD00] transition-colors leading-tight">
                        {article.title}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <Badge className={`text-[9px] px-1 py-0 ${article.status === 'published' ? 'bg-green-900/30 text-green-400 border-green-700/30' : 'bg-zinc-700 text-gray-400'}`}>
                      {article.status === 'published' ? '已發布' : '草稿'}
                    </Badge>
                    <HealthBadge status={article.healthStatus} days={article.daysSinceUpdate} />
                    {article.viewCount > 0 && (
                      <span className="text-[9px] text-gray-500 flex items-center gap-0.5">
                        <TrendingUp className="w-2.5 h-2.5" />{article.viewCount}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Gap Suggestions */}
          {cluster.seoGapScore >= 40 && (
            <div className={`mt-2 p-2 rounded-lg border text-xs ${
              cluster.seoGapScore >= 70
                ? 'bg-red-900/10 border-red-700/20 text-red-300'
                : 'bg-yellow-900/10 border-yellow-700/20 text-yellow-300'
            }`}>
              <div className="flex items-center gap-1.5 font-medium mb-0.5">
                <Zap className="w-3 h-3" />
                {cluster.seoGapScore >= 70 ? '⚠ 重要 SEO 缺口' : '💡 SEO 優化建議'}
              </div>
              <p className="text-[10px] opacity-80">
                {cluster.articles.length === 0
                  ? `「${cluster.name}」分類目前沒有文章，建議新增 3-5 篇核心文章建立主題權威。`
                  : cluster.articles.length < 3
                  ? `「${cluster.name}」分類文章數量不足（${cluster.articles.length} 篇），建議增加至 5 篇以上以提升 SEO 集群效果。`
                  : `「${cluster.name}」分類有 ${needsRefresh.length + updateSuggested.length} 篇文章需要更新，舊文刷新可提升搜尋排名。`}
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface TopicClusterViewProps {
  onArticleClick: (id: number) => void;
}

export function TopicClusterView({ onArticleClick }: TopicClusterViewProps) {
  const { data: postsData, isLoading: postsLoading } = trpc.blog.getPosts.useQuery({
    limit: 200,
    sortBy: 'newest',
  });
  const { data: categories, isLoading: catsLoading } = trpc.blog.getCategories.useQuery();

  const isLoading = postsLoading || catsLoading;

  // Cluster color palette
  const CLUSTER_COLORS = [
    '#FEDD00', '#6366f1', '#22c55e', '#f97316', '#06b6d4',
    '#ec4899', '#a855f7', '#14b8a6', '#f59e0b', '#3b82f6',
  ];

  // Build cluster groups
  const clusters: ClusterGroup[] = (() => {
    if (!postsData?.posts || !categories) return [];

    const allPosts = postsData.posts;

    // Group by category
    const categoryMap = new Map<string, { id: string; name: string; articles: ClusterNode[] }>();

    // Add "Uncategorized" bucket
    categoryMap.set('uncategorized', { id: 'uncategorized', name: '未分類', articles: [] });

    // Add known categories
    (categories as any[]).forEach(cat => {
      categoryMap.set(String(cat.id), { id: String(cat.id), name: cat.name, articles: [] });
    });

    // Assign posts to categories
    allPosts.forEach((post: any) => {
      const catKey = post.categoryId ? String(post.categoryId) : 'uncategorized';
      const bucket = categoryMap.get(catKey) || categoryMap.get('uncategorized')!;
      const { status, days } = getHealthStatus(post);
      bucket.articles.push({
        id: post.id,
        title: post.title,
        status: post.status,
        publishedAt: post.publishedAt,
        updatedAt: post.updatedAt,
        viewCount: post.viewCount || 0,
        healthStatus: status,
        daysSinceUpdate: days,
      });
    });

    // Calculate SEO gap score for each cluster
    return Array.from(categoryMap.values())
      .filter(c => c.id !== 'uncategorized' || c.articles.length > 0)
      .map((cluster, idx) => {
        const total = cluster.articles.length;
        const published = cluster.articles.filter(a => a.status === 'published').length;
        const stale = cluster.articles.filter(a => a.healthStatus !== 'fresh').length;

        // Gap score: 0 articles = 100, few articles = high, many fresh = low
        let gapScore = 0;
        if (total === 0) gapScore = 100;
        else if (total < 3) gapScore = 70;
        else if (total < 5) gapScore = 40;
        else gapScore = Math.min(60, Math.round((stale / total) * 60));

        // Reduce gap score if well covered
        if (published >= 5 && stale === 0) gapScore = Math.max(0, gapScore - 20);

        return {
          id: cluster.id,
          name: cluster.name,
          color: CLUSTER_COLORS[idx % CLUSTER_COLORS.length],
          articles: cluster.articles,
          seoGapScore: gapScore,
        };
      })
      .sort((a, b) => b.seoGapScore - a.seoGapScore); // Sort by gap (biggest first)
  })();

  // Summary stats
  const totalArticles = clusters.reduce((s, c) => s + c.articles.length, 0);
  const totalPublished = clusters.reduce((s, c) => s + c.articles.filter(a => a.status === 'published').length, 0);
  const totalNeedsRefresh = clusters.reduce((s, c) => s + c.articles.filter(a => a.healthStatus === 'needs-refresh').length, 0);
  const totalUpdateSuggested = clusters.reduce((s, c) => s + c.articles.filter(a => a.healthStatus === 'update-suggested').length, 0);
  const highGapClusters = clusters.filter(c => c.seoGapScore >= 70).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <div className="text-center">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-50 animate-pulse" />
          <p className="text-sm">載入集群視圖...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <FolderOpen className="w-3.5 h-3.5" />主題集群
          </div>
          <div className="text-2xl font-bold text-white">{clusters.length}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">{highGapClusters > 0 ? `${highGapClusters} 個有 SEO 缺口` : '覆蓋良好'}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <FileText className="w-3.5 h-3.5" />已發布
          </div>
          <div className="text-2xl font-bold text-white">{totalPublished}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">共 {totalArticles} 篇文章</div>
        </div>
        <div className="bg-zinc-900 border border-red-800/30 rounded-xl p-3">
          <div className="flex items-center gap-2 text-red-400 text-xs mb-1">
            <AlertTriangle className="w-3.5 h-3.5" />需刷新
          </div>
          <div className="text-2xl font-bold text-red-400">{totalNeedsRefresh}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">超過 90 天未更新</div>
        </div>
        <div className="bg-zinc-900 border border-yellow-800/30 rounded-xl p-3">
          <div className="flex items-center gap-2 text-yellow-400 text-xs mb-1">
            <RefreshCw className="w-3.5 h-3.5" />建議更新
          </div>
          <div className="text-2xl font-bold text-yellow-400">{totalUpdateSuggested}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">超過 30 天未更新</div>
        </div>
      </div>

      {/* Action Hint */}
      {(totalNeedsRefresh > 0 || highGapClusters > 0) && (
        <div className="flex items-center gap-2 p-3 bg-purple-900/20 border border-purple-700/30 rounded-xl text-xs text-purple-300">
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          <span>
            {totalNeedsRefresh > 0 && `${totalNeedsRefresh} 篇文章需要刷新。`}
            {highGapClusters > 0 && ` ${highGapClusters} 個主題集群有 SEO 缺口。`}
            前往 <strong>AI 內容工作流 → E. 刷新技能</strong> 或 <strong>G. 集群分析</strong> 獲取具體建議。
          </span>
        </div>
      )}

      {/* Cluster Cards */}
      <div className="space-y-3">
        {clusters.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>尚無分類數據</p>
            <p className="text-xs mt-1">請先在博客設定中建立文章分類</p>
          </div>
        ) : (
          clusters.map(cluster => (
            <ClusterCard
              key={cluster.id}
              cluster={cluster}
              onArticleClick={onArticleClick}
            />
          ))
        )}
      </div>
    </div>
  );
}
