import { useState, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandButton } from "@/components/ui/brand-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Calendar, Eye, TrendingUp, Sparkles, ArrowRight, Tag } from "lucide-react";
import { LazyImage } from "@/components/LazyImage";
import { ResponsiveBlogImage } from "@/components/ResponsiveBlogImage";
import { useTranslation } from "react-i18next";

export default function Blog() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
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

  // Helper function to get localized post content
  const getLocalizedContent = (post: any, field: 'title' | 'excerpt') => {
    if (currentLang === 'en' && post[`${field}En`]) {
      return post[`${field}En`];
    }
    if (currentLang === 'ja' && post[`${field}Ja`]) {
      return post[`${field}Ja`];
    }
    return post[field]; // Fallback to Chinese
  };

  // Helper function to get localized category name
  const getLocalizedCategory = (category: any) => {
    if (currentLang === 'en' && category.nameEn) {
      return category.nameEn;
    }
    if (currentLang === 'ja' && category.nameJa) {
      return category.nameJa;
    }
    return category.name; // Fallback to Chinese
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - 白色底色 + 藍色漸變 */}
      <div className="bg-gradient-to-br from-blue-50 via-white to-yellow-50 border-b border-gray-200">
        <div className="container mx-auto px-4 py-12 md:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto text-center">
            {/* Title - 使用 logo 藍色 */}
            <h1 className="text-3xl sm:text-4xl md:text-4xl lg:text-5xl font-bold text-[#0033CC] mb-4 md:mb-6 leading-tight">
              {t('blogPage.title')}
            </h1>
            <p className="text-base sm:text-lg md:text-lg text-gray-600 mb-8 md:mb-10 leading-relaxed">
              {t('blogPage.subtitle')}
            </p>
            
            {/* Search Bar - 專業設計 */}
            <div className="flex flex-col sm:flex-row gap-3 max-w-3xl mx-auto">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder={t('blogPage.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 bg-white border-gray-300 text-gray-900 min-h-[52px] text-base shadow-sm focus:border-[#0033CC] focus:ring-[#0033CC]"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-56 bg-white border-gray-300 text-gray-900 min-h-[52px] text-base shadow-sm">
                  <SelectValue placeholder={t('blogPage.allCategories')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('blogPage.allCategories')}</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {getLocalizedCategory(cat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="container mx-auto px-4 py-12 md:py-16">
        {isLoading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#0033CC]"></div>
            <p className="text-gray-600 mt-6 text-lg">{t('blogPage.loading')}</p>
          </div>
        ) : posts && posts.length > 0 ? (
          <>
            {/* Featured Post - 大型卡片設計 */}
            {featuredPost && (
              <div className="mb-16">
                <div className="flex items-center gap-3 mb-6">
                  <TrendingUp className="w-7 h-7 text-[#FFD700]" />
                  <h2 className="text-2xl md:text-2xl font-bold text-[#0033CC]">
                    {t('blogPage.featuredPost')}
                  </h2>
                </div>
                <Link href={`/blog/${featuredPost.slug}`}>
                  <Card className="bg-white border-2 border-gray-200 hover:border-[#0033CC] hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden group">
                    <div className="grid md:grid-cols-5 gap-0">
                      {featuredPost.featuredImage && (
                        <div className="relative h-64 sm:h-80 md:h-auto md:col-span-2 overflow-hidden">
                          <ResponsiveBlogImage
                            imageData={featuredPost.featuredImage}
                            size="medium"
                            alt={featuredPost.title}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      )}
                      <div className="p-6 sm:p-8 md:p-10 flex flex-col justify-center md:col-span-3">
                        <div className="flex items-center gap-2 mb-4">
                          {featuredPost.dataSource === 'ai-generated' && (
                            <Badge variant="outline" className="border-purple-500 text-purple-600 bg-purple-50">
                              <Sparkles className="w-3 h-3 mr-1" />
                              AI 生成
                            </Badge>
                          )}
                          <Badge className="bg-[#FFD700] text-[#0033CC] hover:bg-[#FFD700]/90">精選文章</Badge>
                        </div>
                        <h3 className="text-2xl sm:text-3xl md:text-3xl font-bold text-gray-900 mb-4 line-clamp-2 group-hover:text-[#0033CC] transition-colors">
                          {getLocalizedContent(featuredPost, 'title')}
                        </h3>
                        {featuredPost.excerpt && (
                          <p className="text-base sm:text-base text-gray-600 mb-6 line-clamp-3 leading-relaxed">
                            {getLocalizedContent(featuredPost, 'excerpt')}
                          </p>
                        )}
                        <div className="flex items-center gap-6 text-sm text-gray-500 mb-6">
                          <span className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {new Date(featuredPost.publishedAt || featuredPost.createdAt).toLocaleDateString('zh-TW')}
                          </span>
                          <span className="flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            {featuredPost.viewCount} {t('blogPage.views')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[#0033CC] font-semibold group-hover:gap-4 transition-all">
                          {t('blogPage.readMore')}
                          <ArrowRight className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              </div>
            )}

            {/* Regular Posts Grid - 專業卡片設計 */}
            {regularPosts.length > 0 && (
              <div>
                <h2 className="text-2xl md:text-2xl font-bold text-[#0033CC] mb-8">
                  {t('blogPage.latestPosts')}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                  {regularPosts.map((post) => (
                    <Link key={post.id} href={`/blog/${post.slug}`}>
                      <Card className="bg-white border-2 border-gray-200 hover:border-[#0033CC] hover:shadow-xl transition-all duration-300 cursor-pointer h-full flex flex-col group overflow-hidden">
                        {post.featuredImage && (
                          <div className="relative h-48 sm:h-56 overflow-hidden">
                            <ResponsiveBlogImage
                              imageData={post.featuredImage}
                              size="thumbnail"
                              alt={post.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          </div>
                        )}
                        <CardHeader className="p-5 sm:p-6 flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            {post.dataSource === 'ai-generated' && (
                              <Badge variant="outline" className="border-purple-500 text-purple-600 bg-purple-50">
                                <Sparkles className="w-3 h-3 mr-1" />
                                AI
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-gray-900 text-lg sm:text-xl md:text-xl line-clamp-2 group-hover:text-[#0033CC] transition-colors mb-3 leading-tight font-bold">
                            {getLocalizedContent(post, 'title')}
                          </CardTitle>
                          {post.excerpt && (
                            <CardDescription className="text-sm sm:text-sm line-clamp-3 text-gray-600 leading-relaxed">
                              {getLocalizedContent(post, 'excerpt')}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="p-5 sm:p-6 pt-0">
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4" />
                              {new Date(post.publishedAt || post.createdAt).toLocaleDateString('zh-TW', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            <span className="flex items-center gap-1.5">
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
                  <div className="mt-12 md:mt-16 text-center">
                    <BrandButton
                      onClick={handleLoadMore}
                      disabled={isLoading}
                      className="px-8 md:px-10 py-4 md:py-6 text-lg md:text-xl min-h-[56px] shadow-lg hover:shadow-xl transition-shadow"
                    >
                      {isLoading ? t('blogPage.loading') : t('blogPage.loadMore')}
                    </BrandButton>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-gray-100 flex items-center justify-center">
              <Search className="w-16 h-16 text-gray-400" />
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">{t('blogPage.noPostsFound')}</h3>
            <p className="text-base md:text-lg text-gray-600">
              {searchQuery || selectedCategory !== 'all'
                ? t('blogPage.tryOtherSearch')
                : t('blogPage.noPostsFound')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
