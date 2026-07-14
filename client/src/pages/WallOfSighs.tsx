import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Crown, MessageCircle, Wind, Share2, Trophy, ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import { useLocation } from "wouter";

const QUICK_COMMENTS = [
  "大佬還缺腿件嗎？",
  "跪著看完了這張圖",
  "我手裡的卡瞬間不香了",
  "請問大佬收徒嗎？",
  "這輩子是沒機會了",
  "膜拜！",
];

function formatHKD(val: number) {
  return `HKD ${val.toLocaleString("en-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function AnimatedCounter({ value, duration = 1500 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);
  return <>{display.toLocaleString("en-HK")}</>;
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
    onSuccess: () => {
      utils.wall.getComments.invalidate({ entryId });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mt-4 border-t border-[#F0F0EE] pt-4">
      <p className="text-xs text-[#737373] mb-3 font-medium tracking-widest uppercase">
        吃瓜留言 · {comments.length} 則
      </p>

      {/* Comment input */}
      {user ? (
        <div className="mb-4">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={`留言給 ${entryName}...`}
            className="bg-[#F5F5F3] border-0 text-xs text-[#1A1A1A] placeholder:text-[#B0B0B0] resize-none min-h-[72px] rounded-xl"
            maxLength={500}
          />
          {/* Quick comment chips */}
          <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
            {QUICK_COMMENTS.map((q) => (
              <button
                key={q}
                onClick={() => setComment(q)}
                className="text-[10px] px-2 py-1 bg-[#F5F5F3] hover:bg-[#EAEAE8] text-[#737373] rounded-full transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => {
              if (!comment.trim()) return;
              addMutation.mutate({ entryId, content: comment.trim() });
            }}
            disabled={!comment.trim() || addMutation.isPending}
            className="bg-[#1A1A1A] text-white hover:bg-[#333] text-xs h-8 px-4 rounded-lg"
          >
            {addMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "發送"}
          </Button>
        </div>
      ) : (
        <a
          href="/login"
          className="block text-xs text-[#737373] hover:text-[#1A1A1A] mb-3 underline underline-offset-2"
        >
          登入後留言
        </a>
      )}

      {/* Comment list */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-[#B0B0B0]" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-[#B0B0B0] text-center py-3">還沒有留言，搶先吃瓜！</p>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2 group">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-semibold text-[#1A1A1A] mr-2">{c.displayName}</span>
                <span className="text-xs text-[#4A4A4A]">{c.content}</span>
                <span className="text-[10px] text-[#B0B0B0] ml-2">
                  {new Date(c.createdAt).toLocaleDateString("zh-HK")}
                </span>
              </div>
              {user && (user.id === c.userId || user.role === "admin") && (
                <button
                  onClick={() => deleteMutation.mutate({ commentId: c.id })}
                  className="opacity-0 group-hover:opacity-100 text-[#B0B0B0] hover:text-red-500 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Wall Entry Card ────────────────────────────────────────────────────────────
function WallCard({ entry, rank }: { entry: any; rank: number }) {
  const { data: user } = trpc.auth.me.useQuery();
  const [, setLocation] = useLocation();
  const [showComments, setShowComments] = useState(false);
  const utils = trpc.useUtils();

  const sighMutation = trpc.wall.sigh.useMutation({
    onSuccess: (data) => {
      utils.wall.getWall.invalidate();
      toast.success(`已嘆息！目前 ${data.sighs.toLocaleString()} 次嘆息`);
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

  const rankColors: Record<number, string> = {
    1: "bg-[#FFD700] text-[#1A1A1A]",
    2: "bg-[#C0C0C0] text-[#1A1A1A]",
    3: "bg-[#CD7F32] text-white",
  };
  const rankBg = rankColors[rank] ?? "bg-[#F5F5F3] text-[#737373]";

  return (
    <div className="bg-white border border-[#F0F0EE] rounded-2xl overflow-hidden hover:shadow-lg hover:border-[#C9A84C]/30 transition-all duration-300 group">
      {/* Card header */}
      <div className="relative">
        {/* Top card image */}
        {entry.topCardImageUrl ? (
          <div className="relative h-48 overflow-hidden bg-[#F5F5F3]">
            <img
              src={entry.topCardImageUrl}
              alt={entry.topCardName ?? ""}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>
        ) : (
          <div className="h-48 bg-gradient-to-br from-[#F5F5F3] to-[#EAEAE8] flex items-center justify-center">
            <Crown className="w-16 h-16 text-[#C9A84C]/30" />
          </div>
        )}

        {/* Rank badge */}
        <div className={`absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${rankBg} shadow-md`}>
          {rank <= 3 ? <Trophy className="w-4 h-4" /> : rank}
        </div>

        {/* Value overlay */}
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-white font-black text-lg leading-tight drop-shadow-lg">
            {formatHKD(entry.totalValueHKD)}
          </p>
          {entry.topCardName && (
            <p className="text-white/80 text-xs truncate drop-shadow">
              👑 {entry.topCardName}
            </p>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="font-bold text-[#1A1A1A] text-sm leading-tight">{entry.displayName}</p>
            {entry.topCardGrader && entry.topCardGrade && (
              <span className="inline-block mt-1 text-[10px] px-2 py-0.5 bg-[#FFF8E7] text-[#C9A84C] border border-[#C9A84C]/30 rounded-full font-medium">
                {entry.topCardGrader} {entry.topCardGrade}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[#C9A84C] shrink-0">
            <Wind className="w-3.5 h-3.5" />
            <span className="text-xs font-bold">{entry.sighs.toLocaleString()}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (!user) { setLocation("/login"); return; }
              sighMutation.mutate({ entryId: entry.id });
            }}
            disabled={sighMutation.isPending}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#F5F5F3] hover:bg-[#EAEAE8] text-[#1A1A1A] text-xs font-medium rounded-xl transition-colors"
          >
            {sighMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wind className="w-3 h-3" />}
            嘆息
          </button>
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#F5F5F3] hover:bg-[#EAEAE8] text-[#1A1A1A] text-xs font-medium rounded-xl transition-colors"
          >
            <MessageCircle className="w-3 h-3" />
            留言
            {showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={handleShare}
            className="p-2 bg-[#F5F5F3] hover:bg-[#EAEAE8] text-[#1A1A1A] rounded-xl transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Comment section */}
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
      toast.success("🎉 恭喜！您已成功登上嘆息之牆！");
      onClose();
    },
    onError: (e) => {
      // Error handled in modal UI
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
      <DialogContent className="max-w-md bg-white rounded-2xl border border-[#F0F0EE] p-0 overflow-hidden">
        <DialogTitle className="sr-only">發佈到嘆息之牆</DialogTitle>

        {/* Header */}
        <div className="bg-gradient-to-br from-[#1A1A1A] to-[#333] p-6 text-white text-center">
          <Crown className="w-10 h-10 text-[#C9A84C] mx-auto mb-2" />
          <h2 className="text-xl font-black tracking-wide">嘆息之牆</h2>
          <p className="text-white/60 text-xs mt-1">THE WALL OF SIGHS</p>
        </div>

        <div className="p-6">
          {myEntry?.isPublic ? (
            // Already on wall
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFF8E7] border border-[#C9A84C]/30 rounded-full mb-4">
                <Crown className="w-4 h-4 text-[#C9A84C]" />
                <span className="text-sm font-semibold text-[#C9A84C]">您已在牆上</span>
              </div>
              <p className="text-sm text-[#737373] mb-2">總資產</p>
              <p className="text-2xl font-black text-[#1A1A1A] mb-1">{formatHKD(myEntry.totalValueHKD)}</p>
              <p className="text-sm text-[#C9A84C] mb-6">{myEntry.sighs.toLocaleString()} 次嘆息</p>

              <div className="flex gap-3">
                <Button
                  onClick={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending}
                  className="flex-1 bg-[#1A1A1A] text-white hover:bg-[#333] text-sm h-10 rounded-xl"
                >
                  {publishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "更新資產"}
                </Button>
                <Button
                  onClick={() => posterMutation.mutate()}
                  disabled={posterMutation.isPending}
                  variant="outline"
                  className="flex-1 border-[#C9A84C] text-[#C9A84C] hover:bg-[#FFF8E7] text-sm h-10 rounded-xl"
                >
                  {posterMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "生成榮譽證書"}
                </Button>
              </div>
              <button
                onClick={() => unpublishMutation.mutate()}
                disabled={unpublishMutation.isPending}
                className="mt-3 w-full text-xs text-[#B0B0B0] hover:text-red-500 transition-colors"
              >
                從牆上撤除
              </button>
            </div>
          ) : publishError && isShortfall ? (
            // Below threshold
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#FFF3F3] flex items-center justify-center mx-auto mb-4">
                <Crown className="w-8 h-8 text-[#E0A0A0]" />
              </div>
              <h3 className="font-bold text-[#1A1A1A] mb-2">距離上牆還差一步</h3>
              <p className="text-sm text-[#737373] mb-4">{shortfallMsg}</p>
              <p className="text-xs text-[#B0B0B0] mb-6">繼續充實您的 Vault，或升級 VIP 解鎖進階資產管理功能！</p>
              <Button
                onClick={onClose}
                className="w-full bg-[#1A1A1A] text-white hover:bg-[#333] text-sm h-10 rounded-xl"
              >
                繼續充實 Vault
              </Button>
            </div>
          ) : (
            // Default: publish prompt
            <div className="text-center">
              <p className="text-sm text-[#737373] mb-2">上牆門檻</p>
              <p className="text-3xl font-black text-[#1A1A1A] mb-1">HKD 5,000</p>
              <p className="text-xs text-[#B0B0B0] mb-6">
                系統將自動計算您的 Vault 總市值。<br />
                達標後即可登上嘆息之牆，讓全網玩家為您嘆息！
              </p>
              <Button
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="w-full bg-[#1A1A1A] text-white hover:bg-[#333] text-sm h-11 rounded-xl font-bold tracking-wide"
              >
                {publishMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />計算中...</>
                ) : (
                  "📤 發佈我的倉庫上牆"
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function WallOfSighs() {
  const { data: user } = trpc.auth.me.useQuery();
  const [, setLocation] = useLocation();
  const [sortBy, setSortBy] = useState<"totalValue" | "sighs" | "createdAt">("totalValue");
  const [showPublishModal, setShowPublishModal] = useState(false);

  const { data: statsData } = trpc.wall.getStats.useQuery();
  const { data: wallData, isLoading } = trpc.wall.getWall.useQuery({
    limit: 50,
    offset: 0,
    sortBy,
  });

  const entries = wallData?.entries ?? [];

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* ── Hero Section ───────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-[#FAFAF8] border-b border-[#F0F0EE]">
        {/* Gold grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(#C9A84C 1px, transparent 1px), linear-gradient(90deg, #C9A84C 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative max-w-5xl mx-auto px-4 py-16 text-center">
          {/* Crown icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FFF8E7] border border-[#C9A84C]/30 mb-6">
            <Crown className="w-8 h-8 text-[#C9A84C]" />
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-6xl font-black text-[#1A1A1A] tracking-widest uppercase mb-2"
            style={{ fontFamily: "'Georgia', serif", letterSpacing: "0.15em" }}>
            嘆息之牆
          </h1>
          <p className="text-sm md:text-base text-[#737373] tracking-widest mb-2">
            THE WALL OF SIGHS
          </p>

          {/* Gold divider */}
          <div className="flex items-center justify-center gap-4 my-6">
            <div className="h-px w-24 bg-gradient-to-r from-transparent to-[#C9A84C]" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
            <div className="h-px w-24 bg-gradient-to-l from-transparent to-[#C9A84C]" />
          </div>

          <p className="text-[#737373] text-sm md:text-base tracking-wide max-w-xl mx-auto mb-10 leading-relaxed">
            凡人止步。這裡只記載讓全網 TCG 玩家為之嘆息的<br className="hidden md:block" />
            絕世巨富與神級收藏。
          </p>

          {/* Stats */}
          <div className="inline-flex gap-8 md:gap-16 bg-white border border-[#F0F0EE] rounded-2xl px-8 py-5 shadow-sm mb-8">
            <div className="text-center">
              <p className="text-[10px] text-[#B0B0B0] tracking-widest uppercase mb-1">Wall Total Value</p>
              <p className="text-xl md:text-2xl font-black text-[#1A1A1A] font-mono">
                HKD <AnimatedCounter value={Math.round(statsData?.totalValueHKD ?? 0)} />
              </p>
            </div>
            <div className="w-px bg-[#F0F0EE]" />
            <div className="text-center">
              <p className="text-[10px] text-[#B0B0B0] tracking-widest uppercase mb-1">Total Sighs</p>
              <p className="text-xl md:text-2xl font-black text-[#C9A84C] font-mono">
                <AnimatedCounter value={statsData?.totalSighs ?? 0} />
              </p>
            </div>
            <div className="w-px bg-[#F0F0EE]" />
            <div className="text-center">
              <p className="text-[10px] text-[#B0B0B0] tracking-widest uppercase mb-1">On The Wall</p>
              <p className="text-xl md:text-2xl font-black text-[#1A1A1A] font-mono">
                <AnimatedCounter value={statsData?.entryCount ?? 0} />
              </p>
            </div>
          </div>

          {/* Publish button */}
          <div>
            <button
              onClick={() => {
        if (!user) { setLocation("/login"); return; }
        setShowPublishModal(true);
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A1A1A] text-white text-sm font-bold tracking-widest uppercase rounded-full hover:bg-[#333] transition-colors shadow-lg"
            >
              <span>📤</span>
              發佈我的倉庫上牆
            </button>
          </div>
        </div>
      </div>

      {/* ── Sort tabs ──────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-bold text-[#1A1A1A] tracking-widest uppercase">
            殿堂排行 · {entries.length} 位大佬
          </h2>
          <div className="flex gap-1 bg-[#F5F5F3] rounded-xl p-1">
            {(["totalValue", "sighs", "createdAt"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  sortBy === s
                    ? "bg-white text-[#1A1A1A] shadow-sm"
                    : "text-[#737373] hover:text-[#1A1A1A]"
                }`}
              >
                {s === "totalValue" ? "資產排行" : s === "sighs" ? "嘆息排行" : "最新上牆"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Wall grid ────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-24">
            <Crown className="w-16 h-16 text-[#C9A84C]/20 mx-auto mb-4" />
            <p className="text-[#737373] font-medium">牆上還沒有大佬</p>
            <p className="text-sm text-[#B0B0B0] mt-1">成為第一個登上嘆息之牆的人！</p>
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
  );
}
