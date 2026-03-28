import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImagePlus, Video, X, Loader2, Upload, Eye, AlertTriangle, FileImage, FileVideo } from "lucide-react";

interface DisputeMediaItem {
  id: number;
  orderId: number;
  uploaderRole: string;
  mediaUrl: string;
  mediaType: string;
  fileName: string | null;
  fileSize: number | null;
  createdAt: Date | string;
}

interface DisputeMediaUploadProps {
  orderId: number;
  orderNo: string;
  /** If true, shows upload UI. If false (admin view), shows read-only gallery. */
  canUpload?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  buyer: "買家",
  seller: "賣家",
  admin: "管理員",
};

const ROLE_COLORS: Record<string, string> = {
  buyer: "bg-blue-100 text-blue-700 border-blue-200",
  seller: "bg-emerald-100 text-emerald-700 border-emerald-200",
  admin: "bg-violet-100 text-violet-700 border-violet-200",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DisputeMediaUpload({ orderId, orderNo, canUpload = true }: DisputeMediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const { data: mediaList, isLoading } = trpc.marketplace.getDisputeMedia.useQuery(
    { orderId },
    { refetchInterval: 30000 }
  );

  const uploadMutation = trpc.marketplace.uploadDisputeMedia.useMutation({
    onSuccess: () => {
      toast.success("證據已上傳");
      utils.marketplace.getDisputeMedia.invalidate({ orderId });
    },
    onError: (e) => toast.error(e.message || "上傳失敗"),
  });

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const currentCount = mediaList?.length ?? 0;
    if (currentCount >= 10) {
      toast.error("最多上傳 10 個檔案");
      return;
    }
    const toUpload = Array.from(files).slice(0, 10 - currentCount);
    setUploading(true);
    try {
      for (const file of toUpload) {
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        if (!isImage && !isVideo) {
          toast.error(`${file.name} 不是圖片或影片`);
          continue;
        }
        // 20MB limit (matches backend)
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name} 超過 20MB`);
          continue;
        }
        // Convert to base64
        const buffer = await file.arrayBuffer();
        const mediaBase64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );
        await uploadMutation.mutateAsync({
          orderId,
          orderNo,
          mediaBase64,
          mediaType: isImage ? "image" : "video",
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        });
      }
    } catch (e: any) {
      toast.error(e.message || "上傳失敗");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [mediaList, orderId, orderNo, uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>載入爭議證據...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-gray-800">爭議證據</span>
          {(mediaList?.length ?? 0) > 0 && (
            <Badge variant="secondary" className="text-xs">
              {mediaList!.length} 個檔案
            </Badge>
          )}
        </div>
        {canUpload && (mediaList?.length ?? 0) < 10 && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-orange-200 text-orange-600 hover:bg-orange-50"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            上傳證據
          </Button>
        )}
      </div>

      {/* Upload drop zone (only when canUpload and no files yet) */}
      {canUpload && (mediaList?.length ?? 0) === 0 && !uploading && (
        <div
          className="border-2 border-dashed border-orange-200 rounded-lg p-5 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <div className="flex flex-col items-center gap-2 text-orange-400">
            <div className="flex gap-2">
              <FileImage className="w-6 h-6" />
              <FileVideo className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium">點擊或拖放圖片/影片作為爭議證據</span>
            <span className="text-xs text-gray-400">支援 JPG、PNG、MP4、MOV，每個最大 20MB，最多 10 個</span>
          </div>
        </div>
      )}

      {/* Empty state for admin view */}
      {!canUpload && (mediaList?.length ?? 0) === 0 && (
        <p className="text-xs text-gray-400 text-center py-3">暫無爭議證據</p>
      )}

      {/* Media gallery */}
      {(mediaList?.length ?? 0) > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(mediaList as DisputeMediaItem[]).map((media) => (
            <div key={media.id} className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
              {media.mediaType === "image" ? (
                <a href={media.mediaUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={media.mediaUrl}
                    alt={media.fileName ?? "證據圖片"}
                    className="w-full h-24 object-cover hover:opacity-90 transition-opacity"
                  />
                </a>
              ) : (
                <a
                  href={media.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center h-24 gap-2 hover:bg-gray-100 transition-colors"
                >
                  <Video className="w-8 h-8 text-gray-400" />
                  <span className="text-xs text-gray-500 px-2 truncate w-full text-center">{media.fileName ?? "影片"}</span>
                </a>
              )}
              {/* Overlay info */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <Badge className={`text-[9px] px-1 py-0 border ${ROLE_COLORS[media.uploaderRole] ?? ''}`}>
                  {ROLE_LABELS[media.uploaderRole] ?? media.uploaderRole}
                </Badge>
                {media.fileSize != null && (
                  <span className="text-[9px] text-white/80">{formatFileSize(media.fileSize)}</span>
                )}
              </div>
              {/* View button */}
              <a
                href={media.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Eye className="w-3 h-3" />
              </a>
            </div>
          ))}
          {/* Add more button */}
          {canUpload && (mediaList?.length ?? 0) < 10 && (
            <div
              className="border-2 border-dashed border-orange-200 rounded-lg h-24 flex flex-col items-center justify-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-colors text-orange-400"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ImagePlus className="w-5 h-5" />
                  <span className="text-xs mt-1">新增</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
