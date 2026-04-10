/**
 * 內容工作流中心
 * BOXIUM = 自有數據平台 + Manus 內容自動化引擎
 * 五大技能：研究 → 撰寫 → 校對 → 發布 → 刷新
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search, PenLine, CheckCircle, Send, RefreshCw,
  ChevronRight, BarChart3, Sparkles, TrendingUp, TrendingDown,
  Clock, Eye, Tag, ArrowRight, Zap, Database, Globe,
  FileText, AlertCircle, CheckCheck, Info
} from "lucide-react";
import { CardSelectionDialog } from "@/components/CardSelectionDialog";

// ─── Skill Card Component ────────────────────────────────────────
function SkillCard({
  icon: Icon,
  title,
  subtitle,
  description,
  inputLabel,
  outputLabel,
  color,
  onClick,
  isActive,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  description: string;
  inputLabel: string;
  outputLabel: string;
  color: string;
  onClick: () => void;
  isActive: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        isActive
          ? `border-${color}-500 bg-${color}-900/20 ring-1 ring-${color}-500/50`
          : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-500 hover:bg-zinc-800'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-${color}-900/40 border border-${color}-700/30 flex-shrink-0`}>
          <Icon className={`w-5 h-5 text-${color}-400`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-white font-semibold text-sm">{title}</p>
            {isActive && <Badge className="bg-purple-600 text-white text-[10px] px-1.5 py-0">使用中</Badge>}
          </div>
          <p className={`text-${color}-400 text-xs font-medium mb-1.5`}>{subtitle}</p>
          <p className="text-gray-400 text-xs leading-relaxed">{description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-gray-500 bg-zinc-700 px-2 py-0.5 rounded">輸入：{inputLabel}</span>
            <ArrowRight className="w-3 h-3 text-gray-600" />
            <span className="text-[10px] text-gray-500 bg-zinc-700 px-2 py-0.5 rounded">輸出：{outputLabel}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Skill A: 研究技能 ────────────────────────────────────────────
function ResearchSkill({ onBriefReady }: { onBriefReady: (brief: any) => void }) {
  const [topic, setTopic] = useState('');
  const [cardIds, setCardIds] = useState('');
  const [days, setDays] = useState('30');
  const [goal, setGoal] = useState<'price-analysis' | 'market-trend' | 'investment-guide' | 'news-brief'>('price-analysis');
  const [result, setResult] = useState<any>(null);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [selectedCardNames, setSelectedCardNames] = useState<string[]>([]);

  const researchMutation = trpc.blogAi.researchWithData.useMutation({
    onSuccess: (data) => { setResult(data); toast.success('研究 Brief 已生成！'); },
    onError: (e) => toast.error(`研究失敗：${e.message}`),
  });

  const handleCardInsert = (cardData: string) => {
    // Extract card IDs from the data string
    const idMatch = cardData.match(/ID:\s*(\d+)/g);
    if (idMatch) {
      const ids = idMatch.map(m => m.replace('ID: ', '').trim());
      setCardIds(prev => prev ? [...prev.split(','), ...ids].join(',') : ids.join(','));
    }
    const nameMatch = cardData.match(/卡牌名稱：(.+)/);
    if (nameMatch) setSelectedCardNames(prev => [...prev, nameMatch[1].trim()]);
  };

  const handleResearch = () => {
    if (!topic) { toast.error('請輸入研究主題'); return; }
    const ids = cardIds ? cardIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : undefined;
    researchMutation.mutate({ topic, cardIds: ids, days: parseInt(days), researchGoal: goal });
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
        <div className="flex items-start gap-2">
          <Database className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-blue-300 text-xs font-medium">🔬 研究技能 — BOXIUM 數據驅動</p>
            <p className="text-gray-400 text-xs mt-0.5">AI 會從平台真實成交數據中提取洞察，生成有具體數字支撐的研究 Brief，而非泛化推測。</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-white text-sm">研究主題 *</Label>
          <Input value={topic} onChange={e => setTopic(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white mt-1"
            placeholder="例如：Charizard PSA 10 近期市場分析、2024 年最值得收藏的 Pokemon 卡牌" />
        </div>
        <div>
          <Label className="text-white text-sm">研究目標</Label>
          <Select value={goal} onValueChange={(v: any) => setGoal(v)}>
            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price-analysis">💰 深度價格分析</SelectItem>
              <SelectItem value="market-trend">📈 市場趨勢報告</SelectItem>
              <SelectItem value="investment-guide">🎯 投資收藏指南</SelectItem>
              <SelectItem value="news-brief">📰 市場快訊</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-white text-sm">數據區間（天）</Label>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">近 7 天</SelectItem>
              <SelectItem value="30">近 30 天</SelectItem>
              <SelectItem value="90">近 90 天</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-1">
            <Label className="text-white text-sm">綁定卡牌數據（選填）</Label>
            <Button type="button" variant="outline" size="sm"
              onClick={() => setCardDialogOpen(true)}
              className="h-7 text-xs border-[#FEDD00] text-[#FEDD00] hover:bg-[#FEDD00]/10">
              🎴 選擇卡牌
            </Button>
          </div>
          {selectedCardNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedCardNames.map((name, i) => (
                <Badge key={i} className="bg-blue-900/40 text-blue-300 border border-blue-700/30 text-xs">
                  {name}
                  <button onClick={() => {
                    setSelectedCardNames(prev => prev.filter((_, j) => j !== i));
                    const ids = cardIds.split(',');
                    ids.splice(i, 1);
                    setCardIds(ids.join(','));
                  }} className="ml-1 text-blue-400 hover:text-red-400">×</button>
                </Badge>
              ))}
            </div>
          )}
          <Input value={cardIds} onChange={e => setCardIds(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white text-xs"
            placeholder="卡牌 ID（逗號分隔），或點擊上方按鈕選擇" />
        </div>
      </div>

      <Button onClick={handleResearch} disabled={researchMutation.isPending}
        className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
        <Search className="w-4 h-4 mr-2" />
        {researchMutation.isPending ? '研究員正在分析數據...' : '啟動數據研究'}
      </Button>

      {/* Research Result */}
      {result && (
        <div className="space-y-3 p-4 bg-zinc-800 rounded-xl border border-zinc-700">
          <div className="flex items-center justify-between">
            <p className="text-white font-semibold text-sm flex items-center gap-2">
              <CheckCheck className="w-4 h-4 text-green-400" /> 研究 Brief 已完成
            </p>
            <Button size="sm" onClick={() => onBriefReady(result)}
              className="h-7 bg-green-600 hover:bg-green-700 text-xs">
              用此 Brief 生成文章 →
            </Button>
          </div>

          {/* Core Insights */}
          <div>
            <p className="text-xs text-gray-400 mb-1.5">核心洞察</p>
            <ul className="space-y-1">
              {result.coreInsights?.map((insight: string, i: number) => (
                <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5">
                  <span className="text-blue-400 mt-0.5">•</span>{insight}
                </li>
              ))}
            </ul>
          </div>

          {/* Key Data Points */}
          {result.keyDataPoints?.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5">必引數據點</p>
              <div className="flex flex-wrap gap-1.5">
                {result.keyDataPoints.map((point: string, i: number) => (
                  <Badge key={i} className="bg-zinc-700 text-gray-200 text-xs border-zinc-600 border">{point}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Title Options */}
          <div>
            <p className="text-xs text-gray-400 mb-1.5">標題草案</p>
            <div className="space-y-1">
              {result.titleOptions?.map((title: string, i: number) => (
                <p key={i} className="text-gray-300 text-xs p-2 bg-zinc-700 rounded">{i + 1}. {title}</p>
              ))}
            </div>
          </div>

          {/* Outline */}
          <div>
            <p className="text-xs text-gray-400 mb-1.5">大綱建議</p>
            <div className="space-y-1">
              {result.outlineSuggestion?.map((section: string, i: number) => (
                <p key={i} className="text-gray-300 text-xs flex items-start gap-1.5">
                  <span className="text-purple-400 font-mono text-[10px] mt-0.5">H2</span>{section}
                </p>
              ))}
            </div>
          </div>

          {result.dataLimitations && (
            <div className="p-2 bg-yellow-900/20 border border-yellow-700/30 rounded text-xs text-yellow-300 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{result.dataLimitations}</span>
            </div>
          )}
        </div>
      )}

      <CardSelectionDialog open={cardDialogOpen} onOpenChange={setCardDialogOpen} onInsert={handleCardInsert} />
    </div>
  );
}

// ─── Skill B: 每日快報技能 ────────────────────────────────────────
function DailyReportSkill({ onArticleReady }: { onArticleReady: (article: any) => void }) {
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [days, setDays] = useState('1');
  const [result, setResult] = useState<any>(null);

  const generateMutation = trpc.blogAi.generateDailyReport.useMutation({
    onSuccess: (data) => { setResult(data); toast.success('市場快報已生成！'); },
    onError: (e) => toast.error(`生成失敗：${e.message}`),
  });

  return (
    <div className="space-y-4">
      <div className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
        <div className="flex items-start gap-2">
          <Zap className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-yellow-300 text-xs font-medium">⚡ 快報技能 — 一鍵生成市場快報</p>
            <p className="text-gray-400 text-xs mt-0.5">AI 自動拉取平台漲跌幅榜、成交數據，生成完整的市場快報文章，無需任何輸入。</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-white text-sm">快報類型</Label>
          <Select value={reportType} onValueChange={(v: any) => setReportType(v)}>
            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">📅 每日快報</SelectItem>
              <SelectItem value="weekly">📆 每週報告</SelectItem>
              <SelectItem value="monthly">🗓️ 每月總結</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-white text-sm">數據區間</Label>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">過去 24 小時</SelectItem>
              <SelectItem value="7">過去 7 天</SelectItem>
              <SelectItem value="30">過去 30 天</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={() => generateMutation.mutate({ days: parseInt(days), reportType })}
        disabled={generateMutation.isPending}
        className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-black font-semibold">
        <Zap className="w-4 h-4 mr-2" />
        {generateMutation.isPending ? 'AI 正在拉取數據並生成快報...' : '一鍵生成市場快報'}
      </Button>

      {result && (
        <div className="p-4 bg-zinc-800 rounded-xl border border-zinc-700 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-white font-semibold text-sm flex items-center gap-2">
              <CheckCheck className="w-4 h-4 text-green-400" /> 快報已生成
            </p>
            <Button size="sm" onClick={() => onArticleReady({
              title: result.title,
              excerpt: result.excerpt,
              content: result.content,
              tags: result.tags,
              seoTitle: result.seoTitle,
              seoDescription: result.seoDescription,
            })} className="h-7 bg-[#FEDD00] hover:bg-[#FEDD00]/90 text-black text-xs font-semibold">
              進入編輯器 →
            </Button>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">標題</p>
            <p className="text-white text-sm font-medium">{result.title}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">摘要</p>
            <p className="text-gray-300 text-xs">{result.excerpt}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">內容預覽</p>
            <p className="text-gray-400 text-xs font-mono line-clamp-4">{result.content?.substring(0, 300)}...</p>
          </div>
          {result.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.tags.map((tag: string, i: number) => (
                <Badge key={i} className="bg-zinc-700 text-gray-300 text-xs">{tag}</Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Skill C: 刷新技能 ────────────────────────────────────────────
function RefreshSkill() {
  const { data: posts } = trpc.blog.getPosts.useQuery({ limit: 50, sortBy: 'oldest' });
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [result, setResult] = useState<any>(null);

  const refreshMutation = trpc.blogAi.suggestRefresh.useMutation({
    onSuccess: (data) => { setResult(data); toast.success('刷新建議已生成！'); },
    onError: (e) => toast.error(`分析失敗：${e.message}`),
  });

  const selectedPost = posts?.posts?.find((p: any) => p.id === selectedPostId);

  const handleAnalyze = () => {
    if (!selectedPost) { toast.error('請選擇要分析的文章'); return; }
    refreshMutation.mutate({
      postId: selectedPost.id,
      title: selectedPost.title,
      content: selectedPost.content,
      publishedAt: new Date(selectedPost.publishedAt || selectedPost.createdAt).getTime(),
      viewCount: selectedPost.viewCount || 0,
      category: selectedPost.category?.name,
      tags: selectedPost.tags?.join(', '),
    });
  };

  const priorityConfig: Record<string, { color: string; icon: React.ElementType }> = {
    '緊急': { color: 'red', icon: AlertCircle },
    '建議': { color: 'yellow', icon: RefreshCw },
    '可選': { color: 'blue', icon: Info },
    '不需要': { color: 'green', icon: CheckCircle },
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
        <div className="flex items-start gap-2">
          <RefreshCw className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-green-300 text-xs font-medium">♻️ 刷新技能 — 內容生命周期管理</p>
            <p className="text-gray-400 text-xs mt-0.5">AI 分析文章的時效性、瀏覽量和市場相關性，判斷是否需要更新，並給出具體刷新建議。</p>
          </div>
        </div>
      </div>

      <div>
        <Label className="text-white text-sm">選擇要分析的文章</Label>
        <Select value={selectedPostId?.toString() || ''} onValueChange={(v) => setSelectedPostId(parseInt(v))}>
          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1">
            <SelectValue placeholder="選擇文章..." />
          </SelectTrigger>
          <SelectContent>
            {posts?.posts?.map((post: any) => {
              const daysOld = Math.floor((Date.now() - new Date(post.publishedAt || post.createdAt).getTime()) / (1000 * 60 * 60 * 24));
              return (
                <SelectItem key={post.id} value={post.id.toString()}>
                  <span className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${daysOld > 60 ? 'bg-red-400' : daysOld > 30 ? 'bg-yellow-400' : 'bg-green-400'}`} />
                    {post.title?.substring(0, 40)}{post.title?.length > 40 ? '...' : ''} ({daysOld}天前)
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {selectedPost && (
        <div className="p-3 bg-zinc-800 rounded-lg text-xs space-y-1">
          <div className="flex items-center gap-3 text-gray-400">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{Math.floor((Date.now() - new Date(selectedPost.publishedAt || selectedPost.createdAt).getTime()) / (1000 * 60 * 60 * 24))} 天前發布</span>
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{selectedPost.viewCount || 0} 次瀏覽</span>
            {selectedPost.category && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{selectedPost.category.name}</span>}
          </div>
        </div>
      )}

      <Button onClick={handleAnalyze} disabled={refreshMutation.isPending || !selectedPostId}
        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
        <RefreshCw className="w-4 h-4 mr-2" />
        {refreshMutation.isPending ? 'AI 正在分析文章生命周期...' : '分析刷新需求'}
      </Button>

      {result && (
        <div className="p-4 bg-zinc-800 rounded-xl border border-zinc-700 space-y-3">
          <div className="flex items-center gap-3">
            {(() => {
              const cfg = priorityConfig[result.priority] || priorityConfig['不需要'];
              const Icon = cfg.icon;
              return (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-${cfg.color}-900/30 border border-${cfg.color}-700/30`}>
                  <Icon className={`w-4 h-4 text-${cfg.color}-400`} />
                  <span className={`text-${cfg.color}-300 text-sm font-semibold`}>{result.priority}</span>
                </div>
              );
            })()}
            <Badge className={`${result.needsRefresh ? 'bg-orange-600' : 'bg-green-600'} text-white text-xs`}>
              {result.needsRefresh ? '需要刷新' : '暫不需要'}
            </Badge>
            <Badge className="bg-zinc-600 text-gray-200 text-xs">{result.contentAge}</Badge>
          </div>

          <p className="text-gray-300 text-sm">{result.reason}</p>

          {result.suggestions?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 font-medium">具體刷新建議</p>
              {result.suggestions.map((s: any, i: number) => (
                <div key={i} className="p-2.5 bg-zinc-700 rounded-lg">
                  <p className="text-white text-xs font-medium mb-0.5">{s.action}</p>
                  <p className="text-gray-400 text-xs">{s.detail}</p>
                </div>
              ))}
            </div>
          )}

          <div className="p-2 bg-blue-900/20 border border-blue-700/30 rounded text-xs text-blue-300">
            預期改善效果：{result.estimatedImpact}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export function ContentWorkflowCenter({ onArticleReady }: { onArticleReady?: (article: any) => void }) {
  const [activeSkill, setActiveSkill] = useState<'overview' | 'research' | 'daily-report' | 'write' | 'proofread' | 'refresh'>('overview');

  const skills = [
    {
      id: 'research' as const,
      icon: Search,
      title: 'A. 研究技能',
      subtitle: '數據驅動研究',
      description: '輸入主題和卡牌 ID，AI 從平台真實成交數據中提取洞察，生成有具體數字支撐的研究 Brief。',
      inputLabel: '主題 + 卡牌 ID',
      outputLabel: '研究 Brief',
      color: 'blue',
    },
    {
      id: 'daily-report' as const,
      icon: Zap,
      title: 'B. 快報技能',
      subtitle: '一鍵市場快報',
      description: '無需任何輸入，AI 自動拉取平台漲跌幅榜和成交數據，生成完整的每日/每週市場快報。',
      inputLabel: '時間範圍',
      outputLabel: '完整快報文章',
      color: 'yellow',
    },
    {
      id: 'write' as const,
      icon: PenLine,
      title: 'C. 撰寫技能',
      subtitle: '多步驟 AI 寫作',
      description: '策略 → 大綱 → 分段生成，每步驟獨立可控。支援主題、URL、圖片、卡牌數據四種輸入模式。',
      inputLabel: '大綱 + 數據',
      outputLabel: '完整文章',
      color: 'purple',
    },
    {
      id: 'proofread' as const,
      icon: CheckCircle,
      title: 'D. 校對技能',
      subtitle: 'AI 品質審核',
      description: '對已生成文章進行全面品質審核：數據核實、重複內容、誇大語句、SEO 優化、AI 痕跡檢測。',
      inputLabel: '初稿',
      outputLabel: '校對報告',
      color: 'orange',
    },
    {
      id: 'refresh' as const,
      icon: RefreshCw,
      title: 'E. 刷新技能',
      subtitle: '內容生命周期',
      description: '分析文章的時效性、瀏覽量和市場相關性，判斷是否需要更新，給出具體刷新建議。',
      inputLabel: '文章表現數據',
      outputLabel: '刷新建議',
      color: 'green',
    },
  ];

  const handleBriefReady = (brief: any) => {
    // 把研究 Brief 轉換成 AI 工廠的輸入格式
    toast.success('研究 Brief 已準備好，切換到撰寫技能...');
    setActiveSkill('write');
  };

  const handleArticleReady = (article: any) => {
    if (onArticleReady) onArticleReady(article);
    toast.success('文章已準備好，已傳送到博客管理！');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-zinc-900 to-zinc-800 border-zinc-700">
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-900/40 border border-purple-700/30 rounded-xl">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-white text-lg">AI 內容運營系統</CardTitle>
              <CardDescription className="mt-1">
                <span className="text-purple-300 font-medium">BOXIUM 自有數據</span>
                <span className="text-gray-400"> + </span>
                <span className="text-blue-300 font-medium">Manus 內容自動化引擎</span>
              </CardDescription>
              <p className="text-gray-400 text-xs mt-2">
                五大技能分工清晰，每個技能有獨立的輸入/輸出，流程可重複執行。
                BOXIUM 提供數據，AI 負責研究、生成、校對、發布和刷新。
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Workflow Arrow */}
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {['研究', '撰寫', '校對', '發布', '刷新'].map((step, i) => (
              <div key={step} className="flex items-center gap-1 flex-shrink-0">
                <span className="text-xs text-gray-400 bg-zinc-800 px-2 py-1 rounded border border-zinc-700">{step}</span>
                {i < 4 && <ChevronRight className="w-3 h-3 text-zinc-600" />}
              </div>
            ))}
            <span className="text-xs text-zinc-600 ml-1">← 閉環</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Skill List */}
        <div className="space-y-2">
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">選擇技能</p>
          {skills.map(skill => (
            <SkillCard
              key={skill.id}
              {...skill}
              isActive={activeSkill === skill.id}
              onClick={() => setActiveSkill(skill.id)}
            />
          ))}
          {/* Quick Link to AI Factory */}
          <button
            onClick={() => setActiveSkill('write')}
            className="w-full text-left p-3 rounded-xl border border-dashed border-zinc-600 hover:border-purple-500 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <div>
                <p className="text-purple-300 text-xs font-medium">完整 AI 內容工廠</p>
                <p className="text-gray-500 text-[10px]">策略→大綱→生成→校對 一條龍</p>
              </div>
            </div>
          </button>
        </div>

        {/* Skill Panel */}
        <div className="lg:col-span-2">
          <Card className="bg-zinc-900 border-zinc-800 min-h-[400px]">
            <CardContent className="pt-5">
              {activeSkill === 'overview' && (
                <div className="text-center py-12">
                  <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-4 opacity-50" />
                  <p className="text-white font-medium mb-2">選擇左側技能開始工作</p>
                  <p className="text-gray-400 text-sm">每個技能都有清晰的輸入和輸出，可獨立使用或串聯成完整工作流。</p>
                  <div className="grid grid-cols-3 gap-3 mt-6 text-left">
                    <div className="p-3 bg-zinc-800 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-green-400 mb-2" />
                      <p className="text-white text-xs font-medium">數據驅動</p>
                      <p className="text-gray-500 text-xs">所有文章基於平台真實成交數據</p>
                    </div>
                    <div className="p-3 bg-zinc-800 rounded-lg">
                      <RefreshCw className="w-5 h-5 text-blue-400 mb-2" />
                      <p className="text-white text-xs font-medium">可重複執行</p>
                      <p className="text-gray-500 text-xs">每個技能都是獨立可重用的工作流</p>
                    </div>
                    <div className="p-3 bg-zinc-800 rounded-lg">
                      <Globe className="w-5 h-5 text-purple-400 mb-2" />
                      <p className="text-white text-xs font-medium">閉環管理</p>
                      <p className="text-gray-500 text-xs">從生成到刷新的完整內容生命周期</p>
                    </div>
                  </div>
                </div>
              )}

              {activeSkill === 'research' && (
                <ResearchSkill onBriefReady={handleBriefReady} />
              )}

              {activeSkill === 'daily-report' && (
                <DailyReportSkill onArticleReady={handleArticleReady} />
              )}

              {activeSkill === 'write' && (
                <div className="text-center py-8">
                  <PenLine className="w-10 h-10 text-purple-400 mx-auto mb-3 opacity-70" />
                  <p className="text-white font-medium mb-2">AI 內容工廠（完整撰寫流程）</p>
                  <p className="text-gray-400 text-sm mb-4">策略 → 大綱 → 分段生成 → 校對，請前往博客管理使用 AI 內容工廠。</p>
                  <Button
                    onClick={() => {
                      // Navigate to blog management
                      window.dispatchEvent(new CustomEvent('navigate-to-blog'));
                    }}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Sparkles className="w-4 h-4 mr-2" /> 前往 AI 內容工廠
                  </Button>
                </div>
              )}

              {activeSkill === 'proofread' && (
                <ProofreadSkill />
              )}

              {activeSkill === 'refresh' && (
                <RefreshSkill />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Skill D: 校對技能（獨立使用） ───────────────────────────────
function ProofreadSkill() {
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [result, setResult] = useState<any>(null);

  const proofreadMutation = trpc.blogAi.proofreadArticle.useMutation({
    onSuccess: (data) => { setResult(data); toast.success('校對完成！'); },
    onError: (e) => toast.error(`校對失敗：${e.message}`),
  });

  return (
    <div className="space-y-4">
      <div className="p-3 bg-orange-900/20 border border-orange-700/30 rounded-lg">
        <div className="flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-orange-300 text-xs font-medium">🔍 校對技能 — AI 品質審核</p>
            <p className="text-gray-400 text-xs mt-0.5">對文章進行全面品質審核：數據核實、重複內容、誇大語句、SEO 優化、AI 痕跡檢測。</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-white text-sm">文章標題</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white mt-1" />
        </div>
        <div>
          <Label className="text-white text-sm">文章摘要</Label>
          <Textarea value={excerpt} onChange={e => setExcerpt(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white mt-1" rows={2} />
        </div>
        <div>
          <Label className="text-white text-sm">文章內容（Markdown）</Label>
          <Textarea value={content} onChange={e => setContent(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white mt-1 font-mono text-xs" rows={8}
            placeholder="貼入文章 Markdown 內容..." />
        </div>
        <div>
          <Label className="text-white text-sm">SEO 關鍵字（選填）</Label>
          <Input value={seoKeywords} onChange={e => setSeoKeywords(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white mt-1"
            placeholder="PSA 10, 卡牌市場, 香港 PTCG" />
        </div>
      </div>

      <Button onClick={() => proofreadMutation.mutate({ title, excerpt, content, seoKeywords })}
        disabled={proofreadMutation.isPending || !title || !content}
        className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700">
        <CheckCircle className="w-4 h-4 mr-2" />
        {proofreadMutation.isPending ? 'AI 正在校對中...' : '啟動 AI 校對'}
      </Button>

      {result && (
        <div className="p-4 bg-zinc-800 rounded-xl border border-zinc-700 space-y-3">
          <div className="flex items-center justify-between">
            <Badge className={`text-sm px-3 py-1 ${
              result.overallScore === '優秀' ? 'bg-green-600' :
              result.overallScore === '良好' ? 'bg-blue-600' :
              result.overallScore === '需改進' ? 'bg-yellow-600' : 'bg-red-600'
            } text-white`}>{result.overallScore}</Badge>
            <div className="flex gap-2 text-xs">
              <Badge className="bg-zinc-700 text-gray-200">可讀性 {result.readabilityScore}/10</Badge>
              <Badge className={`${result.aiDetectionRisk === '低' ? 'bg-green-900/40 text-green-300' : result.aiDetectionRisk === '中' ? 'bg-yellow-900/40 text-yellow-300' : 'bg-red-900/40 text-red-300'} border border-zinc-600`}>AI 痕跡：{result.aiDetectionRisk}</Badge>
            </div>
          </div>
          <p className="text-gray-300 text-sm">{result.overallComment}</p>
          {result.quickFixes?.length > 0 && (
            <div className="p-3 bg-orange-900/20 border border-orange-700/30 rounded-lg">
              <p className="text-orange-300 text-xs font-medium mb-2">⚡ 快速修改建議</p>
              <ul className="space-y-1">
                {result.quickFixes.map((fix: string, i: number) => (
                  <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5">
                    <span className="text-orange-400 mt-0.5">•</span>{fix}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.issues?.slice(0, 3).map((issue: any, i: number) => (
            <div key={i} className={`p-2.5 rounded-lg border ${
              issue.severity === '高' ? 'bg-red-900/20 border-red-700/30' :
              issue.severity === '中' ? 'bg-yellow-900/20 border-yellow-700/30' :
              'bg-zinc-700 border-zinc-600'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <Badge className={`text-[10px] ${issue.severity === '高' ? 'bg-red-600' : issue.severity === '中' ? 'bg-yellow-600' : 'bg-zinc-600'}`}>{issue.severity}</Badge>
                <span className="text-gray-400 text-xs">{issue.category} @ {issue.location}</span>
              </div>
              <p className="text-gray-300 text-xs">{issue.description}</p>
              <p className="text-blue-300 text-xs mt-1">💡 {issue.suggestion}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
