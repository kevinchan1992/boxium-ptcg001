import { useState } from "react";
import { Link } from "wouter";
import { Bell, Check, CheckCheck, Trash2, Package, DollarSign, AlertTriangle, Info, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      <div className="min-h-screen pt-20 flex items-center justify-center" style={{ backgroundColor: "#f8f9fa" }}>
        <div className="text-center">
          <Bell className="w-16 h-16 mx-auto mb-4" style={{ color: "#06038d", opacity: 0.3 }} />
          <p className="text-gray-700 text-lg mb-4">請先登入以查看通知</p>
          <a href="/login"><Button style={{ backgroundColor: "#06038d" }} className="text-white">登入</Button></a>
        </div>
      </div>
    );
  }

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  return (
    <div className="min-h-screen pt-20 pb-12" style={{ backgroundColor: "#f8f9fa" }}>
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="outline" size="sm" className="border-[#06038d] text-[#06038d] hover:bg-[#06038d] hover:text-white p-2">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "#06038d" }}>
                <Bell className="w-6 h-6" style={{ color: "#FFD700" }} />
                通知中心
              </h1>
              {unreadCount > 0 && (
                <p className="text-sm text-gray-500">{unreadCount} 則未讀通知</p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="border-[#06038d] text-[#06038d] hover:bg-[#06038d] hover:text-white"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              全部已讀
            </Button>
          )}
        </div>

        {/* Filter Tabs */}
        <Tabs value={unreadOnly ? "unread" : "all"} onValueChange={(v) => setUnreadOnly(v === "unread")} className="mb-4">
          <TabsList className="bg-white border border-gray-200 shadow-sm">
            <TabsTrigger value="all" className="text-gray-600 data-[state=active]:bg-[#06038d] data-[state=active]:text-white">
              全部
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-gray-600 data-[state=active]:bg-[#06038d] data-[state=active]:text-white">
              未讀
              {unreadCount > 0 && (
                <Badge className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0">{unreadCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Notification List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-16 h-16 mx-auto mb-4" style={{ color: "#06038d", opacity: 0.2 }} />
            <p className="text-gray-400 text-lg">
              {unreadOnly ? "沒有未讀通知" : "暫無通知"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif: any) => (
              <div
                key={notif.id}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
                  !notif.isRead
                    ? "border-l-4 border-l-[#06038d] border-gray-200"
                    : "border-gray-200"
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "#f0f4ff" }}>
                      {typeIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${notif.isRead ? "text-gray-600" : "text-gray-900"}`}>
                            {notif.title}
                            {!notif.isRead && (
                              <span className="ml-2 inline-block w-2 h-2 rounded-full" style={{ backgroundColor: "#06038d" }} />
                            )}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>
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
                            className="mt-2 h-7 text-xs p-0 font-medium hover:underline"
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
        )}
      </div>
    </div>
  );
}
