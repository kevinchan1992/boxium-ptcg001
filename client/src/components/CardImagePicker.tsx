import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { toast } from "sonner";
import { ImageIcon, Search, Loader2 } from "lucide-react";
import { getProxiedImageUrl } from "@/lib/utils";

interface CardImagePickerProps {
  onInsert: (imageUrl: string, cardName: string) => void;
  variant?: 'dark' | 'light';
}

export function CardImagePicker({ onInsert, variant = 'dark' }: CardImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setTimeout(() => {
      setDebouncedQuery(value);
    }, 500);
  };

  const { data: searchData, isLoading } = trpc.cards.search.useQuery(
    { query: debouncedQuery, limit: 20 },
    { enabled: debouncedQuery.length > 0 }
  );

  const cards = searchData?.cards || [];

  const handleInsertCard = (card: any) => {
    if (card.imageUrl) {
      onInsert(card.imageUrl, card.name);
      toast.success(`已插入 ${card.name} 圖片`);
      setOpen(false);
      setSearchQuery("");
      setDebouncedQuery("");
    } else {
      toast.error("此卡牌沒有圖片");
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={variant === 'light'
          ? "border-gray-300 text-gray-700 hover:bg-gray-100"
          : "border-zinc-700 text-white hover:bg-zinc-800"
        }
      >
        <ImageIcon className="w-4 h-4 mr-2" />
        插入卡牌圖片
      </Button>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={<span className={variant === 'dark' ? 'text-white' : ''}>選擇卡牌圖片</span>}
        description="搜索卡牌並插入圖片到文章中"
        className={variant === 'dark' ? 'bg-zinc-900 border-zinc-800 sm:max-w-2xl' : 'sm:max-w-2xl'}
      >
        <div className="flex flex-col gap-4">
          {/* Search Input */}
          <div>
            <Label htmlFor="card-search" className={variant === 'dark' ? 'text-white' : ''}>搜索卡牌</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="card-search"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="輸入卡牌名稱或編號..."
                className={variant === 'dark' ? 'bg-zinc-800 border-zinc-700 text-white pl-10' : 'pl-10'}
              />
            </div>
          </div>

          {/* Results */}
          <div className="min-h-[200px]">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            )}
            {!isLoading && debouncedQuery && cards.length === 0 && (
              <div className="text-center py-8 text-gray-400">沒有找到相關卡牌</div>
            )}
            {!debouncedQuery && (
              <div className="text-center py-8 text-gray-400">請輸入卡牌名稱或編號進行搜索</div>
            )}
            {cards.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {cards.map((card: any) => (
                  <div
                    key={card.id}
                    className={`rounded-lg p-2 cursor-pointer transition-colors ${
                      variant === 'dark'
                        ? 'bg-zinc-800 hover:bg-zinc-700'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                    onClick={() => handleInsertCard(card)}
                  >
                    {card.imageUrl && (
                      <img
                        src={getProxiedImageUrl(card.imageUrl) ?? ""}
                        alt={card.name}
                        className="w-full h-auto rounded mb-2"
                      />
                    )}
                    <div className={`text-xs font-medium line-clamp-2 leading-tight ${variant === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                      {card.name}
                    </div>
                    {card.setCode && (
                      <div className="text-gray-400 text-[10px] mt-0.5">
                        {card.setCode} {card.cardNumber}
                      </div>
                    )}
                    {card.currentPrice && (
                      <div className="text-yellow-400 text-[10px] mt-0.5 font-semibold">
                        NT${card.currentPrice.toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
