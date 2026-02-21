import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Check, Trash2, X } from "lucide-react";
import { trpc } from "../lib/trpc";
import { NotificationItem } from "./NotificationItem";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ScrollArea } from "./ui/scroll-area";

export function NotificationCenter() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const utils = trpc.useUtils();

  // Get unread count
  const { data: unreadCount = 0 } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Get notifications
  const { data: notifications = [], isLoading } = trpc.notifications.list.useQuery(
    {
      limit: 20,
      offset: 0,
      unreadOnly: filter === "unread",
    },
    {
      enabled: isOpen,
    }
  );

  // Mark all as read mutation
  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
      toast.success(t("notifications.markAllAsReadSuccess"));
    },
    onError: () => {
      toast.error(t("notifications.markAllAsReadError"));
    },
  });

  // Delete all read mutation
  const deleteAllReadMutation = trpc.notifications.deleteAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
      toast.success(t("notifications.deleteAllReadSuccess"));
    },
    onError: () => {
      toast.error(t("notifications.deleteAllReadError"));
    },
  });

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleDeleteAllRead = () => {
    deleteAllReadMutation.mutate();
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
          aria-label={t("notifications.title")}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[400px] p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{t("notifications.title")}</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors"
            aria-label={t("common.close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              filter === "all"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t("notifications.all")}
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              filter === "unread"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t("notifications.unread")} {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>

        {/* Actions */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-end gap-2 p-2 border-b bg-gray-50">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsReadMutation.isPending || unreadCount === 0}
              className="text-xs"
            >
              <Check className="w-3 h-3 mr-1" />
              {t("notifications.markAllAsRead")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteAllRead}
              disabled={deleteAllReadMutation.isPending}
              className="text-xs"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              {t("notifications.deleteAllRead")}
            </Button>
          </div>
        )}

        {/* Notifications list */}
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-gray-500">{t("common.loading")}</div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <Bell className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">
                {filter === "unread"
                  ? t("notifications.noUnreadNotifications")
                  : t("notifications.noNotifications")}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={() => {
                    // Handled by NotificationItem
                  }}
                  onDelete={() => {
                    // Handled by NotificationItem
                  }}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
