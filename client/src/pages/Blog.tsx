import { useState, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandButton } from "@/components/ui/brand-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Calendar, Eye, TrendingUp, Sparkles, ArrowRight } from "lucide-react";
import { LazyImage } from "@/components/LazyImage";

export default function Blog() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const POSTS_PER_PAGE = 12;

  // Query published posts
  const { data: posts, isLoading, refetch } = trpc.blog.getPosts.useQuery({
    status: 'published',
    search: searchQuery || undefined,
    categoryId: selectedCategory === 'all' ? undefined : Number(selectedCategory),
    sortBy: 'newest',
    limit: POSTS_PER_PAGE * page,
  });

  // Update allPosts when posts change
  useEffect(() => {
    if (posts) {
      setAllPosts(posts);
    }
  }, [posts]);

  // Reset page when search or category changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCategory]);

  // Query categories
  const { data: categories } = trpc.blog.getCategories.useQuery();

  // Get featured post (most recent)
  const featuredPost = allPosts && allPosts.length > 0 ? allPosts[0] : null;
  const regularPosts = allPosts && allPosts.length > 1 ? allPosts.slice(1) : [];
  const hasMore = posts && posts.length === POSTS_PER_PAGE * page;

  const handleLoadMore = () => {
    setPage(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-[#06038d]/20 to-black border-b border-zinc-800">
        <div className="container mx-auto px-4 py-8 md:py-16 lg:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-bold text-white mb-4 md:mb-6">
              BOXIUM PTCG 博客
            </h1>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-300 mb-6 md:mb-8">
              專業的 Pokémon TCG 市場分析、價格趨勢、投資建議
            </p>
            
            {/* Search Bar - 手機版優化 */}
            <div className="flex flex-col sm:flex-row gap-2 max-w-2xl mx-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="搜尋文章..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-zinc-900 border-zinc-700 text-white min-h-[44px] text-sm md:text-base"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-48 bg-zinc-900 border-zinc-700 text-white min-h-[44px] text-sm md:text-base">
                  <SelectValue placeholder="所有分類" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有分類</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="container mx-auto px-4 py-12">
        {isLoading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#06038d]"></div>
            <p className="text-gray-400 mt-4">載入中...</p>
          </div>
        ) : posts && posts.length > 0 ? (
          <>
            {/* Featured Post */}
            {featuredPost && (
              <div className="mb-12">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-4 md:mb-6 flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-[#06038d]" />
                  精選文章
                </h2>
                <Link href={`/blog/${featuredPost.slug}`}>
                  <Card className="bg-zinc-900 border-zinc-800 hover:border-[#06038d] transition-all cursor-pointer overflow-hidden">
                    <div className="grid md:grid-cols-2 gap-0 md:gap-6">
                      {featuredPost.featuredImage && (
                        <div className="relative h-48 sm:h-64 md:h-auto">
                          <LazyImage
                            src={featuredPost.featuredImage}
                            alt={featuredPost.title}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="p-4 sm:p-6 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-4">
                          {featuredPost.dataSource === 'ai-generated' && (
                            <Badge variant="outline" className="border-purple-500 text-purple-400">
                              <Sparkles className="w-3 h-3 mr-1" />
                              AI 生成
                            </Badge>
                          )}
                          <Badge variant="secondary">精選</Badge>
                        </div>
                        <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 md:mb-4 line-clamp-2">
                          {featuredPost.title}
                        </h3>
                        {featuredPost.excerpt && (
                          <p className="text-sm sm:text-base text-gray-300 mb-4 md:mb-6 line-clamp-3">
                            {featuredPost.excerpt}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-400 mb-6">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(featuredPost.publishedAt || featuredPost.createdAt).toLocaleDateString('zh-TW')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {featuredPost.viewCount} 次瀏覽
                          </span>
                        </div>
                        <BrandButton className="w-fit">
                          閱讀全文
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </BrandButton>
                      </div>
                    </div>
                  </Card>
                </Link>
              </div>
            )}

            {/* Regular Posts Grid */}
            {regularPosts.length > 0 && (
              <div>
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-4 md:mb-6">最新文章</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {regularPosts.map((post) => (
                    <Link key={post.id} href={`/blog/${post.slug}`}>
                      <Card className="bg-zinc-900 border-zinc-800 hover:border-[#06038d] transition-all cursor-pointer h-full flex flex-col">
                        {post.featuredImage && (
                          <div className="relative h-40 sm:h-48 overflow-hidden">
                            <LazyImage
                              src={post.featuredImage}
                              alt={post.title}
                              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        )}
                        <CardHeader className="p-4 sm:p-6">
                          <div className="flex items-center gap-2 mb-2">
                            {post.dataSource === 'ai-generated' && (
                              <Badge variant="outline" className="border-purple-500 text-purple-400">
                                <Sparkles className="w-3 h-3 mr-1" />
                                AI
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-white text-base sm:text-lg md:text-xl line-clamp-2 hover:text-[#06038d] transition-colors">
                            {post.title}
                          </CardTitle>
                          {post.excerpt && (
                            <CardDescription className="text-sm sm:text-base line-clamp-3">
                              {post.excerpt}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="mt-auto p-4 sm:p-6">
                          <div className="flex items-center gap-3 md:gap-4 text-xs sm:text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(post.publishedAt || post.createdAt).toLocaleDateString('zh-TW', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="w-4 h-4" />
                              {post.viewCount}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>

                {/* Load More Button */}
                {hasMore && (
                  <div className="mt-8 md:mt-12 text-center">
                    <BrandButton
                      onClick={handleLoadMore}
                      disabled={isLoading}
                      className="px-6 md:px-8 py-3 md:py-6 text-base md:text-lg min-h-[44px]"
                    >
                      {isLoading ? '載入中...' : '載入更多文章'}
                    </BrandButton>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-zinc-900 flex items-center justify-center">
              <Search className="w-12 h-12 text-gray-600" />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-white mb-2">沒有找到文章</h3>
            <p className="text-sm md:text-base text-gray-400">
              {searchQuery || selectedCategory !== 'all'
                ? '請嘗試其他搜尋條件'
                : '目前還沒有發布任何文章'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
