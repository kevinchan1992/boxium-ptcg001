import { useState } from 'react';
import { trpc } from '../lib/trpc';
import { formatHKDate } from '../lib/formatDate';
import { BottomSheet } from './ui/bottom-sheet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Search, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface ImageLibraryProps {
  open: boolean;
  onClose: () => void;
  onSelectImage?: (imageUrl: string) => void;
}

export function ImageLibrary({ open, onClose, onSelectImage }: ImageLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: images, isLoading, refetch } = trpc.blog.listUploadedImages.useQuery({
    search: searchQuery || undefined,
    limit: 50,
    offset: 0,
  }, {
    enabled: open,
  });

  const deleteImageMutation = trpc.blog.deleteUploadedImage.useMutation({
    onSuccess: () => {
      toast.success('圖片已刪除');
      refetch();
    },
    onError: (error) => {
      toast.error(`刪除失敗：${error.message}`);
    },
  });

  const handleDelete = async (imageId: number, fileName: string) => {
    if (!confirm(`確定要刪除圖片「${fileName}」嗎？`)) return;
    await deleteImageMutation.mutateAsync({ imageId });
  };

  const handleSelect = (imageUrl: string) => {
    if (onSelectImage) {
      onSelectImage(imageUrl);
      onClose();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title="圖片庫"
      className="sm:max-w-4xl"
    >
      <div className="flex flex-col gap-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋圖片..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Image Grid */}
        <div className="min-h-[200px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-muted-foreground">載入中...</div>
            </div>
          ) : !images || images.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
              <p>沒有找到圖片</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="group relative border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleSelect(image.url)}
                >
                  {/* Image */}
                  <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                    <img
                      src={image.url}
                      alt={image.fileName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Info */}
                  <div className="p-2 bg-background">
                    <p className="text-xs font-medium truncate" title={image.fileName}>
                      {image.fileName}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                      <span>{formatFileSize(image.fileSize)}</span>
                      <span>{formatHKDate(image.createdAt)}</span>
                    </div>
                  </div>

                  {/* Delete Button */}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(image.id, image.fileName);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-2 border-t">
          <p className="text-sm text-muted-foreground">
            {images && images.length > 0 ? `共 ${images.length} 張圖片` : ''}
          </p>
          <Button variant="outline" onClick={onClose}>
            關閉
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
