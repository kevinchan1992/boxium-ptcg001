/**
 * AdminQuickPublish — 簡化版 AI 出文章介面
 *
 * 設計原則：管理員只需 3 步完成出文章：
 *   Step 1 → 選擇文章類型 + 可選填主題
 *   Step 2 → 一鍵生成，AI 自動完成策略+大綱+撰寫+校對
 *   Step 3 → 預覽文章，確認後一鍵發布或存草稿
 *
 * 取代原有複雜的 A/B/C/D 技能選擇流程。
 */

import { useState } from "react";
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
  BarChart3, Star, Info,
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

/* ─── Generated Article Preview ─────────────────────────────────────── */
function ArticlePreview({
  article,
  onEdit,
  onPublish,
  onSaveDraft,
  onRegenerate,
  isPublishing,
  isSavingDraft,
}: {
  article: any;
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
        // 快報：直接用 generateDailyReport（自動拉數據）
        article = await generateReportMutation.mutateAsync({
          days: 7,
          reportType: "weekly",
        });
      } else if (selectedType === "trend-analysis") {
        // 趨勢報告：用 generateFromTemplate
        article = await generateFromTemplateMutation.mutateAsync({
          templateType: "trend-analysis",
          variables: topic.trim() ? { 時間段: "本週", 主題: topic.trim() } : { 時間段: "本週" },
        });
        // Normalize field names
        if (article.suggestedTags && !article.tags) article.tags = article.suggestedTags;
      } else if (selectedType === "beginner-guide") {
        // 入門指南：strategy → outline → generate
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
        // 單卡研究：strategy → outline → generate
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
        // 平台公告：用 template
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
      toast.success("文章生成成功！請確認後發布");
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
      {step === 3 && generatedArticle && (
        <ArticlePreview
          article={{ ...generatedArticle, ...editedFields }}
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
