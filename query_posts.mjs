import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.SUPABASE_DATABASE_URL);

const [rows] = await connection.execute(
  'SELECT id, title, featuredImage, status FROM posts LIMIT 1'
);

console.log('\n📊 文章數據：\n');
if (rows.length === 0) {
  console.log('❌ 沒有找到任何文章');
} else {
  const post = rows[0];
  console.log(`ID: ${post.id}`);
  console.log(`標題: ${post.title}`);
  console.log(`狀態: ${post.status}`);
  console.log(`主題圖片: ${post.featuredImage || '❌ 無圖片'}`);
  
  if (post.featuredImage) {
    console.log(`\n✅ 圖片 URL 長度: ${post.featuredImage.length} 字符`);
    console.log(`圖片 URL 前 100 字符: ${post.featuredImage.substring(0, 100)}...`);
  }
}

await connection.end();
