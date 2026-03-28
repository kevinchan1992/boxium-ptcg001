import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, ImagePlus, Loader2, MessageCircle, ChevronDown, ChevronUp, X, Check, CheckCheck } from "lucide-react";
import { trpc as trpcClient } from "@/lib/trpc";

const ROLE_COLORS: Record<string, { badge: string; avatar: string; bubble: string }> = {
  buyer:  { badge: "bg-blue-100 text-blue-700 border-blue-200",   avatar: "bg-blue-100 text-blue-700",   bubble: "bg-blue-50 border border-blue-100" },
  seller: { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", avatar: "bg-emerald-100 text-emerald-700", bubble: "bg-emerald-50 border border-emerald-100" },
  admin:  { badge: "bg-violet-100 text-violet-700 border-violet-200",  avatar: "bg-violet-100 text-violet-700",  bubble: "bg-violet-50 border border-violet-100" },
};

const ROLE_LABELS: Record<string, string> = {
  buyer: "買家",
  seller: "賣家",
  admin: "管理員",
};

export default function OrderChat({ orderNo, defaultExpanded = false }: { orderNo: string; defaultExpanded?: boolean }) {
  const { data: user } = trpcClient.auth.me.useQuery();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: messages, refetch } = trpc.marketplace.getOrderMessages.useQuery(
    { orderNo },
    { enabled: expanded, refetchInterval: expanded ? 10000 : false }
  );

  const { data: unreadData } = trpc.marketplace.getOrderUnreadCount.useQuery(
    { orderNo },
    { refetchInterval: 30000 }
  );

  const sendMutation = trpc.marketplace.sendOrderMessage.useMutation({
    onSuccess: () => {
      setMessage("");
      setImageFile(null);
      setImagePreview(null);
      refetch();
    },
    onError: (e: any) => toast.error(e.message || "發送失敗"),
  });

  useEffect(() => {
    if (expanded && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, expanded]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("圖片不能超過 5MB");
      return;
    }
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

  const unreadCount = unreadData?.count ?? 0;

  return (
    <div className="rounded-xl overflow-hidden bg-white border border-gray-200 shadow-sm">
      {/* Header toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#06038D]/10 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-[#06038D]" />
          </div>
          <span className="font-semibold text-sm text-gray-800">訂單訊息</span>
          {unreadCount > 0 && (
            <Badge className="text-xs px-1.5 py-0 min-w-[20px] h-5 bg-red-500 hover:bg-red-500 text-white">
              {unreadCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          <span className="text-xs">{expanded ? "收起" : "展開"}</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {/* Messages area */}
          <div className="max-h-[380px] overflow-y-auto p-4 space-y-4 bg-gray-50/60">
            {!messages || messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 text-center leading-relaxed">
                  暫無訊息。你可以在此與{" "}
                  <span className="text-emerald-600 font-semibold">賣家</span> 或{" "}
                  <span className="text-violet-600 font-semibold">管理員</span> 溝通。
                </p>
              </div>
            ) : (
              messages.map((msg: any) => {
                const roleStyle = ROLE_COLORS[msg.senderRole] ?? ROLE_COLORS.buyer;
                return (
                  <div key={msg.id} className="flex gap-3">
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${roleStyle.avatar}`}>
                      {msg.isSystemMessage ? "⚙" : (msg.senderInitial ?? "?")}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Name + Role + Time */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-gray-800">{msg.senderName}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${roleStyle.badge}`}>
                          {ROLE_LABELS[msg.senderRole] ?? msg.senderRole}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(msg.createdAt).toLocaleString("zh-HK", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {/* Bubble */}
                      <div className={`rounded-xl rounded-tl-sm px-3 py-2.5 ${roleStyle.bubble}`}>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
                          {msg.content}
                        </p>
                        {msg.imageUrl && (
                          <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer" className="block mt-2">
                            <img
                              src={msg.imageUrl}
                              alt="附圖"
                              className="max-w-[200px] max-h-[150px] rounded-lg border border-gray-200 object-cover hover:opacity-90 transition-opacity"
                            />
                          </a>
                        )}
                        {/* Read receipt — only for messages sent by the current user */}
                        {msg.senderId === user?.id && (
                          <div className="flex justify-end mt-1">
                            {/* Double-check = read by at least one other party; single = sent only */}
                            {(msg.readByBuyer && msg.readBySeller) || (msg.readByBuyer && msg.readByAdmin) || (msg.readBySeller && msg.readByAdmin) ? (
                              <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </div>
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
          <div className="border-t border-gray-100 p-3 bg-white space-y-2">
            {imagePreview && (
              <div className="relative inline-block">
                <img src={imagePreview} alt="預覽" className="h-16 rounded-lg border border-gray-200 shadow-sm" />
                <button
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex gap-2 items-end">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="輸入訊息..."
                className="min-h-[44px] max-h-[100px] text-sm resize-none bg-gray-50 border-gray-200 focus:border-[#06038D]/40 focus:ring-[#06038D]/10 rounded-xl placeholder:text-gray-400 text-gray-700"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <div className="flex flex-col gap-1.5 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  className="h-9 w-9 bg-[#06038D] hover:bg-[#06038D]/90 rounded-xl shadow-sm"
                  disabled={sendMutation.isPending || (!message.trim() && !imageFile)}
                  onClick={handleSend}
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>
            <p className="text-[10px] text-gray-400 text-center">按 Enter 發送 · Shift+Enter 換行</p>
          </div>
        </div>
      )}
    </div>
  );
}
