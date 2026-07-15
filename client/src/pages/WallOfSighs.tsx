/**
 * WallOfSighs.tsx — 嘆息之牆
 * Nordic Sanctuary Style: ice-cold stone wall, marble shrine containers,
 * stacked card relics with foil shimmer, pulse-glow sigh animation.
 */
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Crown, MessageCircle, Wind, Share2, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import { useLocation } from "wouter";

// ── Constants ──────────────────────────────────────────────────────────────────
const QUICK_COMMENTS = [
  "大佬還缺腿件嗎？",
  "跪著看完了這張圖",
  "我手裡的卡瞬間不香了",
  "請問大佬收徒嗎？",
  "這輩子是沒機會了",
];

function formatHKD(val: number) {
  return `HKD ${val.toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Animated Counter ───────────────────────────────────────────────────────────
function AnimatedCounter({ value, duration = 1800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);
  return <>{display.toLocaleString("en-HK")}</>;
}

// ── Stacked Card Relics ────────────────────────────────────────────────────────
// Displays up to 3 card images in an overlapping "foil relic" arrangement
function StackedCardRelics({ cards }: { cards: Array<{ imageUrl?: string | null; name?: string | null }> }) {
  const displayCards = cards.slice(0, 3).filter(c => c.imageUrl);

  if (displayCards.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center">
        <Crown className="w-14 h-14 text-[#C9A84C]/20" />
      </div>
    );
  }

  // Single card — centered
  if (displayCards.length === 1) {
    return (
      <div className="h-52 flex items-center justify-center px-6">
        <div className="relative group/card w-28">
          {/* Ice-blue foil overlay */}
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[#A8D8EA]/20 via-transparent to-[#B8C8E8]/15 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 z-10 pointer-events-none" />
          <img
            src={displayCards[0].imageUrl!}
            alt={displayCards[0].name ?? ""}
            className="w-full rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-transform duration-500 group-hover/card:scale-105"
          />
        </div>
      </div>
    );
  }

  // 2 cards — slight fan
  if (displayCards.length === 2) {
    return (
      <div className="h-52 flex items-center justify-center">
        <div className="relative w-44 h-40">
          {/* Back card */}
          <div className="absolute left-0 top-2 w-28 rotate-[-6deg] origin-bottom-right group/card">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[#A8D8EA]/20 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 z-10 pointer-events-none" />
            <img
              src={displayCards[1].imageUrl!}
              alt={displayCards[1].name ?? ""}
              className="w-full rounded-lg shadow-[0_6px_18px_rgba(0,0,0,0.15)]"
            />
          </div>
          {/* Front card */}
          <div className="absolute right-0 top-0 w-28 rotate-[4deg] origin-bottom-left group/card z-10">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[#A8D8EA]/25 via-transparent to-[#B8C8E8]/15 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 z-10 pointer-events-none" />
            <img
              src={displayCards[0].imageUrl!}
              alt={displayCards[0].name ?? ""}
              className="w-full rounded-lg shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition-transform duration-500 group-hover/card:scale-105"
            />
          </div>
        </div>
      </div>
    );
  }

  // 3 cards — fan spread
  return (
    <div className="h-52 flex items-center justify-center">
      <div className="relative w-52 h-44">
        {/* Left card */}
        <div className="absolute left-0 top-4 w-24 rotate-[-10deg] origin-bottom group/card">
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[#A8D8EA]/20 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 z-10 pointer-events-none" />
          <img
            src={displayCards[2].imageUrl!}
            alt={displayCards[2].name ?? ""}
            className="w-full rounded-lg shadow-[0_5px_15px_rgba(0,0,0,0.13)]"
          />
        </div>
        {/* Center card — front */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-28 z-20 group/card">
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[#A8D8EA]/30 via-[#E8F4FF]/10 to-[#B8C8E8]/20 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 z-10 pointer-events-none" />
          <img
            src={displayCards[0].imageUrl!}
            alt={displayCards[0].name ?? ""}
            className="w-full rounded-lg shadow-[0_12px_32px_rgba(0,0,0,0.25)] transition-transform duration-500 group-hover/card:scale-105 group-hover/card:-translate-y-1"
          />
        </div>
        {/* Right card */}
        <div className="absolute right-0 top-4 w-24 rotate-[10deg] origin-bottom group/card z-10">
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-transparent via-transparent to-[#B8C8E8]/20 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 z-10 pointer-events-none" />
          <img
            src={displayCards[1].imageUrl!}
            alt={displayCards[1].name ?? ""}
            className="w-full rounded-lg shadow-[0_5px_15px_rgba(0,0,0,0.13)]"
          />
        </div>
      </div>
    </div>
  );
}

// ── Comment Section ────────────────────────────────────────────────────────────
function CommentSection({ entryId, entryName }: { entryId: number; entryName: string }) {
  const { data: user } = trpc.auth.me.useQuery();
  const [comment, setComment] = useState("");
  const utils = trpc.useUtils();

  const { data: comments = [], isLoading } = trpc.wall.getComments.useQuery({ entryId, limit: 50 });

  const addMutation = trpc.wall.addComment.useMutation({
    onSuccess: () => {
      setComment("");
      utils.wall.getComments.invalidate({ entryId });
      toast.success("留言成功！");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.wall.deleteComment.useMutation({
    onSuccess: () => utils.wall.getComments.invalidate({ entryId }),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div
      className="overflow-hidden"
      style={{ animation: "glacierSlide 0.35s cubic-bezier(0.4,0,0.2,1) both" }}
    >
      <div className="mt-4 pt-4 border-t border-[#E8E8E6]">
        <p className="text-[10px] text-[#9A9A8A] mb-3 font-light tracking-[0.25em] uppercase">
          圍觀留言 · {comments.length} 則
        </p>

        {user ? (
          <div className="mb-4">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={`留言給 ${entryName}…`}
              className="bg-[#F8F8F6] border-[#E8E8E6] text-xs text-[#1A1A1A] placeholder:text-[#BCBCB0] resize-none min-h-[64px] rounded-lg font-light"
              maxLength={500}
            />
            {/* Quick comment chips */}
            <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
              {QUICK_COMMENTS.map((q) => (
                <button
                  key={q}
                  onClick={() => setComment(q)}
                  className="text-[10px] px-2.5 py-1 bg-[#F3F3F0] hover:bg-[#EAEAE6] text-[#7A7A6A] rounded-full transition-colors font-light tracking-wide border border-[#E8E8E4]"
                >
                  {q}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              onClick={() => { if (!comment.trim()) return; addMutation.mutate({ entryId, content: comment.trim() }); }}
              disabled={!comment.trim() || addMutation.isPending}
              className="bg-[#1A1A1A] text-white hover:bg-[#2A2A2A] text-xs h-8 px-4 rounded-lg font-light tracking-widest"
            >
              {addMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "SEND"}
            </Button>
          </div>
        ) : (
          <a href="/login" className="block text-[10px] text-[#9A9A8A] hover:text-[#1A1A1A] mb-3 tracking-widest uppercase transition-colors">
            登入後留言
          </a>
        )}

        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-[#BCBCB0]" /></div>
        ) : comments.length === 0 ? (
          <p className="text-[10px] text-[#BCBCB0] text-center py-3 tracking-widest">— 尚無留言 —</p>
        ) : (
          <div className="space-y-2.5">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2 group">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-medium text-[#4A4A3A] mr-2 tracking-wide">{c.displayName}</span>
                  <span className="text-xs text-[#5A5A4A] font-light">{c.content}</span>
                  <span className="text-[10px] text-[#BCBCB0] ml-2 font-light">
                    {new Date(c.createdAt).toLocaleDateString("zh-HK")}
                  </span>
                </div>
                {user && (user.id === c.userId || user.role === "admin") && (
                  <button
                    onClick={() => deleteMutation.mutate({ commentId: c.id })}
                    className="opacity-0 group-hover:opacity-100 text-[#BCBCB0] hover:text-red-400 transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Wall Entry Card (Marble Shrine) ───────────────────────────────────────────
function WallCard({ entry, rank }: { entry: any; rank: number }) {
  const { data: user } = trpc.auth.me.useQuery();
  const [, setLocation] = useLocation();
  const [showComments, setShowComments] = useState(false);
  const [glowing, setGlowing] = useState(false);
  const utils = trpc.useUtils();

  const sighMutation = trpc.wall.sigh.useMutation({
    onSuccess: (data) => {
      utils.wall.getWall.invalidate();
      setGlowing(true);
      setTimeout(() => setGlowing(false), 1200);
      toast.success(`已嘆息 · ${data.sighs.toLocaleString()} 次`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleShare = () => {
    const url = `https://boxium.asia/wall-of-sighs`;
    if (navigator.share) {
      navigator.share({ title: `${entry.displayName} 的嘆息之牆`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast.success("連結已複製！");
    }
  };

  // Build top-3 cards array from entry data
  const topCards: Array<{ imageUrl?: string | null; name?: string | null }> = [];
  if (entry.topCardImageUrl) topCards.push({ imageUrl: entry.topCardImageUrl, name: entry.topCardName });
  if (entry.card2ImageUrl) topCards.push({ imageUrl: entry.card2ImageUrl, name: entry.card2Name });
  if (entry.card3ImageUrl) topCards.push({ imageUrl: entry.card3ImageUrl, name: entry.card3Name });

  const rankLabel = rank <= 3
    ? ["Ⅰ", "Ⅱ", "Ⅲ"][rank - 1]
    : `${rank}`;

  const rankGold = rank === 1
    ? "text-[#C9A84C] border-[#C9A84C]/40"
    : rank === 2
    ? "text-[#9A9A9A] border-[#9A9A9A]/40"
    : rank === 3
    ? "text-[#A07040] border-[#A07040]/40"
    : "text-[#BCBCB0] border-[#BCBCB0]/30";

  return (
    <div
      className={`relative bg-white rounded-2xl overflow-hidden transition-all duration-500 group
        border border-[#E8E8E4]
        shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.9)]
        hover:shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]
        hover:-translate-y-0.5
        ${glowing ? "shadow-[0_0_0_3px_rgba(168,216,234,0.35),0_8px_32px_rgba(168,216,234,0.2)]" : ""}
      `}
      style={{
        transition: glowing
          ? "box-shadow 0.15s ease-out, transform 0.3s ease"
          : "box-shadow 0.6s ease-out, transform 0.3s ease",
      }}
    >
      {/* Rank badge — top-left rune */}
      <div className={`absolute top-3 left-3 z-20 w-7 h-7 rounded-full border flex items-center justify-center text-[11px] font-light tracking-wider bg-white/90 backdrop-blur-sm ${rankGold}`}>
        {rankLabel}
      </div>

      {/* Stone display base — card showcase area */}
      <div className="relative bg-gradient-to-b from-[#F5F5F3] to-[#EEEEEB] pt-4 pb-2 px-4">
        {/* Subtle vertical stone-line texture */}
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: "repeating-linear-gradient(90deg, #6A6A5A 0px, #6A6A5A 1px, transparent 1px, transparent 28px)",
          }}
        />
        <StackedCardRelics cards={topCards} />
      </div>

      {/* Marble body */}
      <div className="p-4">
        {/* Name + grade */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">
            <p className="font-light text-[#1A1A1A] text-sm tracking-[0.08em] truncate">{entry.displayName}</p>
            {entry.topCardGrader && entry.topCardGrade && (
              <span className="inline-block mt-0.5 text-[10px] px-2 py-0.5 bg-[#FFF8E7] text-[#C9A84C] border border-[#C9A84C]/25 rounded-full font-light tracking-wide">
                {entry.topCardGrader} {entry.topCardGrade}
              </span>
            )}
          </div>
          {/* Sigh count */}
          <div className="flex items-center gap-1 text-[#C9A84C] shrink-0 mt-0.5">
            <Wind className="w-3 h-3" />
            <span className="text-xs font-light tracking-wider">{entry.sighs.toLocaleString()}</span>
          </div>
        </div>

        {/* Value — runic inscription style */}
        <div className="my-3 py-2.5 border-t border-b border-[#EEEEE8]">
          <p className="text-[9px] text-[#BCBCB0] tracking-[0.3em] uppercase mb-0.5 font-light">Total Value</p>
          <p className="text-lg font-light text-[#1A1A1A] tracking-[0.05em]">
            {formatHKD(entry.totalValueHKD)}
          </p>
          {/* Gold runic underline */}
          <div className="mt-1 h-px w-16 bg-gradient-to-r from-[#C9A84C]/60 to-transparent" />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-3">
          {/* Sigh button — capsule */}
          <button
            onClick={() => {
              if (!user) { setLocation("/login"); return; }
              sighMutation.mutate({ entryId: entry.id });
            }}
            disabled={sighMutation.isPending}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-[#E8E8E4] hover:border-[#C9A84C]/40 hover:bg-[#FFF8E7]/50 text-[#4A4A3A] text-[11px] font-light tracking-[0.12em] rounded-full transition-all duration-300 uppercase"
          >
            {sighMutation.isPending
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Wind className="w-3 h-3 text-[#C9A84C]" />
            }
            Sigh
          </button>

          {/* Comment toggle */}
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-[#E8E8E4] hover:border-[#8A9AAA]/40 hover:bg-[#F5F8FA]/50 text-[#4A4A3A] text-[11px] font-light tracking-[0.12em] rounded-full transition-all duration-300 uppercase"
          >
            <MessageCircle className="w-3 h-3 text-[#8A9AAA]" />
            {showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="p-2 border border-[#E8E8E4] hover:border-[#BCBCB0] text-[#BCBCB0] hover:text-[#4A4A3A] rounded-full transition-all duration-300"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Comment section — glacier slide */}
        {showComments && (
          <CommentSection entryId={entry.id} entryName={entry.displayName} />
        )}
      </div>
    </div>
  );
}

// ── Publish Modal ──────────────────────────────────────────────────────────────
function PublishModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: myEntry } = trpc.wall.getMyEntry.useQuery(undefined, { enabled: open });

  const publishMutation = trpc.wall.publish.useMutation({
    onSuccess: () => {
      utils.wall.getWall.invalidate();
      utils.wall.getStats.invalidate();
      utils.wall.getMyEntry.invalidate();
      toast.success("恭喜！您已登上嘆息之牆！");
      onClose();
    },
  });

  const unpublishMutation = trpc.wall.unpublish.useMutation({
    onSuccess: () => {
      utils.wall.getWall.invalidate();
      utils.wall.getMyEntry.invalidate();
      toast.success("已從嘆息之牆撤除");
      onClose();
    },
  });

  const posterMutation = trpc.wall.generatePoster.useMutation({
    onSuccess: (data) => {
      window.open(data.posterUrl, "_blank");
      toast.success("榮譽證書已生成！");
    },
    onError: (e) => toast.error(e.message),
  });

  const publishError = publishMutation.error;
  const isShortfall = publishError?.data?.code === "FORBIDDEN";
  const shortfallMsg = publishError?.message ?? "";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-white rounded-2xl border border-[#E8E8E4] p-0 overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.12)]">
        <DialogTitle className="sr-only">發佈到嘆息之牆</DialogTitle>

        {/* Nordic header */}
        <div className="relative bg-[#1A1A1A] px-6 py-8 text-center overflow-hidden">
          {/* Vertical stone lines */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: "repeating-linear-gradient(90deg, #FFFFFF 0px, #FFFFFF 1px, transparent 1px, transparent 32px)",
            }}
          />
          {/* Gold divider lines */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/40 to-transparent" />

          <p className="text-[10px] text-[#C9A84C] tracking-[0.4em] uppercase mb-3 font-light">Nordic Sanctuary</p>
          <h2
            className="text-2xl text-white tracking-[0.25em] uppercase font-light mb-1"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            嘆息之牆
          </h2>
          <p className="text-[10px] text-white/30 tracking-[0.35em] uppercase font-light">The Wall of Sighs</p>
        </div>

        <div className="p-6">
          {myEntry?.isPublic ? (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FFF8E7] border border-[#C9A84C]/25 rounded-full mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
                <span className="text-xs font-light text-[#C9A84C] tracking-widest uppercase">已在牆上</span>
              </div>
              <p className="text-[10px] text-[#BCBCB0] tracking-[0.25em] uppercase mb-1 font-light">Total Value</p>
              <p className="text-2xl font-light text-[#1A1A1A] tracking-wide mb-0.5">{formatHKD(myEntry.totalValueHKD)}</p>
              <div className="mx-auto mb-1 h-px w-12 bg-gradient-to-r from-transparent via-[#C9A84C]/50 to-transparent" />
              <p className="text-xs text-[#C9A84C] mb-6 font-light tracking-widest">{myEntry.sighs.toLocaleString()} sighs</p>

              <div className="flex gap-3 mb-3">
                <Button
                  onClick={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending}
                  className="flex-1 bg-[#1A1A1A] text-white hover:bg-[#2A2A2A] text-xs h-10 rounded-xl font-light tracking-widest uppercase"
                >
                  {publishMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "更新資產"}
                </Button>
                <Button
                  onClick={() => posterMutation.mutate()}
                  disabled={posterMutation.isPending}
                  variant="outline"
                  className="flex-1 border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#FFF8E7] text-xs h-10 rounded-xl font-light tracking-widest uppercase"
                >
                  {posterMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "榮譽證書"}
                </Button>
              </div>
              <button
                onClick={() => unpublishMutation.mutate()}
                disabled={unpublishMutation.isPending}
                className="w-full text-[10px] text-[#BCBCB0] hover:text-red-400 transition-colors tracking-widest uppercase font-light"
              >
                從牆上撤除
              </button>
            </div>
          ) : publishError && isShortfall ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#FFF0F0] border border-red-100 flex items-center justify-center mx-auto mb-4">
                <Wind className="w-5 h-5 text-red-300" />
              </div>
              <p className="text-[10px] text-[#BCBCB0] tracking-[0.25em] uppercase mb-2 font-light">距離神殿</p>
              <p className="text-sm font-light text-[#1A1A1A] mb-4 leading-relaxed">{shortfallMsg}</p>
              <p className="text-[10px] text-[#BCBCB0] mb-5 font-light leading-relaxed">
                繼續充實您的 Vault，讓資產突破門檻，<br />登上神殿石壁
              </p>
              <Button
                onClick={onClose}
                className="w-full bg-[#1A1A1A] text-white hover:bg-[#2A2A2A] text-xs h-10 rounded-xl font-light tracking-widest uppercase"
              >
                繼續充實 Vault
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-[10px] text-[#BCBCB0] tracking-[0.3em] uppercase mb-2 font-light">入牆門檻</p>
              <p className="text-3xl font-light text-[#1A1A1A] tracking-wide mb-0.5">HKD 5,000</p>
              <div className="mx-auto mb-4 h-px w-10 bg-gradient-to-r from-transparent via-[#C9A84C]/50 to-transparent" />
              <p className="text-xs text-[#9A9A8A] mb-6 font-light leading-relaxed tracking-wide">
                系統將自動計算您的 Vault 總市值。<br />
                達標後即可登上嘆息之牆，<br />
                讓全網玩家為您嘆息。
              </p>
              <Button
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="w-full bg-[#1A1A1A] text-white hover:bg-[#2A2A2A] text-sm h-11 rounded-xl font-light tracking-[0.2em] uppercase"
              >
                {publishMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />計算中…</>
                ) : (
                  "登上神殿石壁"
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Stone Wall Background ──────────────────────────────────────────────────────
function StoneWallBg() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Vertical megalith lines — very subtle */}
      <div
        className="absolute inset-0 opacity-[0.028]"
        style={{
          backgroundImage: "repeating-linear-gradient(90deg, #4A4A3A 0px, #4A4A3A 1px, transparent 1px, transparent 80px)",
        }}
      />
      {/* Horizontal mortar lines */}
      <div
        className="absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, #4A4A3A 0px, #4A4A3A 1px, transparent 1px, transparent 120px)",
        }}
      />
      {/* Top vignette */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#F0F0EE]/60 to-transparent" />
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function WallOfSighs() {
  const { data: user } = trpc.auth.me.useQuery();
  const [, setLocation] = useLocation();
  const [sortBy, setSortBy] = useState<"totalValue" | "sighs" | "createdAt">("totalValue");
  const [showPublishModal, setShowPublishModal] = useState(false);

  const { data: statsData } = trpc.wall.getStats.useQuery();
  const { data: wallData, isLoading } = trpc.wall.getWall.useQuery({ limit: 50, offset: 0, sortBy });

  const entries = wallData?.entries ?? [];

  return (
    <>
      {/* Keyframe animations */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@200;300;400&display=swap');
        @keyframes glacierSlide {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes runeGlow {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }
        @keyframes sighPulse {
          0%   { box-shadow: 0 0 0 0 rgba(168,216,234,0.5); }
          70%  { box-shadow: 0 0 0 14px rgba(168,216,234,0); }
          100% { box-shadow: 0 0 0 0 rgba(168,216,234,0); }
        }
      `}</style>

      <div className="min-h-screen bg-[#F5F5F3]" style={{ fontFamily: "'Montserrat', sans-serif" }}>

        {/* ── Hero / Sanctuary Gate ──────────────────────────────── */}
        <div className="relative overflow-hidden bg-[#F3F4F6] border-b border-[#E8E8E4]">
          <StoneWallBg />

          <div className="relative max-w-4xl mx-auto px-4 py-20 md:py-28 text-center">

            {/* Rune ornament top */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#C9A84C]/50" />
              <div className="w-1 h-1 rounded-full bg-[#C9A84C]/60" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
              <div className="w-1 h-1 rounded-full bg-[#C9A84C]/60" />
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#C9A84C]/50" />
            </div>

            {/* Main title */}
            <p className="text-[10px] text-[#C9A84C] tracking-[0.5em] uppercase mb-3 font-light"
              style={{ animation: "runeGlow 3s ease-in-out infinite" }}>
              Nordic Sanctuary · BOXIUM PTCG
            </p>
            <h1
              className="text-5xl md:text-7xl text-[#1A1A1A] tracking-[0.25em] uppercase mb-3 font-light leading-none"
            >
              嘆息之牆
            </h1>
            <p className="text-[11px] md:text-xs text-[#9A9A8A] tracking-[0.45em] uppercase mb-2 font-light">
              THE WALL OF SIGHS
            </p>

            {/* Gold divider */}
            <div className="flex items-center justify-center gap-4 my-7">
              <div className="h-px w-20 bg-gradient-to-r from-transparent to-[#C9A84C]/70" />
              <div className="flex gap-1.5">
                <div className="w-1 h-1 rounded-full bg-[#C9A84C]/50" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
                <div className="w-1 h-1 rounded-full bg-[#C9A84C]/50" />
              </div>
              <div className="h-px w-20 bg-gradient-to-l from-transparent to-[#C9A84C]/70" />
            </div>

            <p className="text-[#7A7A6A] text-sm font-light tracking-[0.08em] max-w-md mx-auto mb-12 leading-loose">
              凡人止步。此牆只記載令全網 TCG 玩家<br className="hidden md:block" />
              為之嘆息的絕世巨富與神級收藏。
            </p>

            {/* Stats altar */}
            <div className="inline-flex flex-col sm:flex-row gap-0 bg-white border border-[#E8E8E4] rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.05)] mb-10">
              <div className="px-8 py-5 text-center">
                <p className="text-[9px] text-[#BCBCB0] tracking-[0.35em] uppercase mb-1.5 font-light">Wall Total Value</p>
                <p className="text-xl md:text-2xl font-light text-[#1A1A1A] tracking-wide">
                  HKD <AnimatedCounter value={Math.round(statsData?.totalValueHKD ?? 0)} />
                </p>
                <div className="mt-1.5 h-px w-10 mx-auto bg-gradient-to-r from-transparent via-[#C9A84C]/50 to-transparent" />
              </div>
              <div className="w-px bg-[#E8E8E4] hidden sm:block" />
              <div className="h-px bg-[#E8E8E4] sm:hidden" />
              <div className="px-8 py-5 text-center">
                <p className="text-[9px] text-[#BCBCB0] tracking-[0.35em] uppercase mb-1.5 font-light">Total Sighs</p>
                <p className="text-xl md:text-2xl font-light text-[#C9A84C] tracking-wide">
                  <AnimatedCounter value={statsData?.totalSighs ?? 0} />
                </p>
                <div className="mt-1.5 h-px w-10 mx-auto bg-gradient-to-r from-transparent via-[#C9A84C]/50 to-transparent" />
              </div>
              <div className="w-px bg-[#E8E8E4] hidden sm:block" />
              <div className="h-px bg-[#E8E8E4] sm:hidden" />
              <div className="px-8 py-5 text-center">
                <p className="text-[9px] text-[#BCBCB0] tracking-[0.35em] uppercase mb-1.5 font-light">On The Wall</p>
                <p className="text-xl md:text-2xl font-light text-[#1A1A1A] tracking-wide">
                  <AnimatedCounter value={statsData?.entryCount ?? 0} />
                </p>
                <div className="mt-1.5 h-px w-10 mx-auto bg-gradient-to-r from-transparent via-[#C9A84C]/50 to-transparent" />
              </div>
            </div>

            {/* CTA — publish to wall */}
            <div>
              <button
                onClick={() => {
                  if (!user) { setLocation("/login"); return; }
                  setShowPublishModal(true);
                }}
                className="inline-flex items-center gap-3 px-8 py-3.5 bg-[#1A1A1A] text-white text-[11px] font-light tracking-[0.3em] uppercase rounded-full hover:bg-[#2A2A2A] transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_28px_rgba(0,0,0,0.2)]"
              >
                <Wind className="w-3.5 h-3.5 text-[#C9A84C]" />
                登上神殿石壁
              </button>
            </div>
          </div>
        </div>

        {/* ── Leaderboard ────────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-4 py-10">

          {/* Sort tabs */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[9px] text-[#BCBCB0] tracking-[0.35em] uppercase mb-0.5 font-light">Sanctuary</p>
              <h2 className="text-sm font-light text-[#1A1A1A] tracking-[0.2em] uppercase">
                殿堂排行 · {entries.length}
              </h2>
            </div>
            <div className="flex gap-0.5 bg-white border border-[#E8E8E4] rounded-xl p-1 shadow-sm">
              {(["totalValue", "sighs", "createdAt"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`px-3 py-1.5 text-[10px] font-light tracking-widest rounded-lg transition-all uppercase ${
                    sortBy === s
                      ? "bg-[#1A1A1A] text-white shadow-sm"
                      : "text-[#9A9A8A] hover:text-[#1A1A1A]"
                  }`}
                >
                  {s === "totalValue" ? "資產" : s === "sighs" ? "嘆息" : "最新"}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-28 gap-4">
              <Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]/50" />
              <p className="text-[10px] text-[#BCBCB0] tracking-[0.3em] uppercase font-light">Loading…</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-28">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#C9A84C]/30" />
                <Crown className="w-8 h-8 text-[#C9A84C]/20" />
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#C9A84C]/30" />
              </div>
              <p className="text-[#9A9A8A] font-light tracking-[0.2em] uppercase text-sm mb-2">牆上尚無大佬</p>
              <p className="text-[10px] text-[#BCBCB0] font-light tracking-widest">成為第一個登上神殿石壁的人</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {entries.map((entry) => (
                <WallCard key={entry.id} entry={entry} rank={entry.rank} />
              ))}
            </div>
          )}
        </div>

        {/* Publish Modal */}
        <PublishModal open={showPublishModal} onClose={() => setShowPublishModal(false)} />
      </div>
    </>
  );
}
