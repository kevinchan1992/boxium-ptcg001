/**
 * Blog tRPC Router
 * Blog article management: CRUD, AI generation, publishing
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import * as db from "../db";

export const blogRouter = router({
    // Debug: Get post data for troubleshooting
    debugGetPost: publicProcedure
      .input(z.object({ id: z.number().optional() }))
      .query(async ({ input }) => {
        const blogDb = await import('../blogDb');
        const { getDb } = await import('../db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { posts } = await import('../../drizzle/schema_new');
        const { desc } = await import('drizzle-orm');
        
        let query = db.select().from(posts);
        if (input.id) {
          const { eq } = await import('drizzle-orm');
          query = query.where(eq(posts.id, input.id)) as any;
        } else {
          query = query.orderBy(desc(posts.createdAt)).limit(1) as any;
        }
        
        const result = await query;
        return result.length > 0 ? result[0] : null;
      }),

    // Get all posts with filters
    getPosts: publicProcedure
      .input(z.object({
        categoryId: z.number().optional(),
        status: z.enum(['draft', 'published']).optional(),
        search: z.string().optional(),
        sortBy: z.enum(['newest', 'oldest', 'views']).optional(),
        limit: z.number().min(1).max(50).optional(),
        offset: z.number().min(0).optional(),
      }))
      .query(async ({ input }) => {
        const blogDb = await import('../blogDb');
        return await blogDb.getPosts(input);
      }),

    // Get post by slug
    getPostBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const blogDb = await import('../blogDb');
        return await blogDb.getPostBySlug(input.slug);
      }),

    // Create new post (Admin only)
    createPost: adminProcedure
      .input(z.object({
        title: z.string(),
        excerpt: z.string().optional(),
        content: z.string(),
        featuredImage: z.string().optional(),
        category: z.string().optional(), // Category name (e.g., "市場分析", "卡牌評測")
        categoryId: z.number().optional(),
        status: z.enum(['draft', 'published']),
        dataSource: z.enum(['manual', 'ai-generated', 'mixed']),
        relatedCardIds: z.string().optional(),
        dataSnapshot: z.string().optional(),
        metaTitle: z.string().optional(),
        metaDescription: z.string().optional(),
        metaKeywords: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const blogDb = await import('../blogDb');
        
        // Generate slug from title
        const slug = blogDb.generateSlug(input.title);
        
        // Create post
        const postId = await blogDb.createPost({
          title: input.title,
          slug,
          excerpt: input.excerpt || null,
          content: input.content,
          featuredImage: input.featuredImage || null,
          category: input.category || null,
          categoryId: input.categoryId || null,
          status: input.status,
          publishedAt: input.status === 'published' ? new Date() : null,
          viewCount: 0,
          authorId: ctx.user?.id || 0,
          dataSource: input.dataSource,
          relatedCardIds: input.relatedCardIds || null,
          dataSnapshot: input.dataSnapshot || null,
          metaTitle: input.metaTitle || null,
          metaDescription: input.metaDescription || null,
          metaKeywords: input.metaKeywords || null,
        });
        
        // Add tags if provided
        if (input.tags && input.tags.length > 0) {
          const tagIds: number[] = [];
          for (const tagName of input.tags) {
            const tagSlug = blogDb.generateSlug(tagName);
            let tag = await blogDb.getTagBySlug(tagSlug);
            if (!tag) {
              const tagId = await blogDb.createTag({ name: tagName, slug: tagSlug });
              tagIds.push(tagId);
            } else {
              tagIds.push(tag.id);
            }
          }
          await blogDb.addTagsToPost(postId, tagIds);
        }
        
        return { postId, slug };
      }),

    // Update post (Admin only)
    updatePost: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        excerpt: z.string().optional(),
        content: z.string().optional(),
        featuredImage: z.string().optional(),
        category: z.string().optional(), // Category name (e.g., "市場分析", "卡牌評測")
        categoryId: z.number().optional(),
        status: z.enum(['draft', 'published']).optional(),
        metaTitle: z.string().optional(),
        metaDescription: z.string().optional(),
        metaKeywords: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const blogDb = await import('../blogDb');
        
        // Save current version before updating
        const currentPost = await blogDb.getPostById(input.id);
        if (currentPost && ctx.user) {
          const { getDb } = await import('../db');
          const db = await getDb();
          if (db) {
            const { postVersions } = await import('../../drizzle/schema_new');
            await db.insert(postVersions).values({
              postId: input.id,
              title: currentPost.title,
              excerpt: currentPost.excerpt || null,
              content: currentPost.content,
              featuredImage: currentPost.featuredImage || null,
              category: currentPost.category || null,
              tags: '', // Will be populated from postTags relation if needed
              metaKeywords: currentPost.metaKeywords || null,
              createdBy: ctx.user.id,
            });
          }
        }
        
        const updates: any = {};
        if (input.title) {
          updates.title = input.title;
          updates.slug = blogDb.generateSlug(input.title);
        }
        if (input.excerpt !== undefined) updates.excerpt = input.excerpt;
        if (input.content) updates.content = input.content;
        if (input.featuredImage !== undefined) updates.featuredImage = input.featuredImage;
        if (input.category !== undefined) updates.category = input.category;
        if (input.categoryId !== undefined) updates.categoryId = input.categoryId;
        if (input.status) {
          updates.status = input.status;
          // Only set publishedAt on first publish, don't reset on subsequent updates
          if (input.status === 'published' && currentPost && !currentPost.publishedAt) {
            updates.publishedAt = new Date();
          } else if (input.status === 'draft') {
            // Keep publishedAt when reverting to draft (can re-publish later)
          }
        }
        if (input.metaTitle !== undefined) updates.metaTitle = input.metaTitle;
        if (input.metaDescription !== undefined) updates.metaDescription = input.metaDescription;
        if (input.metaKeywords !== undefined) updates.metaKeywords = input.metaKeywords;
        
        await blogDb.updatePost(input.id, updates);
        
        // Update tags if provided
        if (input.tags) {
          await blogDb.removeTagsFromPost(input.id);
          if (input.tags.length > 0) {
            const tagIds: number[] = [];
            for (const tagName of input.tags) {
              const tagSlug = blogDb.generateSlug(tagName);
              let tag = await blogDb.getTagBySlug(tagSlug);
              if (!tag) {
                const tagId = await blogDb.createTag({ name: tagName, slug: tagSlug });
                tagIds.push(tagId);
              } else {
                tagIds.push(tag.id);
              }
            }
            await blogDb.addTagsToPost(input.id, tagIds);
          }
        }
        
        return { success: true };
      }),

    // Delete post (Admin only)
    deletePost: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const blogDb = await import('../blogDb');
        const { getDb } = await import('../db');
        const db = await getDb();
        
        // Clean up related data
        await blogDb.removeTagsFromPost(input.id);
        
        // Clean up postVersions and postShares
        if (db) {
          const { eq } = await import('drizzle-orm');
          const { postVersions, postShares } = await import('../../drizzle/schema_new');
          await db.delete(postVersions).where(eq(postVersions.postId, input.id));
          await db.delete(postShares).where(eq(postShares.postId, input.id));
        }
        
        await blogDb.deletePost(input.id);
        return { success: true };
      }),

    // Toggle publish status (Admin only)
    togglePublish: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const blogDb = await import('../blogDb');
        await blogDb.togglePublishPost(input.id);
        return { success: true };
      }),

    // AI translate post (Admin only)
    translatePost: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const blogDb = await import('../blogDb');
        const { invokeLLM } = await import('../_core/llm');
        
        // Get post data
        const post = await blogDb.getPostById(input.id);
        if (!post) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
        }
        
        // Generate English translation using JSON schema
        const enResponse = await invokeLLM({
          messages: [
            { role: 'system', content: `You are a professional TCG (Trading Card Game) content translator for Boxium PTCG, a Hong Kong-based TCG market information platform. Translate the Traditional Chinese blog post to English.

Translation rules:
- Maintain all Markdown formatting (## headings, **bold**, lists)
- Keep TCG terminology in original form: PSA 10, CGC 10, GEM-MT 10, BGS 9.5, etc.
- Keep card names in their official English names (do not translate card names)
- Keep currency as HKD$ (do not convert to USD)
- Maintain the professional yet approachable tone
- Do not add or remove information, only translate` },
            { role: 'user', content: `Translate this Boxium PTCG blog post to English:\n\nTitle: ${post.title}\n\nExcerpt: ${post.excerpt || ''}\n\nContent:\n${post.content}` }
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'blog_translation',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Translated title' },
                  excerpt: { type: 'string', description: 'Translated excerpt' },
                  content: { type: 'string', description: 'Translated content with markdown' }
                },
                required: ['title', 'excerpt', 'content'],
                additionalProperties: false
              }
            }
          }
        });
        
        const enData = JSON.parse(enResponse.choices[0].message.content as string);
        const titleEn = enData.title;
        const excerptEn = enData.excerpt;
        const contentEn = enData.content;
        
        // Generate Japanese translation using JSON schema
        const jaResponse = await invokeLLM({
          messages: [
            { role: 'system', content: `あなたは香港のTCG（トレーディングカードゲーム）情報プラットフォーム「Boxium PTCG」のプロフェッショナルな翻訳者です。繁体字中国語のブログ記事を日本語に翻訳してください。

翻訳ルール：
- Markdownフォーマットを維持する（## 見出し、**太字**、リストなど）
- TCG用語はそのまま保持：PSA 10、CGC 10、GEM-MT 10、BGS 9.5など
- カード名は公式の日本語名または英語名を使用（翻訳しない）
- 通貨はHKD$のまま（JPYに変換しない）
- プロフェッショナルで親しみやすいトーンを維持
- 情報を追加・削除せず、翻訳のみ行う` },
            { role: 'user', content: `このBoxium PTCGブログ記事を日本語に翻訳してください：\n\nタイトル: ${post.title}\n\n概要: ${post.excerpt || ''}\n\n内容:\n${post.content}` }
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'blog_translation',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Translated title' },
                  excerpt: { type: 'string', description: 'Translated excerpt' },
                  content: { type: 'string', description: 'Translated content with markdown' }
                },
                required: ['title', 'excerpt', 'content'],
                additionalProperties: false
              }
            }
          }
        });
        
        const jaData = JSON.parse(jaResponse.choices[0].message.content as string);
        const titleJa = jaData.title;
        const excerptJa = jaData.excerpt;
        const contentJa = jaData.content;
        
        // Update post with translations
        await blogDb.updatePost(input.id, {
          titleEn,
          excerptEn,
          contentEn,
          titleJa,
          excerptJa,
          contentJa,
        });
        
        return { 
          success: true,
          translations: {
            en: { title: titleEn, excerpt: excerptEn },
            ja: { title: titleJa, excerpt: excerptJa }
          }
        };
      }),

    // Update post translation (Admin only)
    updatePostTranslation: adminProcedure
      .input(z.object({
        id: z.number(),
        titleEn: z.string().optional(),
        titleJa: z.string().optional(),
        excerptEn: z.string().optional(),
        excerptJa: z.string().optional(),
        contentEn: z.string().optional(),
        contentJa: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const blogDb = await import('../blogDb');
        const { id, ...translations } = input;
        
        // Update post with translations
        await blogDb.updatePost(id, translations);
        
        return { success: true };
      }),

    // Get all categories
    getCategories: publicProcedure
      .query(async () => {
        const blogDb = await import('../blogDb');
        return await blogDb.getCategories();
      }),

    // Create category (Admin only)
    createCategory: adminProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const blogDb = await import('../blogDb');
        const slug = blogDb.generateSlug(input.name);
        const categoryId = await blogDb.createCategory({
          name: input.name,
          slug,
          description: input.description || null,
        });
        return { categoryId, slug };
      }),

    // Increment post view count
    incrementViewCount: publicProcedure
      .input(z.object({ slug: z.string() }))
      .mutation(async ({ input }) => {
        const blogDb = await import('../blogDb');
        await blogDb.incrementPostViewCount(input.slug);
        return { success: true };
      }),

    // Record share event
    recordShare: publicProcedure
      .input(z.object({
        slug: z.string(),
        shareType: z.enum(['facebook', 'whatsapp', 'copy_link']),
      }))
      .mutation(async ({ input, ctx }) => {
        const blogDb = await import('../blogDb');
        await blogDb.recordPostShare({
          slug: input.slug,
          shareType: input.shareType,
          userAgent: ctx.req?.headers['user-agent'],
          ipAddress: ctx.req?.ip || ctx.req?.socket?.remoteAddress,
        });
        return { success: true };
      }),

    // Get all posts share statistics (Admin only)
    getAllPostsShareStats: adminProcedure
      .query(async () => {
        const blogDb = await import('../blogDb');
        return await blogDb.getAllPostsShareStats();
      }),

    // Search cards for blog article generation (Admin only)
    searchCardsForBlog: adminProcedure
      .input(z.object({
        query: z.string(),
        limit: z.number().min(1).max(50).optional().default(20),
      }))
      .query(async ({ input }) => {
        const result = await db.searchCards(input.query, input.limit);
        
        // Return card data with latest price
        return result.cards.map((card: any) => ({
          id: card.id,
          name: card.name,
          nameJa: card.nameJa,
          cardNumber: card.cardNumber,
          imageUrl: card.imageUrl,
          latestPrice: card.latestPrice || null,
        }));
      }),

    // Get card details for blog article generation (Admin only)
    getCardDetailsForBlog: adminProcedure
      .input(z.object({
        cardIds: z.array(z.number()),
      }))
      .query(async ({ input }) => {
        // Use articleGenerator's getArticleDataContext for comprehensive card data
        const articleGenerator = await import('../articleGenerator');
        const context = await articleGenerator.getArticleDataContext(input.cardIds, '30d');
        
        // Return full card details with all price statistics
        return context.cards.map(card => ({
          id: card.id,
          name: card.name,
          nameJa: card.nameJa,
          cardNumber: card.cardNumber,
          series: card.series,
          setName: card.setName,
          rarity: card.rarity,
          imageUrl: card.imageUrl,
          // PSA10 price statistics
          psa10Stats: {
            avgPrice: card.psa10Stats.avgPrice,
            minPrice: card.psa10Stats.minPrice,
            maxPrice: card.psa10Stats.maxPrice,
            priceChange7d: card.psa10Stats.priceChange7d,
            priceChange30d: card.psa10Stats.priceChange30d,
            totalVolume: card.psa10Stats.totalVolume,
          },
          // Used Grade A price statistics
          usedStats: {
            avgPrice: card.usedGradeAStats.avgPrice,
            minPrice: card.usedGradeAStats.minPrice,
            maxPrice: card.usedGradeAStats.maxPrice,
            priceChange7d: card.usedGradeAStats.priceChange7d,
            priceChange30d: card.usedGradeAStats.priceChange30d,
            totalVolume: card.usedGradeAStats.totalVolume,
          },
          peakPrice: card.peakPrice,
          peakDate: card.peakDate,
        }));
      }),

    // AI generate article (Admin only)
    generateArticle: adminProcedure
      .input(z.object({
        articleType: z.enum(['daily-report', 'card-analysis', 'market-trend', 'news']),
        featuredImageUrl: z.string().optional(),
        dataInput: z.object({
          cardIds: z.array(z.number()).optional(),
          timeRange: z.enum(['7d', '30d', '60d', 'all']).optional(),
          topic: z.string().optional(),
        }).optional(),
        imageInput: z.object({
          imageUrls: z.array(z.string()),
          extractedText: z.string().optional(),
        }).optional(),
        textInput: z.object({
          content: z.string(),
          topic: z.string(),
        }).optional(),
        urlInput: z.object({
          url: z.string(),
          targetLanguage: z.enum(['zh-TW', 'en', 'ja']).optional(),
        }).optional(),
        options: z.object({
          language: z.enum(['zh-TW', 'en', 'ja']).optional(),
          tone: z.enum(['professional', 'casual', 'technical']).optional(),
          length: z.enum(['short', 'medium', 'long']).optional(),
        }).optional(),
      }))
      .mutation(async ({ input }) => {
        const articleGenerator = await import('../articleGenerator');
        const result = await articleGenerator.generateArticle(input);
        // Add featured image URL to result if provided
        if (input.featuredImageUrl) {
          result.featuredImage = input.featuredImageUrl;
        }
        return result;
      }),

    // Generate theme image using AI (Admin only)
    generateThemeImage: adminProcedure
      .input(z.object({ prompt: z.string() }))
      .mutation(async ({ input }) => {
        const { generateImage } = await import('../_core/imageGeneration');
        const result = await generateImage({ prompt: input.prompt });
        return result;
      }),

    // Get post versions (Admin only)
    getPostVersions: adminProcedure
      .input(z.object({ postId: z.number() }))
      .query(async ({ input }) => {
        const { getDb } = await import('../db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { postVersions, users } = await import('../../drizzle/schema_new');
        const { desc, eq } = await import('drizzle-orm');
        
        const versions = await db.select({
          id: postVersions.id,
          title: postVersions.title,
          excerpt: postVersions.excerpt,
          content: postVersions.content,
          featuredImage: postVersions.featuredImage,
          category: postVersions.category,
          tags: postVersions.tags,
          metaKeywords: postVersions.metaKeywords,
          createdAt: postVersions.createdAt,
          createdByName: users.name,
        })
        .from(postVersions)
        .leftJoin(users, eq(postVersions.createdBy, users.id))
        .where(eq(postVersions.postId, input.postId))
        .orderBy(desc(postVersions.createdAt));
        
        return versions;
      }),

    // Restore post version (Admin only)
    restorePostVersion: adminProcedure
      .input(z.object({ 
        postId: z.number(),
        versionId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { getDb } = await import('../db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { postVersions } = await import('../../drizzle/schema_new');
        const { eq } = await import('drizzle-orm');
        
        // Get version data
        const [version] = await db.select()
          .from(postVersions)
          .where(eq(postVersions.id, input.versionId))
          .limit(1);
        
        if (!version) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' });
        }
        
        // Update post with version data
        const blogDb = await import('../blogDb');
        await blogDb.updatePost(input.postId, {
          title: version.title,
          excerpt: version.excerpt || undefined,
          content: version.content,
          featuredImage: version.featuredImage || undefined,
          category: version.category || undefined,
          metaKeywords: version.metaKeywords || undefined,
        });
        
        // Update tags if available
        if (version.tags) {
          // Note: Tags are stored as comma-separated string in version
          // For simplicity, we skip tag restoration in this version
          // TODO: Implement proper tag restoration if needed
        }
        
        return { success: true };
      }),

    // AI generate metadata (category, tags, SEO keywords) for article (Admin only)
    generateMetadata: adminProcedure
      .input(z.object({
        title: z.string(),
        excerpt: z.string(),
        content: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import('../_core/llm');
        
        // Call LLM to generate metadata
        const response = await invokeLLM({
          messages: [
            { 
              role: 'system', 
              content: `你是 Boxium PTCG 平台的專業 SEO 專家和內容分類師。你的任務是分析文章內容，生成最適合的分類、標籤和 SEO 關鍵字。

平台分類體系（必須從中選擇一個）：
- 市場分析：價格走勢、市場行情、投資分析
- 卡牌評測：單卡深度研究、稿件分析、等級評分
- 市場快報：每日/每週行情、即時動態
- 收藏指南：新手教學、收藏策略、保存建議
- 平台新聞：功能更新、活動公告、平台動態
- 投資指南：投資策略、風險評估、市場預測
- 新品資訊：新卡發布、新包裝資訊、預售資訊
- 社群動態：活動資訊、展覽報導、社群新聞

HK SEO 關鍵字策略：
- 優先使用繁體中文關鍵字（香港用戶主要使用繁體）
- 加入平台相關關鍵字：Boxium、PTCG、香港卡牌市場
- 包含具體卡牌名稱或床型名稱（如文章有提及）
- 包含價格相關關鍵字：PSA 10 價格、HKD 卡牌價格等` 
            },
            { 
              role: 'user', 
              content: `請分析以下文章並生成 metadata：\n\n標題：${input.title}\n\n摘要：${input.excerpt}\n\n內容：\n${input.content.substring(0, 2000)}...\n\n請生成：\n1. 分類（必須從平台分類體系中選擇一個）\n2. 3-5 個相關標籤（繁體中文，如：導導、PSA 10、市場走勢）\n3. 5-8 個 SEO 關鍵字（繁體中文為主，如：香港 PTCG 市場、導導 PSA 10 價格）`
            }
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'article_metadata',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  category: { type: 'string', description: 'Single category for the article' },
                  tags: { 
                    type: 'array', 
                    items: { type: 'string' },
                    description: '3-5 relevant tags'
                  },
                  seoKeywords: { 
                    type: 'array', 
                    items: { type: 'string' },
                    description: '5-8 SEO keywords'
                  },
                },
                required: ['category', 'tags', 'seoKeywords'],
                additionalProperties: false,
              },
            },
          },
        });
        
        const messageContent = response.choices[0]?.message?.content;
        if (!messageContent) {
          throw new Error('生成失敗');
        }
        
        const contentString = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
        const metadata = JSON.parse(contentString || '{}');
        
        return metadata;
      }),

    // AI edit article (Admin only)
    editArticleWithAI: adminProcedure
      .input(z.object({
        article: z.object({
          title: z.string(),
          excerpt: z.string(),
          content: z.string(),
        }),
        instruction: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import('../_core/llm');
        
        // Call LLM to edit the article based on user instruction
        const response = await invokeLLM({
          messages: [
            { 
              role: 'system', 
              content: `你是 Boxium PTCG 平台的資深文章編輯。Boxium PTCG 是香港及台灣最專業的集換式卡牌（TCG）資訊平台，主要面向 Pokemon、遊戲王、Magic: The Gathering 等卡牌的玩家、收藏家及投資者。

編輯原則：
- 繁體中文，香港讀者口吻（自然、專業、有溫度）
- 所有價格統一使用港幣（HKD$）表示
- 保留 TCG 術語不翻譯：PSA 10、CGC 10、GEM-MT 10、BGS 9.5、中古 A 級等
- 保留卡牌官方名稱（英文/日文名稱不翻譯）
- 保持 Markdown 格式（## 標題、**粗體**、列表）
- 數據導向：引用具體數字，避免模糊表達
- 避免過度誇大：不用「最」「絕對」「保證」等字眼
- 維持文章原有結構和風格，只根據指示修改指定部分` 
            },
            { 
              role: 'user', 
              content: `請根據以下指示編輯文章：\n\n編輯指示：${input.instruction}\n\n當前文章：\n標題：${input.article.title}\n\n摘要：${input.article.excerpt}\n\n內容：\n${input.article.content}` 
            }
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'edited_article',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Edited title' },
                  excerpt: { type: 'string', description: 'Edited excerpt' },
                  content: { type: 'string', description: 'Edited content with markdown' }
                },
                required: ['title', 'excerpt', 'content'],
                additionalProperties: false
              }
            }
          }
        });
        
        const editedData = JSON.parse(response.choices[0].message.content as string);
        
        return {
          title: editedData.title,
          excerpt: editedData.excerpt,
          content: editedData.content,
        };
      }),

    // List all uploaded images (Admin only)
    listUploadedImages: adminProcedure
      .input(z.object({
        search: z.string().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        const { getDb } = await import('../db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { uploadedImages, users } = await import('../../drizzle/schema_new');
        const { eq, like, desc } = await import('drizzle-orm');
        
        let query = db.select({
          id: uploadedImages.id,
          url: uploadedImages.url,
          fileKey: uploadedImages.fileKey,
          fileName: uploadedImages.fileName,
          fileSize: uploadedImages.fileSize,
          mimeType: uploadedImages.mimeType,
          uploadedBy: uploadedImages.uploadedBy,
          createdAt: uploadedImages.createdAt,
          uploaderName: users.name,
        })
        .from(uploadedImages)
        .leftJoin(users, eq(uploadedImages.uploadedBy, users.id))
        .orderBy(desc(uploadedImages.createdAt))
        .limit(input.limit)
        .offset(input.offset);
        
        if (input.search) {
          query = query.where(like(uploadedImages.fileName, `%${input.search}%`)) as any;
        }
        
        const images = await query;
        return images;
      }),

    // Delete uploaded image (Admin only)
    deleteUploadedImage: adminProcedure
      .input(z.object({ imageId: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import('../db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { uploadedImages } = await import('../../drizzle/schema_new');
        const { eq } = await import('drizzle-orm');
        
        // TODO: Also delete from S3 if needed
        await db.delete(uploadedImages).where(eq(uploadedImages.id, input.imageId));
        
        return { success: true };
      }),

    // Record uploaded image (Admin only)
    recordUploadedImage: adminProcedure
      .input(z.object({
        url: z.string(),
        fileKey: z.string(),
        fileName: z.string(),
        fileSize: z.number(),
        mimeType: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        
        const { getDb } = await import('../db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { uploadedImages } = await import('../../drizzle/schema_new');
        
        const [image] = await db.insert(uploadedImages).values({
          url: input.url,
          fileKey: input.fileKey,
          fileName: input.fileName,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          uploadedBy: ctx.user.id,
        });
        
        return { success: true, imageId: image.insertId };
      }),
    // Get card images from DB for cover image selection (Admin only)
    getCardImagesForCover: adminProcedure
      .input(z.object({
        query: z.string().optional(),
        limit: z.number().min(1).max(20).default(8),
      }))
      .query(async ({ input }) => {
        const { getDb } = await import('../db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { cards } = await import('../../drizzle/schema_new');
        const { desc, like, and, isNotNull, ne } = await import('drizzle-orm');

        if (input.query) {
          const results = await db.select({
            id: cards.id,
            name: cards.name,
            nameJa: cards.nameJa,
            rarity: cards.rarity,
            setName: cards.setName,
            imageUrl: cards.imageUrl,
            imageUrlHiRes: cards.imageUrlHiRes,
          })
          .from(cards)
          .where(and(
            like(cards.name, `%${input.query}%`),
            isNotNull(cards.imageUrl),
            ne(cards.imageUrl, ''),
          ))
          .orderBy(desc(cards.updatedAt))
          .limit(input.limit);
          return results;
        }

        // Default: trending cards with images
        try {
          const { getTrendingByPriceIncrease } = await import('../db');
          const trending = await getTrendingByPriceIncrease({ limit: input.limit, days: 30 });
          const trendingWithImages = trending
            .filter((c: any) => c.imageUrl || c.imageUrlHiRes)
            .map((c: any) => ({
              id: c.id,
              name: c.name,
              nameJa: c.nameJa,
              rarity: c.rarity,
              setName: c.setName,
              imageUrl: c.imageUrl,
              imageUrlHiRes: c.imageUrlHiRes,
              priceChangePercent: c.priceChangePercent,
            }));
          if (trendingWithImages.length >= 4) return trendingWithImages.slice(0, input.limit);
        } catch (_) { /* fallback */ }

        // Fallback: latest cards with images
        const fallback = await db.select({
          id: cards.id,
          name: cards.name,
          nameJa: cards.nameJa,
          rarity: cards.rarity,
          setName: cards.setName,
          imageUrl: cards.imageUrl,
          imageUrlHiRes: cards.imageUrlHiRes,
        })
        .from(cards)
        .where(and(isNotNull(cards.imageUrl), ne(cards.imageUrl, '')))
        .orderBy(desc(cards.updatedAt))
        .limit(input.limit);
        return fallback;
      }),
    // Auto-extract card names from article content and match from DB (Admin only)
    extractCardsFromArticle: adminProcedure
      .input(z.object({
        articleContent: z.string(),
        articleTitle: z.string().optional(),
        limit: z.number().min(1).max(6).default(4),
      }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import('../_core/llm');
        const { getDb } = await import('../db');
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { cards } = await import('../../drizzle/schema_new');
        const { like, and, isNotNull, ne, or } = await import('drizzle-orm');

        // Step 1: Use LLM to extract card names from article
        const extractionResponse = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: 'You are a Pokemon TCG expert. Extract all specific Pokemon card names mentioned in the article. Return ONLY a JSON array of card name strings. Include the card variant/set info if mentioned (e.g. "Charizard EX SR", "Flareon EX RR"). Return maximum 6 cards, prioritize the most prominently featured ones.',
            },
            {
              role: 'user',
              content: `Extract Pokemon card names from this article:\n\nTitle: ${input.articleTitle || ''}\n\nContent: ${input.articleContent.slice(0, 3000)}`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'card_names',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  cardNames: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of Pokemon card names mentioned in the article',
                  },
                },
                required: ['cardNames'],
                additionalProperties: false,
              },
            },
          },
        });

        let extractedNames: string[] = [];
        try {
          const parsed = JSON.parse(extractionResponse.choices[0].message.content as string);
          extractedNames = parsed.cardNames || [];
        } catch (_) {
          extractedNames = [];
        }

        if (extractedNames.length === 0) {
          // Fallback: return trending cards
          const { getTrendingByPriceIncrease } = await import('../db');
          const trending = await getTrendingByPriceIncrease({ limit: input.limit, days: 30 });
          return trending
            .filter((c: any) => c.imageUrl || c.imageUrlHiRes)
            .slice(0, input.limit)
            .map((c: any) => ({
              id: c.id,
              name: c.name,
              nameJa: c.nameJa,
              rarity: c.rarity,
              setName: c.setName,
              imageUrl: c.imageUrl,
              imageUrlHiRes: c.imageUrlHiRes,
              matchedFrom: 'trending' as const,
            }));
        }

        // Step 2: Match each extracted name against DB
        const matchedCards: any[] = [];
        for (const cardName of extractedNames.slice(0, input.limit)) {
          // Try to find exact or close match
          const nameParts = cardName.split(/[\s\[\]()]+/).filter(p => p.length > 2);
          const searchTerms = nameParts.slice(0, 2); // Use first 2 meaningful parts
          if (searchTerms.length === 0) continue;

          const conditions = searchTerms.map(term => like(cards.name, `%${term}%`));
          const results = await dbConn.select({
            id: cards.id,
            name: cards.name,
            nameJa: cards.nameJa,
            rarity: cards.rarity,
            setName: cards.setName,
            imageUrl: cards.imageUrl,
            imageUrlHiRes: cards.imageUrlHiRes,
          })
          .from(cards)
          .where(and(
            isNotNull(cards.imageUrl),
            ne(cards.imageUrl, ''),
            or(...conditions),
          ))
          .limit(1);

          if (results.length > 0) {
            const card = results[0];
            if (!matchedCards.find(c => c.id === card.id)) {
              matchedCards.push({ ...card, matchedFrom: 'article' as const });
            }
          }
        }

        // If we didn't find enough, pad with trending cards
        if (matchedCards.length < Math.min(input.limit, 3)) {
          const { getTrendingByPriceIncrease } = await import('../db');
          const trending = await getTrendingByPriceIncrease({ limit: 6, days: 30 });
          for (const t of trending) {
            if (matchedCards.length >= input.limit) break;
            if (!matchedCards.find((c: any) => c.id === (t as any).id) && ((t as any).imageUrl || (t as any).imageUrlHiRes)) {
              matchedCards.push({ ...(t as any), matchedFrom: 'trending' as const });
            }
          }
        }

        return matchedCards.slice(0, input.limit);
      }),

    // Generate AI cover image using card images as reference (Admin only)
    generateCoverImage: adminProcedure
      .input(z.object({
        articleTitle: z.string(),
        articleType: z.string(),
        cardImageUrls: z.array(z.string()).min(1).max(4),
        cardNames: z.array(z.string()).optional(),
        style: z.enum(['market-report', 'card-analysis', 'guide', 'news', 'custom']).default('market-report'),
        customStyleDesc: z.string().max(500).optional(), // Free-text style description for 'custom' mode
        referenceImageUrl: z.string().url().optional(),  // Optional reference image URL for style analysis
      }))
      .mutation(async ({ input }) => {
        const { generateImage } = await import('../_core/imageGeneration');
        const cardNamesStr = (input.cardNames || []).slice(0, 3).join(', ') || 'Pokemon TCG cards';
        const cardCount = input.cardImageUrls.length;

        // ─── PROFESSIONAL STYLE GUIDES v2 ─────────────────────────────────
        // Each style is a complete cinematic art direction brief.
        // Designed for maximum visual impact and brand consistency.
        const styleGuides: Record<string, string> = {

          // ── MARKET REPORT ── Financial power meets collector culture
          'market-report': `
STYLE IDENTITY: "Bloomberg Terminal meets Pokémon TCG" — the authoritative voice of the market.

CANVAS: 1920×1080px, 16:9 ratio. Pure cinematic widescreen.

BACKGROUND CONSTRUCTION:
- Base layer: Deep navy-to-black gradient (#06038D → #000820), top-left to bottom-right.
- Mid layer: Subtle hexagonal honeycomb grid at 4% opacity, suggesting data infrastructure.
- Accent layer: Thin horizontal scan lines at 2% opacity (like a Bloomberg terminal).
- Depth layer: A faint radial glow of electric blue (#0066FF) at 15% opacity centered behind the cards.

LIGHTING SYSTEM:
- PRIMARY: Two dramatic volumetric god-ray beams in gold-yellow (#FEDD00) emanating from bottom-left corner at 35° angle, traveling across the full image. Each beam is 80px wide with soft feathered edges and 60% opacity.
- SECONDARY: Ambient fill light in cool blue (#001AFF) at 20% intensity from top-right, creating depth.
- CARD LIGHTING: Each card receives a sharp specular highlight on its top-left edge (white, 90% opacity, 3px wide) simulating studio strobe.

CARD PRESENTATION (${cardCount} card${cardCount > 1 ? 's' : ''}):
- Arrangement: Dynamic diagonal cascade on the RIGHT HALF of the frame (x: 55%–95%).
- Primary card: Largest, front-most, 45% frame height, rotated +8°, positioned at x:72%, y:50%.
- Secondary card (if present): 35% frame height, rotated -5°, positioned at x:60%, y:45%, partially behind primary.
- Tertiary card (if present): 28% frame height, rotated +12°, positioned at x:82%, y:55%, partially behind primary.
- Each card surface: Holographic rainbow shimmer effect (iridescent overlay at 25% opacity), intense specular glare on top edge.
- Behind each card: Soft golden halo glow (#FEDD00 at 30% opacity, 40px blur radius).
- Cards bleed 5% off the right edge for dynamism.

ATMOSPHERE:
- 200+ tiny golden particle specks (#FEDD00, 1–3px, varying opacity 20–80%) scattered across the image, denser near the cards.
- 3 subtle lens flare artifacts (hexagonal aperture shape) in the god-ray path.
- Depth-of-field: Background elements slightly defocused (2px blur).

COMPOSITION LAW:
- LEFT 45% of frame: COMPLETELY CLEAR dark space. No cards, no particles, no decorative elements. This is the text overlay zone.
- The visual weight must pull the eye from left-to-right, from darkness to light.

QUALITY: Photorealistic 8K render quality. Cards must look like physical objects under professional studio lighting.`,

          // ── CARD ANALYSIS ── Museum-grade luxury showcase
          'card-analysis': `
STYLE IDENTITY: "Christie's Auction House meets PSA Grading Lab" — the pinnacle of collector prestige.

CANVAS: 1920×1080px, 16:9 ratio.

BACKGROUND CONSTRUCTION:
- Base layer: Near-black (#080810) with a very subtle dark purple vignette at the edges (radial gradient, #1a0a2e at 40% opacity).
- Texture layer: Ultra-fine diagonal crosshatch at 2% opacity, suggesting premium paper or fabric.
- Depth layer: A single large soft radial glow of deep indigo (#2D1B69) at 20% opacity, centered at x:65%, y:50%.

LIGHTING SYSTEM:
- PRIMARY: Single theatrical spotlight from directly above (top-center), creating a dramatic cone of light 400px wide at the card surface. Sharp falloff to deep shadow.
- SECONDARY: Subtle rim light in electric blue-white (#C8E6FF) along the right edge of the hero card (3px wide, 70% opacity).
- REFLECTION: The card casts a perfect mirror reflection on a dark glass surface below it (reflection at 35% opacity, slightly blurred).
- AMBIENT: Deep, rich shadows with almost no fill light — maximum contrast and drama.

CARD PRESENTATION (${cardCount} card${cardCount > 1 ? 's' : ''}):
- Hero card: Perfectly flat-on (0° rotation), centered at x:65%, y:48%, 55% frame height. Museum display quality.
- If 2+ cards: Second card partially visible behind hero (x:58%, y:52%, 35% frame height, 10° rotation, 50% opacity).
- If 3 cards: Third card barely visible as a ghost (x:72%, y:52%, 25% frame height, -8° rotation, 30% opacity).
- Card surface: Ultra-sharp detail, microscopic holographic foil texture visible on card surface.
- Around card edges: 15–20 microscopic sparkle particles (#FFFFFF, 1–2px) suggesting extreme rarity.
- Card shadow: Long, soft shadow cast to the bottom-right (45° angle, 60px blur, 50% opacity).

ATMOSPHERE:
- Thin wisps of atmospheric haze (white, 5% opacity) drifting across the lower third.
- The overall mood is hushed, reverent, like a museum at night.

COMPOSITION LAW:
- LEFT 42% of frame: COMPLETELY CLEAR dark space for text overlay.
- The single hero card is the undisputed focal point — nothing competes with it.

QUALITY: Studio product photography quality. Every pixel of the card artwork must be crisp and faithful.`,

          // ── GUIDE ── Welcoming, modern, educational
          'guide': `
STYLE IDENTITY: "Apple Education meets TCG Community" — approachable expertise, clean and trustworthy.

CANVAS: 1920×1080px, 16:9 ratio.

BACKGROUND CONSTRUCTION:
- Base layer: Deep slate blue (#1A1F2E) to dark teal (#0d1a24) gradient, top to bottom.
- Geometric layer: 3–4 large, very subtle rounded rectangles (outline only, 4% opacity, teal #00D4AA) at various rotations, creating a modern geometric feel.
- Warm accent: A gentle warm glow (#FF8C42 at 8% opacity) at the bottom-center, suggesting warmth and welcome.

LIGHTING SYSTEM:
- PRIMARY: Soft, diffused overhead lighting — no harsh shadows. Even, friendly illumination.
- CARD LIGHTING: Clean, even studio lighting on cards. Soft drop shadows (20px blur, 30% opacity).
- ACCENT: Subtle teal (#00D4AA) edge glow on the primary card (2px, 50% opacity).

CARD PRESENTATION (${cardCount} card${cardCount > 1 ? 's' : ''}):
- Arrangement: Gentle fan/spread on the RIGHT side (x: 55%–90%), cards fanned out at -10°, 0°, +10° rotations.
- Primary card: Front and center of the fan, 42% frame height, clean and clear.
- Cards slightly elevated with clean drop shadows, as if laid on a clean table.
- Card surfaces: Clean, no special effects — just crisp, clear artwork.
- Between cards: Small teal sparkle dots (#00D4AA, 2px) suggesting learning and discovery.

ATMOSPHERE:
- 8–10 soft bokeh circles (teal and white, 20–60px diameter, 15–25% opacity) in the background.
- Clean, airy, modern feel. No darkness, no drama — just clarity.

COMPOSITION LAW:
- LEFT 45% of frame: COMPLETELY CLEAR for text overlay.
- The overall feel must be inviting and non-intimidating for newcomers.

QUALITY: Clean editorial illustration quality. Professional but warm and accessible.`,

          // ── NEWS ── Urgency, impact, breaking moment
          'news': `
STYLE IDENTITY: "Reuters Breaking News meets TCG Hype Drop" — first-to-know urgency and raw excitement.

CANVAS: 1920×1080px, 16:9 ratio.

BACKGROUND CONSTRUCTION:
- Base layer: Very dark charcoal (#0D0D0D) to near-black (#050505).
- Edge layer: Subtle dark red-orange vignette at all four corners (#3D0000 at 25% opacity).
- Energy layer: 5–7 sharp diagonal speed lines (white, 1px, 15% opacity) sweeping from bottom-left to top-right, suggesting motion and urgency.
- Tension layer: A faint radial burst pattern (like a shockwave) centered behind the main card, in deep red (#8B0000 at 20% opacity).

LIGHTING SYSTEM:
- PRIMARY: High-contrast, hard directional light from top-left (45° angle). Creates dramatic shadows and highlights.
- CARD LIGHTING: Harsh, high-contrast lighting. Strong specular highlight on top-left edge (white, 100% opacity, 4px).
- ACCENT: Bright red (#FF2D2D) rim light on the right edge of the primary card (3px, 80% opacity).
- URGENCY GLOW: A red-orange energy burst (#FF4500 at 35% opacity, 80px blur) emanating from directly behind the primary card.

CARD PRESENTATION (${cardCount} card${cardCount > 1 ? 's' : ''}):
- Primary card: Dynamic tilt at +15° rotation, positioned at x:68%, y:48%, 48% frame height. Slight motion blur on edges (2px directional blur in the direction of tilt).
- Secondary card (if present): Behind primary, -10° rotation, x:58%, y:52%, 35% frame height, 60% opacity.
- Cards feel like they are in motion, just captured at a dramatic moment.
- Energy lines: 3–4 sharp white speed lines (1px, 40% opacity) radiating from behind the primary card.

ATMOSPHERE:
- 3–4 sharp debris/spark particles (white, 2–4px, 60% opacity) near the cards.
- The mood is electric, urgent, "you need to see this NOW".

COMPOSITION LAW:
- LEFT 45% of frame: COMPLETELY CLEAR dark space for text overlay.
- The image must create an immediate sense of urgency and importance.

QUALITY: High-impact graphic design quality. Bold, punchy, attention-commanding.`,
        };

        // ── CUSTOM STYLE GUIDE ─────────────────────────────────────────────
        // Build a dynamic art direction brief from the admin's free-text description
        // and/or a reference image they uploaded for style analysis.
        let customStyleGuide = '';
        if (input.style === 'custom') {
          const descPart = input.customStyleDesc?.trim()
            ? `ADMIN-SPECIFIED STYLE DESCRIPTION: "${input.customStyleDesc.trim()}"

Interpret this description as a complete art direction brief. Extract:
- Color palette and mood (e.g., warm pastels, neon cyberpunk, ink wash)
- Lighting style (e.g., soft diffused, dramatic rim light, flat manga shading)
- Compositional energy (e.g., dynamic action, serene display, editorial clean)
- Texture and material language (e.g., watercolor paper, cel-shaded, photorealistic)
- Cultural/genre references (e.g., anime, Western editorial, Hong Kong street style)

Apply this style language to the Pokémon TCG card showcase while maintaining:
- Professional quality suitable for a premium TCG media platform
- 16:9 widescreen canvas
- LEFT 40–45% of frame kept as clean negative space for text overlay
- Cards as the hero visual elements`
            : `STYLE: Versatile premium editorial — clean dark background, dramatic card lighting, professional composition.`;

          const refPart = input.referenceImageUrl
            ? `\n\nREFERENCE IMAGE PROVIDED: The admin has uploaded a reference image to guide the visual style. Analyze it carefully and extract:
- Dominant color palette and tonal range
- Lighting quality and direction
- Compositional structure and visual hierarchy
- Texture, grain, or material qualities
- Overall mood and atmosphere
Then apply these extracted style elements to the Pokémon TCG cover image.`
            : '';

          customStyleGuide = `${descPart}${refPart}

CANVAS: 1920×1080px, 16:9 ratio.
COMPOSITION LAW: LEFT 40–45% of frame COMPLETELY CLEAR dark space for text overlay. Cards on the right half.`;
        }

        const styleGuide = input.style === 'custom' ? customStyleGuide : (styleGuides[input.style] || styleGuides['market-report']);
        const styleLabel = input.style === 'custom'
          ? `CUSTOM (${input.customStyleDesc?.slice(0, 40) || 'Admin-defined'})`
          : input.style.toUpperCase().replace('-', ' ');

        const prompt = `You are a world-class digital art director creating a professional cover image for "Boxium PTCG" — Hong Kong's premier Pokémon TCG market intelligence platform.

ARTICLE: "${input.articleTitle}"
FEATURED CARDS: ${cardNamesStr}
COVER STYLE: ${styleLabel}

═══════════════════════════════════════════
ART DIRECTION BRIEF:
═══════════════════════════════════════════
${styleGuide}

═══════════════════════════════════════════
BRAND WATERMARK — MANDATORY, NON-NEGOTIABLE:
═══════════════════════════════════════════
Bottom-right corner placement:
- Line 1: "BOXIUM" — bold, wide-tracked capital letters, clean modern sans-serif
- Line 2: "PTCG" — smaller, same typeface, centered below "BOXIUM"
- Both lines: White at 75% opacity
- Background: Semi-transparent dark pill shape (12px padding H, 8px padding V, #000000 at 50% opacity, 6px border-radius)
- Sizing: BOXIUM = ~22px equivalent, PTCG = ~14px equivalent at 1080p
- Position: 20px from right edge, 20px from bottom edge
- This watermark MUST appear on EVERY generated image, no exceptions.

═══════════════════════════════════════════
UNBREAKABLE RULES:
═══════════════════════════════════════════
1. The Pokémon card artwork from the provided reference images MUST be the hero elements — clearly visible, recognizable, and faithful to the original artwork.
2. Card proportions must be maintained — no stretching, squishing, or distorting the cards.
3. The LEFT 40–45% of the image MUST remain as clean, dark negative space — no cards, no major decorative elements. This zone is reserved for text overlay in post-production.
4. NO text of any kind except the BOXIUM PTCG brand watermark.
5. The final image must look like it belongs on a premium TCG media platform — not a generic stock photo.
6. Overall dimensions and aspect ratio: 16:9 widescreen.`;

        const originalImages: Array<{ url: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }> = [
          ...input.cardImageUrls.slice(0, 3).map(url => ({ url, mimeType: 'image/jpeg' as const })),
          // Append reference image last (if provided in custom mode) so AI can analyze its style
          ...(input.style === 'custom' && input.referenceImageUrl
            ? [{ url: input.referenceImageUrl, mimeType: 'image/jpeg' as const }]
            : []),
        ];
        const result = await generateImage({ prompt, originalImages });
        return { url: result.url, prompt };
      }),
});
