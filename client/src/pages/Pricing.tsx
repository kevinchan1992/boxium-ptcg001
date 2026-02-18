import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, ExternalLink } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

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

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    searchMutation.mutate({ query: searchQuery, forceRefresh: false });
  };

  const handleRefresh = () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    searchMutation.mutate({ query: searchQuery, forceRefresh: true });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#06038D] to-[#000428] text-white">
      {/* Header */}
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            💰 {t('pricing.title', 'Pokémon TCG 格價查詢')}
          </h1>
          <p className="text-lg text-gray-300">
            {t('pricing.subtitle', '實時比較全球市場卡牌價格')}
          </p>
        </div>

        {/* Search Box */}
        <Card className="bg-black/40 border-gray-700 p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder={t('pricing.searchPlaceholder', '輸入卡牌名稱、編號或系列...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10 bg-black/60 border-gray-600 text-white placeholder-gray-400 h-12"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold h-12 px-8"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  {t('pricing.searching', '搜尋中...')}
                </>
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  {t('pricing.search', '搜尋')}
                </>
              )}
            </Button>
            {results.length > 0 && (
              <Button
                onClick={handleRefresh}
                disabled={isSearching}
                variant="outline"
                className="border-gray-600 text-white hover:bg-white/10 h-12 px-6"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                {t('pricing.refresh', '刷新')}
              </Button>
            )}
          </div>

          <div className="mt-4 text-sm text-gray-400">
            <p>{t('pricing.searchHint', '提示: 搜尋結果僅顯示 PSA 10 評級的可購買商品')}</p>
          </div>
        </Card>

        {/* Price Stats */}
        {stats && (
          <Card className="bg-black/40 border-gray-700 p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4">
              📊 {t('pricing.priceStats', '價格統計')} (PSA 10 - {t('pricing.totalListings', '共 {{count}} 個在售商品', { count: stats.totalCount })})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-black/60 p-4 rounded-lg">
                <p className="text-gray-400 text-sm mb-1">{t('pricing.minPrice', '最低價')}</p>
                <p className="text-2xl font-bold text-green-400">
                  ${stats.minPrice.toFixed(2)}
                </p>
              </div>
              <div className="bg-black/60 p-4 rounded-lg">
                <p className="text-gray-400 text-sm mb-1">{t('pricing.avgPrice', '平均價')}</p>
                <p className="text-2xl font-bold text-yellow-400">
                  ${stats.avgPrice.toFixed(2)}
                </p>
              </div>
              <div className="bg-black/60 p-4 rounded-lg">
                <p className="text-gray-400 text-sm mb-1">{t('pricing.maxPrice', '最高價')}</p>
                <p className="text-2xl font-bold text-red-400">
                  ${stats.maxPrice.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                <span>eBay: {stats.marketDistribution.ebay} {t('pricing.listings', '個')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                <span>SNKRDUNK: {stats.marketDistribution.snkrdunk} {t('pricing.listings', '個')}</span>
              </div>
            </div>
          </Card>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">
              {t('pricing.searchResults', '搜尋結果')}: {t('pricing.totalResults', '共 {{count}} 筆', { count: results.length })}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {results.map((listing) => (
                <Card
                  key={listing.id}
                  className="bg-black/40 border-gray-700 overflow-hidden hover:border-yellow-500 transition-all duration-300"
                >
                  {/* Card Image */}
                  <div className="relative aspect-[3/4] bg-black/60">
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
                      <p className="text-xs text-gray-400 mb-1">{t('pricing.grade', '評級')}: {listing.grade}</p>
                      <p className="text-sm text-gray-300 line-clamp-2 mb-2">{listing.title}</p>
                    </div>

                    <div className="mb-3">
                      <p className="text-2xl font-bold text-yellow-400">
                        {listing.currency} ${listing.price.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {t('pricing.seller', '賣家')}: {listing.seller.name}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        asChild
                        className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold text-sm h-9"
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
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isSearching && results.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <p className="text-xl text-gray-400">
              {t('pricing.noResults', '未找到相關結果，請嘗試其他關鍵詞')}
            </p>
          </div>
        )}

        {/* Initial State */}
        {!searchQuery && results.length === 0 && (
          <div className="text-center py-12">
            <p className="text-xl text-gray-400">
              {t('pricing.initialState', '輸入卡牌名稱開始搜尋')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
