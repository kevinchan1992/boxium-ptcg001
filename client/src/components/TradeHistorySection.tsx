/**
 * TradeHistorySection — 以卡換卡歷史記錄
 * Displays all card trade records for the current user with detail view
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ArrowLeftRight, ChevronRight, Trash2, X, ArrowRight, ArrowLeft, Calendar, User2, StickyNote, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getProxiedImageUrl } from "@/lib/utils";

const BRAND_BLUE = "#06038D";
const BRAND_YELLOW = "#FEDD00";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TradeItem {
  id: number;
  tradeId: number;
  direction: "in" | "out";
  cardId: number;
  cardName: string;
  grader: string;
  grade: string | null;
  quantity: number;
  estimatedValue: string | null;
  cardImageUrl: string | null;
  cardSeries: string | null;
  collectionId: number | null;
  newCollectionId: number | null;
}

interface Trade {
  id: number;
  tradedAt: Date;
  tradePartner: string | null;
  cashAdjustment: string | null;
  notes: string | null;
  items: TradeItem[];
}

// ─── Card thumbnail ────────────────────────────────────────────────────────────
function CardThumb({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  return (
    <div className="w-10 h-14 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200">
      {imageUrl ? (
        <img
          src={getProxiedImageUrl(imageUrl) ?? undefined}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <ArrowLeftRight className="w-4 h-4 text-gray-400" />
      )}
    </div>
  );
}

// ─── Trade Detail Sheet ────────────────────────────────────────────────────────
function TradeDetailSheet({ trade, onClose, onDelete }: { trade: Trade; onClose: () => void; onDelete: () => void }) {
  const outItems = trade.items.filter((i) => i.direction === "out");
  const inItems = trade.items.filter((i) => i.direction === "in");

  const outTotal = outItems.reduce((s, i) => s + (parseFloat(i.estimatedValue ?? "0") * i.quantity), 0);
  const inTotal = inItems.reduce((s, i) => s + (parseFloat(i.estimatedValue ?? "0") * i.quantity), 0);
  const cashAdj = parseFloat(trade.cashAdjustment ?? "0");
  const netDiff = inTotal + cashAdj - outTotal;

  const tradedAt = new Date(trade.tradedAt);
  const dateStr = tradedAt.toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Panel */}
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0" style={{ background: BRAND_BLUE }}>
          <ArrowLeftRight className="w-5 h-5 text-white" />
          <div className="flex-1">
            <h3 className="font-bold text-white">交換記錄詳情</h3>
            <p className="text-white/70 text-xs">{dateStr}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Meta info */}
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="flex items-center gap-1.5 text-gray-600">
              <Calendar className="w-3.5 h-3.5" style={{ color: BRAND_BLUE }} />
              <span>{dateStr}</span>
            </div>
            {trade.tradePartner && (
              <div className="flex items-center gap-1.5 text-gray-600">
                <User2 className="w-3.5 h-3.5" style={{ color: BRAND_BLUE }} />
                <span>{trade.tradePartner}</span>
              </div>
            )}
          </div>

          {/* Out cards */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: `${BRAND_BLUE}10` }}>
              <ArrowRight className="w-3.5 h-3.5" style={{ color: BRAND_BLUE }} />
              <span className="text-sm font-semibold" style={{ color: BRAND_BLUE }}>換出卡牌</span>
              <span className="ml-auto text-xs font-medium text-gray-500">共 {outItems.length} 張</span>
            </div>
            <div className="divide-y divide-gray-50">
              {outItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <CardThumb imageUrl={item.cardImageUrl} name={item.cardName} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.cardName}</p>
                    <p className="text-xs text-gray-400">{item.grader} {item.grade} × {item.quantity}</p>
                  </div>
                  {item.estimatedValue && (
                    <span className="text-sm font-semibold text-gray-700">HKD {parseFloat(item.estimatedValue).toLocaleString()}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="px-4 py-2 bg-gray-50 text-right text-xs text-gray-500">
              換出總估值：<span className="font-semibold text-gray-700">HKD {outTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* In cards */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: `${BRAND_BLUE}10` }}>
              <ArrowLeft className="w-3.5 h-3.5" style={{ color: BRAND_BLUE }} />
              <span className="text-sm font-semibold" style={{ color: BRAND_BLUE }}>換入卡牌</span>
              <span className="ml-auto text-xs font-medium text-gray-500">共 {inItems.length} 張</span>
            </div>
            <div className="divide-y divide-gray-50">
              {inItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <CardThumb imageUrl={item.cardImageUrl} name={item.cardName} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.cardName}</p>
                    <p className="text-xs text-gray-400">{item.grader} {item.grade} × {item.quantity}</p>
                  </div>
                  {item.estimatedValue && (
                    <span className="text-sm font-semibold text-gray-700">HKD {parseFloat(item.estimatedValue).toLocaleString()}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="px-4 py-2 bg-gray-50 text-right text-xs text-gray-500">
              換入總估值：<span className="font-semibold text-gray-700">HKD {inTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Cash adjustment */}
          {cashAdj !== 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-100 bg-gray-50">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">補差金額</span>
              <span className={`ml-auto text-sm font-semibold ${cashAdj > 0 ? "text-green-600" : "text-red-500"}`}>
                {cashAdj > 0 ? "+" : ""}HKD {cashAdj.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Net difference */}
          <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: BRAND_BLUE }}>
            <ArrowLeftRight className="w-4 h-4 text-white/70" />
            <span className="text-sm text-white/80">換入 − 換出差值</span>
            <span className={`ml-auto text-base font-bold ${netDiff >= 0 ? "text-green-300" : "text-red-300"}`}>
              {netDiff >= 0 ? "+" : ""}HKD {netDiff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Notes */}
          {trade.notes && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl border border-gray-100 bg-gray-50">
              <StickyNote className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">{trade.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-red-500 border-red-200 hover:bg-red-50"
            onClick={onDelete}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            刪除記錄
          </Button>
          <Button size="sm" className="flex-1 text-white font-semibold" style={{ background: BRAND_BLUE }} onClick={onClose}>
            關閉
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Trade Row ─────────────────────────────────────────────────────────────────
function TradeRow({ trade, onClick }: { trade: Trade; onClick: () => void }) {
  const outItems = trade.items.filter((i) => i.direction === "out");
  const inItems = trade.items.filter((i) => i.direction === "in");
  const outTotal = outItems.reduce((s, i) => s + (parseFloat(i.estimatedValue ?? "0") * i.quantity), 0);
  const inTotal = inItems.reduce((s, i) => s + (parseFloat(i.estimatedValue ?? "0") * i.quantity), 0);
  const cashAdj = parseFloat(trade.cashAdjustment ?? "0");
  const netDiff = inTotal + cashAdj - outTotal;

  const tradedAt = new Date(trade.tradedAt);
  const dateStr = tradedAt.toLocaleDateString("zh-HK", { month: "short", day: "numeric", year: "numeric" });

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all active:scale-[0.99] p-4"
    >
      <div className="flex items-start gap-3">
        {/* Date badge */}
        <div className="flex-shrink-0 w-11 h-11 rounded-xl flex flex-col items-center justify-center text-white" style={{ background: BRAND_BLUE }}>
          <span className="text-[10px] font-medium leading-tight">{tradedAt.toLocaleDateString("zh-HK", { month: "short" })}</span>
          <span className="text-base font-bold leading-tight">{tradedAt.getDate()}</span>
        </div>

        {/* Cards preview */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {/* Out card thumbs */}
            <div className="flex -space-x-2">
              {outItems.slice(0, 3).map((item) => (
                <CardThumb key={item.id} imageUrl={item.cardImageUrl} name={item.cardName} />
              ))}
              {outItems.length > 3 && (
                <div className="w-10 h-14 rounded-md bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 border border-white">
                  +{outItems.length - 3}
                </div>
              )}
            </div>
            <ArrowLeftRight className="w-4 h-4 flex-shrink-0 text-gray-400" />
            {/* In card thumbs */}
            <div className="flex -space-x-2">
              {inItems.slice(0, 3).map((item) => (
                <CardThumb key={item.id} imageUrl={item.cardImageUrl} name={item.cardName} />
              ))}
              {inItems.length > 3 && (
                <div className="w-10 h-14 rounded-md bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 border border-white">
                  +{inItems.length - 3}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">{dateStr}</span>
            {trade.tradePartner && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <User2 className="w-3 h-3" />
                {trade.tradePartner}
              </span>
            )}
          </div>
        </div>

        {/* Net diff */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <span className={`text-sm font-bold ${netDiff >= 0 ? "text-green-600" : "text-red-500"}`}>
            {netDiff >= 0 ? "+" : ""}HKD {Math.abs(netDiff).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
      </div>
    </button>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function TradeHistorySection() {
  const utils = trpc.useUtils();
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: trades, isLoading } = trpc.profile.getTrades.useQuery(undefined, {
    staleTime: 30_000,
  });

  const deleteMutation = trpc.profile.deleteTrade.useMutation({
    onSuccess: () => {
      toast.success("交換記錄已刪除");
      utils.profile.getTrades.invalidate();
      utils.profile.getCollection.invalidate();
      utils.profile.getCollectionStats.invalidate();
      setSelectedTrade(null);
      setDeletingId(null);
    },
    onError: (e) => {
      toast.error(`刪除失敗：${e.message}`);
      setDeletingId(null);
    },
  });

  const handleDelete = (tradeId: number) => {
    if (!confirm("確定要刪除此交換記錄嗎？此操作無法復原，換入的卡牌將從收藏中移除，換出的卡牌將恢復為正常狀態。")) return;
    setDeletingId(tradeId);
    deleteMutation.mutate({ tradeId });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!trades || trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: `${BRAND_BLUE}10` }}>
          <ArrowLeftRight className="w-8 h-8" style={{ color: BRAND_BLUE }} />
        </div>
        <p className="text-gray-500 font-medium">尚無交換記錄</p>
        <p className="text-gray-400 text-sm mt-1">在收藏清單中點擊 ⇄ 按鈕開始記錄以卡換卡</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: `${BRAND_BLUE}08` }}>
        <ArrowLeftRight className="w-4 h-4" style={{ color: BRAND_BLUE }} />
        <span className="text-sm font-medium" style={{ color: BRAND_BLUE }}>
          共 {trades.length} 筆交換記錄
        </span>
      </div>

      {/* Trade list */}
      {(trades as Trade[]).map((trade) => (
        <TradeRow
          key={trade.id}
          trade={trade}
          onClick={() => setSelectedTrade(trade)}
        />
      ))}

      {/* Detail sheet */}
      {selectedTrade && (
        <TradeDetailSheet
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onDelete={() => handleDelete(selectedTrade.id)}
        />
      )}
    </div>
  );
}
