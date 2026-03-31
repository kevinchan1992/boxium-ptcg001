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
  ChevronRight, ImageIcon
} from "lucide-react";

// ─── Countdown Hook ───────────────────────────────────────────────────────────
function useCountdown(endTime: Date | string | null) {
  const [remaining, setRemaining] = useState<number>(0);
  useEffect(() => {
    if (!endTime) return;
    const end = new Date(endTime).getTime();
    const tick = () => setRemaining(Math.max(0, end - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endTime]);
  return remaining;
}

function CountdownDisplay({ ms }: { ms: number }) {
  if (ms <= 0) return <span className="text-gray-400 font-bold">已結標</span>;
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

  return (
    <div className="flex items-center gap-2">
      {parts.map(({ label, val }) => (
        <div key={label} className={`flex flex-col items-center px-3 py-2 rounded-xl min-w-[52px] ${
          urgent ? 'bg-red-50 border border-red-200' : 'bg-[#06038D]/5 border border-[#06038D]/10'
        }`}>
          <span className={`text-2xl font-black tabular-nums ${urgent ? 'text-red-600' : 'text-[#06038D]'}`}>
            {String(val).padStart(2, '0')}
          </span>
          <span className={`text-[10px] font-semibold ${urgent ? 'text-red-400' : 'text-[#06038D]/50'}`}>{label}</span>
        </div>
      ))}
      {urgent && ms > 0 && (
        <span className="text-xs font-bold text-red-500 animate-pulse ml-1">即將結標！</span>
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

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#06038D]" />
            {role === 'buyer' ? '買家' : '賣家'}拍賣條款
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-gray-600 max-h-64 overflow-y-auto pr-2">
          <p className="font-semibold text-gray-800">請仔細閱讀以下條款：</p>
          {role === 'buyer' ? (
            <ul className="space-y-2 list-disc list-inside">
              <li>出價即代表您承諾以該金額購買商品</li>
              <li>得標後須在 <strong>24 小時內</strong>完成付款</li>
              <li>逾期未付款將被記錄違規，累計 3 次將被禁止參與拍賣</li>
              <li>商品描述與實物不符可申請退款保障</li>
              <li>拍賣結束後不得無故取消交易</li>
            </ul>
          ) : (
            <ul className="space-y-2 list-disc list-inside">
              <li>上架拍賣需經管理員審核後才會公開</li>
              <li>拍賣開始後不得修改起標價或即買價</li>
              <li>有人出價後不得取消拍賣</li>
              <li>得標後須在 <strong>3 個工作天</strong>內出貨</li>
              <li>違反條款將影響賣家評分及平台使用資格</li>
            </ul>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button
            className="bg-[#06038D] hover:bg-[#0804b8] text-white"
            onClick={() => agreeMutation.mutate({ role })}
            disabled={agreeMutation.isPending}
          >
            {agreeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            我已閱讀並同意
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
  const isEnded = remaining <= 0 || ['ended_sold', 'ended_no_bid', 'cancelled'].includes(listing.auctionStatus);
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
      {/* Current price */}
      <div className="bg-[#06038D]/5 rounded-2xl p-4">
        <p className="text-xs text-gray-500 mb-1">{bids.length > 0 ? '目前最高出價' : '起標價'}</p>
        <p className="text-3xl font-black text-[#06038D]">HK${currentPrice.toLocaleString()}</p>
        {bids.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">共 {bids.length} 次出價</p>
        )}
      </div>

      {/* Countdown */}
      {isActive && (
        <div>
          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
            <Clock className="w-3 h-3" /> 距離結標
          </p>
          <CountdownDisplay ms={remaining} />
        </div>
      )}

      {/* Bid input */}
      {isActive && !isEnded && (
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1.5">您的出價（最低 HK${minBid.toLocaleString()}）</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">HK$</span>
                <Input
                  type="number"
                  value={bidAmount}
                  onChange={e => setBidAmount(e.target.value)}
                  placeholder={minBid.toString()}
                  className="pl-10 border-[#06038D]/20 focus:border-[#06038D] focus:ring-[#06038D]/20"
                  min={minBid}
                  step={parseFloat(listing.bidIncrement || "10")}
                />
              </div>
              <Button
                onClick={handleBid}
                disabled={placeBidMutation.isPending || isEnded}
                className="bg-[#06038D] hover:bg-[#0804b8] text-white px-5 shrink-0"
              >
                {placeBidMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
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
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  bidAmount === amt.toString()
                    ? 'bg-[#06038D] text-white border-[#06038D]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#06038D]/30'
                }`}
              >
                HK${amt.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Buy now */}
          {buyNowPrice && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">即買價</p>
                  <p className="text-lg font-bold text-amber-600">HK${buyNowPrice.toLocaleString()}</p>
                </div>
                <Button
                  onClick={handleBuyNow}
                  disabled={buyNowMutation.isPending}
                  className="bg-[#FEDD00] hover:bg-yellow-400 text-[#06038D] font-bold"
                >
                  {buyNowMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  <span className="ml-1.5">立即購買</span>
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Ended state */}
      {isEnded && (
        <div className={`rounded-2xl p-4 text-center ${
          listing.auctionStatus === 'ended_sold' ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
        }`}>
          {listing.auctionStatus === 'ended_sold' ? (
            <>
              <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="font-bold text-green-700">拍賣已結束（已售出）</p>
            </>
          ) : (
            <>
              <Gavel className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="font-bold text-gray-500">拍賣已結束</p>
            </>
          )}
        </div>
      )}

      {/* Scheduled */}
      {listing.auctionStatus === 'scheduled' && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
          <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <p className="font-bold text-blue-700">拍賣尚未開始</p>
          <p className="text-xs text-blue-500 mt-1">
            開始時間：{new Date(listing.auctionStartAt).toLocaleString('zh-HK')}
          </p>
        </div>
      )}

      {/* Terms dialog */}
      {user && (
        <TermsDialog
          open={showTerms}
          onClose={() => setShowTerms(false)}
          role="buyer"
          onAgree={handleTermsAgreed}
        />
      )}
    </div>
  );
}

// ─── Bid History ──────────────────────────────────────────────────────────────
function BidHistory({ bids }: { bids: any[] }) {
  if (bids.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">暫無出價記錄</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {bids.map((bid, i) => (
        <div key={bid.id} className={`flex items-center justify-between p-3 rounded-xl ${
          i === 0 ? 'bg-[#06038D]/5 border border-[#06038D]/10' : 'bg-gray-50'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              i === 0 ? 'bg-[#06038D] text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {i === 0 ? <ArrowUp className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700">
                {bid.bidderName || `買家 #${bid.bidderId}`}
                {i === 0 && <span className="ml-1.5 text-[10px] bg-[#06038D] text-white px-1.5 py-0.5 rounded-full">最高</span>}
              </p>
              <p className="text-[10px] text-gray-400">
                {new Date(bid.createdAt).toLocaleString('zh-HK')}
              </p>
            </div>
          </div>
          <p className={`text-sm font-bold ${i === 0 ? 'text-[#06038D]' : 'text-gray-600'}`}>
            HK${parseFloat(bid.amount).toLocaleString()}
          </p>
        </div>
      ))}
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
    { enabled: !!id, refetchInterval: 15000 } // auto-refresh every 15s
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#06038D]" />
          <p className="text-sm text-gray-500">載入拍賣資料...</p>
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

  const statusLabel: Record<string, { label: string; color: string }> = {
    pending_review: { label: '審核中', color: 'bg-yellow-100 text-yellow-800' },
    scheduled:      { label: '待開始', color: 'bg-blue-100 text-blue-800' },
    active:         { label: '競標中', color: 'bg-green-100 text-green-800' },
    ending_soon:    { label: '即將結標', color: 'bg-red-100 text-red-800' },
    ended_sold:     { label: '已售出', color: 'bg-gray-100 text-gray-600' },
    ended_no_bid:   { label: '流拍', color: 'bg-gray-100 text-gray-500' },
    cancelled:      { label: '已取消', color: 'bg-gray-100 text-gray-400' },
  };
  const status = statusLabel[listing.auctionStatus || 'active'] ?? { label: listing.auctionStatus, color: 'bg-gray-100 text-gray-600' };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setLocation('/marketplace')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#06038D] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            返回市集
          </button>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <Gavel className="w-4 h-4 text-[#06038D]" />
            <span className="text-sm font-semibold text-[#06038D]">拍賣詳情</span>
          </div>
          <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full ${status.color}`}>
            {status.label}
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left: Images */}
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden aspect-square relative">
              {images.length > 0 ? (
                <img
                  src={images[imgIdx]}
                  alt={listing.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                  <ImageIcon className="w-16 h-16 text-gray-200" />
                </div>
              )}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setImgIdx(i => (i + 1) % images.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                      i === imgIdx ? 'border-[#06038D]' : 'border-gray-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#06038D]" />
                商品描述
              </h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                {listing.description || '賣家暫未提供詳細描述'}
              </p>
              {listing.condition && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-400">品相：</span>
                  <span className="text-xs font-semibold bg-[#06038D]/10 text-[#06038D] px-2 py-0.5 rounded-full">
                    {listing.condition}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Bid panel + info */}
          <div className="space-y-4">
            {/* Title */}
            <div>
              <h1 className="text-xl font-black text-gray-900 leading-tight">{listing.title}</h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-400">拍賣 #{listing.id}</span>
                {listing.tcgSeries && listing.tcgSeries !== 'other' && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-semibold">
                    {listing.tcgSeries === 'pokemon' ? 'Pokémon' : listing.tcgSeries === 'onepiece' ? 'One Piece' : 'Yu-Gi-Oh!'}
                  </span>
                )}
              </div>
            </div>

            {/* Bid panel */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <BidPanel listing={listing} bids={bids} onRefetch={refetch} />
            </div>

            {/* Auction info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#06038D]" />
                拍賣資訊
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400">起標價</p>
                  <p className="font-bold text-gray-700">HK${parseFloat(listing.startingBid || "0").toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">最低加價</p>
                  <p className="font-bold text-gray-700">HK${parseFloat(listing.bidIncrement || "10").toLocaleString()}</p>
                </div>
                {listing.auctionStartAt && (
                  <div>
                    <p className="text-xs text-gray-400">開始時間</p>
                    <p className="font-semibold text-gray-700 text-xs">
                      {new Date(listing.auctionStartAt).toLocaleString('zh-HK')}
                    </p>
                  </div>
                )}
                {listing.auctionEndAt && (
                  <div>
                    <p className="text-xs text-gray-400">結標時間</p>
                    <p className="font-semibold text-gray-700 text-xs">
                      {new Date(listing.auctionEndAt).toLocaleString('zh-HK')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Bid history */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-[#06038D]" />
                出價記錄
                {bids.length > 0 && (
                  <span className="ml-auto text-xs bg-[#06038D]/10 text-[#06038D] px-2 py-0.5 rounded-full font-bold">
                    {bids.length} 次
                  </span>
                )}
              </h3>
              <BidHistory bids={bids} />
            </div>

            {/* Buyer protection */}
            <div className="bg-[#06038D]/5 rounded-2xl p-4 flex items-start gap-3">
              <Shield className="w-5 h-5 text-[#06038D] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-[#06038D]">買家保障</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  得標後 24 小時內付款，商品與描述不符可申請退款。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
