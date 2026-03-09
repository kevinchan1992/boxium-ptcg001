import { marketplaceRouter } from "./routers/marketplace";
import { notificationsRouter } from "./routers/notifications";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, adminProcedure, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { extractSnkrdunkId, scrapeSnkrdunkPage, convertJpyToHkd } from "./snkrdunkScraper";
import { downloadAndEncodeImage, getBestImageUrl } from "./imageUtils";
import { getUpdateStatus, manualUpdateDataSource, getSchedulerStatus, triggerManualUpdateAll } from "./scheduler";
import { executePersistentSnkrdunkBatchUpdate } from "./persistentSnkrdunkBatchUpdate";
import * as batchTaskManager from "./batchTaskManager";
import { restartScheduler } from "./batchUpdateScheduler";
import { restartPriceUpdateScheduler } from "./priceUpdateScheduler";
import { pricingRouter } from "./routers/pricing";
import { templatesRouter } from "./routers/templates";
import { diagnosticsRouter } from "./routers/diagnostics";

export const appRouter = router({
  system: systemRouter,

  pricing: pricingRouter,

  diagnostics: diagnosticsRouter,

  products: router({
    getById: publicProcedure
      .input(z.object({
        id: z.number(),
        productType: z.enum(['single_card', 'sealed_product']).optional(),
      }))
      .query(async ({ input }) => {
        const product = await db.getProductById(input.id, input.productType);
        return product || null;
      }),

    search: publicProcedure
      .input(z.object({
        query: z.string(),
        limit: z.number().optional().default(20),
        offset: z.number().optional().default(0),
      }))
      .query(async ({ input }) => {
        // Search both cards and sealed products
        const [cardsResult, sealedResult] = await Promise.all([
          db.searchCards(input.query, input.limit, input.offset),
          db.searchSealedProducts(input.query, input.limit, input.offset),
        ]);

        // Merge results with productType tag
        const cardItems = cardsResult.cards.map(c => ({
          id: c.id,
          name: c.name,
          nameJa: c.nameJa,
          imageUrl: c.imageUrl,
          latestPrice: c.latestPrice,
          productType: 'single_card' as const,
          cardNumber: c.cardNumber,
          rarity: c.rarity,
          series: c.series,
          boxType: null,
        }));

        const sealedItems = sealedResult.products.map(p => ({
          id: p.id,
          name: p.name,
          nameJa: p.nameJa,
          imageUrl: p.imageUrl,
          latestPrice: p.latestPrice,
          productType: 'sealed_product' as const,
          cardNumber: null,
          rarity: null,
          series: p.series,
          boxType: p.boxType,
        }));

        // Combine and sort by price (highest first)
        const allItems = [...cardItems, ...sealedItems].sort((a, b) => {
          const priceA = a.latestPrice || 0;
          const priceB = b.latestPrice || 0;
          return priceB - priceA;
        });

        return {
          items: allItems.slice(0, input.limit),
          total: cardsResult.total + sealedResult.total,
        };
      }),

    getPriceHistory: publicProcedure
      .input(z.object({
        productId: z.number(),
        productType: z.enum(['single_card', 'sealed_product']),
        source: z.enum(['snkrdunk', 'ebay', 'tcgplayer', 'other']).optional(),
        grade: z.string().optional(),
        limit: z.number().optional().default(50),
        days: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const history = await db.getPriceHistory(
          input.productId,
          input.source,
          input.grade,
          input.limit,
          input.days
        );
        // Filter by productType
        return history.filter(h => h.productType === input.productType);
      }),

    getPriceTrendData: publicProcedure
      .input(z.object({
        productId: z.number(),
        productType: z.enum(['single_card', 'sealed_product']),
        days: z.number().optional().default(90),
      }))
      .query(async ({ input }) => {
        try {
          // Get product info
          const product = await db.getProductById(input.productId, input.productType);
          if (!product) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });
          }

          // Get all price history for this product
          const allHistory = await db.getPriceHistoryByCardId(input.productId);
          // Filter by productType
          const productHistory = allHistory.filter(h => h.productType === input.productType);

          if (input.productType === 'sealed_product') {
            // For sealed products: group by date, show all prices (no grade filter)
            const recentHistory = input.days > 0
              ? (() => {
                  const cutoffDate = new Date();
                  cutoffDate.setDate(cutoffDate.getDate() - input.days);
                  return productHistory.filter(record =>
                    new Date(record.soldAt || record.createdAt) >= cutoffDate
                  );
                })()
              : productHistory;

            const groupedByDate = new Map<string, any[]>();
            for (const record of recentHistory) {
              if (record.source !== 'snkrdunk') continue;
              const date = new Date(record.soldAt || record.createdAt);
              const dateStr = date.toISOString().split('T')[0];
              if (!groupedByDate.has(dateStr)) groupedByDate.set(dateStr, []);
              groupedByDate.get(dateStr)!.push(record);
            }

            const trendData = Array.from(groupedByDate.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, records]) => {
                const prices = records.map(r => parseFloat(r.price));
                return {
                  date,
                  snkrdunkPrice: prices.length > 0
                    ? prices.reduce((a, b) => a + b, 0) / prices.length
                    : undefined,
                  snkrdunkCount: prices.length,
                };
              });

            const allPrices = recentHistory
              .filter(r => r.source === 'snkrdunk')
              .map(r => parseFloat(r.price));

            const stats = {
              snkrdunk: allPrices.length > 0 ? {
                minPrice: Math.min(...allPrices),
                maxPrice: Math.max(...allPrices),
                avgPrice: allPrices.reduce((a, b) => a + b, 0) / allPrices.length,
                latestPrice: parseFloat(recentHistory
                  .filter(r => r.source === 'snkrdunk')
                  .sort((a: any, b: any) => new Date(b.soldAt || b.createdAt).getTime() - new Date(a.soldAt || a.createdAt).getTime())[0]?.price || '0'),
              } : { minPrice: 0, maxPrice: 0, avgPrice: 0, latestPrice: 0 },
            };

            return {
              cardId: product.id,
              cardName: product.name,
              productType: 'sealed_product' as const,
              trendData,
              stats,
            };
          } else {
            // For single cards: existing PSA 10 logic
            const recentHistory = input.days > 0
              ? (() => {
                  const cutoffDate = new Date();
                  cutoffDate.setDate(cutoffDate.getDate() - input.days);
                  return productHistory.filter(record =>
                    new Date(record.soldAt || record.createdAt) >= cutoffDate &&
                    (record.grade === 'PSA 10' || record.grade === 'PSA10')
                  );
                })()
              : productHistory.filter(record =>
                  (record.grade === 'PSA 10' || record.grade === 'PSA10')
                );

            const groupedByDate = new Map<string, any[]>();
            for (const record of recentHistory) {
              if (record.grade !== 'PSA 10' && record.grade !== 'PSA10') continue;
              if (record.source !== 'snkrdunk') continue;
              const date = new Date(record.soldAt || record.createdAt);
              const dateStr = date.toISOString().split('T')[0];
              if (!groupedByDate.has(dateStr)) groupedByDate.set(dateStr, []);
              groupedByDate.get(dateStr)!.push(record);
            }

            const trendData = Array.from(groupedByDate.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, records]) => {
                const prices = records.map(r => parseFloat(r.price));
                return {
                  date,
                  snkrdunkPrice: prices.length > 0
                    ? prices.reduce((a, b) => a + b, 0) / prices.length
                    : undefined,
                  snkrdunkCount: prices.length,
                };
              });

            const allSnkrdunkPrices = recentHistory
              .filter(r => r.source === 'snkrdunk')
              .map(r => parseFloat(r.price));

            const stats = {
              snkrdunk: allSnkrdunkPrices.length > 0 ? {
                minPrice: Math.min(...allSnkrdunkPrices),
                maxPrice: Math.max(...allSnkrdunkPrices),
                avgPrice: allSnkrdunkPrices.reduce((a, b) => a + b, 0) / allSnkrdunkPrices.length,
                latestPrice: parseFloat(recentHistory
                  .filter(r => r.source === 'snkrdunk')
                  .sort((a: any, b: any) => new Date(b.soldAt || b.createdAt).getTime() - new Date(a.soldAt || a.createdAt).getTime())[0]?.price || '0'),
              } : { minPrice: 0, maxPrice: 0, avgPrice: 0, latestPrice: 0 },
            };

            return {
              cardId: product.id,
              cardName: product.name,
              productType: 'single_card' as const,
              trendData,
              stats,
            };
          }
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to get price trend data: ${error.message}`,
          });
        }
      }),
  }),

  auth: router({
    me: publicProcedure
      .query(async ({ ctx }) => {
        console.log('[Auth.me] Checking current user...');
        console.log('[Auth.me] ctx.user exists:', !!ctx.user);
        if (ctx.user) {
          console.log('[Auth.me] User found:', {
            id: ctx.user.id,
            email: ctx.user.email,
            role: ctx.user.role,
          });
        } else {
          console.log('[Auth.me] No user in context');
        }
        return ctx.user || null;
      }),
    
    register: publicProcedure
      .input(z.object({
        email: z.string().trim().toLowerCase().email(),
        password: z.string().min(8),
        name: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { registerUser } = await import('./auth');
        const result = await registerUser(input.email, input.password, input.name);
        
        if (!result.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: result.error || '註冊失敗',
          });
        }
        
        // Set session cookie for automatic login after registration
        if (result.token && ctx.res && ctx.req) {
          ctx.res.cookie('session', result.token, getSessionCookieOptions(ctx.req));
        }
        
        return {
          success: true,
          user: result.user,
          token: result.token,
        };
      }),
    
    login: publicProcedure
      .input(z.object({
        email: z.string().trim().toLowerCase().email(),
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        console.log('[Login API] Starting login process for:', input.email);
        console.log('[Login API] ctx.req exists:', !!ctx.req);
        console.log('[Login API] ctx.res exists:', !!ctx.res);
        
        const { loginUser } = await import('./auth');
        const result = await loginUser(input.email, input.password);
        
        console.log('[Login API] Login result:', {
          success: result.success,
          hasToken: !!result.token,
          hasUser: !!result.user,
          userId: result.user?.id,
        });
        
        if (!result.success) {
          console.log('[Login API] Login failed:', result.error);
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: result.error || '登入失敗',
          });
        }
        
        // Set session cookie
        if (result.token && ctx.res && ctx.req) {
          console.log('[Login API] Setting session cookie...');
          const cookieOptions = getSessionCookieOptions(ctx.req);
          console.log('[Login API] Cookie options:', cookieOptions);
          ctx.res.cookie('session', result.token, cookieOptions);
          console.log('[Login API] Session cookie set successfully');
        } else {
          console.warn('[Login API] Cannot set cookie - missing token, req, or res:', {
            hasToken: !!result.token,
            hasReq: !!ctx.req,
            hasRes: !!ctx.res,
          });
        }
        
        return {
          success: true,
          user: result.user,
          token: result.token,
        };
      }),
    
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(100).optional(),
        phone: z.string().max(30).optional().nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import('./db');
        const drizzleDb = await getDb();
        if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '資料庫連線失敗' });
        const updateData: Record<string, any> = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.phone !== undefined) updateData.phone = input.phone;
        if (Object.keys(updateData).length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: '沒有需要更新的資料' });
        const { users: usersTable } = await import('../drizzle/schema_new');
        const { eq: eqOp } = await import('drizzle-orm');
        await drizzleDb.update(usersTable).set(updateData).where(eqOp(usersTable.id, ctx.user.id));
        const rows = await drizzleDb.select().from(usersTable).where(eqOp(usersTable.id, ctx.user.id)).limit(1);
        return rows[0] || null;
      }),
    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8, '密碼至少需要 8 個字元'),
      }))
      .mutation(async ({ input, ctx }) => {
        const bcrypt = await import('bcrypt');
        const { getDb } = await import('./db');
        const drizzleDb = await getDb();
        if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '資料庫連線失敗' });
        const { users: usersTable } = await import('../drizzle/schema_new');
        const { eq: eqOp } = await import('drizzle-orm');
        const userRows = await drizzleDb.select().from(usersTable).where(eqOp(usersTable.id, ctx.user.id)).limit(1);
        const user = userRows[0];
        if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: '用戶不存在' });
        if (!user.passwordHash) throw new TRPCError({ code: 'BAD_REQUEST', message: '您的帳號使用第三方登入，無法修改密碼' });
        const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
        if (!isValid) throw new TRPCError({ code: 'UNAUTHORIZED', message: '現有密碼不正確' });
        const newHash = await bcrypt.hash(input.newPassword, 12);
        await drizzleDb.update(usersTable).set({ passwordHash: newHash }).where(eqOp(usersTable.id, ctx.user.id));
        return { success: true };
      }),
    logout: publicProcedure
      .mutation(async ({ ctx }) => {
        console.log('[Logout API] Clearing session cookie...');
        
        if (ctx.res) {
          // Clear session cookie
          ctx.res.clearCookie('session', {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
          });
          console.log('[Logout API] Session cookie cleared');
        } else {
          console.warn('[Logout API] Cannot clear cookie - ctx.res is missing');
        }
        
        return { success: true };
      }),
  }),

  cards: router({
    search: publicProcedure
      .input(z.object({
        query: z.string(),
        limit: z.number().optional().default(20),
        offset: z.number().optional().default(0),
      }))
      .query(async ({ input }) => {
        const results = await db.searchCards(input.query, input.limit, input.offset);
        return results;
      }),

    /**
     * Fuzzy query suggestion: when a search returns 0 results, suggest
     * alternative queries by decomposing the input (e.g. extract the numeric
     * part, try canonical card-number forms, strip extra words).
     *
     * Returns an array of { query, label } objects that the frontend can
     * display as "Did you mean: SM-P 288?" chips.
     */
    suggestQuery: publicProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ input }) => {
        const { parseCardNumber, normalizeCardQuery } = await import('./utils/cardNumberNormalize');
        const raw = input.query.trim();
        if (!raw) return { suggestions: [] };

        const suggestions: { query: string; label: string }[] = [];
        const seen = new Set<string>();

        const addSuggestion = (q: string, label: string) => {
          if (q && q !== raw && !seen.has(q)) {
            seen.add(q);
            suggestions.push({ query: q, label });
          }
        };

        // 1. Canonical card-number form (e.g. "288 sm-p" → "SM-P 288")
        const canonical = normalizeCardQuery(raw);
        if (canonical !== raw) {
          addSuggestion(canonical, canonical);
        }

        // 2. Parsed parts: number-only and set-code-only
        const parts = parseCardNumber(raw);
        if (parts) {
          if (parts.number) {
            addSuggestion(parts.number, parts.number);
          }
          if (parts.setCode && parts.number) {
            // Alternative separator forms
            addSuggestion(`${parts.number}/${parts.setCode}`, `${parts.number}/${parts.setCode}`);
            addSuggestion(`${parts.setCode} ${parts.number}`, `${parts.setCode} ${parts.number}`);
          }
          if (parts.setCode) {
            addSuggestion(parts.setCode, parts.setCode);
          }
        }

        // 3. Extract any number sequence from free-text (e.g. "pikachu 288" → "288")
        const numberMatch = raw.match(/(\d{2,4})/);
        if (numberMatch) {
          addSuggestion(numberMatch[1], numberMatch[1]);
        }

        // 4. Try first word only (handles "pikachu promo" → "pikachu")
        const words = raw.split(/\s+/);
        if (words.length > 1) {
          addSuggestion(words[0], words[0]);
        }

        // Verify each suggestion actually returns results (up to 3 checks)
        const verified: { query: string; label: string }[] = [];
        for (const s of suggestions.slice(0, 6)) {
          if (verified.length >= 3) break;
          const result = await db.searchCards(s.query, 1, 0);
          if (result.total > 0) {
            verified.push(s);
          }
        }

        return { suggestions: verified };
      }),

    getById: publicProcedure
      .input(z.object({
        id: z.number(),
      }))
      .query(async ({ input }) => {
        const card = await db.getCardById(input.id);
        return card;
      }),

    getByCardId: publicProcedure
      .input(z.object({
        cardId: z.string(),
      }))
      .query(async ({ input }) => {
        const card = await db.getCardByCardId(input.cardId);
        return card;
      }),

    getDataSource: publicProcedure
      .input(z.object({
        cardId: z.number(),
        source: z.enum(["snkrdunk", "ebay", "tcgplayer", "other"]),
      }))
      .query(async ({ input }) => {
        const dataSource = await db.getDataSourceByCardIdAndSource(input.cardId, input.source);
        return dataSource;
      }),

    getPopular: publicProcedure
      .input(z.object({
        limit: z.number().optional().default(10),
      }))
      .query(async ({ input }) => {
        const cards = await db.getPopularCards(input.limit);
        return cards;
      }),

    getStats: publicProcedure
      .query(async () => {
        try {
          const totalCards = await db.getTotalCardCount();
          return {
            totalCards,
          };
        } catch (error: any) {
          console.error("[getStats] Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to get stats: ${error.message}`,
          });
        }
      }),

    getTrending: publicProcedure
      .input(z.object({
        limit: z.number().optional().default(5),
      }))
      .query(async ({ input }) => {
        try {
          // Use cached trending cards (calculated daily at 06:00 HKT)
          const cachedCards = await db.getCachedTrendingCards();
          
          // If cache is empty, return empty array
          // (Cache will be populated by daily scheduler)
          if (cachedCards.length === 0) {
            console.warn("[getTrending] No cached trending cards found, cache may not be initialized yet");
            return [];
          }
          
          // Return cached cards (already sorted by rank)
          return cachedCards.slice(0, input.limit);
        } catch (error: any) {
          console.error("[getTrending] Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to get trending cards: ${error.message}`,
          });
        }
      }),

    getPriceTrendData: publicProcedure
      .input(z.object({
        cardId: z.number(),
        days: z.number().optional().default(90),
      }))
      .query(async ({ input }) => {
        try {
          const card = await db.getCardById(input.cardId);
          if (!card) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
          }

          // Get all price history for this card (PSA 10 only)
          const allHistory = await db.getPriceHistoryByCardId(input.cardId);
          
          // Filter by date range (last N days) and grade (PSA 10 only)
          // If days is 0 or negative, return all PSA 10 data
          const recentHistory = input.days > 0 
            ? (() => {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - input.days);
                return allHistory.filter(record => 
                  new Date(record.soldAt || record.createdAt) >= cutoffDate &&
                  (record.grade === "PSA 10" || record.grade === "PSA10")
                );
              })()
            : allHistory.filter(record => 
                (record.grade === "PSA 10" || record.grade === "PSA10")
              );

          // Group by date (SNKRDUNK only)
          const groupedByDate = new Map<string, any[]>();
          
          for (const record of recentHistory) {
            // Only include PSA 10 records from SNKRDUNK
            if (record.grade !== "PSA 10" && record.grade !== "PSA10") continue;
            if (record.source !== "snkrdunk") continue;
            
            const date = new Date(record.soldAt || record.createdAt);
            const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
            
            if (!groupedByDate.has(dateStr)) {
              groupedByDate.set(dateStr, []);
            }
            
            groupedByDate.get(dateStr)!.push(record);
          }

          // Calculate daily averages (SNKRDUNK only)
          const trendData = Array.from(groupedByDate.entries())
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, records]) => {
              const prices = records.map(r => parseFloat(r.price));
              
              return {
                date,
                snkrdunkPrice: prices.length > 0 
                  ? prices.reduce((a, b) => a + b, 0) / prices.length 
                  : undefined,
                snkrdunkCount: prices.length,
              };
            });

          // Calculate statistics (SNKRDUNK only)
          const allSnkrdunkPrices = recentHistory
            .filter(r => r.source === "snkrdunk")
            .map(r => parseFloat(r.price));

          const stats = {
            snkrdunk: allSnkrdunkPrices.length > 0 ? {
              minPrice: Math.min(...allSnkrdunkPrices),
              maxPrice: Math.max(...allSnkrdunkPrices),
              avgPrice: allSnkrdunkPrices.reduce((a, b) => a + b, 0) / allSnkrdunkPrices.length,
              latestPrice: parseFloat(recentHistory
                .filter(r => r.source === "snkrdunk")
                .sort((a: any, b: any) => new Date(b.soldAt || b.createdAt).getTime() - new Date(a.soldAt || a.createdAt).getTime())[0]?.price || "0"),
            } : { minPrice: 0, maxPrice: 0, avgPrice: 0, latestPrice: 0 },
          };

          return {
            cardId: card.id,
            cardName: card.name,
            trendData,
            stats,
          };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to get price trend data: ${error.message}`,
          });
        }
      }),

    // 圖片搜尋卡牌
    searchByImage: publicProcedure
      .input(z.object({
        image: z.string(), // base64 encoded image
      }))
      .mutation(async ({ input }) => {
        try {
          const { searchCardByImage } = await import("./imageCardSearch");
          const result = await searchCardByImage(input.image);
          return result;
        } catch (error: any) {
          console.error("[Image Search] Error:", error.message);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to search by image: ${error.message}`,
          });
        }
      }),

    // 獲取隨機卡牌名稱用於 placeholder 輪播
    getRandomCardNames: publicProcedure
      .input(z.object({
        count: z.number().optional().default(10),
      }))
      .query(async ({ input }) => {
        try {
          const cards = await db.getRandomCards(input.count);
          return cards.map((card: any) => {
            // 格式化卡牌名稱：名稱 + 稀有度 + 編號 + 系列
            const parts = [];
            
            // 使用日文名稱（如果有），否則使用英文名稱
            const displayName = card.nameJa || card.name;
            parts.push(displayName);
            
            // 添加稀有度（如果有）
            if (card.rarity) {
              parts.push(card.rarity);
            }
            
            // 添加編號和系列
            if (card.cardNumber && card.series) {
              parts.push(`[${card.cardNumber}](${card.series})`);
            } else if (card.cardNumber) {
              parts.push(`[${card.cardNumber}]`);
            } else if (card.series) {
              parts.push(`(${card.series})`);
            }
            
            return parts.join(' ');
          });
        } catch (error: any) {
          console.error("[Get Random Card Names] Error:", error.message);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to get random card names: ${error.message}`,
          });
        }
      }),

    // Log user search query
    logSearch: publicProcedure
      .input(z.object({
        cardId: z.number(),
        searchQuery: z.string().optional(),
        source: z.enum(["search_page", "card_click", "trending_page", "home_page"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // Log user search behavior for trending cards
        await db.logUserSearch({
          cardId: input.cardId,
          searchQuery: input.searchQuery,
          source: input.source,
          userId: ctx.user?.id,
          sessionId: undefined, // Session ID tracking not implemented yet
        });
        return { success: true };
      }),

    /**
     * Trigger on-demand price refresh for a single card.
     * Called when a user views a card detail page.
     * Uses 6-hour cooldown to avoid redundant scraping.
     * Writes results to priceHistory + updates dataSource status,
     * exactly like the batch update process.
     */
    triggerPriceRefresh: publicProcedure
      .input(z.object({
        cardId: z.number(),
        productType: z.enum(['single_card', 'sealed_product']).optional().default('single_card'),
      }))
      .mutation(async ({ input }) => {
        const { cardId, productType: inputProductType } = input;
        const COOLDOWN_HOURS = 3;
        const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

        console.log(`[PriceRefresh] Triggered for cardId: ${cardId}, productType: ${inputProductType}`);

        // Step 1: Get product info (card or sealed product)
        if (inputProductType === 'sealed_product') {
          const product = await db.getProductById(cardId, 'sealed_product');
          if (!product) {
            return { status: 'error' as const, message: 'Sealed product not found', recordsAdded: 0 };
          }
        } else {
          const card = await db.getCardById(cardId);
          if (!card) {
            return { status: 'error' as const, message: 'Card not found', recordsAdded: 0 };
          }
        }

        // Step 2: Get SNKRDUNK data source
        const dataSource = await db.getDataSourceByCardIdAndSource(cardId, 'snkrdunk');
        if (!dataSource || !dataSource.sourceUrl) {
          return { status: 'no_source' as const, message: 'No SNKRDUNK data source for this card', recordsAdded: 0 };
        }

        // Step 3: Check 6-hour cooldown via dataSource.lastFetchedAt
        const now = new Date();
        if (dataSource.lastFetchedAt) {
          const lastFetched = new Date(dataSource.lastFetchedAt);
          const elapsed = now.getTime() - lastFetched.getTime();
          if (elapsed < COOLDOWN_MS) {
            const remainingMin = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
            console.log(`[PriceRefresh] Card ${cardId} in cooldown, ${remainingMin} min remaining`);
            return {
              status: 'cooldown' as const,
              message: `Recently updated, next refresh available in ${remainingMin} minutes`,
              lastFetchedAt: lastFetched.toISOString(),
              remainingMinutes: remainingMin,
              recordsAdded: 0,
            };
          }
        }

        // Step 4: Fetch price history from SNKRDUNK (same as batch update)
        console.log(`[PriceRefresh] Fetching price history for card ${cardId} from ${dataSource.sourceUrl}`);
        try {
          const { fetchPriceHistory, convertJpyToHkd } = await import('./snkrdunkScraper');
          const productType: "single_card" | "sealed_product" = 
            (dataSource.productType === 'sealed_product') ? 'sealed_product' : 'single_card';

          const priceHistoryData = await fetchPriceHistory(dataSource.sourceUrl, productType);

          if (!priceHistoryData || priceHistoryData.length === 0) {
            // Update status even if no data found
            await db.updateDataSourceFetchStatus(dataSource.id, 'success');
            console.log(`[PriceRefresh] No price history found for card ${cardId}`);
            return { status: 'success' as const, message: 'No new price data found', recordsAdded: 0 };
          }

          // Step 5: Write to priceHistory table (exactly like batch update)
          let recordsAdded = 0;
          for (const priceItem of priceHistoryData) {
            const priceHKD = convertJpyToHkd(priceItem.price);
            await db.addPriceHistory({
              cardId: cardId,
              source: 'snkrdunk',
              price: priceHKD.toString(),
              currency: 'HKD',
              jpyPrice: priceItem.price, // Original JPY price for stable deduplication
              grade: productType === 'sealed_product' ? undefined : priceItem.grade,
              quantity: productType === 'sealed_product' ? (priceItem.quantity || undefined) : undefined,
              productType,
              soldAt: priceItem.soldAt,
            });
            recordsAdded++;
          }

          // Step 6: Update data source fetch status (exactly like batch update)
          await db.updateDataSourceFetchStatus(dataSource.id, 'success');

          console.log(`[PriceRefresh] Card ${cardId} refreshed: ${recordsAdded} records added`);
          return {
            status: 'success' as const,
            message: `Price data refreshed, ${recordsAdded} records added`,
            recordsAdded,
            lastFetchedAt: now.toISOString(),
          };
        } catch (error: any) {
          console.error(`[PriceRefresh] Error refreshing card ${cardId}:`, error.message);
          await db.updateDataSourceFetchStatus(dataSource.id, 'error', error.message);
          return {
             status: 'error' as const,
            message: `Refresh failed: ${error.message}`,
            recordsAdded: 0,
          };
        }
      }),

    // Batch query lowest active listing price for a list of card IDs
    // Source: snkrdunkListingsCache (real SNKRDUNK on-sale listings, price in HKD)
    getLowestListingPrices: publicProcedure
      .input(z.object({
        cardIds: z.array(z.number()).max(100),
      }))
      .query(async ({ input }) => {
        if (input.cardIds.length === 0) return { prices: {} };
        const dbConn = await (await import('./db')).getDb();
        if (!dbConn) return { prices: {} };
        const { snkrdunkListingsCache } = await import('../drizzle/schema_new');
        const { inArray } = await import('drizzle-orm');

        // Fetch all cache rows for the requested card IDs
        const rows = await dbConn
          .select({
            cardId: snkrdunkListingsCache.cardId,
            listings: snkrdunkListingsCache.listings,
          })
          .from(snkrdunkListingsCache)
          .where(inArray(snkrdunkListingsCache.cardId, input.cardIds));

        const prices: Record<number, number> = {};
        for (const row of rows) {
          try {
            // listings is stored as JSON string: [{price, currency, grade, url, status}, ...]
            const items: Array<{ price: number; currency: string; grade: string; status?: string }> =
              typeof row.listings === 'string' ? JSON.parse(row.listings) : (row.listings as any);
            // Only consider on-sale items (filter out sold items)
            const onSaleItems = items.filter((item) => !item.status || item.status === 'on-sale');
            if (onSaleItems.length > 0) {
              // price is already in HKD (converted during scraping)
              const minPrice = Math.min(...onSaleItems.map((item) => item.price));
              if (isFinite(minPrice) && minPrice > 0) {
                prices[row.cardId] = Math.round(minPrice * 100) / 100;
              }
            }
          } catch (e) {
            // Skip malformed cache entries
          }
        }
        return { prices };
      }),

    // Trigger background cache refresh for a list of card IDs (fire-and-forget)
    // Used by search results page to pre-warm cache for displayed cards
    triggerCacheRefresh: publicProcedure
      .input(z.object({
        cardIds: z.array(z.number()).max(50),
      }))
      .mutation(async ({ input }) => {
        if (input.cardIds.length === 0) return { triggered: 0 };
        // Fire-and-forget: don't await, just kick off background scraping
        (async () => {
          const dbModule = await import('./db');
          const { scrapeSnkrdunkListings } = await import('./services/snkrdunkScraperService');
          let triggered = 0;
          for (const cardId of input.cardIds) {
            try {
              // Check if cache exists and is fresh (hot cache valid)
              const cache = await dbModule.getSnkrdunkListingsCache(cardId);
              const now = new Date();
              if (cache && cache.hotExpiresAt && new Date(cache.hotExpiresAt) > now) {
                continue; // Hot cache still valid, skip
              }
              // Get SNKRDUNK data source for this card
              const dataSource = await dbModule.getDataSourceByCardIdAndSource(cardId, 'snkrdunk');
              if (!dataSource || !dataSource.sourceUrl) continue;
              const snkrdunkIdMatch = dataSource.sourceUrl.match(/\/apparels\/(\d+)/);
              if (!snkrdunkIdMatch) continue;
              const snkrdunkId = snkrdunkIdMatch[1];
              triggered++;
              // Scrape in background (no await at outer level)
              scrapeSnkrdunkListings(snkrdunkId).then(async (newListings) => {
                if (newListings.length > 0) {
                  const hotExpiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000);
                  const coldExpiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
                  await dbModule.saveSnkrdunkListingsCache({
                    cardId,
                    snkrdunkId,
                    listings: JSON.stringify(newListings),
                    hotExpiresAt,
                    expiresAt: coldExpiresAt,
                  });
                  console.log(`[CacheRefresh] Updated cache for cardId=${cardId}: ${newListings.length} listings`);
                }
              }).catch((err) => {
                console.warn(`[CacheRefresh] Failed for cardId=${cardId}:`, err?.message);
              });
            } catch (err) {
              console.warn(`[CacheRefresh] Error processing cardId=${cardId}:`, (err as Error)?.message);
            }
          }
          console.log(`[CacheRefresh] Triggered background refresh for ${triggered} cards`);
        })();
        return { triggered: input.cardIds.length };
      }),
  }),
  prices: router({
    getHistory: publicProcedure
      .input(z.object({
        cardId: z.number(),
        source: z.enum(["snkrdunk", "ebay", "tcgplayer", "other"]).optional(),
        grade: z.string().optional(),
        limit: z.number().optional().default(50),
        days: z.number().optional(), // 添加時間範圍篩選（最近 N 天）
      }))
      .query(async ({ input }) => {
        // 直接將 days 參數傳遞給 db.getPriceHistory，在數據庫層面篩選
        const history = await db.getPriceHistory(
          input.cardId,
          input.source,
          input.grade,
          input.limit,
          input.days
        );
        
        return history;
      }),

    getStatistics: publicProcedure
      .input(z.object({
        cardId: z.number(),
        source: z.enum(["snkrdunk", "ebay", "tcgplayer", "other"]).optional(),
        grade: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const stats = await db.getPriceStatistics(
          input.cardId,
          input.source,
          input.grade
        );
        return stats;
      }),
  }),

  trends: router({
    getMarketTrends: publicProcedure
      .input(z.object({
        cardId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        const trends = await db.getMarketTrends(
          input.cardId,
          input.startDate,
          input.endDate
        );
        return trends;
      }),
  }),

  admin: router({
    getDataSources: publicProcedure
      .input(z.object({
        page: z.number().min(1).optional(),
        pageSize: z.number().min(1).max(100).optional(),
        search: z.string().optional(),
        status: z.enum(["all", "success", "pending", "failed"]).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const sources = await db.getDataSources(input);
        return sources;
      }),

    getDataSourceStats: publicProcedure
      .query(async () => {
        const stats = await db.getDataSourceStats();
        return stats;
      }),

    getAllFilteredDataSourceIds: publicProcedure
      .input(z.object({
        search: z.string().optional(),
        status: z.enum(["all", "success", "pending", "failed"]).optional(),
      }).optional())
      .query(async ({ input }) => {
        const ids = await db.getAllFilteredDataSourceIds(input);
        return ids;
      }),

    getAllDataSourceUrls: publicProcedure
      .query(async () => {
        // Get all data sources without pagination to support full deduplication
        const { data: allSources } = await db.getDataSources({ pageSize: 100000 });
        return allSources.map(ds => ds.sourceUrl);
      }),

    addSnkrdunkSource: adminProcedure
      .input(z.object({
        url: z.string().url(),
        gameId: z.number().int().positive().optional(), // Game type ID (defaults to 1 for Pokémon)
        productType: z.enum(["single_card", "sealed_product"]).optional(), // Product type (defaults to single_card)
      }))
      .mutation(async ({ ctx, input }) => {
const snkrdunkId = extractSnkrdunkId(input.url);
        if (!snkrdunkId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid SNKRDUNK URL" });
        }

        // Normalize URL for duplicate check
        const normalizedUrl = input.url.split('?')[0].split('#')[0];
        
        // Check if data source already exists using database query
        const exists = await db.checkDataSourceExists(normalizedUrl);
        if (exists) {
          // Return special status instead of throwing error
          return { success: false, status: 'duplicate', message: `Data source already exists: ${normalizedUrl}` };
        }

        try {
          // Determine product type (default to single_card if not specified)
          const productType = input.productType || "single_card";

          // Scrape SNKRDUNK page with correct productType
          const cardData = await scrapeSnkrdunkPage(input.url, productType);
          const gameId = input.gameId || 1; // Default to Pokémon
          let productId: number;

          if (productType === "sealed_product") {
            // Create or update sealed product
            // For sealed products, we use the SNKRDUNK ID as the unique identifier
            // Since we don't have a getSealedProductByCardId function, we'll create a new product each time
            // TODO: Add getSealedProductByCardId function to avoid duplicates
            
            productId = await db.createSealedProduct({
              gameId,
              name: cardData.name,
              nameJa: cardData.nameJa,
              imageUrl: cardData.imageUrl || undefined,
              boxType: "booster_box", // Default to booster_box
              styleCode: cardData.styleCode || undefined,
            });
          } else {
            // Create or update single card
            const existingCard = await db.getCardByCardId(`snkrdunk-${snkrdunkId}`);

            if (existingCard) {
              productId = existingCard.id;
              // Update card with scraped data
              await db.updateCard(productId, {
                name: cardData.name,
                nameJa: cardData.nameJa,
                imageUrl: cardData.imageUrl || undefined,
              });
            } else {
              // Create new card
              // Extract card number from name (e.g., "Pikachu[SM-P 288]" → "SM-P 288")
              const cardNumberMatch = cardData.name.match(/\[([^\]]+)\]/);
              const cardNumber = cardNumberMatch ? cardNumberMatch[1].trim() : undefined;
              
              productId = await db.createCard({
                cardId: `snkrdunk-${snkrdunkId}`,
                gameId,
                name: cardData.name,
                nameJa: cardData.nameJa,
                imageUrl: cardData.imageUrl || undefined,
                cardNumber,
              });
            }
          }

          // Add data source (now guaranteed to be new)
          await db.addDataSource({
            cardId: productId, // This is the ID of either a card or sealed product
            gameId, // Use the gameId determined above
            productType, // Use the productType determined above
            source: "snkrdunk",
            sourceUrl: input.url,
            sourceIdentifier: snkrdunkId,
          });

          // Save price history
          for (const priceEntry of cardData.priceHistory) {
            const priceHkd = convertJpyToHkd(priceEntry.price);
            await db.addPriceHistory({
              cardId: productId, // This is the ID of either a card or sealed product
              source: "snkrdunk",
              price: priceHkd.toString(),
              currency: "HKD",
              jpyPrice: priceEntry.price, // Original JPY price for stable deduplication
              grade: priceEntry.grade,
              quantity: priceEntry.quantity, // Add quantity field for sealed products
              productType, // Add productType field
              soldAt: priceEntry.soldAt,
              listingUrl: input.url,
            });
          }

          // Get and update data source status
          const { data: dataSources } = await db.getDataSources({ pageSize: 10000 });
          const newDataSource = dataSources.find(
            (ds) => ds.cardId === productId && ds.source === "snkrdunk"
          );
          if (newDataSource) {
            await db.updateDataSourceFetchStatus(newDataSource.id, "success");
          }

          return { success: true, cardId: productId, priceCount: cardData.priceHistory.length };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to scrape SNKRDUNK: ${error.message}`,
          });
        }
      }),

    refreshDataSource: adminProcedure
      .input(z.object({
        dataSourceId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
try {
          // Get data source
          const dataSource = await db.getDataSourceById(input.dataSourceId);
          if (!dataSource) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Data source not found" });
          }

          // Scrape SNKRDUNK page with correct productType
          const productType = (dataSource.productType as "single_card" | "sealed_product") || "single_card";
          const cardData = await scrapeSnkrdunkPage(dataSource.sourceUrl, productType);

          // Update card or sealed product
          if (productType === 'sealed_product') {
            await db.updateSealedProduct(dataSource.cardId, {
              name: cardData.name,
              nameJa: cardData.nameJa,
              imageUrl: cardData.imageUrl || undefined,
              styleCode: cardData.styleCode || undefined,
            });
          } else {
            await db.updateCard(dataSource.cardId, {
              name: cardData.name,
              nameJa: cardData.nameJa,
              imageUrl: cardData.imageUrl || undefined,
            });
          }

          // Save new price history
          for (const priceEntry of cardData.priceHistory) {
            const priceHkd = convertJpyToHkd(priceEntry.price);
            await db.addPriceHistory({
              cardId: dataSource.cardId,
              source: "snkrdunk",
              price: priceHkd.toString(),
              currency: "HKD",
              jpyPrice: priceEntry.price, // Original JPY price for stable deduplication
              grade: priceEntry.grade,
              quantity: priceEntry.quantity,
              productType,
              soldAt: priceEntry.soldAt,
              listingUrl: dataSource.sourceUrl,
            });
          }

          // Update data source status
          await db.updateDataSourceFetchStatus(input.dataSourceId, "success");

          return { success: true, priceCount: cardData.priceHistory.length };
        } catch (error: any) {
          await db.updateDataSourceFetchStatus(
            input.dataSourceId,
            "failed",
            error.message
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to refresh data source: ${error.message}`,
          });
        }
      }),

    getUpdateStatus: publicProcedure
      .input(z.object({
        dataSourceId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
const status = await getUpdateStatus(input.dataSourceId);
        return status;
      }),

    manualUpdate: adminProcedure
      .input(z.object({
        dataSourceId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
try {
          await manualUpdateDataSource(input.dataSourceId);
          return { success: true };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to trigger manual update: ${error.message}`,
          });
        }
      }),

    deleteDataSource: adminProcedure
      .input(z.object({
        dataSourceId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
try {
          await db.deleteDataSource(input.dataSourceId);
          return { success: true };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to delete data source: ${error.message}`,
          });
        }
      }),

    autoCrawlSnkrdunk: adminProcedure
      .input(z.object({
        startPage: z.number().min(1).default(1),
        endPage: z.number().min(1).default(1575),
      }))
      .mutation(async ({ ctx, input }) => {
const { autoCrawlSnkrdunk } = await import("./scheduler");
        
        try {
          const result = await autoCrawlSnkrdunk(input.startPage, input.endPage);
          return result;
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Auto crawl failed: ${error.message}`,
          });
        }
      }),

    getCrawlProgress: publicProcedure
      .query(async ({ ctx }) => {
const { getCrawlProgress } = await import("./scheduler");
        return getCrawlProgress();
      }),

    getSchedulerStatus: publicProcedure
      .query(async ({ ctx }) => {
const status = await getSchedulerStatus();
        return status;
      }),

    triggerManualUpdateAll: adminProcedure
      .mutation(async ({ ctx }) => {
try {
          await triggerManualUpdateAll();
          return { success: true };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to trigger manual update: ${error.message}`,
          });
        }
      }),

    cleanDuplicateDataSources: adminProcedure
      .mutation(async ({ ctx }) => {
try {
          // Get all data sources
          const { data: allSources } = await db.getDataSources({ pageSize: 10000 });
          
          // Group by normalized URL
          const urlGroups = new Map<string, typeof allSources>();
          
          for (const source of allSources) {
            const normalizedUrl = source.sourceUrl.split('?')[0].split('#')[0];
            if (!urlGroups.has(normalizedUrl)) {
              urlGroups.set(normalizedUrl, []);
            }
            urlGroups.get(normalizedUrl)!.push(source);
          }
          
          // Delete duplicates (keep the newest one)
          let deletedCount = 0;
          for (const [normalizedUrl, sources] of Array.from(urlGroups.entries())) {
            if (sources.length > 1) {
              // Sort by createdAt (newest first)
              sources.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              
              // Delete all except the first one (which is the newest)
              for (let i = 1; i < sources.length; i++) {
                await db.deleteDataSource(sources[i].id);
                deletedCount++;
              }
            }
          }
          
          return { 
            success: true, 
            deletedCount,
            message: `Successfully deleted ${deletedCount} duplicate data sources`
          };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to clean duplicates: ${error.message}`,
          });
        }
      }),

    deleteFailedDataSources: adminProcedure
      .mutation(async ({ ctx }) => {
try {
          const result = await db.deleteFailedDataSources();
          
          if (!result.success) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to delete failed data sources",
            });
          }
          
          return { 
            success: true, 
            deletedCount: result.deletedCount,
            message: `Successfully deleted ${result.deletedCount} failed data sources`
          };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to delete failed data sources: ${error.message}`,
          });
        }
      }),

  updateCardEnglishNames: adminProcedure.mutation(async () => {
    const { data: dataSources } = await db.getDataSources({ pageSize: 10000 });
    
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const source of dataSources) {
      if (!source.cardId) continue;

      try {
        const productId = source.sourceUrl.match(/\/apparels\/(\d+)/);
        if (!productId) continue;

        // Fetch English name from API
        const apiUrl = `https://snkrdunk.com/v1/apparels/${productId[1]}`;
        const response = await fetch(apiUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
          },
        });

        if (!response.ok) {
          failed++;
          continue;
        }

        const data = await response.json();
        const nameEn = data.name;

        // Update card with English name using db function
        await db.updateCard(source.cardId, { name: nameEn });

        updated++;
        console.log(`[Update] Card ${source.cardId}: ${nameEn}`);
      } catch (error: any) {
        failed++;
        errors.push(`${source.sourceUrl}: ${error.message}`);
      }
    }

    return {
      success: true,
      updated,
      failed,
      errors: errors.slice(0, 10),
    };
  }),

  // Get scraper performance metrics
  getScraperPerformance: publicProcedure
    .input(z.object({
      source: z.enum(["snkrdunk", "ebay", "all"]).optional(),
      hours: z.number().min(1).max(168).optional(), // Last N hours (default 24)
    }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { scraperPerformanceLogs } = await import("../drizzle/schema_new");
      const { sql, eq, and, gte } = await import("drizzle-orm");

      const hours = input?.hours || 24;
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      // Build query conditions
      const conditions = [gte(scraperPerformanceLogs.createdAt, cutoffTime)];
      if (input?.source && input.source !== "all") {
        conditions.push(eq(scraperPerformanceLogs.source, input.source));
      }

      // Get recent logs
      const logs = await db
        .select()
        .from(scraperPerformanceLogs)
        .where(and(...conditions))
        .orderBy(sql`${scraperPerformanceLogs.createdAt} DESC`)
        .limit(100);

      // Calculate metrics
      const totalRequests = logs.length;
      const successCount = logs.filter((l: any) => l.status === "success").length;
      const errorCount = logs.filter((l: any) => l.status === "error").length;
      const timeoutCount = logs.filter((l: any) => l.status === "timeout").length;
      const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 0;

      const avgResponseTime = totalRequests > 0
        ? logs.reduce((sum: number, l: any) => sum + l.responseTime, 0) / totalRequests
        : 0;

      const totalItemsProcessed = logs.reduce((sum: number, l: any) => sum + (l.itemsProcessed || 0), 0);

      // Get error logs
      const errorLogs = logs
        .filter((l: any) => l.status === "error" || l.status === "timeout")
        .slice(0, 20)
        .map((l: any) => ({
          id: l.id,
          source: l.source,
          cardId: l.cardId,
          status: l.status,
          errorMessage: l.errorMessage,
          createdAt: l.createdAt,
        }));

      return {
        totalRequests,
        successCount,
        errorCount,
        timeoutCount,
        successRate: Math.round(successRate * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime),
        totalItemsProcessed,
        recentLogs: logs.slice(0, 10).map((l: any) => ({
          id: l.id,
          source: l.source,
          cardId: l.cardId,
          operationType: l.operationType,
          status: l.status,
          responseTime: l.responseTime,
          itemsProcessed: l.itemsProcessed,
          createdAt: l.createdAt,
        })),
        errorLogs,
      };
    }),

  // Trigger cache warming
  triggerCacheWarming: adminProcedure
    .input(z.object({
      cardLimit: z.number().min(1).max(100).optional(), // Number of cards to warm (default: 20)
    }).optional())
    .mutation(async ({ input }) => {
      const { warmCache } = await import("./services/cacheWarmer");
      const cardLimit = input?.cardLimit || 20;
      
      console.log(`[Admin] Triggering cache warming for ${cardLimit} cards...`);
      const result = await warmCache(cardLimit);
      
      return result;
    }),

  fixOrphanDataSources: adminProcedure.mutation(async ({ ctx }) => {
try {
          const { fixOrphanDataSources } = await import("./fixOrphanDataSources");
          const result = await fixOrphanDataSources();
          
          return { 
            success: true, 
            fixed: result.fixed,
            failed: result.failed,
            failedUrls: result.failedUrls,
            message: `Fixed ${result.fixed} orphan data sources, ${result.failed} failed`
          };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to fix orphan data sources: ${error.message}`,
          });
        }
      }),

    getFirecrawlUsageStats: publicProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
const stats = await db.getFirecrawlUsageStats(
          input?.startDate,
          input?.endDate
        );
        
        // Get quota limit from system settings
        const quotaLimitSetting = await db.getSystemSetting("firecrawl_quota_limit");
        const quotaLimit = quotaLimitSetting ? parseInt(quotaLimitSetting.settingValue) : null;
        
        return {
          ...stats,
          quotaLimit,
          quotaUsagePercent: quotaLimit ? (stats!.totalCreditsUsed / quotaLimit) * 100 : null,
        };
      }),

    setFirecrawlQuotaLimit: adminProcedure
      .input(z.object({
        limit: z.number().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
await db.setSystemSetting(
          "firecrawl_quota_limit",
          input.limit.toString(),
          "Firecrawl monthly quota limit"
        );
        
        return { success: true };
      }),

    // Get SMTP settings
    getSmtpSettings: publicProcedure
      .query(async ({ ctx }) => {
const settings = {
          smtpHost: await db.getSystemSetting("smtp_host"),
          smtpPort: await db.getSystemSetting("smtp_port"),
          smtpUser: await db.getSystemSetting("smtp_user"),
          fromEmail: await db.getSystemSetting("from_email"),
          fromName: await db.getSystemSetting("from_name"),
        };
        
        return {
          smtpHost: settings.smtpHost?.settingValue || "",
          smtpPort: settings.smtpPort?.settingValue || "587",
          smtpUser: settings.smtpUser?.settingValue || "",
          fromEmail: settings.fromEmail?.settingValue || "",
          fromName: settings.fromName?.settingValue || "BOXIUM PTCG",
        };
      }),

    // Save SMTP settings
    saveSmtpSettings: adminProcedure
      .input(z.object({
        smtpHost: z.string(),
        smtpPort: z.string(),
        smtpUser: z.string(),
        smtpPass: z.string().optional(),
        fromEmail: z.string(),
        fromName: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
await db.setSystemSetting("smtp_host", input.smtpHost, "SMTP server host");
        await db.setSystemSetting("smtp_port", input.smtpPort, "SMTP server port");
        await db.setSystemSetting("smtp_user", input.smtpUser, "SMTP username");
        if (input.smtpPass) {
          await db.setSystemSetting("smtp_pass", input.smtpPass, "SMTP password");
        }
        await db.setSystemSetting("from_email", input.fromEmail, "From email address");
        await db.setSystemSetting("from_name", input.fromName, "From name");
        
        return { success: true };
      }),

    // Test SMTP connection
    testSmtpConnection: adminProcedure
      .input(z.object({
        email: z.string().email(),
      }))
      .mutation(async ({ ctx, input }) => {
// TODO: Implement email service
        // const { sendPasswordResetEmail, generateResetToken } = await import("./emailService");
        // const testToken = generateResetToken();
        // const emailSent = await sendPasswordResetEmail(input.email, testToken, "測試用戶");
        
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: "SMTP 功能尚未實作，請稍後再試",
        });
      }),

    // User management removed - no authentication system

    // 獲取搜尋統計數據
    getSearchStats: publicProcedure
      .query(async ({ ctx }) => {
        const stats = await db.getSearchStats();
        if (!stats) {
          return {
            totalSearches: 0,
            imageSearches: 0,
            textSearches: 0,
            avgImageDuration: 0,
            avgTextDuration: 0,
            successfulSearches: 0,
            imageSuccessRate: 0,
            fallbackToTextCount: 0,
          };
        }

        // 計算圖片搜尋成功率
        const imageSuccessRate = stats.imageSearches > 0 
          ? (stats.imageSearches / stats.totalSearches) * 100 
          : 0;

        // 計算回退到文字搜尋的次數（總搜尋次數 - 圖片搜尋次數）
        const fallbackToTextCount = stats.textSearches;

        return {
          ...stats,
          imageSuccessRate: Math.round(imageSuccessRate * 100) / 100,
          fallbackToTextCount,
        };
      }),
    // ─── 批量更新 API（統一使用持久化版本，進度從數據庫讀取）───

    // 獲取批量更新進度（從數據庫讀取，前端輪詢用）
    getBatchUpdateProgress: publicProcedure
      .query(async () => {
        const runningTask = await batchTaskManager.getLatestRunningTask('batch_snkrdunk_update');
        if (runningTask) {
          return {
            isRunning: true,
            isPaused: runningTask.status === 'paused',
            totalCards: runningTask.totalItems,
            processedCards: runningTask.processedItems,
            successCount: runningTask.successCount,
            failureCount: runningTask.failureCount,
            totalRecordsAdded: 0,
            errors: runningTask.errors || [],
            startTime: runningTask.startedAt ? new Date(runningTask.startedAt).getTime() : null,
            endTime: null,
            taskId: runningTask.taskId,
          };
        }
        return {
          isRunning: false,
          isPaused: false,
          totalCards: 0,
          processedCards: 0,
          successCount: 0,
          failureCount: 0,
          totalRecordsAdded: 0,
          errors: [],
          startTime: null,
          endTime: null,
          taskId: null,
        };
      }),

    // 暫停批量更新（操作數據庫，batchTaskManager 是唯一的狀態來源）
    pauseBatchUpdate: adminProcedure
      .mutation(async () => {
        const runningTask = await batchTaskManager.getLatestRunningTask('batch_snkrdunk_update');
        if (runningTask) {
          await batchTaskManager.pauseTask(runningTask.taskId);
        }
        return { success: true, message: "批量更新已暫停" };
      }),

    // 繼續批量更新（操作數據庫）
    resumeBatchUpdate: adminProcedure
      .mutation(async () => {
        const runningTask = await batchTaskManager.getLatestRunningTask('batch_snkrdunk_update');
        if (runningTask) {
          await batchTaskManager.resumeTask(runningTask.taskId);
        }
        return { success: true, message: "批量更新已繼續" };
      }),

    // 啟動 SNKRDUNK 批量更新（持久化版本）
    batchUpdateSnkrdunkPrices: adminProcedure
      .mutation(async () => {
        try {
          const { taskId, totalCards } = await executePersistentSnkrdunkBatchUpdate();
          return {
            success: true,
            message: `SNKRDUNK 批量更新已啟動，共 ${totalCards} 張卡牌`,
            taskId,
            totalCards,
          };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `啟動 SNKRDUNK 批量更新失敗: ${error.message}`,
          });
        }
      }),

    // 獲取排程設定
    getScheduleConfig: publicProcedure
      .query(async ({ ctx }) => {
        const config = await db.getScheduleConfig("batch_update_daily");
        return config;
      }),

    // 啟用/停用排程
    updateScheduleEnabled: adminProcedure
      .input(z.object({
        enabled: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateScheduleEnabled("batch_update_daily", input.enabled);
        // 重新啟動排程器以應用新設定
        await restartScheduler();
        return {
          success: true,
          message: input.enabled ? "排程已啟用" : "排程已停用",
        };
      }),

    // 立即手動觸發排程（使用持久化版本）
    triggerScheduleNow: adminProcedure
      .mutation(async () => {
        try {
          // 創建執行歷史記錄
          const historyId = await db.addScheduleExecutionHistory({
            scheduleType: "batch_update_daily",
            executionType: "manual",
            status: "running",
            startedAt: new Date(),
          });

          // 使用持久化版本的批量更新
          const { taskId, totalCards } = await executePersistentSnkrdunkBatchUpdate();

          // 更新執行歷史（任務已在後台運行）
          await db.updateScheduleExecutionHistory(historyId, {
            status: "completed",
            snkrdunkSuccessCount: totalCards,
            snkrdunkFailureCount: 0,
            snkrdunkRecordsAdded: 0,
            completedAt: new Date(),
            durationMs: 0,
          });

          return {
            success: true,
            message: `排程任務已啟動，任務 ID: ${taskId}，共 ${totalCards} 張卡牌`,
          };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `啟動排程任務失敗: ${error.message}`,
          });
        }
      }),

    // 獲取排程執行歷史
    getScheduleExecutionHistory: publicProcedure
      .input(z.object({
        scheduleType: z.enum(["snkrdunk_update", "trending_update"]).optional(),
        limit: z.number().min(1).max(50).optional().default(10),
      }).optional())
      .query(async ({ input }) => {
        const scheduleType = input?.scheduleType;
        const limit = input?.limit ?? 10;
        
        if (scheduleType) {
          // 查詢特定類型的排程歷史
          return await db.getScheduleExecutionHistory(scheduleType, limit);
        } else {
          // 查詢所有類型的排程歷史
          const snkrdunk = await db.getScheduleExecutionHistory("snkrdunk_update", limit);
          const trending = await db.getScheduleExecutionHistory("trending_update", limit);
          
          return {
            snkrdunk,
            ebay: [], // eBay 功能已移除，返回空陣列
            trending,
          };
        }
      }),

    // Get schedule health statistics (last 7 days)
    getScheduleHealthStats: publicProcedure
      .query(async () => {
        const { getAllScheduleHealthStats } = await import('./getScheduleHealthStats');
        const stats = await getAllScheduleHealthStats();
        return stats;
      }),

    // Manually trigger trending cards calculation
    calculateTrendingCards: adminProcedure
      .mutation(async () => {
        try {
          console.log("[Admin] Manually triggering trending cards calculation...");
          await db.calculateAndCacheTrendingCards();
          return { success: true, message: "Trending cards calculated and cached successfully" };
        } catch (error: any) {
          console.error("[Admin] Failed to calculate trending cards:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to calculate trending cards: ${error.message}`,
          });
        }
      }),


    // 獲取儀表板統計數據
    getDashboardStats: publicProcedure
      .query(async () => {
        try {
          // 獲取各種統計數據
          const totalCards = await db.getTotalCardCount();
          const totalDataSources = await db.getTotalDataSourceCount();
          const activeDataSources = await db.getActiveDataSourceCount();
          const totalPriceRecords = await db.getTotalPriceRecordCount();
          
          return {
            totalUsers: 0, // 平台已公開，無用戶系統
            totalCards,
            totalDataSources,
            activeDataSources,
            totalPriceRecords,
          };
        } catch (error: any) {
          console.error("[Admin] Failed to get dashboard stats:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to get dashboard stats: ${error.message}`,
          });
        }
      }),

    // === 持久化批量更新 API ===

    // 啟動持久化 SNKRDUNK 批量更新
    startPersistentSnkrdunkBatchUpdate: adminProcedure
      .mutation(async () => {
        try {
          const result = await executePersistentSnkrdunkBatchUpdate();
          return {
            success: true,
            message: `SNKRDUNK 批量更新已啟動，共 ${result.totalCards} 張卡牌`,
            taskId: result.taskId,
            totalCards: result.totalCards,
          };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "SNKRDUNK 批量更新啟動失敗",
          });
        }
      }),

    // 獲取持久化任務進度
    getPersistentTaskProgress: publicProcedure
      .input(z.object({
        taskType: z.enum(['batch_snkrdunk_update']),
      }))
      .query(async ({ input }) => {
        const task = await batchTaskManager.getLatestRunningTask(input.taskType);
        return task;
      }),

    // 暂停持久化任務
    pausePersistentTask: adminProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await batchTaskManager.pauseTask(input.taskId);
        return { success: true, message: "任務已暂停" };
      }),

    // 繼續持久化任務
    resumePersistentTask: adminProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await batchTaskManager.resumeTask(input.taskId);
        return { success: true, message: "任務已繼續" };
      }),

    // 取消持久化任務
    cancelPersistentTask: adminProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await batchTaskManager.cancelTask(input.taskId);
        return { success: true, message: "任務已取消" };
      }),

    // 批量更新健康檢查 - 偵測卡死任務
    checkBatchHealth: adminProcedure
      .query(async () => {
        const stalledTasks = await batchTaskManager.checkStalledTasks(30);
        return {
          healthy: stalledTasks.length === 0,
          stalledTasks,
          checkedAt: new Date(),
        };
      }),

    // 強制取消卡死任務（標記為 failed）
    forceCancelStalledTask: adminProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await batchTaskManager.completeTask(input.taskId, 'failed');
        return { success: true, message: `任務 ${input.taskId} 已強制取消` };
      }),

    // 恢復所有卡死任務（服務器啟動時自動調用，也可手動觸發）
    recoverStalledTasks: adminProcedure
      .mutation(async () => {
        const result = await batchTaskManager.recoverStalledTasks(30);
        return {
          success: true,
          recoveredCount: result.recoveredCount,
          recoveredTaskIds: result.recoveredTaskIds,
          message: result.recoveredCount > 0
            ? `已恢復 ${result.recoveredCount} 個卡死任務`
            : '沒有找到卡死任務',
        };
      }),

    // 從上次進度恢復失敗的批量更新任務
    resumeFailedBatchTask: adminProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ input }) => {
        const { resumeFailedTask } = await import('./persistentSnkrdunkBatchUpdate');
        const result = await resumeFailedTask(input.taskId);
        return {
          success: true,
          newTaskId: result.taskId,
          totalCards: result.totalCards,
          skippedCards: result.skippedCards,
          resumedFrom: result.resumedFrom,
          message: `已從任務 ${input.taskId} 的進度恢復，跳過 ${result.resumedFrom} 個已處理產品，繼續處理 ${result.totalCards} 個產品`,
        };
      }),

    // 價格更新排程 API
    getPriceUpdateSchedule: publicProcedure
      .query(async () => {
        const schedule = await db.getPriceUpdateSchedule();
        return schedule;
      }),

    updatePriceUpdateSchedule: adminProcedure
      .input(z.object({
        snkrdunkEnabled: z.boolean().optional(),
        snkrdunkUpdateTime: z.string().optional(),
        // eBay 已停用，保留參數但忽略
        ebayEnabled: z.boolean().optional(),
        ebayUpdateTime: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updatePriceUpdateSchedule(input);
        // 重啟排程器以應用新設定
        await restartPriceUpdateScheduler();
        return { success: true, message: "排程設定已更新" };
      }),

    // 緩存管理 API
    getCacheStats: publicProcedure
      .query(async () => {
        const stats = await db.getSnkrdunkCacheStats();
        return stats;
      }),

    // 獲取詳細快取統計（按快取狀態分類）
    getDetailedCacheStats: publicProcedure
      .query(async () => {
        const stats = await db.getDetailedSnkrdunkCacheStats();
        return stats;
      }),

    // 批量更新 SNKRDUNK 數據（處理一個批次）
    processBatch: adminProcedure
      .input(z.object({
        batchIndex: z.number(),
        batchSize: z.number().default(50),
      }))
      .mutation(async ({ input }) => {
        const { batchIndex, batchSize } = input;
        const offset = batchIndex * batchSize;
        
        // 獲取這一批次的卡牌（只獲取有 SNKRDUNK ID 的卡牌）
        const cardsToProcess = await db.getCardsWithSnkrdunkId({ limit: batchSize, offset });
        
        const results = {
          success: 0,
          failed: 0,
          skipped: 0,
          errors: [] as Array<{ cardId: number; error: string }>
        };
        
        const HOT_CACHE_DURATION = 60 * 60 * 1000; // 1 hour
        const COLD_CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours
        
        for (const card of cardsToProcess) {
          try {
            // 檢查快取狀態
            const cache = await db.getSnkrdunkListingsCache(card.id);
            
            if (cache) {
              const cacheAge = Date.now() - new Date(cache.createdAt).getTime();
              
              // 跳過熱快取和冷快取
              if (cacheAge < COLD_CACHE_DURATION) {
                results.skipped++;
                continue;
              }
            }
            
            // 爬取並更新快取
            const { scrapeSnkrdunkListings } = await import('./services/snkrdunkScraperService');
            const listings = await scrapeSnkrdunkListings(card.snkrdunkId!);
            
            // 保存快取
            const now = new Date();
            await db.saveSnkrdunkListingsCache({
              cardId: card.id,
              snkrdunkId: card.snkrdunkId!,
              listings: JSON.stringify(listings),
              hotExpiresAt: new Date(now.getTime() + HOT_CACHE_DURATION),
              expiresAt: new Date(now.getTime() + COLD_CACHE_DURATION),
            });
            
            results.success++;
          } catch (error: any) {
            results.failed++;
            results.errors.push({
              cardId: card.id,
              error: error.message || String(error)
            });
          }
        }
        
        return {
          batchIndex,
          processed: cardsToProcess.length,
          results,
          hasMore: cardsToProcess.length === batchSize
        };
      }),

    clearCardCache: adminProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const deletedCount = await db.clearSnkrdunkCacheByCardId(input.cardId);
        return { success: true, deletedCount };
      }),

    clearAllCache: adminProcedure
      .mutation(async () => {
        const deletedCount = await db.clearAllSnkrdunkCache();
        return { success: true, deletedCount };
      }),

    // 獲取所有快取列表（包含卡牌信息、過期時間、商品數量）
    getAllCacheList: adminProcedure
      .input(z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      }))
      .query(async ({ input }) => {
        const { getAllSnkrdunkCacheList } = await import('./db');
        const result = await getAllSnkrdunkCacheList(input.page, input.pageSize);
        return result;
      }),

    // 清除單個卡牌快取（通過卡牌 ID）
    clearSingleCardCache: adminProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { clearSnkrdunkCacheByCardId } = await import('./db');
        const deletedCount = await clearSnkrdunkCacheByCardId(input.cardId);
        return { success: true, deletedCount, message: `已清除卡牌 ${input.cardId} 的快取` };
      }),

    // 批量清除所有快取
    clearAllCacheBatch: adminProcedure
      .mutation(async () => {
        const { clearAllSnkrdunkCache } = await import('./db');
        const deletedCount = await clearAllSnkrdunkCache();
        return { success: true, deletedCount, message: `已清除 ${deletedCount} 個快取記錄` };
      }),

    // 啟動批量更新任務（創建任務記錄）
    startBatchUpdateTask: adminProcedure
      .mutation(async () => {
        // 檢查是否已有運行中的任務
        const existingTask = await db.getRunningBatchUpdateTask('batch_snkrdunk_update');
        if (existingTask) {
          return {
            taskId: existingTask.id,
            message: '已有批量更新任務運行中',
            existing: true,
          };
        }

        // 獲取總卡牌數
        const stats = await db.getDetailedSnkrdunkCacheStats();
        const totalItems = stats.needUpdate;

        // 創建新任務
        const taskId = await db.createScheduledTask({
          taskType: 'batch_snkrdunk_update',
          status: 'running',
          totalItems,
          processedItems: 0,
          successCount: 0,
          failureCount: 0,
          progress: 0,
          metadata: JSON.stringify({ errors: [] }),
        });

        return {
          taskId,
          totalItems,
          message: '批量更新任務已啟動',
          existing: false,
        };
      }),

    // 更新批量更新任務進度
    updateBatchUpdateProgress: adminProcedure
      .input(z.object({
        taskId: z.number(),
        processed: z.number(),
        success: z.number(),
        failed: z.number(),
        skipped: z.number(),
        errors: z.array(z.object({
          cardId: z.number(),
          error: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        const task = await db.getScheduledTask(input.taskId);
        if (!task) {
          throw new Error(`Task ${input.taskId} not found`);
        }

        const newProcessedItems = (task.processedItems || 0) + input.processed;
        const newSuccessCount = (task.successCount || 0) + input.success;
        const newFailureCount = (task.failureCount || 0) + input.failed;
        const progress = task.totalItems ? Math.round((newProcessedItems / task.totalItems) * 100) : 0;

        // 更新錯誤信息
        let metadata: any = {};
        try {
          metadata = task.metadata ? JSON.parse(task.metadata) : {};
        } catch (e) {
          metadata = {};
        }

        if (!metadata.errors) {
          metadata.errors = [];
        }
        metadata.errors.push(...input.errors);

        // 只保留最近 100 個錯誤
        if (metadata.errors.length > 100) {
          metadata.errors = metadata.errors.slice(-100);
        }

        await db.updateScheduledTask(input.taskId, {
          processedItems: newProcessedItems,
          successCount: newSuccessCount,
          failureCount: newFailureCount,
          progress,
          metadata: JSON.stringify(metadata),
        });

        return {
          success: true,
          progress,
          processedItems: newProcessedItems,
        };
      }),

    // 獲取 SNKRDUNK 快取批量更新任務進度
    getSnkrdunkCacheBatchUpdateProgress: adminProcedure
      .query(async () => {
        const task = await db.getLatestBatchUpdateTask('batch_snkrdunk_update');
        if (!task) {
          return null;
        }

        // 解析錯誤信息
        let errors: Array<{ cardId: number; error: string }> = [];
        try {
          const metadata = task.metadata ? JSON.parse(task.metadata) : {};
          errors = metadata.errors || [];
        } catch (e) {
          console.error('Failed to parse task metadata:', e);
        }

        return {
          taskId: task.id,
          taskType: task.taskType,
          status: task.status,
          totalItems: task.totalItems || 0,
          processedItems: task.processedItems || 0,
          successCount: task.successCount || 0,
          failureCount: task.failureCount || 0,
          progress: task.progress || 0,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          errors,
        };
      }),

    // 完成批量更新任務
    completeBatchUpdateTask: adminProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.updateScheduledTask(input.taskId, {
          status: 'completed',
          completedAt: new Date(),
          progress: 100,
        });

        return { success: true };
      }),

    // 停止批量更新任務
    stopBatchUpdateTask: adminProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.updateScheduledTask(input.taskId, {
          status: 'completed',
          completedAt: new Date(),
        });

        return { success: true };
      }),
    // Task History APIs
    getTaskHistory: adminProcedure
      .input(z.object({
        page: z.number().min(1).optional(),
        pageSize: z.number().min(1).max(100).optional(),
        taskType: z.string().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await batchTaskManager.getTaskHistory(input);
      }),

    getTaskStats: adminProcedure
      .query(async () => {
        return await batchTaskManager.getTaskStats();
      }),

    cleanOldTasks: adminProcedure
      .input(z.object({
        keepCount: z.number().min(5).max(500).optional(),
      }))
      .mutation(async ({ input }) => {
        const deletedCount = await batchTaskManager.cleanOldTasks(input.keepCount || 50);
        return { success: true, deletedCount };
      }),

    deleteTask: adminProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ input }) => {
        // Only allow deleting completed or failed tasks
        const task = await batchTaskManager.getBatchTaskProgress(input.taskId);
        if (!task) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '找不到該任務' });
        }
        if (task.status === 'running' || task.status === 'paused') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '無法刪除正在運行或暫停的任務，請先取消任務' });
        }
        const dbInstance = await db.getDb();
        if (dbInstance) {
          const { scheduledTasks } = require('../drizzle/schema_new');
          const { eq } = require('drizzle-orm');
          await dbInstance.delete(scheduledTasks).where(eq(scheduledTasks.id, input.taskId));
        }
        return { success: true };
      }),

    // User Management APIs
    getUserList: adminProcedure
      .input(z.object({
        page: z.number().min(1).optional(),
        pageSize: z.number().min(1).max(100).optional(),
        search: z.string().optional(),
        role: z.enum(["admin", "user"]).optional(),
        loginMethod: z.enum(["password", "google"]).optional(),
        isBlocked: z.boolean().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { getUserList } = await import('./userManagement');
        return await getUserList(input || {});
      }),

    getUserStats: adminProcedure
      .query(async () => {
        const { getUserStats } = await import('./userManagement');
        return await getUserStats();
      }),

    updateUserRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(["admin", "user"]),
      }))
      .mutation(async ({ input }) => {
        const { updateUserRole } = await import('./userManagement');
        return await updateUserRole(input.userId, input.role);
      }),

    updateUser: adminProcedure
      .input(z.object({
        userId: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
      }))
      .mutation(async ({ input }) => {
        const { updateUser } = await import('./userManagement');
        const { userId, ...data } = input;
        return await updateUser(userId, data);
      }),

    resetUserPassword: adminProcedure
      .input(z.object({
        userId: z.number(),
        newPassword: z.string().min(8),
      }))
      .mutation(async ({ input }) => {
        const { resetUserPassword } = await import('./userManagement');
        return await resetUserPassword(input.userId, input.newPassword);
      }),

    deleteUser: adminProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { deleteUser } = await import('./userManagement');
        return await deleteUser(input.userId);
      }),

    getUserById: adminProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .query(async ({ input }) => {
        const { getUserById } = await import('./userManagement');
        return await getUserById(input.userId);
      }),

    getUserDetailWithStats: adminProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .query(async ({ input }) => {
        const { getUserDetailWithStats } = await import('./userManagement');
        return await getUserDetailWithStats(input.userId);
      }),
    blockUser: adminProcedure
      .input(z.object({
        userId: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { blockUser } = await import('./userManagement');
        return await blockUser(input.userId, input.reason);
      }),
    unblockUser: adminProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { unblockUser } = await import('./userManagement');
        return await unblockUser(input.userId);
      }),
    
    // Get trending rankings cache status
    getTrendingCacheStatus: adminProcedure
      .query(async () => {
        const { getTrendingCacheStatus } = await import('./trendingCacheManager');
        const status = await getTrendingCacheStatus();
        return status || [];
      }),
    
    // Manually refresh trending rankings cache
    refreshTrendingCache: adminProcedure
      .mutation(async () => {
        const { manualRefreshTrendingCache } = await import('./trendingCacheManager');
        const result = await manualRefreshTrendingCache();
        return result;
      }),
  }),

  watchlist: router({
    getUserWatchlist: publicProcedure
      .query(async ({ ctx }) => {
        const watchlist = await db.getUserWatchlist(ctx.user?.id || 0);
        return watchlist;
      }),

    addToWatchlist: publicProcedure
      .input(z.object({
        cardId: z.number(),
        targetPrice: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.addToWatchlist(
          ctx.user?.id || 0,
          input.cardId,
          input.targetPrice,
          input.notes
        );
        return { success: true, result };
      }),

    removeFromWatchlist: publicProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.removeFromWatchlist(ctx.user?.id || 0, input.cardId);
        return { success: true, result };
      }),
  }),

  templates: templatesRouter,

  // Market Insights router - provides market analysis data
  marketInsights: router({
    // Get top 5 cards with highest price increase in the past 7 days
    getTopGainers: publicProcedure
      .input(z.object({
        days: z.number().optional().default(7),
        limit: z.number().optional().default(5),
      }))
      .query(async ({ input }) => {
        const topGainers = await db.getTopPriceGainers(input.days, input.limit);
        return topGainers;
      }),

    // Get top 5 most searched cards in the past 7 days
    getTopSearched: publicProcedure
      .input(z.object({
        days: z.number().optional().default(7),
        limit: z.number().optional().default(5),
      }))
      .query(async ({ input }) => {
        // userSearchLogs table removed, return empty array
        return [];
      }),

    // Get top 5 cards with highest price volatility in the past 7 days
    getTopVolatile: publicProcedure
      .input(z.object({
        days: z.number().optional().default(7),
        limit: z.number().optional().default(5),
      }))
      .query(async ({ input }) => {
        const topVolatile = await db.getTopVolatileCards(input.days, input.limit);
        return topVolatile;
      }),

    // Get market overview statistics
    getMarketOverview: publicProcedure
      .query(async () => {
        const overview = await db.getMarketOverview();
        return overview;
      }),

    // Generate market analysis using LLM
    generateAnalysis: publicProcedure
      .input(z.object({
        language: z.enum(["zh-TW", "en", "ja"]).optional().default("zh-TW"),
      }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import("./_core/llm");
        
        // Fetch market data
        const topGainers = await db.getTopPriceGainers(7, 5);
        // const topSearched = await db.getTopSearchedCards(7, 5); // userSearchLogs table removed
        const topSearched: any[] = []; // Placeholder
        const topVolatile = await db.getTopVolatileCards(7, 5);
        const overview = await db.getMarketOverview();

        // Prepare prompt based on language
        const languageMap = {
          "zh-TW": "繁體中文",
          "en": "English",
          "ja": "日本語",
        };

        const prompt = `你是一位專業的 PTCG（Pokémon Trading Card Game）市場分析師。請根據以下市場數據，生成一份專業的市場分析報告。

市場概況：
- 追蹤卡牌數量：${overview.totalCards}
- 價格記錄數量：${overview.totalPriceRecords}
- 用戶搜尋次數：${overview.totalSearches}
- 7 天平均漲幅：${overview.avgPriceChange7d.toFixed(2)}%

本週漲幅 Top 5：
${topGainers.map((card, i) => `${i + 1}. ${card.cardName} - 漲幅 ${card.priceChange.toFixed(2)}%`).join("\n")}

熱門搜尋 Top 5：
${topSearched.map((card, i) => `${i + 1}. ${card.cardName} - ${card.searchCount} 次搜尋`).join("\n")}

價格波動 Top 5：
${topVolatile.map((card, i) => `${i + 1}. ${card.cardName} - 波動率 ${card.volatility.toFixed(2)}%`).join("\n")}

請用${languageMap[input.language]}撰寫一份 200-300 字的市場分析報告，包含以下內容：
1. 本週市場整體趨勢分析
2. 重點卡牌分析（挑選 2-3 張最值得關注的卡牌）
3. 投資建議和風險提示

請使用專業但易懂的語言，避免過度技術性的術語。`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "你是一位專業的 PTCG 市場分析師，擅長分析卡牌市場趨勢和提供投資建議。" },
              { role: "user", content: prompt },
            ],
          });

          const analysis = response.choices[0]?.message?.content || "無法生成市場分析，請稍後再試。";
          return { analysis };
        } catch (error) {
          console.error("[LLM] Failed to generate market analysis:", error);
          return { analysis: "市場分析生成失敗，請稍後再試。" };
        }
      }),
  }),

  // Blog router - article management and AI generation
  blog: router({
    // Debug: Get post data for troubleshooting
    debugGetPost: publicProcedure
      .input(z.object({ id: z.number().optional() }))
      .query(async ({ input }) => {
        const blogDb = await import('./blogDb');
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { posts } = await import('../drizzle/schema_new');
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
        const blogDb = await import('./blogDb');
        return await blogDb.getPosts(input);
      }),

    // Get post by slug
    getPostBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const blogDb = await import('./blogDb');
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
        const blogDb = await import('./blogDb');
        
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
        const blogDb = await import('./blogDb');
        
        // Save current version before updating
        const currentPost = await blogDb.getPostById(input.id);
        if (currentPost && ctx.user) {
          const { getDb } = await import('./db');
          const db = await getDb();
          if (db) {
            const { postVersions } = await import('../drizzle/schema_new');
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
        const blogDb = await import('./blogDb');
        const { getDb } = await import('./db');
        const db = await getDb();
        
        // Clean up related data
        await blogDb.removeTagsFromPost(input.id);
        
        // Clean up postVersions and postShares
        if (db) {
          const { eq } = await import('drizzle-orm');
          const { postVersions, postShares } = await import('../drizzle/schema_new');
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
        const blogDb = await import('./blogDb');
        await blogDb.togglePublishPost(input.id);
        return { success: true };
      }),

    // AI translate post (Admin only)
    translatePost: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const blogDb = await import('./blogDb');
        const { invokeLLM } = await import('./_core/llm');
        
        // Get post data
        const post = await blogDb.getPostById(input.id);
        if (!post) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
        }
        
        // Generate English translation using JSON schema
        const enResponse = await invokeLLM({
          messages: [
            { role: 'system', content: 'You are a professional translator. Translate the Chinese blog post to English. Maintain markdown formatting.' },
            { role: 'user', content: `Translate this blog post to English:\n\nTitle: ${post.title}\n\nExcerpt: ${post.excerpt || ''}\n\nContent:\n${post.content}` }
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
            { role: 'system', content: 'You are a professional translator. Translate the Chinese blog post to Japanese. Maintain markdown formatting.' },
            { role: 'user', content: `Translate this blog post to Japanese:\n\nTitle: ${post.title}\n\nExcerpt: ${post.excerpt || ''}\n\nContent:\n${post.content}` }
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
        const blogDb = await import('./blogDb');
        const { id, ...translations } = input;
        
        // Update post with translations
        await blogDb.updatePost(id, translations);
        
        return { success: true };
      }),

    // Get all categories
    getCategories: publicProcedure
      .query(async () => {
        const blogDb = await import('./blogDb');
        return await blogDb.getCategories();
      }),

    // Create category (Admin only)
    createCategory: adminProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const blogDb = await import('./blogDb');
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
        const blogDb = await import('./blogDb');
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
        const blogDb = await import('./blogDb');
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
        const blogDb = await import('./blogDb');
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
        const articleGenerator = await import('./articleGenerator');
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
        const articleGenerator = await import('./articleGenerator');
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
        const { generateImage } = await import('./_core/imageGeneration');
        const result = await generateImage({ prompt: input.prompt });
        return result;
      }),

    // Get post versions (Admin only)
    getPostVersions: adminProcedure
      .input(z.object({ postId: z.number() }))
      .query(async ({ input }) => {
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { postVersions, users } = await import('../drizzle/schema_new');
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
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { postVersions } = await import('../drizzle/schema_new');
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
        const blogDb = await import('./blogDb');
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
        const { invokeLLM } = await import('./_core/llm');
        
        // Call LLM to generate metadata
        const response = await invokeLLM({
          messages: [
            { 
              role: 'system', 
              content: 'You are a professional SEO specialist and content categorizer. Analyze the article and generate appropriate category, tags, and SEO keywords. Return the result in JSON format.' 
            },
            { 
              role: 'user', 
              content: `Analyze this article and generate metadata:\n\nTitle: ${input.title}\n\nExcerpt: ${input.excerpt}\n\nContent:\n${input.content.substring(0, 2000)}...\n\nPlease generate:\n1. A single category (e.g., "市場分析", "卡牌評測", "新聞資訊", "投資指南")\n2. 3-5 relevant tags (e.g., "Pokémon TCG", "卡牌價格", "市場趨勢")\n3. 5-8 SEO keywords (e.g., "Pokémon TCG", "寶可夢卡牌", "市場分析", "投資指南")` 
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
        const { invokeLLM } = await import('./_core/llm');
        
        // Call LLM to edit the article based on user instruction
        const response = await invokeLLM({
          messages: [
            { 
              role: 'system', 
              content: 'You are a professional blog editor. Edit the article based on user instructions while maintaining the original style and structure. Return the edited article in JSON format with title, excerpt, and content fields. Keep markdown formatting.' 
            },
            { 
              role: 'user', 
              content: `Edit this article based on the following instruction:\n\nInstruction: ${input.instruction}\n\nCurrent Article:\nTitle: ${input.article.title}\n\nExcerpt: ${input.article.excerpt}\n\nContent:\n${input.article.content}` 
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
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { uploadedImages, users } = await import('../drizzle/schema_new');
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
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { uploadedImages } = await import('../drizzle/schema_new');
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
        
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { uploadedImages } = await import('../drizzle/schema_new');
        
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
  }),

  // Trending router - hot cards rankings
  trending: router({
    // Get trending cards by search popularity
    getBySearches: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(20).optional(),
        days: z.number().min(1).max(90).optional(),
      }))
      .query(async ({ input }) => {
        // Try to get from cache first (only for default 30-day range)
        if (input.days === 30 || input.days === undefined) {
          const { getTrendingFromCache } = await import("./trendingCacheManager");
          const cachedData = await getTrendingFromCache("search_popularity", 30);
          if (cachedData) {
            console.log("[Trending API] Serving from cache: search_popularity");
            return input.limit ? cachedData.slice(0, input.limit) : cachedData;
          }
        }
        
        // Fall back to real-time calculation
        console.log("[Trending API] Cache miss, calculating in real-time: search_popularity");
        const results = await db.getTrendingBySearches({
          limit: input.limit,
          days: input.days,
        });
        return results;
      }),

    // Get trending cards by price increase
    getByPriceIncrease: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(20).optional(),
        days: z.number().min(1).max(90).optional(),
      }))
      .query(async ({ input }) => {
        // Try to get from cache first (only for default 30-day range)
        if (input.days === 30 || input.days === undefined) {
          const { getTrendingFromCache } = await import("./trendingCacheManager");
          const cachedData = await getTrendingFromCache("price_increase", 30);
          if (cachedData) {
            console.log("[Trending API] Serving from cache: price_increase");
            return input.limit ? cachedData.slice(0, input.limit) : cachedData;
          }
        }
        
        // Fall back to real-time calculation
        console.log("[Trending API] Cache miss, calculating in real-time: price_increase");
        const results = await db.getTrendingByPriceIncrease({
          limit: input.limit,
          days: input.days,
        });
        return results;
      }),

    // Get trending cards by price decrease
    getByPriceDecrease: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(20).optional(),
        days: z.number().min(1).max(90).optional(),
      }))
      .query(async ({ input }) => {
        // Try to get from cache first (only for default 30-day range)
        if (input.days === 30 || input.days === undefined) {
          const { getTrendingFromCache } = await import("./trendingCacheManager");
          const cachedData = await getTrendingFromCache("price_decrease", 30);
          if (cachedData) {
            console.log("[Trending API] Serving from cache: price_decrease");
            return input.limit ? cachedData.slice(0, input.limit) : cachedData;
          }
        }
        
        // Fall back to real-time calculation
        console.log("[Trending API] Cache miss, calculating in real-time: price_decrease");
        const results = await db.getTrendingByPriceDecrease({
          limit: input.limit,
          days: input.days,
        });
        return results;
      }),

    // Get newly added cards
    getNewlyAdded: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(20).optional(),
        days: z.number().min(1).max(90).optional(),
      }))
      .query(async ({ input }) => {
        const results = await db.getNewlyAddedCards({
          limit: input.limit,
          days: input.days,
        });
        return results;
      }),

    // Get price history for a card (for trend charts)
    getPriceHistory: publicProcedure
      .input(z.object({
        cardId: z.number(),
        days: z.number().min(1).max(90).optional(),
      }))
      .query(async ({ input }) => {
        const history = await db.getCardPriceHistory(input.cardId, input.days);
        return history;
      }),
  }),

  // Profile router - user personal page APIs
  profile: router({
    // Get user's watchlist
    getWatchlist: protectedProcedure
      .query(async ({ ctx }) => {
        const { getUserWatchlist } = await import("./profile");
        const watchlist = await getUserWatchlist(ctx.user.id);
        return watchlist;
      }),

    // Check if card is in watchlist
    isInWatchlist: protectedProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const { isCardInWatchlist } = await import("./profile");
        const isInWatchlist = await isCardInWatchlist(ctx.user.id, input.cardId);
        return { isInWatchlist };
      }),

    // Add card to watchlist
    addToWatchlist: protectedProcedure
      .input(z.object({
        cardId: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { addToWatchlist } = await import("./profile");
        await addToWatchlist(ctx.user.id, input.cardId, input.notes);
        return { success: true };
      }),

    // Update watchlist notes
    updateWatchlistNotes: protectedProcedure
      .input(z.object({
        watchlistId: z.number(),
        notes: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateWatchlistNotes } = await import("./profile");
        await updateWatchlistNotes(ctx.user.id, input.watchlistId, input.notes);
        return { success: true };
      }),

    // Remove from watchlist by watchlist ID
    removeFromWatchlist: protectedProcedure
      .input(z.object({
        watchlistId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { removeFromWatchlist } = await import("./profile");
        await removeFromWatchlist(ctx.user.id, input.watchlistId);
        return { success: true };
      }),

    // Remove from watchlist by card ID
    removeFromWatchlistByCardId: protectedProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { removeFromWatchlistByCardId } = await import("./profile");
        await removeFromWatchlistByCardId(ctx.user.id, input.cardId);
        return { success: true };
      }),

    // Get view history
    getViewHistory: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const { getUserViewHistory } = await import("./profile");
        const history = await getUserViewHistory(ctx.user.id, input.limit);
        return history;
      }),

    // Add view history record
    addViewHistory: protectedProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { addViewHistory } = await import("./profile");
        await addViewHistory(ctx.user.id, input.cardId);
        return { success: true };
      }),

    // Clear view history
    clearViewHistory: protectedProcedure
      .mutation(async ({ ctx }) => {
        const { clearViewHistory } = await import("./profile");
        await clearViewHistory(ctx.user.id);
        return { success: true };
      }),

    // Get watchlist statistics
    getWatchlistStats: protectedProcedure
      .query(async ({ ctx }) => {
        const { getUserWatchlistStats } = await import("./profile");
        const stats = await getUserWatchlistStats(ctx.user.id);
        return stats;
      }),
  }),

  marketplace: marketplaceRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;

