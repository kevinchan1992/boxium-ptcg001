import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Pencil, Check, X, Package, Image as ImageIcon, ExternalLink } from 'lucide-react';

export default function AdminSealedProducts() {
  const utils = trpc.useUtils();
  const { data: products, isLoading } = trpc.admin.listSealedProductsAdmin.useQuery();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editImageUrl, setEditImageUrl] = useState('');

  const updateImageMutation = trpc.admin.updateSealedProductImage.useMutation({
    onSuccess: () => {
      toast.success('封面圖已更新');
      setEditingId(null);
      setEditImageUrl('');
      utils.admin.listSealedProductsAdmin.invalidate();
    },
    onError: (err) => {
      toast.error(`更新失敗：${err.message}`);
    },
  });

  const handleEdit = (product: any) => {
    setEditingId(product.id);
    setEditImageUrl(product.imageUrl || '');
  };

  const handleSave = (productId: number) => {
    if (!editImageUrl.trim()) {
      toast.error('請輸入有效的圖片 URL');
      return;
    }
    updateImageMutation.mutate({ sealedProductId: productId, imageUrl: editImageUrl.trim() });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditImageUrl('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-yellow-400" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-yellow-400" />
            卡盒管理
          </h2>
          <p className="text-sm text-gray-400 mt-1">管理卡盒封面圖，確保 eBay 圖片搜尋準確</p>
        </div>
        <Badge variant="outline" className="text-gray-300 border-gray-600">
          共 {products?.length ?? 0} 個卡盒
        </Badge>
      </div>

      {(!products || products.length === 0) ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-500">
          <Package className="w-12 h-12 mb-3 opacity-30" />
          <p>目前沒有卡盒資料</p>
          <p className="text-xs mt-1">請在「數據源管理」中添加卡盒類型的數據源</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((product) => (
            <Card key={product.id} className="bg-gray-900 border-gray-700 overflow-hidden">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-semibold text-white leading-snug line-clamp-2">
                      {product.name}
                    </CardTitle>
                    {product.nameJa && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{product.nameJa}</p>
                    )}
                  </div>
                  <Badge className="shrink-0 bg-purple-900/50 text-purple-300 border-purple-700 text-xs">
                    卡盒
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">ID: {product.id}</span>
                  {product.setCode && (
                    <Badge variant="outline" className="text-xs text-gray-400 border-gray-600 px-1 py-0">
                      {product.setCode}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="px-4 pb-4 space-y-3">
                {/* 封面圖預覽 */}
                <div className="relative w-full h-36 rounded-lg overflow-hidden bg-gray-800 border border-gray-700 flex items-center justify-center">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`flex flex-col items-center gap-1 text-gray-500 ${product.imageUrl ? 'hidden' : ''}`}>
                    <ImageIcon className="w-8 h-8 opacity-40" />
                    <span className="text-xs">無封面圖</span>
                  </div>
                  {product.imageUrl && (
                    <a
                      href={product.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-1 right-1 bg-black/60 rounded p-0.5 hover:bg-black/80 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 text-gray-300" />
                    </a>
                  )}
                </div>

                {/* 編輯封面圖 */}
                {editingId === product.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editImageUrl}
                      onChange={(e) => setEditImageUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="bg-gray-800 border-gray-600 text-white text-xs h-8"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs bg-green-700 hover:bg-green-600"
                        onClick={() => handleSave(product.id)}
                        disabled={updateImageMutation.isPending}
                      >
                        <Check className="w-3 h-3 mr-1" />
                        儲存
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-xs border-gray-600 text-gray-300 hover:bg-gray-700"
                        onClick={handleCancel}
                      >
                        <X className="w-3 h-3 mr-1" />
                        取消
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-xs border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                    onClick={() => handleEdit(product)}
                  >
                    <Pencil className="w-3 h-3 mr-1.5" />
                    {product.imageUrl ? '更換封面圖' : '添加封面圖'}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
