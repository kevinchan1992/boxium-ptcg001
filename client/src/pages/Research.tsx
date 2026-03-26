import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Camera, Upload, X, Crop, CheckCircle2, Star } from "lucide-react";
import { CardSearchDropdown } from "@/components/CardSearchDropdown";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { TypeAnimation } from 'react-type-animation';
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ReactCrop, { type Crop as CropType } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import StructuredData from "@/components/StructuredData";
import { LazyImage } from "@/components/LazyImage";

interface MatchedCard {
  id: number;
  name: string;
  nameJa: string | null;
  cardNumber: string | null;
  series: string | null;
  setName: string | null;
  rarity: string | null;
  imageUrl: string | null;
  matchScore: number;
  matchReasons: string[];
  latestPrice: number | null;
}

export default function Home() {
  const { t } = useTranslation();
  const searchParams = useSearch();
  const initialQuery = new URLSearchParams(searchParams).get('q') || '';
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [, setLocation] = useLocation();

  // Sync search query when URL param changes
  useEffect(() => {
    const q = new URLSearchParams(searchParams).get('q') || '';
    setSearchQuery(q);
  }, [searchParams]);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showCropView, setShowCropView] = useState(false);
  const [crop, setCrop] = useState<CropType>();
  const [completedCrop, setCompletedCrop] = useState<CropType>();
  const [isDragging, setIsDragging] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchedCard[]>([]);
  const [identificationInfo, setIdentificationInfo] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
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
    setShowResults(false);
    setMatchResults([]);
    setIdentificationInfo(null);
  };

  const processImageFile = (file: File) => {
    setSelectedImage(file);
    setShowResults(false);
    setMatchResults([]);
    setIdentificationInfo(null);
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
      toast.error(t('research.pleaseSelectImage'));
      return;
    }

    setIsSearching(true);
    setShowResults(false);
    try {
      let base64Image: string;

      if (useCrop && completedCrop && imgRef.current) {
        base64Image = await getCroppedImg(imgRef.current, completedCrop);
      } else {
        const reader = new FileReader();
        base64Image = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(selectedImage);
        });
      }
      
      const result = await imageSearchMutation.mutateAsync({ image: base64Image });
      
      if (result.success && result.matches && result.matches.length > 0) {
        setMatchResults(result.matches as MatchedCard[]);
        setIdentificationInfo(result.identification);
        setShowResults(true);
        
        if (result.bestMatch) {
          toast.success(`識別成功！找到 ${result.matches.length} 個匹配結果`);
        }
      } else if (result.success && result.identification) {
        // Identified but no DB match - try text search with the identified name
        const cardName = result.identification.cardName || result.identification.cardNameJa;
        if (cardName) {
          toast.info(`識別到「${cardName}」，正在進行文字搜尋...`);
          setShowImageDialog(false);
          setSearchQuery(cardName);
          setLocation(`/search?q=${encodeURIComponent(cardName)}`);
        } else {
          toast.error(result.error || t('research.imageSearchFailed'));
        }
      } else {
        toast.error(result.error || t('research.imageSearchFailed'));
      }
    } catch (error) {
      console.error('Image search error:', error);
      toast.error(t('research.imageSearchError'));
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectMatch = (card: MatchedCard) => {
    setShowImageDialog(false);
    handleCloseDialog();
    setLocation(`/card/${card.id}`);
  };

  const handleCloseDialog = () => {
    setShowImageDialog(false);
    setSelectedImage(null);
    setImagePreview(null);
    setShowCropView(false);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setShowResults(false);
    setMatchResults([]);
    setIdentificationInfo(null);
  };

  const handleStartCrop = () => {
    setShowCropView(true);
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

  const handleRetrySearch = () => {
    setShowResults(false);
    setMatchResults([]);
    setIdentificationInfo(null);
    setSelectedImage(null);
    setImagePreview(null);
    setShowCropView(false);
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

  // Get match score color
  const getScoreColor = (score: number) => {
    if (score >= 60) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    if (score >= 20) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 60) return 'bg-green-500/10 border-green-500/30';
    if (score >= 40) return 'bg-yellow-500/10 border-yellow-500/30';
    if (score >= 20) return 'bg-orange-500/10 border-orange-500/30';
    return 'bg-red-500/10 border-red-500/30';
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

        {/* Search Box with Dropdown */}
        <div className="relative max-w-2xl mx-auto">
          <CardSearchDropdown
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={(q) => {
              if (q.trim()) setLocation(`/search?q=${encodeURIComponent(q)}`);
            }}
            cardLinkPrefix="card"
            inputClassName="w-full py-5 text-base bg-card border-border rounded-xl focus:ring-2 focus:ring-primary pr-16"
            placeholder=""
          />
          {/* Typing Animation Placeholder (only when input is empty) */}
          {!searchQuery && randomCardNames.length > 0 && (
            <div className="absolute left-12 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-sm z-0">
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
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
            title="圖片搜尋"
          >
            <Camera className="w-5 h-5" />
          </button>
        </div>

        {/* Top Gainers - Daily Price Increase Top 5 */}
        <div className="flex justify-center gap-4 mt-12 flex-wrap">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">{t("research.loading")}</span>
            </div>
          ) : popularCards.length > 0 ? (
            popularCards.map((card: any) => (
              <button
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                className="group relative w-28 sm:w-32 transition-transform hover:scale-105"
              >
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-card border border-border shadow-sm">
                  <img
                    src={card.imageUrl || "https://via.placeholder.com/128x176?text=No+Image"}
                    alt={card.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

              </button>
            ))
          ) : (
            <div className="w-full text-center py-12 text-muted-foreground">
              <p>{t("research.noResults")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Image Upload Bottom Sheet */}
      <BottomSheet
        open={showImageDialog}
        onOpenChange={(open) => { if (!open) handleCloseDialog(); }}
        title={showResults ? '識別結果' : '卡牌圖片分析功能'}
      >

          {/* Results View */}
          {showResults && matchResults.length > 0 ? (
            <div className="space-y-4">
              {/* Identification Summary */}
              {identificationInfo && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-1">AI 識別結果：</p>
                  <div className="flex flex-wrap gap-1.5">
                    {identificationInfo.cardNameJa && (
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 max-w-[140px] truncate">
                        {identificationInfo.cardNameJa}
                      </span>
                    )}
                    {identificationInfo.cardName && identificationInfo.cardName !== identificationInfo.cardNameJa && (
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 max-w-[140px] truncate">
                        {identificationInfo.cardName}
                      </span>
                    )}
                    {identificationInfo.cardNumber && (
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 max-w-[120px] truncate">
                        #{identificationInfo.cardNumber}
                      </span>
                    )}
                    {identificationInfo.rarity && (
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 max-w-[100px] truncate">
                        {identificationInfo.rarity}
                      </span>
                    )}
                    {identificationInfo.setName && (
                      <span className="text-xs px-2 py-1 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20 max-w-[120px] truncate">
                        {identificationInfo.setName}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Match Results List */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  找到 {matchResults.length} 個匹配結果，請選擇正確的卡牌：
                </p>
                {matchResults.map((card, index) => (
                  <button
                    key={card.id}
                    onClick={() => handleSelectMatch(card)}
                    className={`w-full flex items-center gap-2 p-3 rounded-lg border transition-all active:scale-[0.99] hover:shadow-md ${
                      index === 0 ? getScoreBg(card.matchScore) : 'bg-card border-border hover:border-primary/50'
                    }`}
                  >
                    {/* Card Image */}
                    <div className="w-12 h-16 flex-shrink-0 rounded-md overflow-hidden bg-muted">
                      {card.imageUrl ? (
                        <LazyImage
                          src={card.imageUrl}
                          alt={card.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Search className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    {/* Card Info - takes all remaining space */}
                    <div className="flex-1 text-left min-w-0 overflow-hidden">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {index === 0 && (
                          <Star className="w-3 h-3 text-yellow-500 flex-shrink-0 fill-yellow-500" />
                        )}
                        <p className="text-sm font-medium text-foreground leading-tight line-clamp-2">
                          {card.name}
                        </p>
                      </div>
                      {card.nameJa && card.nameJa !== card.name && (
                        <p className="text-xs text-muted-foreground truncate">{card.nameJa}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {card.cardNumber && (
                          <span className="text-xs text-muted-foreground">#{card.cardNumber}</span>
                        )}
                        {card.rarity && (
                          <span className="text-xs px-1 py-0.5 rounded bg-muted text-muted-foreground">{card.rarity}</span>
                        )}
                        {card.latestPrice && (
                          <span className="text-xs font-semibold text-green-500">
                            HK${card.latestPrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {/* Match reasons - show fewer on mobile */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {card.matchReasons.slice(0, 2).map((reason, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Match Score - compact */}
                    <div className="flex-shrink-0 text-right pl-1">
                      <div className={`text-base font-bold ${getScoreColor(card.matchScore)}`}>
                        {card.matchScore}
                      </div>
                      <p className="text-[9px] text-muted-foreground">分</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Retry Button */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleRetrySearch}
                  className="flex-1 h-11"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  重新拍攝
                </Button>
                {matchResults.length > 0 && (
                  <Button
                    onClick={() => {
                      const name = identificationInfo?.cardName || identificationInfo?.cardNameJa;
                      if (name) {
                        setShowImageDialog(false);
                        handleCloseDialog();
                        setSearchQuery(name);
                        setLocation(`/search?q=${encodeURIComponent(name)}`);
                      }
                    }}
                    variant="outline"
                    className="flex-1 h-11"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    文字搜尋
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* Upload View */
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
                        <p className="text-xs text-muted-foreground mt-2">正在使用 AI 識別卡牌名稱、卡號、系列...</p>
                      </div>
                    )}
                  </div>
                  {!isSearching && (
                    <button
                      onClick={() => {
                        setSelectedImage(null);
                        setImagePreview(null);
                        setShowCropView(false);
                        setCrop(undefined);
                        setCompletedCrop(undefined);
                      }}
                      className="absolute -top-2 -right-2 p-2 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 shadow-lg transition-colors z-20"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border bg-muted/30'
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const files = e.dataTransfer.files;
                    if (files && files[0]) {
                      const file = files[0];
                      if (file.type.startsWith('image/')) {
                        processImageFile(file);
                      } else {
                        toast.error('請上傳圖片檔案（JPG、PNG）');
                      }
                    }
                  }}
                >
                  <Upload className={`w-12 h-12 mx-auto mb-4 transition-colors ${
                    isDragging ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                  <p className="text-sm text-muted-foreground mb-2">
                    {isDragging ? '釋放以上傳圖片' : '選擇或拖放一張寶可夢卡牌圖片'}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">支持 JPG、PNG 格式</p>
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-2">💡 拍攝技巧：</p>
                    <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 text-left">
                      <li>• 確保卡牌名稱和卡號清晰可見</li>
                      <li>• 避免反光和陰影</li>
                      <li>• 建議使用裁剪功能框選卡牌主體</li>
                      <li>• AI 會自動識別卡名、卡號、系列和稀有度</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Upload Buttons */}
              {!isSearching && !imagePreview && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full h-12 sm:h-14 group"
                  >
                    <Camera className="w-5 h-5 mr-2 transition-transform group-hover:scale-110" />
                    拍攝照片
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-12 sm:h-14 group"
                  >
                    <Upload className="w-5 h-5 mr-2 transition-transform group-hover:scale-110" />
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
                        裁剪後搜尋
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        onClick={handleStartCrop}
                        className="w-full h-12"
                      >
                        <Crop className="w-5 h-5 mr-2" />
                        裁剪圖片
                      </Button>
                      <Button
                        onClick={() => handleImageSearch(false)}
                        className="w-full h-12 text-base font-medium"
                        size="lg"
                      >
                        <Search className="w-5 h-5 mr-2" />
                        直接搜尋
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
      </BottomSheet>
    </div>
    </>
  );
}
