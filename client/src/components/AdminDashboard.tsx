import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatHKLocale } from "@/lib/formatDate";
import { Users, CreditCard, Database, TrendingUp, Activity, Image, FileText, Clock, CheckCircle2, RefreshCw, Camera, AlertTriangle, XCircle, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export function AdminDashboard() {
  const utils = trpc.useUtils();
  const { data: stats, isLoading, refetch } = trpc.admin.getDashboardStats.useQuery();
  
  const handleRefresh = async () => {
    toast.info("正在刷新統計數據...");
    await refetch();
    toast.success("統計數據已更新");
  };

  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white mb-1">數據統計</h2>
          <p className="text-xs sm:text-sm text-gray-400">系統整體數據概覽</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          刷新數據
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
              <Card 
              key={index} 
              className="p-3 sm:p-6 hover:shadow-lg transition-all hover:scale-105 border-l-4" 
              style={{ borderLeftColor: stat.color }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-400 mb-0.5 sm:mb-1">{stat.title}</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-white">{stat.value.toLocaleString()}</p>
                </div>
                <div className={`p-2 sm:p-3 rounded-full ${stat.bgColor}`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: stat.color }} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>



      {/* 截圖審核統計面板 */}
      <ProofReviewStatsPanel
        pendingProofCount={stats?.pendingProofCount ?? 0}
        todayRejectedProofCount={stats?.todayRejectedProofCount ?? 0}
        overdueProofCount={stats?.overdueProofCount ?? 0}
      />
      {/* 搜尋統計面板 */}
      <SearchStatsPanel />

    </div>
  );
}



// 截圖審核統計面板組件
function ProofReviewStatsPanel({
  pendingProofCount,
  todayRejectedProofCount,
  overdueProofCount,
}: {
  pendingProofCount: number;
  todayRejectedProofCount: number;
  overdueProofCount: number;
}) {
  const [, setLocation] = useLocation();
  const proofCards = [
    {
      title: "待審核截圖",
      value: pendingProofCount,
      icon: Camera,
      color: pendingProofCount > 0 ? "#f59e0b" : "#10b981",
      bgColor: pendingProofCount > 0 ? "bg-amber-50" : "bg-green-50",
      description: "待管理員審核的支付寶截圖",
      alert: pendingProofCount > 0,
    },
    {
      title: "超時未審核",
      value: overdueProofCount,
      icon: AlertTriangle,
      color: overdueProofCount > 0 ? "#ef4444" : "#10b981",
      bgColor: overdueProofCount > 0 ? "bg-red-50" : "bg-green-50",
      description: "提交超過 48 小時未審核",
      alert: overdueProofCount > 0,
    },
    {
      title: "今日已拒絕",
      value: todayRejectedProofCount,
      icon: XCircle,
      color: todayRejectedProofCount > 0 ? "#f97316" : "#10b981",
      bgColor: todayRejectedProofCount > 0 ? "bg-orange-50" : "bg-green-50",
      description: "今日被拒絕的截圖（買家需重新提交）",
      alert: todayRejectedProofCount > 0,
    },
  ];
  const hasAlerts = pendingProofCount > 0 || overdueProofCount > 0;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white mb-1 flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-400" />
            支付寶截圖審核
            {hasAlerts && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white animate-pulse">
                需處理
              </span>
            )}
          </h2>
          <p className="text-xs sm:text-sm text-gray-400">支付寶 HK 截圖審核狀態監控</p>
        </div>
        {hasAlerts && (
          <button
            onClick={() => setLocation('/admin?tab=marketplace&proofStatus=pending_review')}
            className="text-xs text-amber-400 hover:text-amber-300 underline"
          >
            前往審核 →
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {proofCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card
              key={index}
              className={`p-3 sm:p-4 hover:shadow-lg transition-all hover:scale-105 border-l-4 ${
                card.alert ? 'ring-1 ring-amber-500/30' : ''
              }`}
              style={{ borderLeftColor: card.color }}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-0.5 truncate">{card.title}</p>
                  <p className={`text-xl sm:text-2xl font-bold ${
                    card.alert ? 'text-amber-400' : 'text-white'
                  }`}>
                    {card.value.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">{card.description}</p>
                </div>
                <div className={`p-2 rounded-full ${card.bgColor} flex-shrink-0 ml-2`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: card.color }} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {!hasAlerts && (
        <div className="flex items-center gap-2 text-sm text-green-400 bg-green-900/20 rounded-lg px-4 py-2">
          <ShieldCheck className="w-4 h-4" />
          <span>所有截圖已審核，無待處理項目</span>
        </div>
      )}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <h2 className="text-lg sm:text-xl font-bold text-white mb-1">搜尋統計</h2>
        <p className="text-xs sm:text-sm text-gray-400">數據源搜尋效果與效能分析</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {searchStatCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={index}
              className="p-3 sm:p-4 hover:shadow-lg transition-all hover:scale-105 border-l-4"
              style={{ borderLeftColor: stat.color }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 sm:p-3 rounded-full ${stat.bgColor}`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: stat.color }} />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">{stat.title}</p>
                <p className="text-xl sm:text-3xl font-bold text-white mb-2">{stat.value}</p>
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
