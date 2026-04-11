/**
 * AdminQuickPublish — 簡化版 AI 出文章介面
 *
 * 設計原則：管理員只需 3 步完成出文章：
 *   Step 1 → 選擇文章類型 + 可選填主題
 *   Step 2 → 一鍵生成，AI 自動完成策略+大綱+撰寫+校對
 *   Step 3 → 預覽文章 + AI 生成封面圖，確認後一鍵發布或存草稿
 *
 * 取代原有複雜的 A/B/C/D 技能選擇流程。
 */

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Zap, TrendingUp, BookOpen, Newspaper, FileText,
  ChevronRight, CheckCircle, Loader2, Eye, Send,
  RotateCcw, Sparkles, ArrowLeft, Edit3, Tag,
  BarChart3, Star, Info, Image, X, RefreshCw, Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

/* ─── Article Type Definitions ──────────────────────────────────────── */
type ArticleTypeId = "market-report" | "card-research" | "trend-analysis" | "beginner-guide" | "platform-news";

interface ArticleType {
  id: ArticleTypeId;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  estimatedTime: string;
  requiresTopic: boolean;
  topicPlaceholder: string;
  topicHint: string;
  coverStyle: "market-report" | "card-analysis" | "guide" | "news";
}

const ARTICLE_TYPES: ArticleType[] = [
  {
    id: "market-report",
    icon: Zap,
    title: "市場快報",
    subtitle: "每日/每週市場動態",
    description: "AI 自動拉取平台漲跌榜和成交數據，生成完整市場快報，無需任何輸入。",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    estimatedTime: "約 30 秒",
    requiresTopic: false,
    topicPlaceholder: "",
    topicHint: "",
    coverStyle: "market-report",
  },
  {
    id: "card-research",
    icon: BookOpen,
    title: "單卡研究",
    subtitle: "深度卡牌價格分析",
    description: "輸入卡牌名稱，AI 結合平台成交數據，生成深度研究報告。",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    estimatedTime: "約 45 秒",
    requiresTopic: true,
    topicPlaceholder: "例如：噴火龍 EX SR、皮卡丘 V MAX...",
    topicHint: "輸入卡牌名稱，AI 會自動搜尋平台成交數據",
    coverStyle: "card-analysis",
  },
  {
    id: "trend-analysis",
    icon: TrendingUp,
    title: "趨勢報告",
    subtitle: "市場趨勢深度分析",
    description: "AI 分析近期市場走勢，生成專業趨勢報告，適合週報或月報。",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    estimatedTime: "約 45 秒",
    requiresTopic: false,
    topicPlaceholder: "選填：指定分析主題（例如：PSA 10 評級市場）",
    topicHint: "不填則自動分析全平台趨勢",
    coverStyle: "market-report",
  },
  {
    id: "beginner-guide",
    icon: Star,
    title: "收藏入門",
    subtitle: "新手教學指南",
    description: "輸入教學主題，AI 生成適合新手的完整入門指南。",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    estimatedTime: "約 40 秒",
    requiresTopic: true,
    topicPlaceholder: "例如：如何開始收藏 PTCG、PSA 評級入門...",
    topicHint: "描述你想教新手的主題",
    coverStyle: "guide",
  },
  {
    id: "platform-news",
    icon: Newspaper,
    title: "平台公告",
    subtitle: "功能更新與通知",
    description: "輸入公告內容要點，AI 生成正式的平台公告文章。",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    estimatedTime: "約 25 秒",
    requiresTopic: true,
    topicPlaceholder: "例如：新增 eBay 比價功能、平台維護通知...",
    topicHint: "簡述公告的主要內容",
    coverStyle: "news",
  },
];

