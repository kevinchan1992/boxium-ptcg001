import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, ExternalLink, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';

interface PriceListing {
  id: string;
  market: 'ebay' | 'snkrdunk';
  title: string;
  price: number;
  currency: string;
  image: string;
  productUrl: string;
  seller: {
    name: string;
    rating?: number;
  };
  grade: string;
  condition: string;
  lastUpdated: string;
}

interface PriceStats {
  totalCount: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  marketDistribution: {
    ebay: number;
    snkrdunk: number;
  };
}

export default function Pricing() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<PriceListing[]>([]);
  const [stats, setStats] = useState<PriceStats | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const searchMutation = trpc.pricing.search.useMutation({
    onSuccess: (data: any) => {
      setResults(data.results);
      setStats(data.stats);
      setIsSearching(false);
    },
    onError: (error: any) => {
      console.error('Search error:', error);
      setIsSearching(false);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    searchMutation.mutate({ query: searchQuery, forceRefresh: false });
  };

  const handleRefresh = () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    searchMutation.mutate({ query: searchQuery, forceRefresh: true });
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
          <h2 className="text-base sm:text-lg font-semibold text-foreground">
            {t('pricing.title', '價格查詢')}
          </h2>
        </div>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm text-muted-foreground px-4">
          {t('pricing.subtitle', '實時比較全球市場卡牌價格')}
        </p>

        {/* Search Box */}
        <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('pricing.searchPlaceholder', '輸入卡牌名稱、編號或系列...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-5 text-base bg-card border-border rounded-xl focus:ring-2 focus:ring-primary"
            />
          </div>
        </form>

        {/* Search Hint */}
        {!isSearching && results.length === 0 && !searchQuery && (
          <div className="text-xs sm:text-sm text-muted-foreground mt-4">
            <p>{t('pricing.searchHint', '提示: 搜尋結果僅顯示 PSA 10 評級的可購買商品')}</p>
          </div>
        )}

        {/* Loading State */}
        {isSearching && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">
              {t('pricing.searching', '搜尋中...')}
            </span>
          </div>
        )}

        {/* Price Stats */}
        {!isSearching && stats && (
          <div className="mt-8 p-6 bg-card border border-border rounded-xl">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              📊 {t('pricing.priceStats', '價格統計')} (PSA 10 - {t('pricing.totalListings', '共 {{count}} 個在售商品', { count: stats.totalCount })})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="p-4 bg-background rounded-lg">
                <p className="text-muted-foreground text-sm mb-1">{t('pricing.minPrice', '最低價')}</p>
                <p className="text-2xl font-bold text-green-400">
                  ${stats.minPrice.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-background rounded-lg">
                <p className="text-muted-foreground text-sm mb-1">{t('pricing.avgPrice', '平均價')}</p>
                <p className="text-2xl font-bold text-yellow-400">
                  ${stats.avgPrice.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-background rounded-lg">
                <p className="text-muted-foreground text-sm mb-1">{t('pricing.maxPrice', '最高價')}</p>
                <p className="text-2xl font-bold text-red-400">
                  ${stats.maxPrice.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm justify-center">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                <span>eBay: {stats.marketDistribution.ebay} {t('pricing.listings', '個')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                <span>SNKRDUNK: {stats.marketDistribution.snkrdunk} {t('pricing.listings', '個')}</span>
              </div>
            </div>
            {/* Refresh Button */}
            <div className="mt-4 flex justify-center">
              <Button
                onClick={handleRefresh}
                disabled={isSearching}
                variant="outline"
                className="border-border text-foreground hover:bg-accent"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('pricing.refresh', '刷新')}
              </Button>
            </div>
          </div>
        )}

        {/* Results */}
        {!isSearching && results.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {t('pricing.searchResults', '搜尋結果')}: {t('pricing.totalResults', '共 {{count}} 筆', { count: results.length })}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {results.map((listing) => (
                <div
                  key={listing.id}
                  className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary transition-all duration-300"
                >
                  {/* Card Image */}
                  <div className="relative aspect-[3/4] bg-background">
                    <img
                      src={listing.image}
                      alt={listing.title}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-2 left-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          listing.market === 'ebay'
                            ? 'bg-blue-500 text-white'
                            : 'bg-purple-500 text-white'
                        }`}
                      >
                        {listing.market === 'ebay' ? 'eBay' : 'SNKRDUNK'}
                      </span>
                    </div>
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-green-500 text-white">
                        🟢 {t('pricing.available', '可購買')}
                      </span>
                    </div>
                  </div>

                  {/* Card Info */}
                  <div className="p-4">
                    <div className="mb-2">
                      <p className="text-xs text-muted-foreground mb-1">
                        {t('pricing.grade', '評級')}: {listing.grade}
                      </p>
                      <p className="text-sm text-foreground line-clamp-2 mb-2">{listing.title}</p>
                    </div>

                    <div className="mb-3">
                      <p className="text-2xl font-bold text-yellow-400">
                        {listing.currency} ${listing.price.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('pricing.seller', '賣家')}: {listing.seller.name}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        asChild
                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm h-9"
                      >
                        <a
                          href={listing.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1"
                        >
                          {t('pricing.buyNow', '前往購買')}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isSearching && results.length === 0 && searchQuery && (
          <div className="text-center py-12 text-muted-foreground">
            <p>{t('pricing.noResults', '未找到相關結果，請嘗試其他關鍵詞')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
