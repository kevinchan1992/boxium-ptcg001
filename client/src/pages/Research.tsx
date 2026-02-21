import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Camera, Upload, X, Crop } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { TypeAnimation } from 'react-type-animation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ReactCrop, { type Crop as CropType } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
// import Footer from "@/components/Footer";
import StructuredData from "@/components/StructuredData";

export default function Home() {
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
      setLocation(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleCardClick = (cardId: number) => {
    setLocation(`/card/${cardId}`);
  };

  const handleCameraClick = () => {
    setShowImageDialog(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setShowCropView(false); // 重置裁剪視圖
        setCrop(undefined);
        setCompletedCrop(undefined);
      };
      reader.readAsDataURL(file);
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
      toast.error(t('research.pleaseSelectImage'));
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
      
      if (result.success && result.cardName) {
        toast.success(t('research.imageSearchSuccess', { cardName: result.cardName }));
        setShowImageDialog(false);
        setSearchQuery(result.cardName);
        setLocation(`/search?q=${encodeURIComponent(result.cardName)}`);
      } else {
        toast.error(t('research.imageSearchFailed'));
      }
    } catch (error) {
      console.error('Image search error:', error);
      toast.error(t('research.imageSearchError'));
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

  // Generate WebSite with SearchAction structured data for SEO
  const generateSearchActionData = () => {
    return {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "BOXIUM PTCG",
      "url": "https://boxiumptcg.manus.space/",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://boxiumptcg.manus.space/search?q={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    };
  };

  return (
    <>
      {/* JSON-LD Structured Data for SEO */}
      <StructuredData data={generateSearchActionData()} />
      
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
          <h2 className="text-base sm:text-lg font-semibold text-foreground">{t("research.title")}</h2>
        </div>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm text-muted-foreground px-4">
          {t("research.searchPlaceholder")}
        </p>

        {/* Search Box */}
        <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder=""
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-16 py-5 text-base bg-card border-border rounded-xl focus:ring-2 focus:ring-primary"
            />
            {/* Typing Animation Placeholder */}
            {!searchQuery && randomCardNames.length > 0 && (
              <div className="absolute left-12 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-sm">
                <TypeAnimation
                  sequence={randomCardNames.flatMap((name: string) => [name, 3000])}
                  wrapper="span"
                  speed={50}
                  repeat={Infinity}
                />
              </div>
            )}
            {/* Camera Button */}
            <button
              type="button"
              onClick={handleCameraClick}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              title={t('research.imageSearch')}
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>
        </form>

        {/* Top Gainers - Daily Price Increase Top 5 */}
        <div className="flex justify-center gap-4 mt-12 flex-wrap">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">{t("research.loading")}</span>
            </div>
          ) : popularCards.length > 0 ? (
            popularCards.map((card: any) => (
              <img
                key={card.id}
                src={card.imageUrl || "https://via.placeholder.com/128x176?text=No+Image"}
                alt={card.name}
                onClick={() => handleCardClick(card.id)}
                className="w-32 h-44 object-cover rounded-lg shadow-lg cursor-pointer transform transition-all hover:scale-110 hover:shadow-2xl"
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>{t("research.noResults")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Image Upload Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">卡牌圖片分析功能</DialogTitle>
          </DialogHeader>
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
                        alt="Crop preview"
                        className="max-h-96 w-full object-contain"
                      />
                    </ReactCrop>
                  ) : (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-80 object-contain"
                    />
                  )}
                  {/* Loading Overlay */}
                  {isSearching && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                      <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                      <p className="text-sm font-medium text-foreground">{t('research.searching')}</p>
                      <p className="text-xs text-muted-foreground mt-2">正在識別卡牌中...</p>
                    </div>
                  )}
                </div>
                {!isSearching && (
                  <button
                    onClick={handleCloseDialog}
                    className="absolute -top-2 -right-2 p-2 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 shadow-lg transition-colors z-20"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-muted/30">
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">選擇一張寶可夢卡牌圖片</p>
                <p className="text-xs text-muted-foreground">支持 JPG、PNG 格式</p>
              </div>
            )}

            {/* Upload Buttons */}
            {!isSearching && !imagePreview && (
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full h-12"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  拍攝照片
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-12"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  上傳照片
                </Button>
              </div>
            )}

            {/* Hidden File Inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Crop and Search Buttons */}
            {imagePreview && !isSearching && (
              <div className="space-y-3">
                {showCropView ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        onClick={handleCancelCrop}
                        className="w-full h-12"
                      >
                        <X className="w-5 h-5 mr-2" />
                        {t('common.cancel')}
                      </Button>
                      <Button
                        onClick={() => handleImageSearch(true)}
                        className="w-full h-12 text-base font-medium"
                        size="lg"
                        disabled={!completedCrop}
                      >
                        <Search className="w-5 h-5 mr-2" />
                        {t('research.searchWithCrop')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        onClick={handleStartCrop}
                        className="w-full h-12"
                      >
                        <Crop className="w-5 h-5 mr-2" />
                        {t('research.cropImage')}
                      </Button>
                      <Button
                        onClick={() => handleImageSearch(false)}
                        className="w-full h-12 text-base font-medium"
                        size="lg"
                      >
                        <Search className="w-5 h-5 mr-2" />
                        {t('research.searchDirect')}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}
