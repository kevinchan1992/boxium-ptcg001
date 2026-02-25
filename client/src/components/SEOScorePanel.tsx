import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";

interface SEOScorePanelProps {
  title: string;
  excerpt: string;
  content: string;
  seoKeywords: string;
}

interface SEOIssue {
  type: 'success' | 'warning' | 'error';
  message: string;
}

export function SEOScorePanel({ title, excerpt, content, seoKeywords }: SEOScorePanelProps) {
  // Calculate SEO score
  const calculateSEOScore = (): { score: number; issues: SEOIssue[] } => {
    let score = 100;
    const issues: SEOIssue[] = [];

    // Title length check (optimal: 50-60 characters)
    if (title.length === 0) {
      score -= 20;
      issues.push({ type: 'error', message: '標題不能為空' });
    } else if (title.length < 30) {
      score -= 10;
      issues.push({ type: 'warning', message: `標題過短（${title.length} 字），建議 30-60 字` });
    } else if (title.length > 60) {
      score -= 10;
      issues.push({ type: 'warning', message: `標題過長（${title.length} 字），建議 30-60 字` });
    } else {
      issues.push({ type: 'success', message: `標題長度適中（${title.length} 字）` });
    }

    // Excerpt length check (optimal: 120-160 characters)
    if (excerpt.length === 0) {
      score -= 15;
      issues.push({ type: 'error', message: '摘要不能為空' });
    } else if (excerpt.length < 100) {
      score -= 10;
      issues.push({ type: 'warning', message: `摘要過短（${excerpt.length} 字），建議 100-160 字` });
    } else if (excerpt.length > 160) {
      score -= 5;
      issues.push({ type: 'warning', message: `摘要過長（${excerpt.length} 字），建議 100-160 字` });
    } else {
      issues.push({ type: 'success', message: `摘要長度適中（${excerpt.length} 字）` });
    }

    // Content length check (optimal: > 300 characters)
    if (content.length === 0) {
      score -= 20;
      issues.push({ type: 'error', message: '內容不能為空' });
    } else if (content.length < 300) {
      score -= 15;
      issues.push({ type: 'warning', message: `內容過短（${content.length} 字），建議至少 300 字` });
    } else {
      issues.push({ type: 'success', message: `內容長度充足（${content.length} 字）` });
    }

    // SEO keywords check
    if (seoKeywords.length === 0) {
      score -= 15;
      issues.push({ type: 'error', message: 'SEO 關鍵字不能為空' });
    } else {
      const keywords = seoKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
      if (keywords.length < 3) {
        score -= 10;
        issues.push({ type: 'warning', message: `SEO 關鍵字過少（${keywords.length} 個），建議 3-5 個` });
      } else if (keywords.length > 10) {
        score -= 5;
        issues.push({ type: 'warning', message: `SEO 關鍵字過多（${keywords.length} 個），建議 3-5 個` });
      } else {
        issues.push({ type: 'success', message: `SEO 關鍵字數量適中（${keywords.length} 個）` });
      }

      // Check keyword density in content
      const contentLower = content.toLowerCase();
      keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        const count = (contentLower.match(new RegExp(keywordLower, 'g')) || []).length;
        if (count === 0) {
          score -= 5;
          issues.push({ type: 'warning', message: `關鍵字「${keyword}」未出現在內容中` });
        } else if (count > 10) {
          score -= 3;
          issues.push({ type: 'warning', message: `關鍵字「${keyword}」出現過多（${count} 次），可能被視為關鍵字堆砌` });
        }
      });
    }

    return { score: Math.max(0, score), issues };
  };

  const { score, issues } = calculateSEOScore();

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" | "outline" => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  return (
    <Card className="bg-white border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-gray-900">SEO 評分</span>
          <Badge variant={getScoreBadgeVariant(score)} className="text-lg px-3 py-1">
            {score} / 100
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {issues.map((issue, index) => (
            <div key={index} className="flex items-start gap-2">
              {issue.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />}
              {issue.type === 'warning' && <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />}
              {issue.type === 'error' && <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
              <span className={`text-sm ${
                issue.type === 'success' ? 'text-green-700' : 
                issue.type === 'warning' ? 'text-yellow-700' : 
                'text-red-700'
              }`}>
                {issue.message}
              </span>
            </div>
          ))}
        </div>

        {score < 80 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800 font-medium mb-1">💡 改進建議</p>
            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
              {score < 60 && <li>優先修復紅色錯誤項目</li>}
              {issues.filter(i => i.type === 'warning').length > 0 && <li>處理黃色警告項目以提升評分</li>}
              <li>確保 SEO 關鍵字自然地出現在標題、摘要和內容中</li>
              <li>使用 AI 自動填寫功能可以快速優化 SEO 設置</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
