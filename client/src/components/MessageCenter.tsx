/**
 * MessageCenter — Global floating message center
 *
 * Features:
 * - Fixed FAB (bottom-right) with unread badge
 * - Click to open a panel showing all order threads
 * - Select a thread to view the full chat (reuses OrderChat internals)
 * - Desktop: two-column layout; Mobile: single column with back navigation
 * - Auto-polls for new messages every 30 seconds
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { MessageCircle, X, ChevronLeft, Send, ImagePlus, Loader2, Check, CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrderThread {
  orderNo: string;
  orderId: number;
  listingTitle: string | null;
  listingImage: string | null;
  counterpartyName: string | null;
  unreadCount: number;
  latestContent: string | null;
  latestAt: Date | null;
  orderStatus: string;
}

interface ChatMessage {
  id: number;
  orderNo: string;
  senderId: number;
  senderRole: string;
  senderName?: string | null;
  content: string;
  imageUrl: string | null;
  isSystemMessage: boolean;
  readByBuyer: boolean;
  readBySeller: boolean;
  createdAt: Date;
}

// ─── Role colours (matches OrderChat.tsx) ─────────────────────────────────────
const ROLE_COLORS: Record<string, { badge: string; avatar: string; bubble: string }> = {
  buyer:  { badge: "bg-blue-100 text-blue-700 border-blue-200",   avatar: "bg-blue-100 text-blue-700",   bubble: "bg-blue-50 border border-blue-100" },
  seller: { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", avatar: "bg-emerald-100 text-emerald-700", bubble: "bg-emerald-50 border border-emerald-100" },
  admin:  { badge: "bg-violet-100 text-violet-700 border-violet-200",  avatar: "bg-violet-100 text-violet-700",  bubble: "bg-violet-50 border border-violet-100" },
};
const ROLE_LABELS: Record<string, string> = { buyer: "買家", seller: "賣家", admin: "管理員" };

// ─── Order status labels ───────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  pending_payment: "待付款",
  paid: "已付款",
  processing: "處理中",
  shipped: "已出貨",
  delivered: "已送達",
  completed: "已完成",
  cancelled: "已取消",
  refunded: "已退款",
  disputed: "爭議中",
};

// ─── Thread List Item ─────────────────────────────────────────────────────────
function ThreadItem({
  thread,
  isActive,
  onClick,
}: {
  thread: OrderThread;
  isActive: boolean;
  onClick: () => void;
}) {
  const timeStr = thread.latestAt
    ? new Date(thread.latestAt).toLocaleString("zh-HK", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-3 flex gap-3 items-start transition-colors border-b border-gray-100 last:border-b-0",
        isActive ? "bg-[#06038D]/8 border-l-2 border-l-[#06038D]" : "hover:bg-gray-50"
      )}
    >
      {/* Thumbnail */}
      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
        {thread.listingImage ? (
          <img
            src={thread.listingImage}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-gray-400" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <span className="text-xs font-semibold text-gray-800 truncate leading-tight">
            {thread.listingTitle ?? `訂單 ${thread.orderNo}`}
          </span>
          {thread.unreadCount > 0 && (
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {thread.unreadCount > 9 ? "9+" : thread.unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[10px] text-gray-400 truncate flex-1">
            {thread.counterpartyName ? `與 ${thread.counterpartyName}` : ""}
            {thread.latestContent ? ` · ${thread.latestContent}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-gray-400">{timeStr}</span>
          <span className="text-[10px] px-1 py-0 rounded bg-gray-100 text-gray-500">
            {STATUS_LABELS[thread.orderStatus] ?? thread.orderStatus}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Inline Chat Panel ────────────────────────────────────────────────────────
function ChatPanel({
  orderNo,
  onBack,
}: {
  orderNo: string;
  onBack?: () => void;
}) {
  const { data: user } = trpc.auth.me.useQuery();
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const { data: messages, refetch } = trpc.marketplace.getOrderMessages.useQuery(
    { orderNo },
    { refetchInterval: 10000 }
  );

  const sendMutation = trpc.marketplace.sendOrderMessage.useMutation({
    onSuccess: () => {
      setMessage("");
      setImageFile(null);
      setImagePreview(null);
      refetch();
      utils.marketplace.getMyOrderThreads.invalidate();
      utils.marketplace.getTotalUnreadMessages.invalidate();
    },
    onError: (e: any) => toast.error(e.message || "發送失敗"),
  });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Messages are marked as read automatically when getOrderMessages is fetched
  // (the backend marks them read on each query call)
  useEffect(() => {
    if (orderNo && messages && messages.length > 0) {
      utils.marketplace.getMyOrderThreads.invalidate();
      utils.marketplace.getTotalUnreadMessages.invalidate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNo, messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("圖片不能超過 5MB"); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    if (!message.trim() && !imageFile) return;
    let imageBase64: string | undefined;
    let imageMimeType: string | undefined;
    if (imageFile) {
      const buffer = await imageFile.arrayBuffer();
      imageBase64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      imageMimeType = imageFile.type;
    }
    sendMutation.mutate({
      orderNo,
      content: message.trim() || (imageFile ? "[圖片]" : ""),
      imageBase64,
      imageMimeType,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 bg-white flex-shrink-0">
        {onBack && (
          <button onClick={onBack} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <span className="text-xs font-semibold text-gray-700 truncate flex-1">
          訂單 {orderNo}
        </span>
        <a
          href={`/orders/${orderNo}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-[#06038D] hover:underline flex-shrink-0"
        >
          查看訂單
        </a>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/60 min-h-0">
        {!messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
            <MessageCircle className="w-8 h-8 opacity-40" />
            <p className="text-xs">暫無訊息</p>
          </div>
        ) : (
          (messages as ChatMessage[]).map((msg) => {
            const isMe = msg.senderId === user?.id;
            const colors = ROLE_COLORS[msg.senderRole] ?? ROLE_COLORS.buyer;
            const isRead = msg.senderRole === 'buyer' ? msg.readBySeller : msg.readByBuyer;

            if (msg.isSystemMessage) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <span className="text-[10px] text-gray-400 bg-gray-100 rounded-full px-2.5 py-0.5">
                    {msg.content}
                  </span>
                </div>
              );
            }

            return (
              <div key={msg.id} className={cn("flex gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                {/* Avatar */}
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5", colors.avatar)}>
                  {(msg.senderName ?? ROLE_LABELS[msg.senderRole] ?? "?")[0]}
                </div>
                {/* Bubble */}
                <div className={cn("max-w-[75%] flex flex-col gap-0.5", isMe ? "items-end" : "items-start")}>
                  <div className={cn("px-2.5 py-1.5 rounded-xl text-xs", colors.bubble)}>
                    {msg.imageUrl && (
                      <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={msg.imageUrl}
                          alt="圖片"
                          className="max-w-[140px] max-h-[140px] rounded-lg object-cover mb-1"
                        />
                      </a>
                    )}
                    {msg.content && msg.content !== "[圖片]" && (
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-gray-400">
                      {new Date(msg.createdAt).toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {isMe && (
                      isRead
                        ? <CheckCheck className="w-3 h-3 text-blue-400" />
                        : <Check className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white p-2 flex-shrink-0">
        {imagePreview && (
          <div className="relative inline-block mb-1.5">
            <img src={imagePreview} alt="預覽" className="h-14 w-14 rounded-lg object-cover border border-gray-200" />
            <button
              onClick={() => { setImageFile(null); setImagePreview(null); }}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
        <div className="flex gap-1.5 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <ImagePlus className="w-4 h-4" />
          </button>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="輸入訊息… (Enter 發送)"
            className="flex-1 min-h-[36px] max-h-[80px] text-xs resize-none py-2 px-2.5 rounded-lg border-gray-200"
            rows={1}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sendMutation.isPending || (!message.trim() && !imageFile)}
            className="flex-shrink-0 h-8 w-8 p-0 bg-[#06038D] hover:bg-[#06038D]/90"
          >
            {sendMutation.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Send className="w-3.5 h-3.5" />
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main MessageCenter Component ─────────────────────────────────────────────
export default function MessageCenter() {
  const [open, setOpen] = useState(false);
  const [selectedOrderNo, setSelectedOrderNo] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const panelRef = useRef<HTMLDivElement>(null);

  // Total unread count for FAB badge
  const { data: unreadData } = trpc.marketplace.getTotalUnreadMessages.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const totalUnread = unreadData?.count ?? 0;

  // All order threads
  const { data: threads, refetch: refetchThreads } = trpc.marketplace.getMyOrderThreads.useQuery(undefined, {
    refetchInterval: open ? 15000 : 60000,
  });

  // Invalidate threads when panel opens
  useEffect(() => {
    if (open) refetchThreads();
  }, [open, refetchThreads]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelectThread = useCallback((orderNo: string) => {
    setSelectedOrderNo(orderNo);
    setMobileView("chat");
  }, []);

  const handleBack = useCallback(() => {
    setMobileView("list");
    setSelectedOrderNo(null);
    refetchThreads();
  }, [refetchThreads]);

  const threadList = (threads ?? []) as OrderThread[];

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-[9998] w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200",
          "bg-[#06038D] hover:bg-[#06038D]/90 active:scale-95",
          open && "ring-2 ring-[#FEDD00] ring-offset-2"
        )}
        aria-label="訊息中心"
      >
        <MessageCircle className="w-6 h-6 text-white" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-[#FEDD00] text-[#06038D] text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className={cn(
            "fixed bottom-24 right-6 z-[9999] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden",
            "flex flex-col",
            // Desktop: two-column layout
            "w-[680px] h-[520px] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-8rem)]",
            // Mobile: full-width single column
            "sm:w-[680px] w-[calc(100vw-3rem)]"
          )}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#06038D] text-white flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              <span className="font-semibold text-sm">訊息中心</span>
              {totalUnread > 0 && (
                <Badge className="bg-[#FEDD00] text-[#06038D] text-[10px] font-bold px-1.5 py-0 h-4 hover:bg-[#FEDD00]">
                  {totalUnread}
                </Badge>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-1 min-h-0">
            {/* Thread list — always visible on desktop, hidden on mobile when chat is open */}
            <div
              className={cn(
                "flex flex-col border-r border-gray-200 overflow-y-auto",
                // Desktop: always show left column
                "hidden sm:flex sm:w-[240px] sm:flex-shrink-0",
                // Mobile: show list or chat
                mobileView === "list" ? "flex w-full" : "hidden"
              )}
            >
              {threadList.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400 p-6">
                  <MessageCircle className="w-10 h-10 opacity-30" />
                  <p className="text-xs text-center">暫無訊息記錄</p>
                  <p className="text-[10px] text-center text-gray-300">購買或出售商品後，可在此與對方溝通</p>
                </div>
              ) : (
                threadList.map((thread) => (
                  <ThreadItem
                    key={thread.orderNo}
                    thread={thread}
                    isActive={selectedOrderNo === thread.orderNo}
                    onClick={() => handleSelectThread(thread.orderNo)}
                  />
                ))
              )}
            </div>

            {/* Chat area */}
            <div
              className={cn(
                "flex-1 flex flex-col min-w-0",
                // Mobile: show chat or list
                mobileView === "chat" ? "flex" : "hidden sm:flex"
              )}
            >
              {selectedOrderNo ? (
                <ChatPanel
                  orderNo={selectedOrderNo}
                  onBack={mobileView === "chat" ? handleBack : undefined}
                />
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400">
                  <MessageCircle className="w-12 h-12 opacity-20" />
                  <p className="text-sm">選擇一個對話</p>
                  <p className="text-xs text-gray-300">從左側選擇訂單訊息</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
