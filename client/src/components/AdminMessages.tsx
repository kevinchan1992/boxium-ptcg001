import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Search, Eye, CheckCheck, RefreshCw, Filter, ChevronDown, ChevronUp, AlertTriangle, Scale, ShieldCheck, User } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import OrderChat from "@/components/OrderChat";
import DisputeMediaUpload from "@/components/DisputeMediaUpload";

const ROLE_LABELS: Record<string, string> = {
  buyer: "買家",
  seller: "賣家",
  admin: "管理員",
  system: "系統",
};

const ROLE_COLORS: Record<string, string> = {
  buyer: "bg-blue-100 text-blue-700 border-blue-200",
  seller: "bg-green-100 text-green-700 border-green-200",
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  system: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function AdminMessages() {
  const [searchOrderNo, setSearchOrderNo] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // Dispute dialog state
  const [disputeOrderId, setDisputeOrderId] = useState<number | null>(null);
  const [disputeOrderNo, setDisputeOrderNo] = useState<string>("");
  const [disputeReason, setDisputeReason] = useState("");

  // Resolve dialog state
  const [resolveOrderId, setResolveOrderId] = useState<number | null>(null);
  const [resolveOrderNo, setResolveOrderNo] = useState<string>("");
  const [resolveInFavorOf, setResolveInFavorOf] = useState<"buyer" | "seller">("buyer");
  const [resolveResolution, setResolveResolution] = useState("");

  const LIMIT = 50;

  const queryInput = useMemo(() => ({
    limit: LIMIT,
    offset,
    orderNo: searchOrderNo.trim() || undefined,
    unreadOnly: unreadOnly || undefined,
  }), [offset, searchOrderNo, unreadOnly]);

  const { data, isLoading, refetch, isFetching } = trpc.marketplace.adminGetAllMessages.useQuery(queryInput, {
    refetchInterval: 30000,
  });

  const markRead = trpc.marketplace.adminMarkOrderMessagesRead.useMutation({
    onSuccess: () => refetch(),
  });

  const markDisputed = trpc.marketplace.adminMarkOrderAsDisputed.useMutation({
    onSuccess: (res) => {
      toast.success(`訂單 #${res.orderNo} 已標記為爭議，Email 通知已發送`);
      setDisputeOrderId(null);
      setDisputeReason("");
      refetch();
    },
    onError: (e: any) => toast.error(e.message || "操作失敗"),
  });

  const resolveDispute = trpc.marketplace.adminResolveDispute.useMutation({
    onSuccess: () => {
      toast.success(`爭議已解決，Email 通知已發送`);
      setResolveOrderId(null);
      setResolveResolution("");
      refetch();
    },
    onError: (e: any) => toast.error(e.message || "操作失敗"),
  });

  const messages = data?.messages ?? [];
  const stats = data?.stats ?? { total: 0, unread: 0, activeOrders: 0 };

  // Group messages by orderNo
  const orderGroups = useMemo(() => {
    const map = new Map<string, {
      orderId: number;
      msgs: typeof messages;
      unreadCount: number;
      latestMsg: (typeof messages)[0] | undefined;
      orderStatus?: string;
    }>();
    for (const msg of messages) {
      if (!map.has(msg.orderNo)) {
        map.set(msg.orderNo, { orderId: msg.orderId, msgs: [], unreadCount: 0, latestMsg: undefined, orderStatus: (msg as any).orderStatus });
      }
      const group = map.get(msg.orderNo)!;
      group.msgs.push(msg);
      if (!msg.readByAdmin) group.unreadCount++;
      if (!group.latestMsg) group.latestMsg = msg;
    }
    return Array.from(map.entries()).map(([orderNo, g]) => ({ orderNo, ...g }));
  }, [messages]);

  const toggleOrder = (orderNo: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderNo)) next.delete(orderNo);
      else next.add(orderNo);
      return next;
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    refetch();
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border border-gray-200">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-gray-500 mb-1">訊息總數</p>
            <p className="text-2xl font-bold text-gray-800">{stats.total.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border border-orange-200 bg-orange-50">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-orange-600 mb-1">管理員未讀</p>
            <p className="text-2xl font-bold text-orange-600">{stats.unread.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border border-blue-200 bg-blue-50">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-blue-600 mb-1">有訊息訂單</p>
            <p className="text-2xl font-bold text-blue-600">{stats.activeOrders.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border border-gray-200">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            篩選條件
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <form onSubmit={handleSearch} className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜尋訂單編號..."
                value={searchOrderNo}
                onChange={e => setSearchOrderNo(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Button
              type="button"
              variant={unreadOnly ? "default" : "outline"}
              size="sm"
              onClick={() => { setUnreadOnly(!unreadOnly); setOffset(0); }}
              className={unreadOnly ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
            >
              {unreadOnly ? "僅未讀" : "全部訊息"}
            </Button>
            <Button type="submit" size="sm" className="bg-[#06038d] hover:bg-[#06038d]/90 text-white">
              搜尋
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Order Groups */}
      <Card className="border border-gray-200">
        <CardHeader className="pb-3 pt-4 px-4 border-b border-gray-100">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            訊息記錄（按訂單分組）
            {orderGroups.length > 0 && (
              <span className="text-xs font-normal text-gray-400">（{orderGroups.length} 個訂單）</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400 mr-2" />
              <span className="text-sm text-gray-500">載入中...</span>
            </div>
          ) : orderGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">暫無訊息記錄</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {orderGroups.map(group => {
                const isExpanded = expandedOrders.has(group.orderNo);
                const latestMsg = group.latestMsg;
                const isDisputed = group.orderStatus === "disputed";
                return (
                  <div key={group.orderNo} className={`${group.unreadCount > 0 ? "bg-orange-50/40" : ""} ${isDisputed ? "border-l-2 border-red-400" : ""}`}>
                    {/* Order header row */}
                    <div className="px-4 py-3 flex items-center gap-3">
                      {/* Expand toggle */}
                      <button
                        onClick={() => toggleOrder(group.orderNo)}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {/* Order info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/orders/${group.orderNo}`}>
                            <span className="text-sm font-mono font-semibold text-[#06038d] hover:underline cursor-pointer">
                              #{group.orderNo}
                            </span>
                          </Link>
                          {isDisputed && (
                            <Badge className="bg-red-100 text-red-600 border-red-200 text-[10px] px-1.5 py-0 h-4">
                              爭議中
                            </Badge>
                          )}
                          {group.unreadCount > 0 && (
                            <Badge className="bg-orange-100 text-orange-600 border-orange-200 text-[10px] px-1.5 py-0 h-4">
                              {group.unreadCount} 未讀
                            </Badge>
                          )}
                          <span className="text-xs text-gray-400">{group.msgs.length} 條訊息</span>
                        </div>
                        {latestMsg && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            <span className={`inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-medium border mr-1 ${ROLE_COLORS[latestMsg.senderRole] ?? ROLE_COLORS.system}`}>
                              {ROLE_LABELS[latestMsg.senderRole] ?? latestMsg.senderRole}
                            </span>
                            {latestMsg.imageUrl ? "[圖片訊息]" : latestMsg.content}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                        {latestMsg && (
                          <span className="text-[11px] text-gray-400">
                            {new Date(latestMsg.createdAt).toLocaleString('zh-HK', {
                              month: '2-digit', day: '2-digit',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        )}
                        {group.unreadCount > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 hover:bg-orange-100 text-orange-500"
                            title="標記此訂單所有訊息為已讀"
                            onClick={() => markRead.mutate({ orderId: group.orderId })}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            <span className="text-xs">已讀</span>
                          </Button>
                        )}
                        {/* Resolve dispute button — only for disputed orders */}
                        {isDisputed && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-green-600 border-green-200 hover:bg-green-50"
                            title="解決此訂單爭議"
                            onClick={() => {
                              setResolveOrderId(group.orderId);
                              setResolveOrderNo(group.orderNo);
                              setResolveInFavorOf("buyer");
                              setResolveResolution("");
                            }}
                          >
                            <Scale className="w-3.5 h-3.5 mr-1" />
                            <span className="text-xs">解決爭議</span>
                          </Button>
                        )}
                        {/* Mark dispute button */}
                        {!isDisputed && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-red-600 border-red-200 hover:bg-red-50"
                            title="標記此訂單為爭議"
                            onClick={() => {
                              setDisputeOrderId(group.orderId);
                              setDisputeOrderNo(group.orderNo);
                              setDisputeReason("");
                            }}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                            <span className="text-xs">標記爭議</span>
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expanded: inline OrderChat + Dispute Media */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3">
                        <OrderChat orderNo={group.orderNo} defaultExpanded={true} />
                        {/* Dispute media — shown for all orders (read-only for admin) */}
                        <div className="rounded-xl bg-white border border-orange-100 p-3">
                          <DisputeMediaUpload
                            orderId={group.orderId}
                            orderNo={group.orderNo}
                            canUpload={false}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {messages.length === LIMIT && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
          >
            上一頁
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOffset(offset + LIMIT)}
          >
            下一頁
          </Button>
        </div>
      )}

      {/* Mark Dispute Dialog */}
      <Dialog open={disputeOrderId !== null} onOpenChange={(open) => { if (!open) setDisputeOrderId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              標記訂單為爭議
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              訂單 <span className="font-mono font-semibold text-[#06038d]">#{disputeOrderNo}</span> 將被標記為爭議狀態，系統將自動發送 Email 通知買家和賣家。
            </p>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">爭議原因（選填）</label>
              <Textarea
                placeholder="例如：買家反映商品與描述不符..."
                value={disputeReason}
                onChange={e => setDisputeReason(e.target.value)}
                className="text-sm min-h-[80px] resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOrderId(null)}>取消</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={markDisputed.isPending}
              onClick={() => {
                if (disputeOrderId !== null) {
                  markDisputed.mutate({ orderId: disputeOrderId, reason: disputeReason.trim() || undefined });
                }
              }}
            >
              {markDisputed.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <AlertTriangle className="w-4 h-4 mr-1" />}
              確認標記爭議
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Dispute Dialog */}
      <Dialog open={resolveOrderId !== null} onOpenChange={(open) => { if (!open) setResolveOrderId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Scale className="w-5 h-5" />
              解決訂單爭議
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              訂單 <span className="font-mono font-semibold text-[#06038d]">#{resolveOrderNo}</span> 的爭議裁決。解決後將自動發送 Email 通知買家和賣家。
            </p>
            {/* Favor selection */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">裁決支持方</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setResolveInFavorOf("buyer")}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 py-3 px-4 transition-all ${
                    resolveInFavorOf === "buyer"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-500 hover:border-blue-200 hover:bg-blue-50/30"
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium">支持買家</span>
                </button>
                <button
                  type="button"
                  onClick={() => setResolveInFavorOf("seller")}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 py-3 px-4 transition-all ${
                    resolveInFavorOf === "seller"
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-200 text-gray-500 hover:border-green-200 hover:bg-green-50/30"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-sm font-medium">支持賣家</span>
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {resolveInFavorOf === "buyer"
                  ? "支持買家：訂單將退款給買家，賣家收到相應通知。"
                  : "支持賣家：訂單視為完成，買家收到相應通知。"}
              </p>
            </div>
            {/* Resolution note */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">裁決說明（選填）</label>
              <Textarea
                placeholder="例如：根據買家提供的照片，商品確實與描述不符，決定退款給買家..."
                value={resolveResolution}
                onChange={e => setResolveResolution(e.target.value)}
                className="text-sm min-h-[80px] resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOrderId(null)}>取消</Button>
            <Button
              className={resolveInFavorOf === "buyer" ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
              disabled={resolveDispute.isPending}
              onClick={() => {
                if (resolveOrderId !== null) {
                  resolveDispute.mutate({
                    orderId: resolveOrderId,
                    outcome: resolveInFavorOf === 'buyer' ? 'refund_buyer' : 'release_seller',
                    resolution: resolveResolution.trim() || (
                      resolveInFavorOf === 'buyer'
                        ? '管理員裁決支持買家，訂單退款處理。'
                        : '管理員裁決支持賣家，訂單完成。'
                    ),
                  });
                }
              }}
            >
              {resolveDispute.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Scale className="w-4 h-4 mr-1" />}
              確認裁決（支持{resolveInFavorOf === "buyer" ? "買家" : "賣家"}）
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
