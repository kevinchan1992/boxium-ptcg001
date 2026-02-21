import { Notification } from "../../../drizzle/schema";
import { useTranslation } from "react-i18next";
import { Bell, TrendingUp, MessageSquare, Megaphone, X, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhTW, enUS, ja } from "date-fns/locale";
import { trpc } from "../lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: number) => void;
  onDelete?: (id: number) => void;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "price_alert":
      return <TrendingUp className="w-5 h-5 text-green-500" />;
    case "trade":
      return <MessageSquare className="w-5 h-5 text-blue-500" />;
    case "announcement":
      return <Megaphone className="w-5 h-5 text-purple-500" />;
    case "system":
    default:
      return <Bell className="w-5 h-5 text-gray-500" />;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "high":
      return "border-l-red-500";
    case "medium":
      return "border-l-yellow-500";
    case "low":
    default:
      return "border-l-gray-300";
  }
};

export function NotificationItem({ notification, onMarkAsRead, onDelete }: NotificationItemProps) {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
      if (onMarkAsRead) {
        onMarkAsRead(notification.id);
      }
    },
  });

  const deleteMutation = trpc.notifications.delete.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
      toast.success(t("notifications.deleteSuccess"));
      if (onDelete) {
        onDelete(notification.id);
      }
    },
    onError: () => {
      toast.error(t("notifications.deleteError"));
    },
  });

  const handleClick = () => {
    // Mark as read when clicked
    if (!notification.isRead) {
      markAsReadMutation.mutate({ notificationId: notification.id });
    }

    // Navigate to related URL if exists
    if (notification.relatedUrl) {
      setLocation(notification.relatedUrl);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteMutation.mutate({ notificationId: notification.id });
  };

  const getLocale = () => {
    switch (i18n.language) {
      case "zh-TW":
        return zhTW;
      case "ja":
        return ja;
      default:
        return enUS;
    }
  };

  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: getLocale(),
  });

  return (
    <div
      className={`
        relative p-4 border-l-4 ${getPriorityColor(notification.priority)}
        ${notification.isRead ? "bg-gray-50" : "bg-white"}
        hover:bg-gray-100 transition-colors cursor-pointer
        ${notification.relatedUrl ? "hover:shadow-md" : ""}
      `}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-1">
          {getNotificationIcon(notification.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={`text-sm font-medium ${notification.isRead ? "text-gray-700" : "text-gray-900"}`}>
              {notification.title}
            </h4>
            <button
              onClick={handleDelete}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-200 transition-colors"
              aria-label={t("notifications.delete")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <p className={`mt-1 text-sm ${notification.isRead ? "text-gray-500" : "text-gray-700"}`}>
            {notification.content}
          </p>

          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400">{timeAgo}</span>
            {notification.relatedUrl && (
              <ExternalLink className="w-3 h-3 text-gray-400" />
            )}
          </div>
        </div>

        {/* Unread indicator */}
        {!notification.isRead && (
          <div className="flex-shrink-0">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          </div>
        )}
      </div>
    </div>
  );
}
