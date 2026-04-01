import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Gavel, Clock, TrendingUp, ChevronLeft, User, Shield, Zap,
  AlertTriangle, CheckCircle2, ArrowUp, Loader2, Eye, Package,
  ChevronRight, ImageIcon, Star, CreditCard, Trophy, Flame,
  Info, ChevronDown, ChevronUp, X
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// ─── Countdown Hook ───────────────────────────────────────────────────────────
function useCountdown(endTime: Date | string | null) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!endTime) { setRemaining(0); return; }
    const end = new Date(endTime).getTime();
    const tick = () => setRemaining(Math.max(0, end - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endTime]);
  return remaining;
}

// ─── Countdown Display (BOXIUM style) ────────────────────────────────────────
function CountdownDisplay({ ms, compact = false }: { ms: number; compact?: boolean }) {
  if (ms <= 0) return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 font-bold text-sm">已結標</span>
    </div>
  );
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const urgent = ms < 30 * 60 * 1000;

  const parts = d > 0
    ? [{ label: '天', val: d }, { label: '時', val: h % 24 }, { label: '分', val: m % 60 }]
    : h > 0
      ? [{ label: '時', val: h }, { label: '分', val: m % 60 }, { label: '秒', val: s % 60 }]
      : [{ label: '分', val: m }, { label: '秒', val: s % 60 }];

  if (compact) {
    return (
      <div className={`flex items-center gap-1 text-sm font-bold ${urgent ? 'text-red-500' : 'text-[#FEDD00]'}`}>
        <Clock className="w-3.5 h-3.5" />
        <span>{parts.map(p => `${String(p.val).padStart(2,'0')}${p.label}`).join(' ')}</span>
        {urgent && <Flame className="w-3.5 h-3.5 animate-pulse" />}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {parts.map(({ label, val }) => (
        <div key={label} className={`flex flex-col items-center px-4 py-3 rounded-2xl min-w-[64px] border-2 ${
          urgent
            ? 'bg-red-600 border-red-400 shadow-lg shadow-red-500/30'
            : 'bg-[#06038D] border-[#FEDD00]/30 shadow-lg shadow-[#06038D]/30'
        }`}>
          <span className={`text-3xl font-black tabular-nums leading-none ${urgent ? 'text-white' : 'text-[#FEDD00]'}`}>
            {String(val).padStart(2, '0')}
          </span>
          <span className={`text-[10px] font-bold mt-1 uppercase tracking-wider ${urgent ? 'text-red-200' : 'text-white/60'}`}>
            {label}
          </span>
        </div>
      ))}
      {urgent && ms > 0 && (
        <div className="flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">
          <Flame className="w-3 h-3" />
          即將結標！
        </div>
      )}
    </div>
  );
}

