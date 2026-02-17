import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Users, CreditCard, Database, TrendingUp, Activity, Image, FileText, Clock, CheckCircle2, BookOpen, FileEdit, AlertCircle, XCircle, Server } from "lucide-react";
import { useLocation } from "wouter";

export function AdminDashboard() {
  const { data: stats, isLoading } = trpc.admin.getDashboardStats.useQuery();
  const { data: articleStats, isLoading: isLoadingArticles, error: articleError } = trpc.blog.getAllArticles.useQuery(
    {},
    {
      retry: false,
      refetchOnWindowFocus: false,
    }
  );
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-muted rounded w-1/3"></div>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: "總用戶數",
      value: stats?.totalUsers || 0,
      icon: Users,
      color: "#3b82f6",
      bgColor: "bg-blue-50",
    },
    {
      title: "卡牌總數",
      value: stats?.totalCards || 0,
      icon: CreditCard,
      color: "#10b981",
      bgColor: "bg-green-50",
    },
    {
      title: "數據源總數",
      value: stats?.totalDataSources || 0,
      icon: Database,
      color: "#a855f7",
      bgColor: "bg-purple-50",
    },
    {
      title: "活躍數據源",
      value: stats?.activeDataSources || 0,
      icon: Activity,
      color: "#f97316",
      bgColor: "bg-orange-50",
    },
    {
      title: "價格記錄數",
      value: stats?.totalPriceRecords || 0,
      icon: TrendingUp,
      color: "#ec4899",
      bgColor: "bg-pink-50",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">數據統計</h2>
        <p className="text-gray-400">系統整體數據概覽</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={index} 
              className="p-6 hover:shadow-lg transition-all hover:scale-105 border-l-4" 
              style={{ borderLeftColor: stat.color }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold text-white">{stat.value.toLocaleString()}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <Icon className="w-6 h-6" style={{ color: stat.color }} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 文章管理面板 */}
      <ArticleManagementPanel articleStats={articleStats} isLoading={isLoadingArticles} onNavigate={setLocation} />

      {/* 搜尋統計面板 */}
      <SearchStatsPanel />

      {/* 數據源健康監控面板 */}
      <DataSourceHealthPanel />
    </div>
  );
}

