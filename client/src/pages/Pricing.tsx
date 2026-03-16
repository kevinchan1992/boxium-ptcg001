import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Camera, Upload, X, Crop } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { TypeAnimation } from 'react-type-animation';
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ReactCrop, { type Crop as CropType } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { CardSearchDropdown } from "@/components/CardSearchDropdown";

export default function Pricing() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showCropView, setShowCropView] = useState(false);
  const [crop, setCrop] = useState<CropType>();
  const [completedCrop, setCompletedCrop] = useState<CropType>();
  const [isDragging, setIsDragging] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Fetch trending cards (top 5 based on PSA10 price increase)
  const { data: trendingCards = [], isLoading } = trpc.cards.getTrending.useQuery(
    { limit: 5 },
    { retry: 1 }
  );

  // Fetch random card names for placeholder rotation
  const { data: randomCardNames = [] } = trpc.cards.getRandomCardNames.useQuery(
    { count: 10 },
    { retry: 1 }
  );

  // Map trending cards to card format for display
  const popularCards = trendingCards.map((card: any) => ({
    id: card.id,
    name: card.name,
    imageUrl: card.imageUrl,
  }));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/pricing/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleCardClick = (cardId: number) => {
    setLocation(`/pricing/${cardId}`);
  };

  const handleCameraClick = () => {
    setShowImageDialog(true);
  };

  const processImageFile = (file: File) => {
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
      setShowCropView(false);
      setCrop(undefined);
      setCompletedCrop(undefined);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const imageSearchMutation = trpc.cards.searchByImage.useMutation();

  // 裁剪圖片並轉換為 base64
  const getCroppedImg = async (image: HTMLImageElement, crop: CropType): Promise<string> => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width!;
    canvas.height = crop.height!;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    ctx.drawImage(
      image,
      crop.x! * scaleX,
      crop.y! * scaleY,
      crop.width! * scaleX,
      crop.height! * scaleY,
      0,
      0,
      crop.width!,
      crop.height!
    );

    return canvas.toDataURL('image/jpeg', 0.9);
  };

  const handleImageSearch = async (useCrop: boolean = false) => {
    if (!selectedImage) {
      toast.error(t('pricing.pleaseSelectImage') || '請選擇圖片');
      return;
    }

    setIsSearching(true);
    try {
      let base64Image: string;

      // 如果用戶選擇裁剪且有完成的裁剪區域
      if (useCrop && completedCrop && imgRef.current) {
        base64Image = await getCroppedImg(imgRef.current, completedCrop);
      } else {
        // 使用原圖
        const reader = new FileReader();
        base64Image = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(selectedImage);
        });
      }
      
      // Call image search API
      const result = await imageSearchMutation.mutateAsync({ image: base64Image });
      
      if (result.success && result.bestMatch) {
        const cardName = result.bestMatch.name;
        toast.success(`找到卡牌：${cardName}`);
        setShowImageDialog(false);
        setSearchQuery(cardName);
        setLocation(`/card/${result.bestMatch.id}`);
      } else if (result.success && result.identification) {
        const cardName = result.identification.cardName || result.identification.cardNameJa;
        if (cardName) {
          toast.info(`識別到「${cardName}」，正在進行文字搜尋...`);
          setShowImageDialog(false);
          setSearchQuery(cardName);
          setLocation(`/search?q=${encodeURIComponent(cardName)}`);
        } else {
          toast.error(result.error || '無法識別卡牌，請嘗試其他圖片');
        }
      } else {
        toast.error(result.error || t('pricing.imageSearchFailed') || '無法識別卡牌，請嘗試其他圖片');
      }
    } catch (error) {
      console.error('Image search error:', error);
      toast.error(t('pricing.imageSearchError') || '圖片搜尋失敗，請稍後再試');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCloseDialog = () => {
    setShowImageDialog(false);
    setSelectedImage(null);
    setImagePreview(null);
    setShowCropView(false);
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  const handleStartCrop = () => {
    setShowCropView(true);
    // 設定預設裁剪區域（居中 80% 大小）
    setCrop({
      unit: '%',
      x: 10,
      y: 10,
      width: 80,
      height: 80,
    });
  };

  const handleCancelCrop = () => {
    setShowCropView(false);
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
    } else {
      toast.error('請上傳圖片檔案');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 md:px-8">
      {/* Hero Section */}
      <div className="text-center space-y-5 max-w-3xl w-full">
        {/* Logo/Brand */}
        <div className="space-y-3">
          <img
            src="/boxium-logo-white.png"
            alt="BOXIUM"
            className="h-24 sm:h-28 mx-auto"
          />
          <h2 className="text-base sm:text-lg font-semibold text-foreground">{t("pricing.title")}</h2>
        </div>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm text-muted-foreground px-4">
          {t("pricing.subtitle")}
        </p>

        {/* Search Box with Dropdown */}
        <CardSearchDropdown
          value={searchQuery}
          onChange={setSearchQuery}
          onSubmit={(q) => {
            if (q.trim()) setLocation(`/pricing/search?q=${encodeURIComponent(q)}`);
          }}
          className="max-w-2xl mx-auto"
          inputClassName="pr-16 py-5 text-base bg-card border-border rounded-xl focus:ring-2 focus:ring-primary"
          cardLinkPrefix="pricing"
          placeholderOverlay={
            !searchQuery && randomCardNames.length > 0 ? (
              <div className="absolute left-12 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-sm z-10">
                <TypeAnimation
                  sequence={randomCardNames.flatMap((name: string) => [name, 3000])}
                  wrapper="span"
                  speed={50}
                  repeat={Infinity}
                />
              </div>
            ) : undefined
          }
          rightElement={
            <button
              type="button"
              onClick={handleCameraClick}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
              title={t('pricing.imageSearch') || '圖片搜尋'}
            >
              <Camera className="w-5 h-5" />
            </button>
          }
        />

        {/* Top Gainers - Daily Price Increase Top 5 */}
        <div className="flex justify-center gap-4 mt-12 flex-wrap">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">{t("pricing.loading")}</span>
            </div>
          ) : (
            popularCards.map((card) => (
              <button
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                className="group relative w-28 sm:w-32 transition-transform hover:scale-105"
              >
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-card border border-border shadow-sm">
                  <img
                    src={card.imageUrl}
                    alt={card.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="mt-2 text-xs sm:text-sm font-medium text-foreground line-clamp-2">
                  {card.name}
                </p>
              </button>
            ))
          )}
        </div>

        {/* Hint Text */}
        <p className="text-xs text-muted-foreground mt-8">
          {t("pricing.hint")}
        </p>
      </div>

      {/* Image Upload Bottom Sheet */}
      <BottomSheet
        open={showImageDialog}
        onOpenChange={setShowImageDialog}
        title={t('pricing.imageSearchTitle') || '卡牌圖片分析功能'}
      >
          <div className="space-y-6">
            {/* Image Preview or Upload Area */}
            {imagePreview ? (
              <div className="relative">
                <div className="relative rounded-lg overflow-hidden bg-muted border-2 border-border">
                  {showCropView ? (
                    <ReactCrop
                      crop={crop}
                      onChange={(c) => setCrop(c)}
                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={undefined}
                    >
                      <img
                        ref={imgRef}
                        src={imagePreview}
                        alt="Preview"
                        className="max-w-full h-auto"
                      />
                    </ReactCrop>
                  ) : (
                    <img
                      ref={imgRef}
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-auto max-h-96 object-contain"
                    />
                  )}
                </div>
                <button
                  onClick={() => {
                    setImagePreview(null);
                    setSelectedImage(null);
                    setShowCropView(false);
                    setCrop(undefined);
                    setCompletedCrop(undefined);
                  }}
                  className="absolute top-2 right-2 p-2 bg-background/80 rounded-full hover:bg-background transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  {t('pricing.dragDropImage') || '拖放圖片到此處'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('pricing.orSelectFile') || '或選擇檔案'}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              {!imagePreview && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {t('pricing.takePhoto') || '拍照'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {t('pricing.uploadFile') || '上傳檔案'}
                  </Button>
                </>
              )}

              {imagePreview && !showCropView && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleStartCrop}
                    className="w-full"
                  >
                    <Crop className="w-4 h-4 mr-2" />
                    {t('pricing.cropImage') || '裁剪圖片'}
                  </Button>
                  <Button
                    onClick={() => handleImageSearch(false)}
                    disabled={isSearching}
                    className="w-full"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('pricing.searching') || '搜尋中...'}
                      </>
                    ) : (
                      t('pricing.searchNow') || '立即搜尋'
                    )}
                  </Button>
                </>
              )}

              {showCropView && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleCancelCrop}
                    className="w-full"
                  >
                    {t('pricing.cancel') || '取消'}
                  </Button>
                  <Button
                    onClick={() => handleImageSearch(true)}
                    disabled={isSearching || !completedCrop}
                    className="w-full"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('pricing.searching') || '搜尋中...'}
                      </>
                    ) : (
                      t('pricing.searchCropped') || '搜尋裁剪區域'
                    )}
                  </Button>
                </>
              )}
            </div>

            {/* Hidden File Inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
      </BottomSheet>
    </div>
  );
}