/* ─── Step Indicator ─────────────────────────────────────────────────── */
function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { num: 1, label: "選擇類型" },
    { num: 2, label: "AI 生成" },
    { num: 3, label: "預覽發布" },
  ];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step > s.num
                  ? "bg-green-500 text-white"
                  : step === s.num
                  ? "bg-[#06038d] text-white ring-2 ring-[#06038d]/30"
                  : "bg-zinc-700 text-zinc-400"
              }`}
            >
              {step > s.num ? <CheckCircle className="w-4 h-4" /> : s.num}
            </div>
            <span className={`text-xs mt-1 whitespace-nowrap ${step === s.num ? "text-white font-medium" : "text-zinc-500"}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-16 h-0.5 mx-1 mb-4 transition-all ${step > s.num + 0 ? "bg-green-500" : "bg-zinc-700"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Article Type Card ──────────────────────────────────────────────── */
function TypeCard({
  type,
  selected,
  onClick,
}: {
  type: ArticleType;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = type.icon;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all hover:scale-[1.01] active:scale-[0.99] ${
        selected
          ? `${type.borderColor} ${type.bgColor} ring-1 ${type.borderColor.replace("border-", "ring-")}`
          : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-500"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-lg ${type.bgColor} border ${type.borderColor} flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${type.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-white font-semibold text-sm">{type.title}</span>
            {selected && <Badge className="bg-[#06038d] text-white text-[10px] px-1.5 py-0">已選</Badge>}
          </div>
          <p className={`text-xs font-medium mb-1 ${type.color}`}>{type.subtitle}</p>
          <p className="text-gray-400 text-xs leading-relaxed">{type.description}</p>
          <div className="flex items-center gap-1 mt-2">
            <Loader2 className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] text-gray-500">{type.estimatedTime}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

/* ─── Cover Image Section ────────────────────────────────────────────── */
interface CardImageItem {
  id: number;
  name: string;
  nameJa?: string | null;
  rarity?: string | null;
  setName?: string | null;
  imageUrl?: string | null;
  imageUrlHiRes?: string | null;
  priceChangePercent?: number;
  matchedFrom?: 'article' | 'trending';
}

// Cover style definitions with rich visual metadata for thumbnail preview
const COVER_STYLES: Array<{
  id: "market-report" | "card-analysis" | "guide" | "news";
  label: string;
  tagline: string;
  keywords: string[];
  bgGradient: string;
  accentColor: string;
  accentColorHex: string;
  textColor: string;
  borderActiveColor: string;
  // SVG thumbnail descriptor for the mock preview
  thumbnailBg: string;
  thumbnailAccent: string;
  thumbnailRays: boolean;
  thumbnailSpotlight: boolean;
  thumbnailSpeedLines: boolean;
  thumbnailBokeh: boolean;
}> = [
  {
    id: "market-report",
    label: "市場快報風",
    tagline: "Bloomberg × TCG",
    keywords: ["金色光束", "財經風格", "動態卡牌"],
    bgGradient: "linear-gradient(135deg, #06038D 0%, #000820 100%)",
    accentColor: "#FEDD00",
    accentColorHex: "FEDD00",
    textColor: "text-yellow-400",
    borderActiveColor: "border-yellow-400",
    thumbnailBg: "#06038D",
    thumbnailAccent: "#FEDD00",
    thumbnailRays: true,
    thumbnailSpotlight: false,
    thumbnailSpeedLines: false,
    thumbnailBokeh: false,
  },
  {
    id: "card-analysis",
    label: "收藏展示風",
    tagline: "Christie's × PSA Lab",
    keywords: ["劇場聚光燈", "玻璃倒影", "頂級精品"],
    bgGradient: "linear-gradient(135deg, #080810 0%, #1a0a2e 100%)",
    accentColor: "#C8E6FF",
    accentColorHex: "C8E6FF",
    textColor: "text-blue-300",
    borderActiveColor: "border-blue-300",
    thumbnailBg: "#080810",
    thumbnailAccent: "#C8E6FF",
    thumbnailRays: false,
    thumbnailSpotlight: true,
    thumbnailSpeedLines: false,
    thumbnailBokeh: false,
  },
  {
    id: "guide",
    label: "入門指南風",
    tagline: "Apple Education × TCG",
    keywords: ["清晰現代", "友善教學", "柔和光效"],
    bgGradient: "linear-gradient(135deg, #1A1F2E 0%, #0d1a24 100%)",
    accentColor: "#00D4AA",
    accentColorHex: "00D4AA",
    textColor: "text-teal-400",
    borderActiveColor: "border-teal-400",
    thumbnailBg: "#1A1F2E",
    thumbnailAccent: "#00D4AA",
    thumbnailRays: false,
    thumbnailSpotlight: false,
    thumbnailSpeedLines: false,
    thumbnailBokeh: true,
  },
  {
    id: "news",
    label: "新聞爆料風",
    tagline: "Reuters × TCG Hype",
    keywords: ["高對比衝擊", "速度線條", "緊迫感"],
    bgGradient: "linear-gradient(135deg, #0D0D0D 0%, #1a0505 100%)",
    accentColor: "#FF2D2D",
    accentColorHex: "FF2D2D",
    textColor: "text-red-400",
    borderActiveColor: "border-red-400",
    thumbnailBg: "#0D0D0D",
    thumbnailAccent: "#FF2D2D",
    thumbnailRays: false,
    thumbnailSpotlight: false,
    thumbnailSpeedLines: true,
    thumbnailBokeh: false,
  },
];

/* ─── Style Thumbnail SVG ─────────────────────────────────────────────── */
// Renders a miniature mock-up of each cover style's visual language
function StyleThumbnail({
  style,
  isActive,
  isGenerating,
}: {
  style: typeof COVER_STYLES[0];
  isActive: boolean;
  isGenerating: boolean;
}) {
  const accent = `#${style.accentColorHex}`;
  return (
    <div
      className="relative w-full rounded-lg overflow-hidden"
      style={{ aspectRatio: "16/9", background: style.bgGradient }}
    >
      {/* ── Market Report: god-rays from bottom-left ── */}
      {style.thumbnailRays && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 90" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`ray-${style.id}`} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor={accent} stopOpacity="0.7" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Two god-ray beams */}
          <polygon points="0,90 140,0 160,0 160,10 20,90" fill={`url(#ray-${style.id})`} opacity="0.5" />
          <polygon points="0,90 100,0 130,0 30,90" fill={`url(#ray-${style.id})`} opacity="0.3" />
          {/* Hex grid dots */}
          {[20,40,60,80,100,120,140].map((x, i) => (
            <circle key={i} cx={x} cy={i % 2 === 0 ? 20 : 40} r="1" fill={accent} opacity="0.3" />
          ))}
          {/* Particle specks */}
          {[30,55,75,95,115,135].map((x, i) => (
            <circle key={`p${i}`} cx={x} cy={10 + (i * 12) % 70} r="0.8" fill={accent} opacity="0.6" />
          ))}
          {/* Mock card silhouettes on right */}
          <rect x="95" y="15" width="28" height="38" rx="2" fill="white" opacity="0.12" transform="rotate(8, 109, 34)" />
          <rect x="108" y="18" width="28" height="38" rx="2" fill="white" opacity="0.18" transform="rotate(3, 122, 37)" />
          <rect x="118" y="22" width="28" height="38" rx="2" fill="white" opacity="0.22" transform="rotate(-5, 132, 41)" />
          {/* Glow behind cards */}
          <ellipse cx="125" cy="45" rx="25" ry="20" fill={accent} opacity="0.12" />
        </svg>
      )}

      {/* ── Card Analysis: spotlight from above ── */}
      {style.thumbnailSpotlight && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 90" preserveAspectRatio="none">
          <defs>
            <radialGradient id={`spot-${style.id}`} cx="62%" cy="0%" r="60%">
              <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`indigo-${style.id}`} cx="65%" cy="50%" r="40%">
              <stop offset="0%" stopColor="#2D1B69" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#2D1B69" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="160" height="90" fill={`url(#indigo-${style.id})`} />
          <rect x="0" y="0" width="160" height="90" fill={`url(#spot-${style.id})`} />
          {/* Hero card — flat on, centered right */}
          <rect x="88" y="12" width="32" height="44" rx="2" fill="white" opacity="0.22" />
          {/* Rim light on card right edge */}
          <rect x="120" y="12" width="1.5" height="44" rx="0.5" fill={accent} opacity="0.8" />
          {/* Glass reflection */}
          <rect x="88" y="57" width="32" height="14" rx="1" fill="white" opacity="0.06" />
          {/* Sparkle particles */}
          {[89,102,115,120,95,108].map((x, i) => (
            <circle key={i} cx={x} cy={10 + (i * 7) % 50} r="0.6" fill="white" opacity="0.7" />
          ))}
        </svg>
      )}

      {/* ── Guide: bokeh circles ── */}
      {style.thumbnailBokeh && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 90" preserveAspectRatio="none">
          <defs>
            <radialGradient id={`warm-${style.id}`} cx="50%" cy="100%" r="50%">
              <stop offset="0%" stopColor="#FF8C42" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#FF8C42" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="160" height="90" fill={`url(#warm-${style.id})`} />
          {/* Bokeh circles */}
          {[
            { cx: 20, cy: 20, r: 12, op: 0.12 },
            { cx: 50, cy: 60, r: 18, op: 0.08 },
            { cx: 130, cy: 15, r: 10, op: 0.15 },
            { cx: 145, cy: 70, r: 14, op: 0.1 },
            { cx: 75, cy: 10, r: 8, op: 0.18 },
          ].map((b, i) => (
            <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={accent} opacity={b.op} />
          ))}
          {/* Geometric outlines */}
          <rect x="10" y="10" width="40" height="30" rx="4" fill="none" stroke={accent} strokeWidth="0.5" opacity="0.2" transform="rotate(-5, 30, 25)" />
          {/* Fan of cards */}
          <rect x="90" y="18" width="26" height="36" rx="2" fill="white" opacity="0.14" transform="rotate(-10, 103, 36)" />
          <rect x="100" y="16" width="26" height="36" rx="2" fill="white" opacity="0.18" transform="rotate(0, 113, 34)" />
          <rect x="110" y="18" width="26" height="36" rx="2" fill="white" opacity="0.14" transform="rotate(10, 123, 36)" />
          {/* Teal accent dots */}
          {[95,108,121].map((x, i) => (
            <circle key={i} cx={x} cy={56 + i * 3} r="1" fill={accent} opacity="0.7" />
          ))}
        </svg>
      )}

      {/* ── News: speed lines + energy burst ── */}
      {style.thumbnailSpeedLines && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 90" preserveAspectRatio="none">
          <defs>
            <radialGradient id={`burst-${style.id}`} cx="65%" cy="50%" r="35%">
              <stop offset="0%" stopColor={accent} stopOpacity="0.3" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`vignette-${style.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3D0000" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3D0000" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="160" height="90" fill={`url(#vignette-${style.id})`} />
          <rect x="0" y="0" width="160" height="90" fill={`url(#burst-${style.id})`} />
          {/* Speed lines */}
          {[0, 15, 30, 45, 60, 75].map((y, i) => (
            <line key={i} x1="0" y1={y} x2="160" y2={y + 15} stroke="white" strokeWidth="0.5" opacity="0.1" />
          ))}
          {/* Tilted card */}
          <rect x="95" y="14" width="30" height="42" rx="2" fill="white" opacity="0.2" transform="rotate(15, 110, 35)" />
          {/* Red rim light */}
          <rect x="95" y="14" width="1.5" height="42" rx="0.5" fill={accent} opacity="0.9" transform="rotate(15, 110, 35)" />
          {/* Energy burst lines from card */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x2 = 110 + Math.cos(rad) * 20;
            const y2 = 35 + Math.sin(rad) * 20;
            return <line key={i} x1="110" y1="35" x2={x2} y2={y2} stroke={accent} strokeWidth="0.5" opacity="0.3" />;
          })}
          {/* Spark particles */}
          {[100, 125, 88, 115].map((x, i) => (
            <circle key={i} cx={x} cy={20 + i * 15} r="1" fill="white" opacity="0.8" />
          ))}
        </svg>
      )}

      {/* Left text zone indicator */}
      <div className="absolute left-0 top-0 bottom-0 w-[44%] flex flex-col justify-end p-2">
        <div className="space-y-1">
          <div className="h-1.5 rounded-full opacity-30" style={{ background: accent, width: '80%' }} />
          <div className="h-1 rounded-full opacity-20" style={{ background: accent, width: '60%' }} />
          <div className="h-1 rounded-full opacity-15" style={{ background: accent, width: '45%' }} />
        </div>
      </div>

      {/* BOXIUM watermark mock */}
      <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/50 flex flex-col items-center">
        <span className="text-[5px] font-bold text-white/70 tracking-widest leading-none">BOXIUM</span>
        <span className="text-[3.5px] text-white/50 tracking-wider leading-none">PTCG</span>
      </div>

      {/* Active overlay */}
      {isActive && !isGenerating && (
        <div className="absolute inset-0 ring-2 rounded-lg pointer-events-none" style={{ boxShadow: `inset 0 0 0 2px ${accent}` }} />
      )}
      {isGenerating && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: accent }} />
        </div>
      )}
    </div>
  );
}

