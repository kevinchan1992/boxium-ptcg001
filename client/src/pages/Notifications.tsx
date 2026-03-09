import { useState } from "react";
import { Link } from "wouter";
import { Bell, Check, CheckCheck, Trash2, Package, DollarSign, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandTabs, BrandTabsList, BrandTabsTrigger, BrandTabsContent } from "@/components/BrandTabs";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const typeIcon = (type: string) => {
  switch (type) {
    case "trade": return <Package className="w-4 h-4" style={{ color: "#06038d" }} />;
    case "payment": return <DollarSign className="w-4 h-4 text-green-600" />;
    case "system": return <Info className="w-4 h-4 text-gray-500" />;
    case "alert": return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    default: return <Bell className="w-4 h-4 text-gray-500" />;
  }
};

export default function Notifications() {
  const { data: user } = trpc.auth.me.useQuery();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.notifications.getMyNotifications.useQuery(
    { limit: 50, offset: 0, unreadOnly },
    { enabled: !!user }
  );

  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.getMyNotifications.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    },
  });

  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      toast.success("已標記所有通知為已讀");
      utils.notifications.getMyNotifications.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    },
  });

  const deleteMutation = trpc.notifications.deleteNotification.useMutation({
    onSuccess: () => {
      utils.notifications.getMyNotifications.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#f0f4ff" }}>
            <Bell className="w-10 h-10" style={{ color: "#06038d", opacity: 0.4 }} />
          </div>
          <p className="text-gray-700 text-lg mb-4">請先登入以查看通知</p>
          <a href="/login"><Button style={{ backgroundColor: "#06038d" }} className="text-white font-bold">登入</Button></a>
        </div>
      </div>
    );
  }

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero Banner ── */}
      <div
        className="relative"
        style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }}
      >
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "#FFD700" }} />
        <div className="max-w-2xl mx-auto px-4 pt-10 pb-8">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center border-4 shadow-xl flex-shrink-0"
              style={{ background: "#FFD700", borderColor: "white" }}
            >
              <Bell className="w-10 h-10" style={{ color: "#06038d" }} />
            </div>
            <div className="text-center md:text-left pb-1 flex-1">
              <div className="flex items-center gap-3 justify-center md:justify-start flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-white">通知中心</h1>
                {unreadCount > 0 && (
                  <Badge className="bg-red-500 text-white text-sm px-2 py-0.5">{unreadCount} 則未讀</Badge>
                )}
              </div>
              <p className="text-white/70 text-sm mt-1">查看所有系統通知和交易動態</p>
            </div>
            {unreadCount > 0 && (
              <Button
                size="sm"
                className="font-bold"
                style={{ background: "#FFD700", color: "#06038d" }}
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
              >
                <CheckCheck className="w-4 h-4 mr-1" />
                全部已讀
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-2xl mx-auto px-4 mt-6 pb-16">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden p-6">
          {/* Filter Tabs */}
          <BrandTabs
            defaultValue="all"
            value={unreadOnly ? "unread" : "all"}
            onValueChange={(v) => setUnreadOnly(v === "unread")}
          >
            <BrandTabsList className="mb-4">
              <BrandTabsTrigger value="all" icon={<Bell className="w-4 h-4" />} label="全部">全部</BrandTabsTrigger>
              <BrandTabsTrigger value="unread" icon={<Check className="w-4 h-4" />} label="未讀">
                未讀
                {unreadCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-red-500 text-white rounded-full">
                    {unreadCount}
                  </span>
                )}
              </BrandTabsTrigger>
            </BrandTabsList>

            <BrandTabsContent value="all">
              <NotificationList
                notifications={notifications}
                isLoading={isLoading}
                unreadOnly={false}
                markAsReadMutation={markAsReadMutation}
                deleteMutation={deleteMutation}
              />
            </BrandTabsContent>
            <BrandTabsContent value="unread">
              <NotificationList
                notifications={notifications.filter((n: any) => !n.isRead)}
                isLoading={isLoading}
                unreadOnly={true}
                markAsReadMutation={markAsReadMutation}
                deleteMutation={deleteMutation}
              />
            </BrandTabsContent>
          </BrandTabs>
        </div>
      </div>
    </div>
  );
}

function NotificationList({
  notifications,
  isLoading,
  unreadOnly,
  markAsReadMutation,
  deleteMutation,
}: {
  notifications: any[];
  isLoading: boolean;
  unreadOnly: boolean;
  markAsReadMutation: any;
  deleteMutation: any;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "#f0f4ff" }} />
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#f0f4ff" }}>
          <Bell className="w-8 h-8" style={{ color: "#06038d", opacity: 0.3 }} />
        </div>
        <p className="text-gray-400 text-lg">
          {unreadOnly ? "沒有未讀通知" : "暫無通知"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notifications.map((notif: any) => (
        <div
          key={notif.id}
          className="rounded-xl border overflow-hidden transition-all"
          style={{
            borderLeft: !notif.isRead ? "4px solid #06038d" : "1px solid #e5e7eb",
            borderColor: !notif.isRead ? undefined : "#e5e7eb",
            background: !notif.isRead ? "#f8faff" : "white",
          }}
        >
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#e8edff" }}
              >
                {typeIcon(notif.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${notif.isRead ? "text-gray-600" : "text-gray-900"}`}>
                      {notif.title}
                      {!notif.isRead && (
                        <span className="ml-2 inline-block w-2 h-2 rounded-full" style={{ backgroundColor: "#06038d" }} />
                      )}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{notif.body}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(notif.createdAt).toLocaleString("zh-HK")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!notif.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-green-600"
                        onClick={() => markAsReadMutation.mutate({ notificationId: notif.id })}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                      onClick={() => deleteMutation.mutate({ notificationId: notif.id })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                {notif.linkUrl && (
                  <Link href={notif.linkUrl}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-7 text-xs p-0 font-semibold hover:underline"
                      style={{ color: "#06038d" }}
                      onClick={() => !notif.isRead && markAsReadMutation.mutate({ notificationId: notif.id })}
                    >
                      查看詳情 →
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
