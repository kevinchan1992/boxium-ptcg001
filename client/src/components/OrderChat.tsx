import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, ImagePlus, Loader2, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  buyer: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  seller: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

const ROLE_LABELS: Record<string, string> = {
  buyer: "買家",
  seller: "賣家",
  admin: "管理員",
};

export default function OrderChat({ orderNo }: { orderNo: string }) {
  const [expanded, setExpanded] = useState(false);
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
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Header toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">訂單訊息</span>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0 min-w-[20px] h-5">
              {unreadCount}
            </Badge>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="border-t">
          {/* Messages area */}
          <div className="max-h-[400px] overflow-y-auto p-3 space-y-3">
            {!messages || messages.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                暫無訊息。你可以在此與{" "}
                <span className="text-green-600 font-medium">賣家</span> 或{" "}
                <span className="text-purple-600 font-medium">管理員</span> 溝通。
              </div>
            ) : (
              messages.map((msg: any) => (
                <div key={msg.id} className="flex gap-2">
                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    msg.senderRole === 'admin' ? 'bg-purple-200 text-purple-700' :
                    msg.senderRole === 'seller' ? 'bg-green-200 text-green-700' :
                    'bg-blue-200 text-blue-700'
                  }`}>
                    {msg.isSystemMessage ? '⚙' : (msg.senderInitial ?? '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium">{msg.senderName}</span>
                      <Badge variant="outline" className={`text-[10px] px-1 py-0 ${ROLE_COLORS[msg.senderRole] ?? ''}`}>
                        {ROLE_LABELS[msg.senderRole] ?? msg.senderRole}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(msg.createdAt).toLocaleString('zh-HK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    {msg.imageUrl && (
                      <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                        <img src={msg.imageUrl} alt="附圖" className="mt-1 max-w-[200px] max-h-[150px] rounded border object-cover" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t p-3 space-y-2">
            {imagePreview && (
              <div className="relative inline-block">
                <img src={imagePreview} alt="預覽" className="h-16 rounded border" />
                <button
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                >
                  ×
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="輸入訊息..."
                className="min-h-[40px] max-h-[100px] text-sm resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <div className="flex flex-col gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  className="h-8 w-8 bg-[#06038D] hover:bg-[#06038D]/90"
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
          </div>
        </div>
      )}
    </div>
  );
}