// 數據源健康監控面板組件
function DataSourceHealthPanel() {
  const { data: healthMetrics, isLoading } = trpc.priceSchedule.getHealthMetrics.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-muted rounded w-1/4 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-muted rounded w-1/3"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const snkrdunkHealth = healthMetrics?.find(m => m.source === 'snkrdunk');
  const ebayHealth = healthMetrics?.find(m => m.source === 'ebay');

  const getStatusIcon = (status: string | undefined) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'down':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Server className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string | undefined) => {
    switch (status) {
      case 'healthy':
        return { text: '正常', color: 'text-green-600', bgColor: 'bg-green-50' };
      case 'degraded':
        return { text: '降級', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
      case 'down':
        return { text: '停機', color: 'text-red-600', bgColor: 'bg-red-50' };
      default:
        return { text: '未知', color: 'text-gray-600', bgColor: 'bg-gray-50' };
    }
  };

  const formatTime = (timestamp: Date | null | undefined) => {
    if (!timestamp) return '從未';
    return new Date(timestamp).toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const healthCards = [
    {
      title: 'SNKRDUNK 數據源',
      health: snkrdunkHealth,
      color: '#3b82f6',
      borderColor: 'border-l-blue-500',
    },
    {
      title: 'eBay 數據源',
      health: ebayHealth,
      color: '#f59e0b',
      borderColor: 'border-l-yellow-500',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">數據源健康監控</h2>
        <p className="text-gray-400">實時監控數據源連接狀態和性能指標</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {healthCards.map((card, index) => {
          const health = card.health;
          const statusInfo = getStatusText(health?.status);
          
          return (
            <Card 
              key={index} 
              className={`p-6 border-l-4 ${card.borderColor} bg-gray-900`}
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${statusInfo.bgColor}`}>
                    {getStatusIcon(health?.status)}
                    <span className={`text-sm font-medium ${statusInfo.color}`}>
                      {statusInfo.text}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                {health ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">成功率</p>
                      <p className="text-2xl font-bold text-white">
                        {parseFloat(health.successRate).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">平均響應時間</p>
                      <p className="text-2xl font-bold text-white">
                        {health.avgResponseTime}ms
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">總請求數</p>
                      <p className="text-lg font-semibold text-white">
                        {health.totalRequests.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">連續失敗</p>
                      <p className="text-lg font-semibold text-white">
                        {health.consecutiveFailures}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">暫無健康數據</p>
                )}

                {/* Last Success Time */}
                <div className="pt-4 border-t border-gray-700">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">上次成功：</span>
                    <span className="font-medium text-white">
                      {formatTime(health?.lastSuccessAt)}
                    </span>
                  </div>
                  {health?.lastFailureAt && (
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-gray-400">上次失敗：</span>
                      <span className="font-medium text-red-600">
                        {formatTime(health.lastFailureAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// 文章管理面板組件
function ArticleManagementPanel({ articleStats, isLoading, onNavigate }: { articleStats: any; isLoading: boolean; onNavigate: (path: string) => void }) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-muted rounded w-1/4 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-muted rounded w-1/3"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const articles = articleStats?.articles || [];
  const totalArticles = articles.length;
  const publishedArticles = articles.filter((a: any) => a.status === 'published').length;
  const draftArticles = articles.filter((a: any) => a.status === 'draft').length;

  const articleStatCards = [
    {
      title: "文章總數",
      value: totalArticles,
      icon: BookOpen,
      color: "#3b82f6",
      bgColor: "bg-blue-50",
      description: "所有文章數量",
    },
    {
      title: "已發布文章",
      value: publishedArticles,
      icon: CheckCircle2,
      color: "#10b981",
      bgColor: "bg-green-50",
      description: "公開可見的文章",
    },
    {
      title: "草稿文章",
      value: draftArticles,
      icon: FileEdit,
      color: "#f97316",
      bgColor: "bg-orange-50",
      description: "尚未發布的草稿",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">文章管理</h2>
          <p className="text-gray-400">市場洞察博客文章統計</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onNavigate('/admin/articles')}
            className="px-4 py-2 bg-[#1E3A8A] text-white rounded-lg hover:bg-[#1E3A8A]/90 transition-colors font-medium"
          >
            管理文章
          </button>
          <button
            onClick={() => onNavigate('/admin/create-article')}
            className="px-4 py-2 bg-[#FDD835] text-[#1E3A8A] font-semibold rounded-lg hover:bg-[#FDD835]/90 transition-colors"
          >
            AI 生成文章
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {articleStatCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={index} 
              className="p-6 hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-l-4" 
              style={{ borderLeftColor: stat.color }}
              onClick={() => onNavigate('/admin/articles')}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <Icon className="w-6 h-6" style={{ color: stat.color }} />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">{stat.title}</p>
                <p className="text-3xl font-bold text-white mb-2">{stat.value}</p>
                <p className="text-xs text-gray-400">{stat.description}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// 搜尋統計面板組件
function SearchStatsPanel() {
  const { data: searchStats, isLoading } = trpc.admin.getSearchStats.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-muted rounded w-1/4 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-muted rounded w-1/3"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const searchStatCards = [
    {
      title: "圖片搜尋成功率",
      value: `${searchStats?.imageSuccessRate.toFixed(2) || 0}%`,
      icon: Image,
      color: "#10b981",
      bgColor: "bg-green-50",
      description: `${searchStats?.imageSearches || 0} / ${searchStats?.totalSearches || 0} 次搜尋`,
    },
    {
      title: "回退到文字搜尋",
      value: searchStats?.fallbackToTextCount || 0,
      icon: FileText,
      color: "#f97316",
      bgColor: "bg-orange-50",
      description: "圖片搜尋失敗次數",
    },
    {
      title: "圖片搜尋平均耗時",
      value: `${((searchStats?.avgImageDuration || 0) / 1000).toFixed(2)}s`,
      icon: Clock,
      color: "#3b82f6",
      bgColor: "bg-blue-50",
      description: "平均響應時間",
    },
    {
      title: "文字搜尋平均耗時",
      value: `${((searchStats?.avgTextDuration || 0) / 1000).toFixed(2)}s`,
      icon: Clock,
      color: "#a855f7",
      bgColor: "bg-purple-50",
      description: "平均響應時間",
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">eBay 搜尋統計</h2>
        <p className="text-gray-400">圖片搜尋效果與效能分析</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {searchStatCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={index} 
              className="p-6 hover:shadow-lg transition-all hover:scale-105 border-l-4" 
              style={{ borderLeftColor: stat.color }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <Icon className="w-6 h-6" style={{ color: stat.color }} />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">{stat.title}</p>
                <p className="text-3xl font-bold text-white mb-2">{stat.value}</p>
                <p className="text-xs text-gray-400">{stat.description}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {searchStats && searchStats.totalSearches > 0 && (
        <Card className="p-6 border-l-4 border-l-green-500">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <h3 className="text-lg font-semibold">搜尋效果分析</h3>
          </div>
          <div className="space-y-2 text-sm text-gray-400">
            <p>• 總搜尋次數：<span className="font-semibold text-white">{searchStats.totalSearches}</span> 次</p>
            <p>• 圖片搜尋成功率：<span className="font-semibold text-green-600">{searchStats.imageSuccessRate.toFixed(2)}%</span></p>
            <p>• 圖片搜尋平均耗時：<span className="font-semibold text-blue-600">{(searchStats.avgImageDuration / 1000).toFixed(2)}s</span></p>
            <p>• 文字搜尋平均耗時：<span className="font-semibold text-purple-600">{(searchStats.avgTextDuration / 1000).toFixed(2)}s</span></p>
            <p className="mt-4 text-xs">
              💡 <span className="font-semibold">建議：</span>
              {searchStats.imageSuccessRate > 70 
                ? "圖片搜尋效果良好，繼續保持現有策略。" 
                : searchStats.imageSuccessRate > 50
                ? "圖片搜尋效果中等，建議檢查卡牌圖片質量。"
                : "圖片搜尋效果較低，建議優先使用文字搜尋或提升圖片質量。"}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
