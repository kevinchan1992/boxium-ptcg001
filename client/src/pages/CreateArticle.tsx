import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function CreateArticle() {
  const [, setLocation] = useLocation();

  const [formData, setFormData] = useState({
    title: "",
    summary: "",
    content: "",
    category: "market_analysis" as "market_analysis" | "investment_trends" | "card_research" | "news" | "guide",
    featuredImageUrl: "",
    status: "draft" as "draft" | "published",
  });

  const createMutation = trpc.blog.create.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    createMutation.mutate(
      formData,
      {
        onSuccess: (data) => {
          alert(formData.status === "published" ? "文章已發布" : "文章已保存為草稿");
          setLocation(`/market-insights/${data.slug}`);
        },
        onError: (error) => {
          alert(`創建失敗：${error.message}`);
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => setLocation("/admin")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回管理後台
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">創建新文章</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div>
                <Label htmlFor="title">標題 *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="輸入文章標題"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <Label htmlFor="category">分類 *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: any) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market_analysis">市場分析</SelectItem>
                    <SelectItem value="investment_trends">投資趨勢</SelectItem>
                    <SelectItem value="card_research">卡牌研究</SelectItem>
                    <SelectItem value="news">最新消息</SelectItem>
                    <SelectItem value="guide">新手指南</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Featured Image URL */}
              <div>
                <Label htmlFor="imageUrl">特色圖片 URL</Label>
                <Input
                  id="imageUrl"
                  value={formData.featuredImageUrl}
                  onChange={(e) => setFormData({ ...formData, featuredImageUrl: e.target.value })}
                  placeholder="輸入圖片 URL（選填）"
                />
                {formData.featuredImageUrl && (
                  <div className="mt-4">
                    <img
                      src={formData.featuredImageUrl}
                      alt="Preview"
                      className="max-w-md rounded-lg shadow-md"
                    />
                  </div>
                )}
              </div>

              {/* Summary */}
              <div>
                <Label htmlFor="summary">摘要</Label>
                <Textarea
                  id="summary"
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="輸入文章摘要（選填）"
                  rows={3}
                />
              </div>

              {/* Content */}
              <div>
                <Label htmlFor="content">內容 *</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="輸入文章內容"
                  rows={15}
                  required
                />
              </div>

              {/* Status */}
              <div>
                <Label htmlFor="status">狀態</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="published">發布</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1"
                >
                  {createMutation.isPending ? "處理中..." : "創建文章"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/admin")}
                >
                  取消
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
