/**
 * BidDrawer — 從右側滑出的極簡風出價面板
 * 讓用戶不需跳轉頁面即可完成競標
 * Editorial / Auction House aesthetic
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { parseApiError } from "@/lib/parseApiError";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { getProxiedImageUrl } from "@/lib/utils";
import {
  X, Gavel, Clock, TrendingUp, ChevronRight, Loader2,
  CheckCircle2, Shield, AlertTriangle, ArrowRight, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ─── Countdown Hook ───────────────────────────────────────────────────────────
function useCountdown(endTime: Date | string | null) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!endTime) { setRemaining(0); return; }
    const end = new Date(endTime).getTime();
    const tick = () => setRemaining(Math.max(0, end - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  return remaining;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "已結束";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}天 ${h % 24}時 ${m % 60}分`;
  if (h > 0) return `${h}時 ${m % 60}分 ${s % 60}秒`;
  return `${m}分 ${s % 60}秒`;
}

// ─── Terms Dialog (inline, minimal) ──────────────────────────────────────────
function TermsConfirmDialog({
  open,
  onClose,
  onAgree,
  isAgreeing,
}: {
  open: boolean;
  onClose: () => void;
  onAgree: () => void;
  isAgreeing: boolean;
}) {
  const { t } = useTranslation();
  const buyerTerms = [
    { icon: "✅", title: t("auctionDetail.terms.buyer.binding.title"), desc: t("auctionDetail.terms.buyer.binding.desc") },
    { icon: "💳", title: t("auctionDetail.terms.buyer.payment.title"), desc: t("auctionDetail.terms.buyer.payment.desc") },
    { icon: "🚫", title: t("auctionDetail.terms.buyer.noCancel.title"), desc: t("auctionDetail.terms.buyer.noCancel.desc") },
    { icon: "📦", title: t("auctionDetail.terms.buyer.shipping.title"), desc: t("auctionDetail.terms.buyer.shipping.desc") },
  ];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden border-0 rounded-2xl bg-white">
        {/* Header */}
        <div className="bg-[#1a1a2e] px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#FEDD00] rounded-xl flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-[#1a1a2e]" />
            </div>
            <div>
              <p className="text-[10px] text-white/50 uppercase tracking-widest font-medium">競投須知</p>
              <h2 className="text-base font-bold text-white">出價前請確認</h2>
            </div>
          </div>
        </div>
        {/* Terms */}
        <div className="px-4 py-3 space-y-2 max-h-64 overflow-y-auto">
          {buyerTerms.map((term, i) => (
            <div key={i} className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-xl">
              <span className="text-base leading-none mt-0.5 shrink-0">{term.icon}</span>
              <div>
                <p className="text-xs font-bold text-gray-900">{term.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{term.desc}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Footer */}
        <div className="px-4 pb-4 pt-2 flex gap-2 border-t border-gray-100">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 text-gray-600 h-10 text-sm bg-white"
          >
            取消
          </Button>
          <Button
            className="flex-[2] bg-[#1a1a2e] hover:bg-[#06038D] text-white rounded-xl h-10 text-sm font-bold"
            onClick={onAgree}
            disabled={isAgreeing}
          >
            {isAgreeing
              ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              : <CheckCircle2 className="w-4 h-4 mr-1.5" />
            }
            我已了解，繼續出價
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── BidDrawer ────────────────────────────────────────────────────────────────
export interface BidDrawerProps {
  /** The auction listing object (from auction.list or auction.getById) */
  listing: any;
  /** Whether the drawer is open */
  open: boolean;
  /** Called when the drawer should close */
  onClose: () => void;
  /** Called after a successful bid (to refresh parent data) */
  onBidSuccess?: () => void;
}

export function BidDrawer({ listing, open, onClose, onBidSuccess }: BidDrawerProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [bidAmount, setBidAmount] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const pendingBidAmountRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auth
  const { data: me } = trpc.auth.me.useQuery();
  const user = me;

  // Fetch fresh listing data for accurate bid state
  const { data: detailData, refetch: refetchDetail } = trpc.auction.getById.useQuery(
    { id: listing.id },
    { enabled: open, staleTime: 10_000 }
  );
  const liveListing = detailData?.listing ?? listing;
  const liveBids = detailData?.bids ?? [];

  // Terms check
  const { data: termsData, refetch: refetchTerms } = trpc.auction.checkTermsAgreement.useQuery(
    { role: "buyer" },
    { enabled: !!user && open }
  );

  // Ban status
  const { data: banStatus } = trpc.auction.getMyBanStatus.useQuery(
    undefined,
    { enabled: !!user && open, staleTime: 30_000 }
  );

  // Mutations
  const agreeMutation = trpc.auction.agreeToTerms.useMutation({
    onSuccess: () => {
      refetchTerms();
      setShowTerms(false);
      // Execute pending bid
      const amount = pendingBidAmountRef.current;
      pendingBidAmountRef.current = null;
      if (amount !== null) {
        placeBidMutation.mutate({ listingId: liveListing.id, amount });
      }
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const placeBidMutation = trpc.auction.placeBid.useMutation({
    onSuccess: () => {
      toast.success("出價成功！");
      setBidAmount("");
      refetchDetail();
      onBidSuccess?.();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  // Derived values
  const currentPrice = liveListing.currentHighestBid
    ? parseFloat(liveListing.currentHighestBid)
    : parseFloat(liveListing.startingBid || "0");
  const bidIncrement = parseFloat(liveListing.bidIncrement || "10");
  const minBid = liveBids.length > 0 || liveListing.currentHighestBid
    ? currentPrice + bidIncrement
    : parseFloat(liveListing.startingBid || "1");
  const buyNowPrice = liveListing.buyNowPrice ? parseFloat(liveListing.buyNowPrice) : null;

  const remaining = useCountdown(liveListing.auctionEndAt);
  const isEnded = (remaining !== null && remaining <= 0) ||
    ["ended_sold", "ended_no_bid", "cancelled"].includes(liveListing.auctionStatus ?? "");
  const isUrgent = remaining !== null && remaining > 0 && remaining < 3600_000;

  const isCurrentHighestBidder = user && liveListing.currentHighestBidderId === (user as any).id;

  // Quick bid amounts
  const quickAmounts = [minBid, minBid + bidIncrement, minBid + bidIncrement * 2, minBid + bidIncrement * 5];

  // Images
  const images: string[] | null = (() => {
    try { return liveListing.images ? JSON.parse(liveListing.images) : null; }
    catch { return null; }
  })();
  const coverImage = getProxiedImageUrl(images?.[0] ?? null);

  // Reset state when drawer opens
  useEffect(() => {
    if (open) {
      setBidAmount("");
      pendingBidAmountRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleBid = useCallback(() => {
    if (!user) {
      onClose();
      setLocation("/login");
      return;
    }
    if (banStatus?.isBanned) {
      toast.error("您的帳號已被禁止競投");
      return;
    }
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount < minBid) {
      toast.error(`出價必須至少 HK$${minBid.toFixed(0)}`);
      return;
    }
    if (buyNowPrice && amount >= buyNowPrice) {
      toast.error(`出價已達即時購買價 HK$${buyNowPrice}，請使用「立即購買」`);
      return;
    }
    if (!termsData?.agreed) {
      pendingBidAmountRef.current = amount;
      setShowTerms(true);
      return;
    }
    placeBidMutation.mutate({ listingId: liveListing.id, amount });
  }, [user, banStatus, bidAmount, minBid, buyNowPrice, termsData, liveListing.id]);

  const handleQuickBid = useCallback((amount: number) => {
    setBidAmount(amount.toString());
    if (!user) {
      onClose();
      setLocation("/login");
      return;
    }
    if (banStatus?.isBanned) {
      toast.error("您的帳號已被禁止競投");
      return;
    }
    if (!termsData?.agreed) {
      pendingBidAmountRef.current = amount;
      setShowTerms(true);
      return;
    }
    placeBidMutation.mutate({ listingId: liveListing.id, amount });
  }, [user, banStatus, termsData, liveListing.id]);

  const handleTermsAgreed = () => {
    agreeMutation.mutate({ role: "buyer" });
  };

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        className={`fixed inset-0 z-40 transition-all duration-300 ${
          open ? "bg-black/30 backdrop-blur-[2px] pointer-events-auto" : "bg-transparent pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Drawer Panel ── */}
      <div
        className={`fixed top-0 right-0 h-full z-50 flex flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: "min(420px, 100vw)" }}
        role="dialog"
        aria-modal="true"
        aria-label="出價面板"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-medium">Place Your Bid</p>
            <h2
              className="text-lg font-bold text-[#1a1a2e] leading-tight"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              出價競投
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors"
            aria-label="關閉"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Lot Preview ── */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
              {coverImage ? (
                <img src={coverImage} alt={liveListing.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Gavel className="w-6 h-6 text-gray-300" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">
                {liveListing.tcgSeries === "pokemon" ? "Pokémon TCG" :
                 liveListing.tcgSeries === "onepiece" ? "One Piece TCG" :
                 liveListing.tcgSeries === "yugioh" ? "Yu-Gi-Oh! TCG" : "TCG"}
              </p>
              <p className="text-sm font-semibold text-[#1a1a2e] line-clamp-2 leading-snug mt-0.5">
                {liveListing.title}
              </p>
              {liveListing.condition && (
                <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">{liveListing.condition}</p>
              )}
            </div>
            <button
              onClick={() => { onClose(); setLocation(`/auction/${liveListing.id}`); }}
              className="shrink-0 text-gray-300 hover:text-[#06038D] transition-colors"
              aria-label="查看詳情"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* ── Current Bid & Countdown ── */}
          <div className="px-5 py-4 border-b border-gray-50">
            <div className="grid grid-cols-2 gap-3">
              {/* Current Bid */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-medium mb-1">
                  {liveBids.length > 0 ? "目前最高出價" : "起拍價"}
                </p>
                <p
                  className="text-xl font-bold text-[#1a1a2e] leading-none"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  HK${currentPrice.toLocaleString()}
                </p>
                {liveListing.bidCount > 0 && (
                  <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {liveListing.bidCount} 次出價
                  </p>
                )}
              </div>
              {/* Countdown */}
              <div className={`rounded-xl p-3 ${isUrgent ? "bg-red-50" : "bg-gray-50"}`}>
                <p className={`text-[10px] uppercase tracking-widest font-medium mb-1 ${isUrgent ? "text-red-400" : "text-gray-400"}`}>
                  <Clock className="w-3 h-3 inline mr-1" />
                  {isEnded ? "已結束" : "剩餘時間"}
                </p>
                <p className={`text-sm font-bold leading-snug ${isUrgent ? "text-red-500" : "text-[#1a1a2e]"}`}>
                  {isEnded
                    ? (liveListing.auctionStatus === "ended_sold" ? "已成交" : "已結束")
                    : remaining !== null
                    ? formatCountdown(remaining)
                    : "—"
                  }
                </p>
                {isUrgent && !isEnded && (
                  <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    即將結標
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Bid Form ── */}
          {!isEnded && (
            <div className="px-5 py-4 space-y-4">

              {/* Highest bidder notice */}
              {isCurrentHighestBidder && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <p className="text-xs font-medium text-green-700">您目前是最高出價者</p>
                </div>
              )}

              {/* Ban notice */}
              {banStatus?.isBanned && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-xs font-medium text-red-700">您的帳號已被禁止競投</p>
                </div>
              )}

              {/* Min bid hint */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-medium mb-2">
                  最低出價 HK${minBid.toLocaleString()}
                </p>
                {/* Quick bid chips */}
                <div className="flex gap-2 flex-wrap mb-3">
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => handleQuickBid(amt)}
                      disabled={placeBidMutation.isPending || !!banStatus?.isBanned}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                        bidAmount === amt.toString()
                          ? "bg-[#1a1a2e] text-white border-[#1a1a2e]"
                          : "bg-white text-gray-600 border-gray-200 hover:border-[#1a1a2e] hover:text-[#1a1a2e]"
                      }`}
                    >
                      HK${amt.toLocaleString()}
                    </button>
                  ))}
                </div>

                {/* Custom amount input */}
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400 pointer-events-none">
                    HK$
                  </span>
                  <Input
                    ref={inputRef}
                    type="number"
                    value={bidAmount}
                    onChange={e => setBidAmount(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleBid(); }}
                    placeholder={minBid.toString()}
                    min={minBid}
                    step={bidIncrement}
                    disabled={placeBidMutation.isPending || !!banStatus?.isBanned}
                    className="pl-10 h-11 text-sm font-semibold border-gray-200 rounded-xl focus:border-[#1a1a2e] focus:ring-[#1a1a2e]/10"
                  />
                </div>
              </div>

              {/* Buy Now */}
              {buyNowPrice && (
                <div className="flex items-center justify-between text-xs text-gray-400 bg-amber-50 rounded-xl px-3 py-2">
                  <span>即時購買價</span>
                  <span className="font-bold text-amber-600">HK${buyNowPrice.toLocaleString()}</span>
                </div>
              )}

              {/* Bid history preview */}
              {liveBids.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-medium mb-2">最近出價記錄</p>
                  <div className="space-y-1.5">
                    {liveBids.slice(0, 3).map((bid: any, i: number) => (
                      <div key={bid.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">
                          {i === 0 ? "🏆 最高出價" : `第 ${i + 1} 位`}
                        </span>
                        <span className={`font-semibold ${i === 0 ? "text-[#1a1a2e]" : "text-gray-400"}`}>
                          HK${parseFloat(bid.amount).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Ended State ── */}
          {isEnded && (
            <div className="px-5 py-8 text-center">
              <Gavel className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-400">
                {liveListing.auctionStatus === "ended_sold" ? "此拍賣已成交" : "此拍賣已結束"}
              </p>
              <button
                onClick={() => { onClose(); setLocation(`/auction/${liveListing.id}`); }}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[#06038D] hover:underline"
              >
                查看結果 <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* ── Footer CTA ── */}
        {!isEnded && (
          <div className="px-5 py-4 border-t border-gray-100 space-y-2.5 bg-white">
            {/* Place Bid */}
            <Button
              className="w-full h-12 rounded-xl font-bold text-sm bg-[#1a1a2e] hover:bg-[#06038D] text-white transition-colors"
              onClick={handleBid}
              disabled={placeBidMutation.isPending || !!banStatus?.isBanned}
            >
              {placeBidMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />出價中...</>
              ) : (
                <><Gavel className="w-4 h-4 mr-2" />確認出價</>
              )}
            </Button>
            {/* View full detail */}
            <button
              onClick={() => { onClose(); setLocation(`/auction/${liveListing.id}`); }}
              className="w-full h-9 rounded-xl text-xs font-medium text-gray-400 hover:text-[#1a1a2e] border border-gray-100 hover:border-gray-200 transition-colors flex items-center justify-center gap-1.5"
            >
              查看完整拍賣詳情
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Terms Confirm Dialog ── */}
      <TermsConfirmDialog
        open={showTerms}
        onClose={() => { setShowTerms(false); pendingBidAmountRef.current = null; }}
        onAgree={handleTermsAgreed}
        isAgreeing={agreeMutation.isPending}
      />
    </>
  );
}
