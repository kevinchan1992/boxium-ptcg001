import { db } from './server/db.js';
import { invokeLLM } from './server/_core/llm.js';

async function testTranslate() {
  try {
    console.log('開始測試 AI 翻譯功能...');
    
    // 獲取第一篇文章 (ID 4)
    const blogDb = await import('./server/blogDb.js');
    const post = await blogDb.getPostById(4);
    
    if (!post) {
      console.error('找不到文章 ID 4');
      return;
    }
    
    console.log('文章標題:', post.title);
    console.log('文章內容長度:', post.content.length);
    
    // 生成英文翻譯
    console.log('\n生成英文翻譯...');
    const enResponse = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are a professional translator. Translate the following Chinese blog post to English. Maintain the original markdown formatting and structure. Only return the translated content without any explanations.' },
        { role: 'user', content: `Title: ${post.title}\n\nExcerpt: ${post.excerpt || ''}\n\nContent:\n${post.content}` }
      ]
    });
    
    const enContent = typeof enResponse.choices[0].message.content === 'string' 
      ? enResponse.choices[0].message.content 
      : JSON.stringify(enResponse.choices[0].message.content);
    
    console.log('英文翻譯完成，長度:', enContent.length);
    console.log('英文翻譯預覽:', enContent.substring(0, 200));
    
    console.log('\n測試完成！');
  } catch (error) {
    console.error('測試失敗:', error.message);
    console.error(error.stack);
  }
}

testTranslate();
