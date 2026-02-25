import { getDb } from './server/db.ts';

const db = await getDb();
if (!db) {
  console.error('Database not available');
  process.exit(1);
}

const { posts } = await import('./drizzle/schema_new.ts');

const allPosts = await db.select({
  id: posts.id,
  title: posts.title,
  featuredImage: posts.featuredImage,
  status: posts.status,
}).from(posts).limit(10);

console.log('\n📊 文章主題圖片檢查：\n');
console.log('總共查詢:', allPosts.length, '篇文章\n');

allPosts.forEach((post, index) => {
  console.log(`${index + 1}. ${post.title}`);
  console.log(`   狀態: ${post.status}`);
  console.log(`   主題圖片: ${post.featuredImage || '❌ 無圖片'}`);
  console.log('');
});

const withImages = allPosts.filter(p => p.featuredImage);
const withoutImages = allPosts.filter(p => !p.featuredImage);

console.log(`✅ 有主題圖片: ${withImages.length} 篇`);
console.log(`❌ 無主題圖片: ${withoutImages.length} 篇`);

process.exit(0);
