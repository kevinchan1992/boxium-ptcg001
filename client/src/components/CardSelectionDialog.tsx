import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CardSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (cardData: string) => void;
}

interface CardForBlog {
  id: number;
  name: string;
  nameJa: string | null;
  cardNumber: string;
  imageUrl: string;
  latestPrice: number | null;
}

export function CardSelectionDialog({ open, onOpenChange, onInsert }: CardSelectionDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCardIds, setSelectedCardIds] = useState<number[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search cards
  const { data: cards, isLoading } = trpc.blog.searchCardsForBlog.useQuery(
    { query: debouncedQuery, limit: 20 },
    { enabled: debouncedQuery.length > 0 }
  );

  // Get card details
  const { data: cardDetails, refetch: refetchCardDetails } = trpc.blog.getCardDetailsForBlog.useQuery(
    { cardIds: selectedCardIds },
    { enabled: false }
  );

  // Toggle card selection
  const toggleCardSelection = (cardId: number) => {
    setSelectedCardIds(prev => {
      if (prev.includes(cardId)) {
        return prev.filter(id => id !== cardId);
      } else {
        return [...prev, cardId];
      }
    });
  };

  // Handle insert
  const handleInsert = async () => {
    if (selectedCardIds.length === 0) {
      toast.error('請至少選擇一張卡牌');
      return;
    }

    // Fetch card details
    const result = await refetchCardDetails();
    if (!result.data || result.data.length === 0) {
      toast.error('無法獲取卡牌資料');
      return;
    }

    // Format card data
    const formattedData = formatCardData(result.data);
    onInsert(formattedData);
    
    // Reset and close
    setSelectedCardIds([]);
    setSearchQuery('');
    onOpenChange(false);
    toast.success(`已插入 ${result.data.length} 張卡牌資料`);
  };

  // Format card data for insertion
  const formatCardData = (cards: any[]) => {
    let formatted = '【卡牌資料】\n\n';
    
    cards.forEach((card, index) => {
      formatted += `卡牌 ${index + 1}：${card.name}`;
      if (card.cardNumber) {
        formatted += ` [${card.cardNumber}]`;
      }
      formatted += '\n';
      
      if (card.latestPrice) {
        formatted += `- 最新價格：HKD ${card.latestPrice.toLocaleString()}（SNKRDUNK PSA10）\n`;
      } else {
        formatted += `- 最新價格：暫無價格資料\n`;
      }
      
      if (card.imageUrl) {
        formatted += `- 圖片：${card.imageUrl}\n`;
      }
      
      formatted += '\n';
    });
    
    return formatted;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white">選擇卡牌圖片</DialogTitle>
          <DialogDescription className="text-gray-400">
            搜尋並選擇卡牌，將資料插入到文字內容中供 AI 參考
          </DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋卡牌名稱或卡號（例如：pikachu）"
            className="pl-10 bg-zinc-800 border-zinc-700 text-white"
          />
        </div>

        {/* Selected Count */}
        {selectedCardIds.length > 0 && (
          <div className="text-sm text-[#ffed00]">
            已選擇 {selectedCardIds.length} 張卡牌
          </div>
        )}

        {/* Card Grid */}
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#ffed00]" />
            </div>
          ) : debouncedQuery.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              請輸入搜尋關鍵字
            </div>
          ) : cards && cards.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className={`relative bg-zinc-800 rounded-lg border-2 transition-all cursor-pointer hover:border-[#ffed00]/50 ${
                    selectedCardIds.includes(card.id)
                      ? 'border-[#ffed00] ring-2 ring-[#ffed00]/30'
                      : 'border-zinc-700'
                  }`}
                  onClick={() => toggleCardSelection(card.id)}
                >
                  {/* Checkbox */}
                  <div className="absolute top-2 left-2 z-10">
                    <Checkbox
                      checked={selectedCardIds.includes(card.id)}
                      onCheckedChange={() => toggleCardSelection(card.id)}
                      className="bg-zinc-900 border-zinc-600 data-[state=checked]:bg-[#ffed00] data-[state=checked]:border-[#ffed00]"
                    />
                  </div>

                  {/* Card Image */}
                  <div className="aspect-[2.5/3.5] overflow-hidden rounded-t-lg">
                    <img
                      src={card.imageUrl || ''}
                      alt={card.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Card Info */}
                  <div className="p-3 space-y-1">
                    <div className="text-sm font-medium text-white line-clamp-2">
                      {card.name}
                    </div>
                    {card.cardNumber && (
                      <div className="text-xs text-gray-400">
                        {card.cardNumber}
                      </div>
                    )}
                    {card.latestPrice && (
                      <div className="text-xs text-[#ffed00] font-semibold">
                        HKD {card.latestPrice.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              找不到符合的卡牌
            </div>
          )}
        </ScrollArea>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
          <Button
            variant="outline"
            onClick={() => {
              setSelectedCardIds([]);
              setSearchQuery('');
              onOpenChange(false);
            }}
            className="border-zinc-700 text-white hover:bg-zinc-800"
          >
            取消
          </Button>
          <Button
            onClick={handleInsert}
            disabled={selectedCardIds.length === 0}
            className="bg-[#ffed00] text-[#06038d] hover:bg-[#ffed00]/90 font-semibold"
          >
            插入 {selectedCardIds.length > 0 && `(${selectedCardIds.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
