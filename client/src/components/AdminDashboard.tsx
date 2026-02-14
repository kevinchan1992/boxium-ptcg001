import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Users, CreditCard, Database, TrendingUp, Activity } from "lucide-react";

export function AdminDashboard() {
  const { data: stats, isLoading } = trpc.admin.getDashboardStats.useQuery();

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
      color: "text-blue-500",
      bgColor: "bg-blue-50",
    },
    {
      title: "卡牌總數",
      value: stats?.totalCards || 0,
      icon: CreditCard,
      color: "text-green-500",
      bgColor: "bg-green-50",
    },
    {
      title: "數據源總數",
      value: stats?.totalDataSources || 0,
      icon: Database,
      color: "text-purple-500",
      bgColor: "bg-purple-50",
    },
    {
      title: "活躍數據源",
      value: stats?.activeDataSources || 0,
      icon: Activity,
      color: "text-orange-500",
      bgColor: "bg-orange-50",
    },
    {
      title: "價格記錄數",
      value: stats?.totalPriceRecords || 0,
      icon: TrendingUp,
      color: "text-pink-500",
      bgColor: "bg-pink-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">數據統計</h2>
        <p className="text-muted-foreground">系統整體數據概覽</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold text-foreground">{stat.value.toLocaleString()}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
