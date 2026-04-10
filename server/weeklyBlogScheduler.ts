/**
 * Weekly Blog Report Scheduler
 * Automatically generates a weekly market report draft every Monday at 08:00 HKT
 * and notifies the owner to review and publish.
 */
import * as cron from 'node-cron';

let weeklyBlogReportCronJob: ReturnType<typeof cron.schedule> | null = null;

/**
 * Generate weekly market report draft and notify owner
 */
export async function runWeeklyBlogReport(): Promise<void> {
  console.log('[WeeklyBlogReport] Starting weekly market report generation...');
  try {
    const { invokeLLM } = await import('./_core/llm');
    const db = await import('./db');
    const { createPost } = await import('./blogDb');
    const { notifyOwner } = await import('./_core/notification');
    const { users } = await import('../drizzle/schema_new');
    const { eq } = await import('drizzle-orm');

    // Fetch market data
    const [overview, trendingUp, trendingDown] = await Promise.all([
      db.getMarketOverview(),
      db.getTrendingByPriceIncrease({ limit: 5, days: 7 }).catch(() => []),
      db.getTrendingByPriceDecrease({ limit: 5, days: 7 }).catch(() => []),
    ]);

    const trendingUpText = (trendingUp as any[]).slice(0, 5).map((item: any) =>
      `- ${item.nameZh || item.name || '未知'}：+${item.priceChangePercent?.toFixed(1) || 0}% (HKD $${Math.round(item.currentPrice || 0).toLocaleString()})`
    ).join('\n');
    const trendingDownText = (trendingDown as any[]).slice(0, 5).map((item: any) =>
      `- ${item.nameZh || item.name || '未知'}：${item.priceChangePercent?.toFixed(1) || 0}% (HKD $${Math.round(item.currentPrice || 0).toLocaleString()})`
    ).join('\n');

    const now = new Date();
    const weekLabel = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月第${Math.ceil(now.getDate() / 7)}週`;

    // Generate article with AI
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: '你是 Boxium PTCG 平台的市場快報撰稿人。根據平台真實成交數據，撰寫專業每週市場快報文章。所有價格以 HKD$ 表示。文章格式為 Markdown，包含完整的 H2/H3 標題結構、數據分析和市場展望。',
        },
        {
          role: 'user',
          content: `請根據以下 BOXIUM 平台真實數據，撰寫 ${weekLabel} 每週市場快報：

=== 市場概覽 ===
- 平台總卡牌數：${(overview as any).totalCards}
- 近期成交記錄：${(overview as any).totalPriceRecords}
- 7 天平均價格變動：${((overview as any).avgPriceChange7d as number)?.toFixed(1) || 0}%

=== 漲幅榜（近 7 天）===
${trendingUpText || '暫無數據'}

=== 跌幅榜（近 7 天）===
${trendingDownText || '暫無數據'}

要求：文章長度 800-1200 字，包含市場總結、漲幅分析、跌幅分析、本週焦點、下週展望五個章節。語氣專業但易讀，適合香港及台灣 TCG 玩家。`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'weekly_report',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: '文章標題' },
              excerpt: { type: 'string', description: '文章摘要（100-150字）' },
              content: { type: 'string', description: 'Markdown 格式正文' },
              tags: { type: 'array', items: { type: 'string' }, description: '建議標籤' },
              seoTitle: { type: 'string', description: 'SEO 標題' },
              seoDescription: { type: 'string', description: 'SEO 描述' },
            },
            required: ['title', 'excerpt', 'content', 'tags', 'seoTitle', 'seoDescription'],
            additionalProperties: false,
          },
        },
      },
      thinking: { budget_tokens: 4096 },
    });

    const article = JSON.parse(response.choices[0].message.content as string);

    // Find admin user as author
    const dbConn = await db.getDb();
    let authorId = 1;
    if (dbConn) {
      const adminUsers = await dbConn
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'admin'))
        .limit(1);
      if (adminUsers.length > 0) authorId = adminUsers[0].id;
    }

    // Generate unique slug
    const slug = `weekly-report-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Save as draft
    const postId = await createPost({
      title: article.title,
      slug,
      excerpt: article.excerpt,
      content: article.content,
      status: 'draft',
      dataSource: 'ai-generated',
      category: '市場快報',
      metaTitle: article.seoTitle,
      metaDescription: article.seoDescription,
      metaKeywords: Array.isArray(article.tags) ? article.tags.join(', ') : '',
      authorId,
    });

    console.log(`[WeeklyBlogReport] Draft saved as post #${postId}: "${article.title}"`);

    // Notify owner
    await notifyOwner({
      title: '📊 每週市場快報草稿已生成',
      content: `本週市場快報已自動生成並儲存為草稿（文章 #${postId}）。\n\n標題：${article.title}\n\n請前往博客管理 → 文章列表審核並發布。`,
    });

    console.log('[WeeklyBlogReport] Weekly blog report completed successfully');
  } catch (error) {
    console.error('[WeeklyBlogReport] Weekly blog report generation failed:', error);
  }
}

/**
 * Start weekly blog report scheduler
 * Runs every Monday at 08:00 HKT
 */
export function startWeeklyBlogReportScheduler() {
  if (weeklyBlogReportCronJob) {
    weeklyBlogReportCronJob.stop();
  }
  // Every Monday at 08:00 HKT
  const cronExpression = '0 8 * * 1';
  console.log(`[WeeklyBlogReport] Starting scheduler: ${cronExpression} (Monday 08:00 HKT)`);
  weeklyBlogReportCronJob = cron.schedule(
    cronExpression,
    async () => {
      await runWeeklyBlogReport();
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[WeeklyBlogReport] Weekly blog report scheduler started successfully');
}

/**
 * Stop weekly blog report scheduler
 */
export function stopWeeklyBlogReportScheduler() {
  if (weeklyBlogReportCronJob) {
    weeklyBlogReportCronJob.stop();
    weeklyBlogReportCronJob = null;
    console.log('[WeeklyBlogReport] Scheduler stopped');
  }
}
