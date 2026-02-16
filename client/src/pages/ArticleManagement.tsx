import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Eye, Plus, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ArticleManagement() {
  const [, setLocation] = useLocation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    summary: "",
    content: "",
    category: "market_analysis" as "market_analysis" | "investment_trends" | "card_research" | "news" | "guide",
    featuredImageUrl: "",
    status: "draft" as "draft" | "published",
  });

  const { data, isLoading, refetch } = trpc.blog.getAllArticles.useQuery(
    {
      limit: 100,
      offset: 0,
    },
    {
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const deleteMutation = trpc.blog.delete.useMutation({
    onSuccess: () => {
      refetch();
      setDeleteDialogOpen(false);
      setSelectedArticleId(null);
      alert("文章已刪除");
    },
    onError: (error) => {
      alert(`刪除失敗：${error.message}`);
    },
  });

  const updateMutation = trpc.blog.update.useMutation({
    onSuccess: () => {
      refetch();
      setEditDialogOpen(false);
      setSelectedArticleId(null);
      alert("文章已更新");
    },
    onError: (error) => {
      alert(`更新失敗：${error.message}`);
    },
  });

  const createMutation = trpc.blog.create.useMutation({
    onSuccess: () => {
      refetch();
      setCreateDialogOpen(false);
      setFormData({
        title: "",
        summary: "",
        content: "",
        category: "market_analysis",
        featuredImageUrl: "",
        status: "draft",
      });
      alert("文章已創建");
    },
    onError: (error) => {
      alert(`創建失敗：${error.message}`);
    },
  });

  const handleDelete = (id: number) => {
    setSelectedArticleId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedArticleId) {
      deleteMutation.mutate({ id: selectedArticleId });
    }
  };

  const handleEdit = (article: any) => {
    setSelectedArticleId(article.id);
    setFormData({
      title: article.title,
      summary: article.summary || "",
      content: article.content,
      category: article.category,
      featuredImageUrl: article.featuredImageUrl || "",
      status: article.status,
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (selectedArticleId) {
      updateMutation.mutate({
        id: selectedArticleId,
        ...formData,
      });
    }
  };

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const getCategoryLabel = (category: string) => {
    const categories: Record<string, string> = {
      market_analysis: "市場分析",
      investment_trends: "投資趨勢",
      card_research: "卡牌研究",
      news: "最新消息",
      guide: "新手指南",
    };
    return categories[category] || category;
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("zh-TW");
  };

  return (
    <div className="container mx-auto px-4 py-8 bg-white min-h-screen">
      <Card className="border border-gray-200 shadow-lg bg-white">
        <CardHeader className="bg-white border-b border-gray-200">
          <div className="flex justify-between items-center">
            <CardTitle className="text-3xl font-bold flex items-center gap-3 text-gray-900">
              <FileText className="w-8 h-8" />
              文章管理
            </CardTitle>
            <div className="flex gap-3">
              <Button
                onClick={() => setLocation("/create-article")}
                className="bg-[#FDD835] text-[#1E3A8A] hover:bg-[#FDD835]/90 font-semibold"
                size="lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                AI 生成文章
              </Button>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                variant="outline"
                className="bg-white text-[#1E3A8A] hover:bg-gray-50 font-semibold border-2 border-[#FDD835]"
                size="lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                手動新增文章
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : data && data.articles.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-bold text-gray-900">標題</TableHead>
                    <TableHead className="font-bold text-gray-900">分類</TableHead>
                    <TableHead className="font-bold text-gray-900">狀態</TableHead>
                    <TableHead className="font-bold text-gray-900">閱讀量</TableHead>
                    <TableHead className="font-bold text-gray-900">發布日期</TableHead>
                    <TableHead className="font-bold text-gray-900 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.articles.map((article) => (
                    <TableRow key={article.id} className="hover:bg-gray-50 border-b border-gray-100">
                      <TableCell className="font-semibold text-gray-900 max-w-md">
                        {article.title}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-blue-100 text-blue-900 hover:bg-blue-200">
                          {getCategoryLabel(article.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {article.status === "published" ? (
                          <Badge className="bg-green-100 text-green-900 hover:bg-green-200">
                            已發布
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-900 hover:bg-gray-200">
                            草稿
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-blue-900" />
                          {article.viewCount}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {formatDate(article.publishedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(article)}
                            className="border-blue-900 text-blue-900 hover:bg-blue-50"
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            編輯
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(article.id)}
                            className="border-red-600 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            刪除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-16">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 text-lg font-semibold">暫無文章</p>
              <p className="text-slate-400 mt-2">點擊上方按鈕創建第一篇文章</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription>
              您確定要刪除這篇文章嗎？此操作無法撤銷。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "刪除中..." : "確認刪除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>編輯文章</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">標題</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-category">分類</Label>
              <Select
                value={formData.category}
                onValueChange={(value: any) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="edit-category">
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
            <div>
              <Label htmlFor="edit-summary">摘要</Label>
              <Textarea
                id="edit-summary"
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-content">內容</Label>
              <Textarea
                id="edit-content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={10}
              />
            </div>
            <div>
              <Label htmlFor="edit-image">特色圖片 URL</Label>
              <Input
                id="edit-image"
                value={formData.featuredImageUrl}
                onChange={(e) => setFormData({ ...formData, featuredImageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div>
              <Label htmlFor="edit-status">狀態</Label>
              <Select
                value={formData.status}
                onValueChange={(value: any) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="published">已發布</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              className="bg-yellow-400 text-blue-900 hover:bg-yellow-500"
            >
              {updateMutation.isPending ? "更新中..." : "更新文章"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增文章</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-title">標題</Label>
              <Input
                id="create-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="create-category">分類</Label>
              <Select
                value={formData.category}
                onValueChange={(value: any) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="create-category">
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
            <div>
              <Label htmlFor="create-summary">摘要</Label>
              <Textarea
                id="create-summary"
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="create-content">內容</Label>
              <Textarea
                id="create-content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={10}
              />
            </div>
            <div>
              <Label htmlFor="create-image">特色圖片 URL</Label>
              <Input
                id="create-image"
                value={formData.featuredImageUrl}
                onChange={(e) => setFormData({ ...formData, featuredImageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div>
              <Label htmlFor="create-status">狀態</Label>
              <Select
                value={formData.status}
                onValueChange={(value: any) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger id="create-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="published">已發布</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="bg-yellow-400 text-blue-900 hover:bg-yellow-500"
            >
              {createMutation.isPending ? "創建中..." : "創建文章"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
