import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Users, CreditCard, Database, TrendingUp, Activity, Image, FileText, Clock, CheckCircle2, RefreshCw, Camera, AlertTriangle, XCircle, ShieldCheck, Scale, BarChart3, Timer, Trophy } from "lucide-react";
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
          <Card key={i} className="p-6 animate-pulse bg-white border-slate-200">
            <div className="h-4 bg-slate-100 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-slate-100 rounded w-1/3"></div>
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
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">數據統計</h2>
          <p className="text-xs sm:text-sm text-slate-500">系統整體數據概覽</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300"
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
              className="p-3 sm:p-6 hover:shadow-md transition-all hover:scale-105 border-l-4 bg-white border-slate-200 shadow-sm" 
              style={{ borderLeftColor: stat.color }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-slate-500 mb-0.5 sm:mb-1">{stat.title}</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900">{stat.value.toLocaleString()}</p>
                </div>
                <div className={`p-2 sm:p-3 rounded-full ${stat.bgColor}`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: stat.color }} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 爭議統計面板 */}
      <DisputeStatsPanel />

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

// ─── 爭議統計面板 ──────────────────────────────────────────────────────────
function DisputeStatsPanel() {
  const [, setLocation] = useLocation();
  const { data: disputeStats, isLoading } = trpc.admin.getDisputeStats.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-slate-100 rounded w-1/4 animate-pulse"></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4 animate-pulse bg-white border-slate-200">
              <div className="h-4 bg-slate-100 rounded w-1/2 mb-3"></div>
              <div className="h-8 bg-slate-100 rounded w-1/3"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const hasUrgent = (disputeStats?.unresolvedOver3DaysCount ?? 0) > 0;
  const hasUnresolved = (disputeStats?.unresolvedCount ?? 0) > 0;

  const cards = [
    {
      title: "本月新增爭議",
      value: disputeStats?.thisMonthDisputeCount ?? 0,
      icon: Scale,
      color: "#f97316",
      bgColor: "bg-orange-50",
      description: "本月開啟的爭議案件數",
      alert: false,
    },
    {
      title: "超過 3 天未解決",
      value: disputeStats?.unresolvedOver3DaysCount ?? 0,
      icon: Timer,
      color: (disputeStats?.unresolvedOver3DaysCount ?? 0) > 0 ? "#ef4444" : "#10b981",
      bgColor: (disputeStats?.unresolvedOver3DaysCount ?? 0) > 0 ? "bg-red-50" : "bg-green-50",
      description: "需要優先處理的爭議",
      alert: hasUrgent,
    },
    {
      title: "平均解決天數",
      value: `${disputeStats?.avgResolutionDays ?? 0}天`,
      icon: BarChart3,
      color: "#3b82f6",
      bgColor: "bg-blue-50",
      description: `共 ${disputeStats?.totalResolvedCount ?? 0} 件已解決`,
      alert: false,
      isString: true,
    },
    {
      title: "買家勝率",
      value: `${disputeStats?.buyerWinRate ?? 0}%`,
      icon: Trophy,
      color: "#a855f7",
      bgColor: "bg-purple-50",
      description: `買家 ${disputeStats?.buyerWinCount ?? 0} 件 / 賣家 ${disputeStats?.sellerWinCount ?? 0} 件`,
      alert: false,
      isString: true,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Scale className="w-5 h-5 text-orange-500" />
            爭議案件統計
            {hasUrgent && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 ring-1 ring-inset ring-red-200">
                需處理
              </span>
            )}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">爭議案件健康度與解決效率監控</p>
        </div>
        {hasUnresolved && (
          <button
            onClick={() => setLocation('/admin?tab=messages')}
            className="text-xs text-orange-600 hover:text-orange-700 underline"
          >
            前往處理 →
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card
              key={index}
              className={`p-3 sm:p-4 hover:shadow-md transition-all hover:scale-105 border-l-4 bg-white border-slate-200 shadow-sm ${
                card.alert ? 'ring-1 ring-red-200' : ''
              }`}
              style={{ borderLeftColor: card.color }}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500 mb-0.5 truncate">{card.title}</p>
                  <p className={`text-xl sm:text-2xl font-bold ${card.alert ? 'text-red-600' : 'text-slate-900'}`}>
                    {card.value}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">{card.description}</p>
                </div>
                <div className={`p-2 rounded-full ${card.bgColor} flex-shrink-0 ml-2`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: card.color }} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 勝率進度條 */}
      {(disputeStats?.totalResolvedCount ?? 0) > 0 && (
        <Card className="p-4 border-l-4 border-l-purple-500 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-purple-500" />
            <h3 className="text-sm font-semibold text-slate-900">爭議裁決分佈</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-blue-600 w-16 shrink-0">買家勝訴</span>
              <div className="flex-1 bg-slate-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${disputeStats?.buyerWinRate ?? 0}%` }}
                />
              </div>
              <span className="text-slate-500 w-10 text-right">{disputeStats?.buyerWinRate ?? 0}%</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-600 w-16 shrink-0">賣家勝訴</span>
              <div className="flex-1 bg-slate-200 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${disputeStats?.sellerWinRate ?? 0}%` }}
                />
              </div>
              <span className="text-slate-500 w-10 text-right">{disputeStats?.sellerWinRate ?? 0}%</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            基於 {disputeStats?.totalResolvedCount ?? 0} 件已解決案件的統計
          </p>
        </Card>
      )}

      {!hasUnresolved && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 border border-emerald-200">
          <ShieldCheck className="w-4 h-4" />
          <span>目前無待處理爭議案件</span>
        </div>
      )}
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
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-500" />
            支付寶截圖審核
            {hasAlerts && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 ring-1 ring-inset ring-red-200">
                需處理
              </span>
            )}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">支付寶 HK 截圖審核狀態監控</p>
        </div>
        {hasAlerts && (
          <button
            onClick={() => setLocation('/admin?tab=marketplace&proofStatus=pending_review')}
            className="text-xs text-amber-600 hover:text-amber-700 underline"
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
              className={`p-3 sm:p-4 hover:shadow-md transition-all hover:scale-105 border-l-4 bg-white border-slate-200 shadow-sm ${
                card.alert ? 'ring-1 ring-amber-200' : ''
              }`}
              style={{ borderLeftColor: card.color }}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500 mb-0.5 truncate">{card.title}</p>
                  <p className={`text-xl sm:text-2xl font-bold ${
                    card.alert ? 'text-amber-600' : 'text-slate-900'
                  }`}>
                    {card.value.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">{card.description}</p>
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
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2 border border-emerald-200">
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
        <div className="h-6 bg-slate-100 rounded w-1/4 animate-pulse"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-6 animate-pulse bg-white border-slate-200">
              <div className="h-4 bg-slate-100 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-slate-100 rounded w-1/3"></div>
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
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">搜尋統計</h2>
        <p className="text-xs sm:text-sm text-slate-500">數據源搜尋效果與效能分析</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {searchStatCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={index}
              className="p-3 sm:p-4 hover:shadow-md transition-all hover:scale-105 border-l-4 bg-white border-slate-200 shadow-sm"
              style={{ borderLeftColor: stat.color }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 sm:p-3 rounded-full ${stat.bgColor}`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: stat.color }} />
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">{stat.title}</p>
                <p className="text-xl sm:text-3xl font-bold text-slate-900 mb-2">{stat.value}</p>
                <p className="text-xs text-slate-400">{stat.description}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {searchStats && searchStats.totalSearches > 0 && (
        <Card className="p-6 border-l-4 border-l-emerald-500 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-semibold text-slate-900">搜尋效果分析</h3>
          </div>
          <div className="space-y-2 text-sm text-slate-500">
            <p>• 總搜尋次數：<span className="font-semibold text-slate-900">{searchStats.totalSearches}</span> 次</p>
            <p>• 圖片搜尋成功率：<span className="font-semibold text-emerald-600">{searchStats.imageSuccessRate.toFixed(2)}%</span></p>
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