function CoverImageSection({
  articleTitle,
  articleContent,
  articleType,
  coverStyle: defaultCoverStyle,
  coverImageUrl,
  onCoverImageChange,
}: {
  articleTitle: string;
  articleContent: string;
  articleType: ArticleTypeId;
  coverStyle: "market-report" | "card-analysis" | "guide" | "news";
  coverImageUrl: string | null;
  onCoverImageChange: (url: string | null) => void;
}) {
  const [selectedCards, setSelectedCards] = useState<CardImageItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [activeStyle, setActiveStyle] = useState<"market-report" | "card-analysis" | "guide" | "news">(defaultCoverStyle);
  const [generatingStyleId, setGeneratingStyleId] = useState<string | null>(null);

  const extractCardsMutation = trpc.blog.extractCardsFromArticle.useMutation();
  const generateCoverMutation = trpc.blog.generateCoverImage.useMutation();

  // Auto-extract cards when component mounts
  const handleAutoExtract = useCallback(async (forceRetry = false) => {
    if ((hasExtracted || isExtracting) && !forceRetry) return;
    setIsExtracting(true);
    if (forceRetry) setHasExtracted(false);
    try {
      const cards = await extractCardsMutation.mutateAsync({
        articleContent,
        articleTitle,
        limit: 4,
      });
      setSelectedCards(cards.slice(0, 3));
      setHasExtracted(true);
    } catch (_) {
      setHasExtracted(true);
    } finally {
      setIsExtracting(false);
    }
  }, [articleContent, articleTitle, hasExtracted, isExtracting]);

  // Trigger extraction on first render
  useState(() => { handleAutoExtract(); });

  const handleToggleCard = useCallback((card: CardImageItem): void => {
    setSelectedCards((prev) => {
      const exists = prev.find((c) => c.id === card.id);
      if (exists) return prev.filter((c) => c.id !== card.id);
      if (prev.length >= 3) { toast.info("最多選擇 3 張卡牌"); return prev; }
      return [...prev, card];
    });
  }, []);

  // Generate cover with a specific style
  const handleGenerateCover = async (styleId?: "market-report" | "card-analysis" | "guide" | "news") => {
    const style = styleId || activeStyle;
    if (selectedCards.length === 0) {
      toast.error("未能找到相關卡牌，請稍後重試");
      return;
    }
    setIsGenerating(true);
    setGeneratingStyleId(style);
    if (styleId) setActiveStyle(styleId);
    try {
      const cardImageUrls = selectedCards.map((c) => c.imageUrlHiRes || c.imageUrl).filter(Boolean) as string[];
      const cardNames = selectedCards.map((c) => c.name);
      const result = await generateCoverMutation.mutateAsync({
        articleTitle,
        articleType,
        cardImageUrls,
        cardNames,
        style,
      });
      onCoverImageChange(result.url ?? null);
      toast.success("封面圖生成成功！");
    } catch (e: any) {
      toast.error(`封面圖生成失敗：${e.message}`);
    } finally {
      setIsGenerating(false);
      setGeneratingStyleId(null);
    }
  };

  const articleCardCount = selectedCards.filter(c => c.matchedFrom === 'article').length;
  const activeStyleInfo = COVER_STYLES.find(s => s.id === activeStyle);

  return (
    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-xs text-zinc-400 font-medium uppercase tracking-wide">封面圖</span>
          {articleCardCount > 0 && (
            <Badge className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30">
              已識別 {articleCardCount} 張卡牌
            </Badge>
          )}
        </div>
        {coverImageUrl && (
          <button
            onClick={() => onCoverImageChange(null)}
            className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" />
            移除
          </button>
        )}
      </div>

      {/* Style Selector — with thumbnail previews */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">選擇封面風格</p>
          <span className="text-[10px] text-zinc-600">點選即自動生成</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {COVER_STYLES.map((style) => {
            const isActive = activeStyle === style.id;
            const isThisGenerating = generatingStyleId === style.id && isGenerating;
            return (
              <button
                key={style.id}
                onClick={() => {
                  setActiveStyle(style.id);
                  if (!isGenerating) handleGenerateCover(style.id);
                }}
                disabled={isGenerating || isExtracting}
                className={`group relative rounded-xl text-left transition-all duration-200 overflow-hidden border-2 ${
                  isActive
                    ? `ring-1`
                    : "border-zinc-700/80 hover:border-zinc-500"
                } ${isGenerating ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:scale-[1.02] active:scale-[0.98]"}`}
                style={isActive ? {
                  borderColor: style.accentColor,
                  boxShadow: `0 0 12px ${style.accentColor}30`,
                } : {}}
              >
                {/* Thumbnail preview */}
                <StyleThumbnail
                  style={style}
                  isActive={isActive}
                  isGenerating={isThisGenerating}
                />

                {/* Info bar below thumbnail */}
                <div
                  className="px-2.5 py-2 space-y-0.5"
                  style={{ background: `${style.thumbnailBg}ee` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">{style.label}</span>
                    {isActive && !isThisGenerating && (
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: style.accentColor }}
                      >
                        <Check className="w-2.5 h-2.5 text-black" />
                      </div>
                    )}
                    {isThisGenerating && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: style.accentColor }} />
                    )}
                  </div>
                  <p className="text-[9px] font-medium" style={{ color: style.accentColor }}>{style.tagline}</p>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {style.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="text-[8px] px-1 py-0.5 rounded-full border leading-none"
                        style={{
                          color: style.accentColor,
                          borderColor: `${style.accentColor}40`,
                          backgroundColor: `${style.accentColor}12`,
                        }}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Current Cover Preview */}
      {coverImageUrl && (
        <div className="relative rounded-lg overflow-hidden border border-zinc-700 group">
          <img src={coverImageUrl} alt="封面圖" className="w-full h-44 object-cover" />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleGenerateCover()}
              disabled={isGenerating}
              className="gap-1.5 text-xs border-white/30 text-white hover:bg-white/10"
            >
              {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              重新生成
            </Button>
          </div>
          <div className="absolute bottom-2 right-2">
            <Badge className="bg-green-500/90 text-white text-[10px]">
              <Check className="w-2.5 h-2.5 mr-1" />
              {activeStyleInfo?.label || "已設定封面圖"}
            </Badge>
          </div>
        </div>
      )}

      {/* Extracted Cards Preview */}
      {isExtracting ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
          <Loader2 className="w-4 h-4 animate-spin text-[#06038d]" />
          <span className="text-sm text-zinc-400">AI 正在從文章識別相關卡牌...</span>
        </div>
      ) : selectedCards.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-zinc-500 font-medium">封面素材卡牌</p>
            <button
              onClick={() => handleAutoExtract(true)}
              disabled={isExtracting || isGenerating}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              重新識別
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {selectedCards.map((card) => {
              const imgUrl = card.imageUrlHiRes || card.imageUrl;
              return (
                <div key={card.id} className="relative flex-shrink-0 group">
                  <div className={`rounded-lg overflow-hidden border-2 w-14 ${
                    card.matchedFrom === 'article' ? 'border-[#FEDD00]/60' : 'border-zinc-600'
                  }`}>
                    {imgUrl ? (
                      <img src={imgUrl} alt={card.name} className="w-14 aspect-[3/4] object-cover" />
                    ) : (
                      <div className="w-14 aspect-[3/4] bg-zinc-700 flex items-center justify-center">
                        <Image className="w-4 h-4 text-zinc-500" />
                      </div>
                    )}
                    <button
                      onClick={() => handleToggleCard(card)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 items-center justify-center hidden group-hover:flex"
                    >
                      <X className="w-2.5 h-2.5 text-white" />
                    </button>
                  </div>
                  <p className="text-[9px] text-zinc-500 mt-0.5 w-14 truncate text-center">{card.name.split('[')[0].trim()}</p>
                  {card.matchedFrom === 'article' && (
                    <div className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-[#FEDD00] flex items-center justify-center">
                      <Star className="w-2 h-2 text-black fill-black" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-zinc-600">
            <Star className="w-2.5 h-2.5 inline text-[#FEDD00] fill-[#FEDD00] mr-0.5" />
            標示為文章中提及的卡牌，其餘為熱門卡牌補充
          </p>
        </div>
      ) : null}

      {/* Generating overlay indicator */}
      {isGenerating && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#06038d]/10 border border-[#06038d]/30">
          <Loader2 className="w-4 h-4 animate-spin text-[#06038d]" />
          <span className="text-sm text-zinc-300">AI 正在生成「{activeStyleInfo?.label}」封面圖（約 20 秒）...</span>
        </div>
      )}
    </div>
  );
}

/* ─── Generated Article Preview ─────────────────────────────────────── */
function ArticlePreview({
  article,
  articleTypeId,
  coverStyle,
  onEdit,
  onPublish,
  onSaveDraft,
  onRegenerate,
  isPublishing,
  isSavingDraft,
}: {
  article: any;
  articleTypeId: ArticleTypeId;
  coverStyle: "market-report" | "card-analysis" | "guide" | "news";
  onEdit: (field: string, value: string) => void;
  onPublish: () => void;
  onSaveDraft: () => void;
  onRegenerate: () => void;
  isPublishing: boolean;
  isSavingDraft: boolean;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingExcerpt, setEditingExcerpt] = useState(false);
  const [localTitle, setLocalTitle] = useState(article.title || "");
  const [localExcerpt, setLocalExcerpt] = useState(article.excerpt || "");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(article.featuredImage || null);

  // Sync cover image to parent when changed
  const handleCoverImageChange = (url: string | null) => {
    setCoverImageUrl(url ?? null);
    onEdit("featuredImage", url || "");
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <span className="text-sm text-white font-medium">文章已生成，請確認後發布</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            className="gap-1.5 border-zinc-600 text-zinc-300 hover:bg-zinc-700 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重新生成
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            disabled={isSavingDraft}
            className="gap-1.5 border-zinc-600 text-zinc-300 hover:bg-zinc-700 text-xs"
          >
            {isSavingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            存草稿
          </Button>
          <Button
            size="sm"
            onClick={onPublish}
            disabled={isPublishing}
            className="gap-1.5 bg-[#06038d] hover:bg-[#0804b0] text-white text-xs"
          >
            {isPublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {isPublishing ? "發布中..." : "立即發布"}
          </Button>
        </div>
      </div>

      {/* Cover Image Section */}
      <CoverImageSection
        articleTitle={localTitle || article.title || ""}
        articleContent={article.content || ""}
        articleType={articleTypeId}
        coverStyle={coverStyle}
        coverImageUrl={coverImageUrl}
        onCoverImageChange={handleCoverImageChange}
      />

      {/* Title */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-400 font-medium uppercase tracking-wide">文章標題</span>
          <button
            onClick={() => setEditingTitle(!editingTitle)}
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
          >
            <Edit3 className="w-3 h-3" />
            {editingTitle ? "完成" : "編輯"}
          </button>
        </div>
        {editingTitle ? (
          <Input
            value={localTitle}
            onChange={(e) => {
              setLocalTitle(e.target.value);
              onEdit("title", e.target.value);
            }}
            className="bg-zinc-800 border-zinc-600 text-white text-base font-bold"
          />
        ) : (
          <h2 className="text-white font-bold text-lg leading-tight">{localTitle || article.title}</h2>
        )}
      </div>

      {/* Excerpt */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-400 font-medium uppercase tracking-wide">文章摘要</span>
          <button
            onClick={() => setEditingExcerpt(!editingExcerpt)}
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
          >
            <Edit3 className="w-3 h-3" />
            {editingExcerpt ? "完成" : "編輯"}
          </button>
        </div>
        {editingExcerpt ? (
          <Textarea
            value={localExcerpt}
            onChange={(e) => {
              setLocalExcerpt(e.target.value);
              onEdit("excerpt", e.target.value);
            }}
            className="bg-zinc-800 border-zinc-600 text-white text-sm resize-none"
            rows={3}
          />
        ) : (
          <p className="text-zinc-300 text-sm leading-relaxed">{localExcerpt || article.excerpt}</p>
        )}
      </div>

      {/* Tags */}
      {(article.tags || article.suggestedTags) && (
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wide">標籤</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(article.tags || article.suggestedTags || []).map((tag: string, i: number) => (
              <Badge key={i} variant="outline" className="text-xs text-zinc-300 border-zinc-600">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Content Preview */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-xs text-zinc-400 font-medium uppercase tracking-wide">文章內容預覽</span>
        </div>
        <div className="prose prose-invert prose-sm max-w-none max-h-[400px] overflow-y-auto pr-2
          prose-headings:text-white prose-p:text-zinc-300 prose-strong:text-white
          prose-li:text-zinc-300 prose-a:text-blue-400 prose-code:text-yellow-300
          prose-h2:text-base prose-h3:text-sm">
          <ReactMarkdown>{article.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

/* ─── Generating Animation ───────────────────────────────────────────── */
function GeneratingView({ typeTitle }: { typeTitle: string }) {
  const steps = [
    "分析市場數據...",
    "制定內容策略...",
    "生成文章大綱...",
    "撰寫完整內容...",
    "品質審核中...",
  ];
  const [currentStep, setCurrentStep] = useState(0);

  // Cycle through steps
  useState(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, 2500);
    return () => clearInterval(interval);
  });

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-[#06038d]/20 border-2 border-[#06038d]/40 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-[#06038d] animate-pulse" />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-[#06038d]/20 animate-ping" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-white font-semibold text-lg">AI 正在生成「{typeTitle}」</h3>
        <p className="text-zinc-400 text-sm">{steps[currentStep]}</p>
      </div>
      <div className="flex gap-1.5">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-500 ${
              i === currentStep ? "bg-[#06038d] scale-125" : i < currentStep ? "bg-green-500" : "bg-zinc-600"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-zinc-500">全程自動完成，無需等待或操作</p>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────── */
export default function AdminQuickPublish() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<ArticleTypeId | null>(null);
  const [topic, setTopic] = useState("");
  const [generatedArticle, setGeneratedArticle] = useState<any>(null);
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const utils = trpc.useUtils();

  // Mutations
  const generateReportMutation = trpc.blogAi.generateDailyReport.useMutation();
  const generateFromTemplateMutation = trpc.blogAi.generateFromTemplate.useMutation();
  const generateStrategyMutation = trpc.blogAi.generateStrategy.useMutation();
  const generateOutlineMutation = trpc.blogAi.generateOutline.useMutation();
  const generateArticleMutation = trpc.blog.generateArticle.useMutation();
  const createPostMutation = trpc.blog.createPost.useMutation({
    onSuccess: () => {
      utils.blog.getPosts.invalidate();
    },
  });

  const selectedTypeInfo = ARTICLE_TYPES.find((t) => t.id === selectedType);

  /* ── Generate Logic ── */
  const handleGenerate = async () => {
    if (!selectedType) { toast.error("請先選擇文章類型"); return; }
    if (selectedTypeInfo?.requiresTopic && !topic.trim()) {
      toast.error(`請輸入${selectedTypeInfo.topicPlaceholder.split("：")[0] || "主題"}`);
      return;
    }

    setStep(2);
    setIsGenerating(true);

    try {
      let article: any = null;

      if (selectedType === "market-report") {
        article = await generateReportMutation.mutateAsync({
          days: 7,
          reportType: "weekly",
        });
      } else if (selectedType === "trend-analysis") {
        article = await generateFromTemplateMutation.mutateAsync({
          templateType: "trend-analysis",
          variables: topic.trim() ? { 時間段: "本週", 主題: topic.trim() } : { 時間段: "本週" },
        });
        if (article.suggestedTags && !article.tags) article.tags = article.suggestedTags;
      } else if (selectedType === "beginner-guide") {
        const strategy = await generateStrategyMutation.mutateAsync({
          topic: topic.trim(),
          targetAudience: "PTCG 新手收藏家",
          purpose: "入門教學",
        });
        const outline = await generateOutlineMutation.mutateAsync({
          title: strategy.titleOptions?.[0] || topic,
          articleType: "beginner-guide",
          contentAngle: strategy.contentAngle,
          keyPoints: strategy.keyPoints,
          targetAudience: strategy.targetAudience,
          estimatedLength: strategy.estimatedLength,
        });
        article = await generateArticleMutation.mutateAsync({
          articleType: "news",
          textInput: {
            content: `文章標題：${outline.h1 || topic}\n文章大綱：\n${
              (outline.sections || []).map((s: any, i: number) =>
                `${i + 1}. ## ${s.h2}\n   說明：${s.description}`
              ).join("\n")
            }`,
            topic: outline.h1 || topic,
          },
        });
      } else if (selectedType === "card-research") {
        const strategy = await generateStrategyMutation.mutateAsync({
          topic: `${topic.trim()} 卡牌價格分析`,
          targetAudience: "PTCG 收藏家和投資者",
          purpose: "單卡深度研究",
          seoKeywords: `${topic.trim()} PSA10 價格`,
        });
        const outline = await generateOutlineMutation.mutateAsync({
          title: strategy.titleOptions?.[0] || `${topic} 深度研究報告`,
          articleType: "card-research",
          contentAngle: strategy.contentAngle,
          keyPoints: strategy.keyPoints,
          targetAudience: strategy.targetAudience,
          estimatedLength: "長",
        });
        article = await generateArticleMutation.mutateAsync({
          articleType: "card-analysis",
          textInput: {
            content: `文章標題：${outline.h1 || topic}\n文章大綱：\n${
              (outline.sections || []).map((s: any, i: number) =>
                `${i + 1}. ## ${s.h2}\n   說明：${s.description}`
              ).join("\n")
            }`,
            topic: outline.h1 || topic,
          },
        });
      } else if (selectedType === "platform-news") {
        article = await generateFromTemplateMutation.mutateAsync({
          templateType: "platform-news",
          variables: { 公告標題: topic.trim(), 核心內容: topic.trim() },
        });
        if (article.suggestedTags && !article.tags) article.tags = article.suggestedTags;
      }

      if (!article) throw new Error("生成失敗，請重試");

      setGeneratedArticle(article);
      setEditedFields({});
      setStep(3);
      toast.success("文章生成成功！可選擇生成封面圖後發布");
    } catch (e: any) {
      toast.error(`生成失敗：${e.message}`);
      setStep(1);
    } finally {
      setIsGenerating(false);
    }
  };

  /* ── Publish Logic ── */
  const handlePublishOrDraft = async (status: "published" | "draft") => {
    if (!generatedArticle || !selectedType) return;

    const finalArticle = {
      ...generatedArticle,
      ...editedFields,
    };

    const typeToCategory: Record<ArticleTypeId, string> = {
      "market-report": "市場快報",
      "card-research": "卡牌研究",
      "trend-analysis": "市場分析",
      "beginner-guide": "收藏指南",
      "platform-news": "平台公告",
    };

    try {
      const result = await createPostMutation.mutateAsync({
        title: finalArticle.title,
        excerpt: finalArticle.excerpt || "",
        content: finalArticle.content,
        status,
        dataSource: "ai-generated",
        category: typeToCategory[selectedType],
        tags: finalArticle.tags || finalArticle.suggestedTags || [],
        metaTitle: finalArticle.seoTitle || finalArticle.title,
        metaDescription: finalArticle.seoDescription || finalArticle.excerpt || "",
        metaKeywords: finalArticle.seoKeywords || (finalArticle.tags || []).join(", "),
        featuredImage: finalArticle.featuredImage || undefined,
      });

      if (status === "published") {
        toast.success(`文章已發布！文章 ID: ${result.postId}`);
      } else {
        toast.success(`已存為草稿，可在博客管理中繼續編輯`);
      }

      // Reset
      setStep(1);
      setSelectedType(null);
      setTopic("");
      setGeneratedArticle(null);
      setEditedFields({});
    } catch (e: any) {
      toast.error(`${status === "published" ? "發布" : "儲存"}失敗：${e.message}`);
    }
  };

  const handleEditField = (field: string, value: string) => {
    setEditedFields((prev) => ({ ...prev, [field]: value }));
  };

  const handleReset = () => {
    setStep(1);
    setSelectedType(null);
    setTopic("");
    setGeneratedArticle(null);
    setEditedFields({});
    setIsGenerating(false);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-[#06038d]/20 border border-[#06038d]/30 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-[#06038d]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">AI 出文章</h1>
          <p className="text-sm text-gray-400">選擇類型 → 一鍵生成 → 確認發布，3 步完成</p>
        </div>
        {step > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="ml-auto text-zinc-400 hover:text-white gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            重新開始
          </Button>
        )}
      </div>

      {/* Step Indicator */}
      <StepIndicator step={step} />

      {/* ── STEP 1: 選擇類型 ── */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400 text-center mb-4">選擇你想生成的文章類型</p>

          <div className="grid grid-cols-1 gap-3">
            {ARTICLE_TYPES.map((type) => (
              <TypeCard
                key={type.id}
                type={type}
                selected={selectedType === type.id}
                onClick={() => setSelectedType(type.id)}
              />
            ))}
          </div>

          {/* Topic Input (conditional) */}
          {selectedType && selectedTypeInfo && (
            <div className="mt-4 p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 space-y-3">
              {selectedTypeInfo.requiresTopic ? (
                <>
                  <div className="flex items-center gap-2">
                    <BarChart3 className={`w-4 h-4 ${selectedTypeInfo.color}`} />
                    <span className="text-sm text-white font-medium">輸入主題</span>
                    <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30">必填</Badge>
                  </div>
                  <Input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={selectedTypeInfo.topicPlaceholder}
                    className="bg-zinc-900 border-zinc-600 text-white placeholder:text-zinc-500"
                    onKeyDown={(e) => e.key === "Enter" && topic.trim() && handleGenerate()}
                  />
                  {selectedTypeInfo.topicHint && (
                    <div className="flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-zinc-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-zinc-500">{selectedTypeInfo.topicHint}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {selectedTypeInfo.topicPlaceholder && (
                    <>
                      <div className="flex items-center gap-2">
                        <BarChart3 className={`w-4 h-4 ${selectedTypeInfo.color}`} />
                        <span className="text-sm text-white font-medium">指定主題（選填）</span>
                        <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-600">選填</Badge>
                      </div>
                      <Input
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder={selectedTypeInfo.topicPlaceholder}
                        className="bg-zinc-900 border-zinc-600 text-white placeholder:text-zinc-500"
                      />
                      {selectedTypeInfo.topicHint && (
                        <div className="flex items-start gap-1.5">
                          <Info className="w-3.5 h-3.5 text-zinc-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-zinc-500">{selectedTypeInfo.topicHint}</p>
                        </div>
                      )}
                    </>
                  )}
                  {!selectedTypeInfo.topicPlaceholder && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-sm">無需輸入，AI 自動從平台數據生成</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={
              !selectedType ||
              (!!selectedTypeInfo?.requiresTopic && !topic.trim())
            }
            className="w-full h-12 bg-[#06038d] hover:bg-[#0804b0] text-white font-semibold text-base gap-2 mt-2"
          >
            <Sparkles className="w-5 h-5" />
            一鍵生成文章
            <ChevronRight className="w-4 h-4" />
          </Button>

          {selectedType && (
            <p className="text-center text-xs text-zinc-500">
              預計生成時間：{selectedTypeInfo?.estimatedTime}，全程自動完成
            </p>
          )}

          {/* Divider + Manual Create */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-xs text-zinc-600">或</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              // Navigate to blog management > new article
              const adminEl = document.querySelector('[data-admin-tab="blog"]') as HTMLElement | null;
              if (adminEl) adminEl.click();
              // Fallback: dispatch custom event
              window.dispatchEvent(new CustomEvent('admin:navigate', { detail: { tab: 'blog', action: 'new' } }));
            }}
            className="w-full h-10 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 gap-2 bg-transparent"
          >
            <FileText className="w-4 h-4" />
            手動新增文章
          </Button>
        </div>
      )}

      {/* ── STEP 2: 生成中 ── */}
      {step === 2 && isGenerating && selectedTypeInfo && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-6">
            <GeneratingView typeTitle={selectedTypeInfo.title} />
          </CardContent>
        </Card>
      )}

      {/* ── STEP 3: 預覽發布 ── */}
      {step === 3 && generatedArticle && selectedTypeInfo && (
        <ArticlePreview
          article={{ ...generatedArticle, ...editedFields }}
          articleTypeId={selectedType!}
          coverStyle={selectedTypeInfo.coverStyle}
          onEdit={handleEditField}
          onPublish={() => handlePublishOrDraft("published")}
          onSaveDraft={() => handlePublishOrDraft("draft")}
          onRegenerate={handleReset}
          isPublishing={createPostMutation.isPending && !editedFields._draftMode}
          isSavingDraft={createPostMutation.isPending && !!editedFields._draftMode}
        />
      )}
    </div>
  );
}