// ─── Terms Dialog ─────────────────────────────────────────────────────────────
function TermsDialog({
  open, onClose, role, onAgree
}: { open: boolean; onClose: () => void; role: 'buyer' | 'seller'; onAgree: () => void }) {
  const agreeMutation = trpc.auction.agreeToTerms.useMutation({
    onSuccess: () => { onAgree(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const buyerTerms = [
    { icon: '⚡', title: '出價即承諾', desc: '出價即代表您承諾以該金額購買此商品' },
    { icon: '⏰', title: '24 小時付款', desc: '得標後須在 24 小時內完成付款，逾期將被記錄違規' },
    { icon: '🚫', title: '違規累計', desc: '累計 3 次違規將被禁止參與所有拍賣活動' },
    { icon: '🛡️', title: '買家保障', desc: '商品與描述不符可申請退款保障' },
    { icon: '📋', title: '不得撤销', desc: '拍賣結束後不得無故取消交易' },
  ];

  const sellerTerms = [
    { icon: '✅', title: '審核公開', desc: '上架拍賣需經管理員審核後才會公開' },
    { icon: '🔒', title: '價格鎖定', desc: '拍賣開始後不得修改起標價或即買價' },
    { icon: '🚫', title: '禁止撤拍', desc: '有人出價後不得取消拍賣' },
    { icon: '📦', title: '3 工作天出貨', desc: '得標後須在 3 個工作天內完成出貨' },
    { icon: '⚠️', title: '違規處罰', desc: '違反條款將影響賣家評分及平台使用資格' },
  ];

  const terms = role === 'buyer' ? buyerTerms : sellerTerms;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-0 rounded-3xl bg-white" showCloseButton={false}>
        {/* Close button - top right corner, above everything */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
          aria-label="關閉"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header - BOXIUM brand */}
        <div className="bg-[#06038D] px-6 pt-6 pb-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#FEDD00]/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          <div className="relative flex items-center gap-3 pr-8">
            <div className="w-10 h-10 bg-[#FEDD00] rounded-xl flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-[#06038D]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-white/50 font-semibold uppercase tracking-wider">拍賣條款</p>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-black text-white">{role === 'buyer' ? '買家' : '賣家'}參與協議</h2>
                <a href="/auction/terms" target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-[#FEDD00] hover:text-yellow-300 flex items-center gap-1 font-bold transition-colors whitespace-nowrap">
                  完整條款 →
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Terms list - white background */}
        <div className="bg-white px-5 py-4 space-y-2.5 max-h-72 overflow-y-auto">
          <p className="text-xs text-gray-500 font-medium mb-3">請仔細閱讀以下所有條款，同意後方可出價：</p>
          {terms.map((term, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl hover:bg-[#06038D]/5 transition-colors">
              <span className="text-lg leading-none mt-0.5 shrink-0">{term.icon}</span>
              <div>
                <p className="text-xs font-black text-gray-900">{term.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{term.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer - white background */}
        <div className="bg-white px-5 pb-5 pt-2 flex gap-2.5 border-t border-gray-100">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 rounded-xl border-2 border-gray-200 text-gray-600 font-bold h-11 bg-white hover:bg-gray-50"
          >
            取消
          </Button>
          <Button
            className="flex-[2] bg-[#06038D] hover:bg-[#0804b8] text-white rounded-xl font-black h-11"
            onClick={() => agreeMutation.mutate({ role })}
            disabled={agreeMutation.isPending}
          >
            {agreeMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
              : <CheckCircle2 className="w-4 h-4 mr-2" />
            }
            我已閱讀並同意
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Winner Payment Panel ───────────────────────────────────────────────────
function WinnerPaymentPanel({ listing, onRefetch }: { listing: any; onRefetch: () => void }) {
  const { data: me } = trpc.auth.me.useQuery();
  const [showReview, setShowReview] = useState(false);

  const paymentMutation = trpc.auction.createAuctionPayment.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        toast.success('正在前往付款頁面...');
        window.open(data.checkoutUrl, '_blank');
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const winningBid = parseFloat(listing.currentHighestBid ?? '0');
  const isWinner = me && listing.winnerId === (me as any).id;
  const isPaid = listing.auctionPaymentStatus === 'paid';
  const canReview = isPaid && isWinner;

  if (!isWinner) return null;

  return (
    <div className="space-y-3">
      {!isPaid ? (
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-[#FEDD00] rounded-2xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-[#FEDD00] rounded-full flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-[#06038D]" />
            </div>
            <div>
              <p className="font-black text-[#06038D] text-base">🎉 恭喜您得標！</p>
              <p className="text-sm text-gray-600 mt-0.5">得標金額：<strong className="text-[#06038D]">HK${winningBid.toLocaleString()}</strong></p>
              <p className="text-xs text-amber-600 mt-1">請在 24 小時內完成付款，逾期將被記錄違規。</p>
            </div>
          </div>
          <Button
            onClick={() => paymentMutation.mutate({ listingId: listing.id, origin: window.location.origin })}
            disabled={paymentMutation.isPending}
            className="w-full bg-[#06038D] hover:bg-[#0804b8] text-[#FEDD00] font-black text-base py-3 rounded-xl"
          >
            {paymentMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CreditCard className="w-5 h-5 mr-2" />}
            立即付款 HK${winningBid.toLocaleString()}
          </Button>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            <div>
              <p className="font-bold text-green-800">付款已完成 ✅</p>
              <p className="text-xs text-green-600 mt-0.5">賣家將盡快安排出貨，請留意訂單狀態。</p>
            </div>
          </div>
          {canReview && (
            <Button onClick={() => setShowReview(true)} variant="outline"
              className="w-full mt-3 border-green-300 text-green-700 hover:bg-green-100">
              <Star className="w-4 h-4 mr-2" />為此拍賣評分
            </Button>
          )}
        </div>
      )}
      {showReview && (
        <AuctionReviewDialog listing={listing} open={showReview}
          onClose={() => setShowReview(false)}
          onSuccess={() => { setShowReview(false); onRefetch(); }} />
      )}
    </div>
  );
}

// ─── Auction Review Dialog ────────────────────────────────────────────────────
function AuctionReviewDialog({
  listing, open, onClose, onSuccess
}: { listing: any; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const reviewMutation = trpc.auction.submitAuctionReview.useMutation({
    onSuccess: () => { toast.success('評價已提交！'); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />為拍賣評分
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold text-gray-700 mb-2 block">評分</Label>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setRating(s)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    s <= rating ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-400 hover:bg-amber-100'
                  }`}>
                  <Star className="w-5 h-5" fill={s <= rating ? 'currentColor' : 'none'} />
                </button>
              ))}
              <span className="ml-2 text-sm text-gray-500 self-center">{rating} 星</span>
            </div>
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-700 mb-2 block">評語（選填）</Label>
            <Textarea value={comment} onChange={e => setComment(e.target.value)}
              placeholder="分享您的交易體驗..." className="resize-none" rows={3} maxLength={500} />
            <p className="text-xs text-gray-400 mt-1 text-right">{comment.length}/500</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300" />
            <span className="text-sm text-gray-600">匿名評價</span>
          </label>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button className="bg-[#06038D] text-white"
            onClick={() => reviewMutation.mutate({ listingId: listing.id, rating, comment, isAnonymous })}
            disabled={reviewMutation.isPending}>
            {reviewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            提交評價
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bid Panel ────────────────────────────────────────────────────────────────
function BidPanel({ listing, bids, onRefetch }: { listing: any; bids: any[]; onRefetch: () => void }) {
  const { data: me } = trpc.auth.me.useQuery();
  const user = me;
  const [, setLocation] = useLocation();
  const [bidAmount, setBidAmount] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [pendingAction, setPendingAction] = useState<'bid' | 'buynow' | null>(null);

  const { data: termsData, refetch: refetchTerms } = trpc.auction.checkTermsAgreement.useQuery(
    { role: 'buyer' },
    { enabled: !!user }
  );

  const placeBidMutation = trpc.auction.placeBid.useMutation({
    onSuccess: () => {
      toast.success("出價成功！");
      setBidAmount("");
      onRefetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const buyNowMutation = trpc.auction.buyNow.useMutation({
    onSuccess: () => {
      toast.success("即買成功！請前往訂單頁面完成付款。");
      onRefetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const currentPrice = listing.currentHighestBid
    ? parseFloat(listing.currentHighestBid)
    : parseFloat(listing.startingBid || "0");
  const minBid = currentPrice + parseFloat(listing.bidIncrement || "10");
  const buyNowPrice = listing.buyNowPrice ? parseFloat(listing.buyNowPrice) : null;

  const remaining = useCountdown(listing.auctionEndAt);
  const remainingMs = remaining ?? Infinity;
  const isEnded = (remaining !== null && remaining <= 0) || ['ended_sold', 'ended_no_bid', 'cancelled'].includes(listing.auctionStatus);
  const isActive = listing.auctionStatus === 'active' || listing.auctionStatus === 'ending_soon';

  const handleBid = useCallback(() => {
    if (!user) { setLocation('/login'); return; }
    if (!termsData?.agreed) { setPendingAction('bid'); setShowTerms(true); return; }
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount < minBid) {
      toast.error(`最低出價為 HK$${minBid.toLocaleString()}`);
      return;
    }
    placeBidMutation.mutate({ listingId: listing.id, amount });
  }, [user, termsData, bidAmount, minBid, listing.id]);

  const handleBuyNow = useCallback(() => {
    if (!user) { setLocation('/login'); return; }
    if (!termsData?.agreed) { setPendingAction('buynow'); setShowTerms(true); return; }
    buyNowMutation.mutate({ listingId: listing.id });
  }, [user, termsData, listing.id]);

  const handleTermsAgreed = () => {
    refetchTerms();
    if (pendingAction === 'bid') handleBid();
    else if (pendingAction === 'buynow') handleBuyNow();
    setPendingAction(null);
  };

  return (
    <div className="space-y-4">
      {/* Current price hero */}
      <div className="bg-[#06038D] rounded-2xl p-5 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#FEDD00]/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-1">
            {bids.length > 0 ? '目前最高出價' : '起標價'}
          </p>
          <p className="text-4xl font-black text-[#FEDD00] leading-none">
            HK${currentPrice.toLocaleString()}
          </p>
          {bids.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <TrendingUp className="w-3.5 h-3.5 text-white/60" />
              <p className="text-white/60 text-xs">共 {bids.length} 次出價</p>
            </div>
          )}
        </div>
      </div>

      {/* Countdown */}
      {isActive && remaining !== null && (
        <div className="bg-[#06038D] rounded-2xl p-4 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#FEDD00]/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5 relative">
            <Clock className="w-3.5 h-3.5 text-[#FEDD00]" /> 距離結標
          </p>
          <div className="relative">
            <CountdownDisplay ms={remaining} />
          </div>
        </div>
      )}

      {/* Bid input */}
      {isActive && !isEnded && (
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1.5 font-medium">您的出價（最低 HK${minBid.toLocaleString()}）</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-bold">HK$</span>
                <Input
                  type="number"
                  value={bidAmount}
                  onChange={e => setBidAmount(e.target.value)}
                  placeholder={minBid.toString()}
                  className="pl-12 border-2 border-[#06038D]/20 focus:border-[#06038D] focus:ring-[#06038D]/20 rounded-xl text-base font-bold h-12 text-gray-900 bg-white"
                  min={minBid}
                  step={parseFloat(listing.bidIncrement || "10")}
                />
              </div>
              <Button
                onClick={handleBid}
                disabled={placeBidMutation.isPending || isEnded}
                className="bg-[#06038D] hover:bg-[#0804b8] text-white px-5 shrink-0 h-12 rounded-xl font-bold text-base"
              >
                {placeBidMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gavel className="w-5 h-5" />}
                <span className="ml-1.5">出價</span>
              </Button>
            </div>
          </div>

          {/* Quick bid buttons */}
          <div className="flex gap-2 flex-wrap">
            {[minBid, minBid + 50, minBid + 100, minBid + 200].map(amt => (
              <button
                key={amt}
                onClick={() => setBidAmount(amt.toString())}
                className={`text-xs px-3 py-1.5 rounded-full border-2 font-bold transition-all ${
                  bidAmount === amt.toString()
                    ? 'bg-[#06038D] text-white border-[#06038D]'
                    : 'bg-white text-[#06038D] border-[#06038D]/20 hover:border-[#06038D]/60'
                }`}
              >
                HK${amt.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Buy now */}
          {buyNowPrice && (
            <div className="bg-[#FEDD00]/10 border-2 border-[#FEDD00] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">即買價</p>
                  <p className="text-2xl font-black text-[#06038D]">HK${buyNowPrice.toLocaleString()}</p>
                </div>
                <Button
                  onClick={handleBuyNow}
                  disabled={buyNowMutation.isPending}
                  className="bg-[#FEDD00] hover:bg-yellow-400 text-[#06038D] font-black px-5 rounded-xl h-12"
                >
                  {buyNowMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-5 h-5" />}
                  <span className="ml-1.5">立即購買</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ended state */}
      {isEnded && (
        <div className={`rounded-2xl p-5 text-center border-2 ${
          listing.auctionStatus === 'ended_sold'
            ? 'bg-green-50 border-green-200'
            : 'bg-gray-50 border-gray-200'
        }`}>
          {listing.auctionStatus === 'ended_sold' ? (
            <>
              <Trophy className="w-10 h-10 text-amber-500 mx-auto mb-2" />
              <p className="font-black text-green-700 text-base">拍賣已結束（已售出）</p>
            </>
          ) : (
            <>
              <Gavel className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="font-black text-gray-500 text-base">拍賣已結束</p>
            </>
          )}
        </div>
      )}

      {/* Winner payment panel */}
      {listing.auctionStatus === 'ended_sold' && (
        <WinnerPaymentPanel listing={listing} onRefetch={onRefetch} />
      )}

      {/* Scheduled */}
      {listing.auctionStatus === 'scheduled' && (
        <div className="bg-[#06038D]/5 border-2 border-[#06038D]/20 rounded-2xl p-5 text-center">
          <Clock className="w-10 h-10 text-[#06038D] mx-auto mb-2" />
          <p className="font-black text-[#06038D] text-base">拍賣尚未開始</p>
          <p className="text-xs text-gray-500 mt-1">
            開始時間：{new Date(listing.auctionStartAt).toLocaleString('zh-HK')}
          </p>
        </div>
      )}

      {/* Terms dialog */}
      {user && (
        <TermsDialog open={showTerms} onClose={() => setShowTerms(false)}
          role="buyer" onAgree={handleTermsAgreed} />
      )}
    </div>
  );
}

// ─── Bid History ──────────────────────────────────────────────────────────────
function BidHistory({ bids }: { bids: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayBids = expanded ? bids : bids.slice(0, 5);

  if (bids.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-20" />
        <p className="text-sm font-medium">暫無出價記錄</p>
        <p className="text-xs mt-1 opacity-60">成為第一個出價者！</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayBids.map((bid, i) => (
        <div key={bid.id} className={`flex items-center justify-between p-3 rounded-xl transition-all ${
          i === 0 ? 'bg-[#06038D] text-white' : 'bg-gray-50 hover:bg-gray-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
              i === 0 ? 'bg-[#FEDD00] text-[#06038D]' : 'bg-gray-200 text-gray-600'
            }`}>
              {i === 0 ? <Trophy className="w-4 h-4" /> : i + 1}
            </div>
            <div>
              <p className={`text-xs font-bold ${i === 0 ? 'text-white' : 'text-gray-700'}`}>
                {bid.bidderName || `買家 #${bid.bidderId}`}
                {i === 0 && <span className="ml-1.5 text-[10px] bg-[#FEDD00] text-[#06038D] px-1.5 py-0.5 rounded-full font-black">最高出價</span>}
              </p>
              <p className={`text-[10px] ${i === 0 ? 'text-white/60' : 'text-gray-400'}`}>
                {new Date(bid.createdAt).toLocaleString('zh-HK')}
              </p>
            </div>
          </div>
          <p className={`text-sm font-black ${i === 0 ? 'text-[#FEDD00]' : 'text-gray-700'}`}>
            HK${parseFloat(bid.amount).toLocaleString()}
          </p>
        </div>
      ))}
      {bids.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-xs text-[#06038D] font-bold py-2 flex items-center justify-center gap-1 hover:bg-[#06038D]/5 rounded-xl transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {expanded ? '收起' : `查看全部 ${bids.length} 筆出價`}
        </button>
      )}
    </div>
  );
}

// ─── Main AuctionDetail Page ──────────────────────────────────────────────────
export default function AuctionDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [imgIdx, setImgIdx] = useState(0);

  const { data, isLoading, error, refetch } = trpc.auction.getById.useQuery(
    { id: parseInt(id || "0") },
    { enabled: !!id, refetchInterval: 15000 }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#06038D] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#FEDD00] flex items-center justify-center animate-pulse">
            <Gavel className="w-8 h-8 text-[#06038D]" />
          </div>
          <p className="text-white/60 text-sm font-medium">載入拍賣資料...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-4">找不到此拍賣</p>
          <Button onClick={() => setLocation('/marketplace')} className="bg-[#06038D] text-white">
            返回市集
          </Button>
        </div>
      </div>
    );
  }

  const { listing, bids } = data;

  const images: string[] = (() => {
    try { return listing.images ? JSON.parse(listing.images as string) : []; }
    catch { return []; }
  })();

  const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    pending_review: { label: '審核中',   bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
    scheduled:      { label: '待開始',   bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-500' },
    active:         { label: '競標中',   bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500' },
    ending_soon:    { label: '即將結標', bg: 'bg-red-100',    text: 'text-red-800',    dot: 'bg-red-500' },
    ended_sold:     { label: '已售出',   bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400' },
    ended_no_bid:   { label: '流拍',     bg: 'bg-gray-100',   text: 'text-gray-500',   dot: 'bg-gray-300' },
    cancelled:      { label: '已取消',   bg: 'bg-gray-100',   text: 'text-gray-400',   dot: 'bg-gray-300' },
    rejected:       { label: '已拒絕',   bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
  };
  const status = statusConfig[listing.auctionStatus || 'active'] ?? {
    label: listing.auctionStatus, bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400'
  };

  const TCG_COLORS: Record<string, { bg: string; text: string }> = {
    pokemon:  { bg: 'bg-yellow-400', text: 'text-yellow-900' },
    onepiece: { bg: 'bg-red-500',    text: 'text-white' },
    yugioh:   { bg: 'bg-purple-500', text: 'text-white' },
  };
  const tcgColor = TCG_COLORS[listing.tcgSeries] ?? { bg: 'bg-gray-200', text: 'text-gray-700' };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero Header ─────────────────────────────────────────── */}
      <div className="bg-[#06038D] sticky top-0 z-20 shadow-lg shadow-[#06038D]/30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setLocation('/marketplace')}
            className="flex items-center gap-1.5 text-white/70 hover:text-[#FEDD00] transition-colors text-sm font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            返回市集
          </button>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#FEDD00] rounded-md flex items-center justify-center">
              <Gavel className="w-3.5 h-3.5 text-[#06038D]" />
            </div>
            <span className="text-white font-bold text-sm">拍賣詳情</span>
          </div>
          <span className="text-white/40 text-xs ml-1">#{listing.id}</span>

          {/* Status badge */}
          <div className={`ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full ${status.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot} ${
              listing.auctionStatus === 'active' || listing.auctionStatus === 'ending_soon' ? 'animate-pulse' : ''
            }`} />
            <span className={`text-xs font-bold ${status.text}`}>{status.label}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 lg:gap-8">

          {/* ── Left Column ─────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Title + badges (mobile first) */}
            <div className="lg:hidden">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {listing.tcgSeries && listing.tcgSeries !== 'other' && (
                  <span className={`text-xs font-black px-2.5 py-1 rounded-full ${tcgColor.bg} ${tcgColor.text}`}>
                    {listing.tcgSeries === 'pokemon' ? 'Pokémon' : listing.tcgSeries === 'onepiece' ? 'One Piece' : 'Yu-Gi-Oh!'}
                  </span>
                )}
                <span className="text-xs text-gray-400 font-medium">拍賣 #{listing.id}</span>
              </div>
              <h1 className="text-xl font-black text-gray-900 leading-tight">{listing.title}</h1>
            </div>

            {/* Image gallery */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Main image */}
              <div className="relative aspect-square bg-gray-50">
                {images.length > 0 ? (
                  <img
                    src={images[imgIdx]}
                    alt={listing.title}
                    className="w-full h-full object-contain p-4"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-200">
                    <ImageIcon className="w-20 h-20" />
                    <p className="text-sm text-gray-300 font-medium">商品圖片</p>
                  </div>
                )}

                {/* Nav arrows */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#06038D]/80 hover:bg-[#06038D] flex items-center justify-center text-white shadow-lg transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setImgIdx(i => (i + 1) % images.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#06038D]/80 hover:bg-[#06038D] flex items-center justify-center text-white shadow-lg transition-all"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    {/* Image counter */}
                    <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {imgIdx + 1} / {images.length}
                    </div>
                  </>
                )}
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto border-t border-gray-50">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setImgIdx(i)}
                      className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                        i === imgIdx
                          ? 'border-[#06038D] shadow-md shadow-[#06038D]/20'
                          : 'border-transparent opacity-50 hover:opacity-80'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-black text-gray-900 mb-4 flex items-center gap-2 text-base">
                <div className="w-7 h-7 bg-[#06038D] rounded-lg flex items-center justify-center">
                  <Package className="w-4 h-4 text-white" />
                </div>
                商品描述
              </h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                {listing.description || '賣家暫未提供詳細描述'}
              </p>
              {listing.condition && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-medium">品相：</span>
                  <span className="text-xs font-black bg-[#06038D] text-[#FEDD00] px-3 py-1 rounded-full">
                    {listing.condition}
                  </span>
                </div>
              )}
            </div>

            {/* Bid history (desktop: shown in left col below description) */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-black text-gray-900 text-base flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-[#06038D] rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                出價記錄
                {bids.length > 0 && (
                  <span className="ml-auto text-xs bg-[#06038D] text-[#FEDD00] px-2.5 py-1 rounded-full font-black">
                    {bids.length} 次
                  </span>
                )}
              </h3>
              <BidHistory bids={bids} />
            </div>
          </div>

          {/* ── Right Column ─────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Title + badges (desktop) */}
            <div className="hidden lg:block bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {listing.tcgSeries && listing.tcgSeries !== 'other' && (
                  <span className={`text-xs font-black px-2.5 py-1 rounded-full ${tcgColor.bg} ${tcgColor.text}`}>
                    {listing.tcgSeries === 'pokemon' ? 'Pokémon' : listing.tcgSeries === 'onepiece' ? 'One Piece' : 'Yu-Gi-Oh!'}
                  </span>
                )}
                <span className="text-xs text-gray-400 font-medium">拍賣 #{listing.id}</span>
              </div>
              <h1 className="text-2xl font-black text-gray-900 leading-tight">{listing.title}</h1>
            </div>

            {/* Anti-snipe notice */}
            {listing.antiSnipingExtensions > 0 && (
              <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-black text-orange-700">防狙擊延長</p>
                  <p className="text-xs text-orange-600 mt-0.5">
                    有人在結標前 {listing.antiSnipingMinutes ?? 5} 分鐘內出價，結標時間已延長 {listing.antiSnipingExtensions} 次（每次 {listing.antiSnipingMinutes ?? 5} 分鐘）。
                  </p>
                </div>
              </div>
            )}

            {/* Reserve price status */}
            {listing.reservePrice && (
              <div className={`rounded-2xl p-4 flex items-center gap-3 border-2 ${
                listing.hasReserveMet
                  ? 'bg-green-50 border-green-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <Shield className={`w-5 h-5 shrink-0 ${listing.hasReserveMet ? 'text-green-500' : 'text-amber-500'}`} />
                <p className={`text-xs font-bold ${listing.hasReserveMet ? 'text-green-700' : 'text-amber-700'}`}>
                  {listing.hasReserveMet
                    ? '✓ 保留價已達到，得標者將確認成交'
                    : '保留價尚未達到，目前出價不保證成交'}
                </p>
              </div>
            )}

            {/* Bid panel */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
              <BidPanel listing={listing} bids={bids} onRefetch={refetch} />
            </div>

            {/* Auction info grid */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-black text-gray-900 text-base flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-[#06038D] rounded-lg flex items-center justify-center">
                  <Info className="w-4 h-4 text-white" />
                </div>
                拍賣資訊
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '起標價', value: `HK$${parseFloat(listing.startingBid || "0").toLocaleString()}` },
                  { label: '最低加價', value: `HK$${parseFloat(listing.bidIncrement || "10").toLocaleString()}` },
                  listing.auctionStartAt && { label: '開始時間', value: new Date(listing.auctionStartAt).toLocaleString('zh-HK') },
                  listing.auctionEndAt && { label: '結標時間', value: new Date(listing.auctionEndAt).toLocaleString('zh-HK') },
                ].filter(Boolean).map((item: any) => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">{item.label}</p>
                    <p className="text-sm font-black text-gray-800">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Buyer protection */}
            <div className="bg-[#06038D] rounded-3xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 bg-[#FEDD00] rounded-xl flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-[#06038D]" />
              </div>
              <div>
                <p className="font-black text-white text-sm">買家保障</p>
                <p className="text-xs text-white/60 mt-1 leading-relaxed">
                  得標後 24 小時內付款，商品與描述不符可申請退款保障。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
