// 預定義的博客分類
export const BLOG_CATEGORIES = [
  '市場分析',
  '卡牌價格',
  '投資指南',
  '新品發布',
  '收藏心得',
  '賽事報導',
  '開箱評測',
  '交易技巧',
] as const;

// 預定義的博客標籤
export const BLOG_TAGS = [
  'TCG',
  'Pokémon',
  'One Piece',
  'PSA10',
  '中古品',
  '價格趨勢',
  '投資',
  '收藏',
  '開箱',
  '賽事',
  '新品',
  '限定版',
  '稀有卡',
  '市場分析',
  '交易',
  'SNKRDUNK',
  'eBay',
] as const;

export type BlogCategory = typeof BLOG_CATEGORIES[number];
export type BlogTag = typeof BLOG_TAGS[number];
