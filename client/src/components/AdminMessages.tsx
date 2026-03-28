import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Search, Eye, CheckCheck, RefreshCw, Filter } from "lucide-react";
import { Link } from "wouter";

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
  const LIMIT = 50;

  // Stable query input
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

  const messages = data?.messages ?? [];
  const stats = data?.stats ?? { total: 0, unread: 0, activeOrders: 0 };

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

      {/* Messages List */}
      <Card className="border border-gray-200">
        <CardHeader className="pb-3 pt-4 px-4 border-b border-gray-100">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            訊息記錄
            {messages.length > 0 && (
              <span className="text-xs font-normal text-gray-400">（最新 {messages.length} 條）</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400 mr-2" />
              <span className="text-sm text-gray-500">載入中...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">暫無訊息記錄</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`px-4 py-3 hover:bg-gray-50 transition-colors ${!msg.readByAdmin ? "bg-orange-50/50" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Role badge */}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 mt-0.5 ${ROLE_COLORS[msg.senderRole] ?? ROLE_COLORS.system}`}>
                      {ROLE_LABELS[msg.senderRole] ?? msg.senderRole}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Link href={`/orders/${msg.orderNo}`}>
                          <span className="text-xs font-mono text-[#06038d] hover:underline cursor-pointer">
                            #{msg.orderNo}
                          </span>
                        </Link>
                        {!msg.readByAdmin && (
                          <Badge className="bg-orange-100 text-orange-600 border-orange-200 text-[10px] px-1.5 py-0 h-4">
                            未讀
                          </Badge>
                        )}
                        {msg.isSystemMessage && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-gray-400">
                            系統
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 break-words leading-relaxed">
                        {msg.imageUrl ? (
                          <span className="flex items-center gap-1 text-gray-400 italic text-xs">
                            [圖片訊息]
                          </span>
                        ) : (
                          msg.content
                        )}
                      </p>
                    </div>

                    {/* Right side: time + actions */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="text-[11px] text-gray-400">
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleString('zh-HK', {
                          month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        }) : '—'}
                      </span>
                      <div className="flex items-center gap-1">
                        {/* Read status indicators */}
                        <span title={`買家${msg.readByBuyer ? '已讀' : '未讀'}`}>
                          <CheckCheck className={`w-3.5 h-3.5 ${msg.readByBuyer ? 'text-blue-400' : 'text-gray-200'}`} />
                        </span>
                        <span title={`賣家${msg.readBySeller ? '已讀' : '未讀'}`}>
                          <CheckCheck className={`w-3.5 h-3.5 ${msg.readBySeller ? 'text-green-400' : 'text-gray-200'}`} />
                        </span>
                        {!msg.readByAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-orange-100"
                            title="標記為已讀"
                            onClick={() => markRead.mutate({ orderId: msg.orderId })}
                          >
                            <Eye className="w-3.5 h-3.5 text-orange-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
    </div>
  );
}
