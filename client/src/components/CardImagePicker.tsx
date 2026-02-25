import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { ImageIcon, Search, Loader2 } from "lucide-react";

interface CardImagePickerProps {
  onInsert: (imageUrl: string, cardName: string) => void;
  variant?: 'dark' | 'light';
}

export function CardImagePicker({ onInsert, variant = 'dark' }: CardImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search query
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    // Simple debounce
    setTimeout(() => {
      setDebouncedQuery(value);
    }, 500);
  };

  // Search cards
  const { data: cards, isLoading } = trpc.cards.search.useQuery(
    {
      query: debouncedQuery,
      limit: 20,
    },
    {
      enabled: debouncedQuery.length > 0,
    }
  );

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={variant === 'light' 
            ? "border-gray-300 text-gray-700 hover:bg-gray-100" 
            : "border-zinc-700 text-white hover:bg-zinc-800"
          }
        >
          <ImageIcon className="w-4 h-4 mr-2" />
          插入卡牌圖片
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">選擇卡牌圖片</DialogTitle>
          <DialogDescription>
            搜索卡牌並插入圖片到文章中
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Search Input */}
          <div>
            <Label htmlFor="card-search" className="text-white">搜索卡牌</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="card-search"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="輸入卡牌名稱或編號..."
                className="bg-zinc-800 border-zinc-700 text-white pl-10"
              />
            </div>
          </div>

          {/* Results */}
          <ScrollArea className="h-[400px]">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            )}

            {!isLoading && debouncedQuery && cards && cards.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                沒有找到相關卡牌
              </div>
            )}

            {!debouncedQuery && (
              <div className="text-center py-8 text-gray-400">
                請輸入卡牌名稱或編號進行搜索
              </div>
            )}

            {cards && cards.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {cards.map((card: any) => (
                  <div
                    key={card.id}
                    className="bg-zinc-800 rounded-lg p-3 hover:bg-zinc-700 cursor-pointer transition-colors"
                    onClick={() => handleInsertCard(card)}
                  >
                    {card.imageUrl && (
                      <img
                        src={card.imageUrl}
                        alt={card.name}
                        className="w-full h-auto rounded mb-2"
                      />
                    )}
                    <div className="text-white text-sm font-medium truncate">
                      {card.name}
                    </div>
                    {card.setCode && (
                      <div className="text-gray-400 text-xs">
                        {card.setCode} {card.cardNumber}
                      </div>
                    )}
                    {card.currentPrice && (
                      <div className="text-yellow-400 text-xs mt-1">
                        NT${card.currentPrice.toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
