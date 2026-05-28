/**
 * Cards tRPC Router
 * Handles card search, lookup, price history, trends, watchlist, and trending rankings
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import * as db from "../db";

// In-memory cache for getStats (avoids repeated COUNT(*) queries)
let statsCache: { data: { totalCards: number; totalPriceRecords: number }; fetchedAt: number } | null = null;

export const cardsRouter = router({
    search: publicProcedure
      .input(z.object({
        query: z.string(),
        limit: z.number().optional().default(20),
        offset: z.number().optional().default(0),
        includeSealedProducts: z.boolean().optional().default(true),
        cardsOnly: z.boolean().optional().default(false),
      }))
      .query(async ({ input }) => {
        const { parseGradeFilter } = await import('../db');
        const { gradeLabel } = parseGradeFilter(input.query);
        let results: { cards: any[]; total: number };
        try {
          results = await db.searchCards(input.query, input.limit, input.offset);
        } catch (err: any) {
          const isTimeout = err?.message?.includes('Timeout') || err?.message?.includes('timeout');
          console.error(`[cards.search] searchCards failed (${isTimeout ? 'TIMEOUT' : 'ERROR'}):`, err?.message || err);
          // Use TIMEOUT code for timeout errors (signals client to retry with backoff)
          // Use INTERNAL_SERVER_ERROR for other failures
          throw new TRPCError({
            code: isTimeout ? 'TIMEOUT' : 'INTERNAL_SERVER_ERROR',
            message: isTimeout
              ? 'Search is warming up, please retry in a few seconds.'
              : 'Search temporarily unavailable, please try again.',
          });
        }

        // Sealed products are only shown on page 1 (offset === 0).
        // They do NOT affect the pagination total so that page N always
        // maps to the correct slice of the card result set.
        let sealedResults: any[] = [];
        if (!input.cardsOnly && input.includeSealedProducts && input.query.trim() && input.offset === 0) {
          try {
            const sealedData = await db.searchSealedProducts(input.query, 10, 0);
            sealedResults = (sealedData.products || []).map((p: any) => ({
              ...p,
              productType: 'sealed_product' as const,
            }));
          } catch (e) {
            // ignore sealed product search errors
          }
        }

        // Merge: sealed products first (only on page 1), then cards
        const mergedCards = [...sealedResults, ...(results.cards || [])];
        return {
          cards: mergedCards,
          // total reflects ONLY card count for correct pagination calculation
          total: results.total,
          sealedCount: sealedResults.length,
          gradeLabel,
        };
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
        const { parseCardNumber, normalizeCardQuery } = await import('../utils/cardNumberNormalize');
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

    /**
     * Get reference price for a card by condition/grade
     * Used in seller listing dialog to show condition-specific market price
     */
    getPriceByCondition: publicProcedure
      .input(z.object({
        cardId: z.number(),
        condition: z.string(),
      }))
      .query(async ({ input }) => {
        // Map frontend condition values to database grade values
        const conditionToGrade: Record<string, string> = {
          psa10: 'PSA 10',
          psa9: 'PSA 9',
          psa8_below: 'PSA 8以下',
          bgs10: 'PSA 10',
          bgs9: 'PSA 10',
          bgs8_below: 'PSA 10',
          tag10: 'PSA 10',
          tag9_below: 'PSA 10',
          raw_a: 'A',
          raw_b: 'B',
          raw_c: 'C',
          raw_d: 'D',
        };

        const grade = conditionToGrade[input.condition] || 'PSA 10';
        const isFallback = ['bgs10','bgs9','bgs8_below','tag10','tag9_below'].includes(input.condition);

        const result = await db.getCardPriceByGrade(input.cardId, grade);
        return {
          ...result,
          condition: input.condition,
          isFallback,
          fallbackGrade: isFallback ? 'PSA 10' : null,
        };
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
          // In-memory cache: refresh at most once every 60 minutes (v11.2: was 5min; COUNT(*) on TiDB ~1.6s, now uses APPROX_COUNT_DISTINCT ~248ms)
          const now = Date.now();
          if (statsCache && now - statsCache.fetchedAt < 60 * 60 * 1000) {
            return statsCache.data;
          }
          const [totalCards, totalPriceRecords] = await Promise.all([
            db.getTotalCardCount(),
            db.getTotalPriceRecordCount(),
          ]);
          const data = { totalCards: totalCards ?? 0, totalPriceRecords: totalPriceRecords ?? 0 };
          statsCache = { data, fetchedAt: now };
          return data;
        } catch (error: any) {
          console.error("[getStats] Error:", error);
          // Return stale cache on error if available
          if (statsCache) return statsCache.data;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to get stats: ${error.message}`,
          });
        }
      }),

    getTrending: publicProcedure
      .input(z.object({
        limit: z.number().optional().default(5),
        gameId: z.number().optional(), // Filter by game type (1=Pokémon, 2=One Piece)
      }))
      .query(async ({ input }) => {
        try {
          // Use cached trending cards (calculated daily at 06:00 HKT)
          const cachedCards = await db.getCachedTrendingCards(input.gameId);
          
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
                  (record.grade === 'PSA 10')
                );
              })()
            : allHistory.filter(record => 
                (record.grade === 'PSA 10')
              );

          // Group by date (SNKRDUNK only)
          const groupedByDate = new Map<string, any[]>();
          
          for (const record of recentHistory) {
            // Only include PSA 10 records from SNKRDUNK
            if (record.grade !== 'PSA 10') continue;
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
          const { searchCardByImage } = await import("../imageCardSearch");
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
            const parts: string[] = [];
            
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
        const COOLDOWN_HOURS = 1;
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
          const { fetchPriceHistory, convertJpyToHkd } = await import('../snkrdunkScraper');
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
          const { validateAndFilterPriceHistory } = await import('../utils/priceValidator');
          const validatedPriceHistory = validateAndFilterPriceHistory(priceHistoryData, productType);

          // Assign per-group sourcePosition (same logic as persistentSnkrdunkBatchUpdate.ts)
          // This ensures same-day same-price records each get a unique recordHash
          // and are NOT incorrectly deduplicated away.
          // groupKey = "YYYY-MM-DD|grade|jpyPrice" — position resets to 0 for each unique group.
          const groupCounters = new Map<string, number>();
          let recordsAdded = 0;
          for (const priceItem of validatedPriceHistory) {
            const priceHKD = convertJpyToHkd(priceItem.price);
            const gradeNorm = productType === 'single_card'
              ? (priceItem.normalisedGrade ?? priceItem.grade ?? null)
              : null;
            const jpyPrice = priceItem.jpyPrice ?? priceItem.price;
            const soldAtStr = priceItem.soldAt
              ? priceItem.soldAt.toISOString().slice(0, 10)
              : 'unknown';
            const gradeKey = gradeNorm ?? 'null';
            const groupKey = `${soldAtStr}|${gradeKey}|${jpyPrice}`;
            const sourcePosition = groupCounters.get(groupKey) ?? 0;
            groupCounters.set(groupKey, sourcePosition + 1);

            const result = await db.addPriceHistory({
              cardId: cardId,
              source: 'snkrdunk',
              price: priceHKD.toString(),
              currency: 'HKD',
              jpyPrice,
              sourcePosition,
              grade: productType === 'sealed_product' ? undefined : (gradeNorm ?? undefined),
              quantity: productType === 'sealed_product' ? (priceItem.quantity || undefined) : undefined,
              productType,
              soldAt: priceItem.soldAt,
              // Pass relative-time dedup fields so dynamic time-window check can run
              isRelativeTime: priceItem.isRelativeTime,
              estimatedSoldAt: priceItem.estimatedSoldAt,
            });
            // Only count records that were actually inserted (not skipped by dedup)
            if (result !== null) recordsAdded++;
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
        const dbConn = await (await import('../db')).getDb();
        if (!dbConn) return { prices: {} };
        const { snkrdunkListingsCache } = await import('../../drizzle/schema_new');
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
        cardIds: z.array(z.number()).max(100),
      }))
      .mutation(async ({ input }) => {
        if (input.cardIds.length === 0) return { triggered: 0 };
        // Fire-and-forget: don't await, just kick off background scraping
        (async () => {
          const dbModule = await import('../db');
          const { scrapeSnkrdunkListings } = await import('../services/snkrdunkScraperService');
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
    getSimilarCards: publicProcedure
      .input(z.object({
        cardId: z.number(),
        series: z.string().optional(),
        setName: z.string().optional(),
        limit: z.number().optional().default(12),
      }))
      .query(async ({ input }) => {
        const card = await db.getCardById(input.cardId);
        if (!card) return [];
        const dbConn = await (await import('../db')).getDb();
        if (!dbConn) return [];
        const { cards: cardsTable } = await import('../../drizzle/schema_new');
        const { and, ne, like, eq, desc, sql } = await import('drizzle-orm');
        let similar: any[] = [];

        // Priority 1: Same setName (same expansion pack) - best for internal linking
        const targetSetName = input.setName || card.setName;
        if (targetSetName) {
          similar = await dbConn
            .select()
            .from(cardsTable)
            .where(
              and(
                ne(cardsTable.id, input.cardId),
                eq(cardsTable.setName, targetSetName)
              )
            )
            .orderBy(desc(cardsTable.id))
            .limit(input.limit);
        }

        // Fallback 1: Same series (broader category)
        if (similar.length < 6) {
          const targetSeries = input.series || card.series;
          if (targetSeries) {
            const extra = await dbConn
              .select()
              .from(cardsTable)
              .where(
                and(
                  ne(cardsTable.id, input.cardId),
                  eq(cardsTable.series, targetSeries)
                )
              )
              .orderBy(desc(cardsTable.id))
              .limit(input.limit * 2);
            const existingIds = new Set(similar.map((c: any) => c.id));
            for (const c of extra) {
              if (!existingIds.has(c.id)) similar.push(c);
              if (similar.length >= input.limit) break;
            }
          }
        }

        // Fallback 2: Extract set code from name e.g. [SM11b] -> SM11b
        if (similar.length < 6) {
          const setCodeMatch = card.name.match(/\[([A-Za-z0-9]+)/);
          const setCode = setCodeMatch ? setCodeMatch[1] : null;
          if (setCode) {
            const extra = await dbConn
              .select()
              .from(cardsTable)
              .where(
                and(
                  ne(cardsTable.id, input.cardId),
                  like(cardsTable.name, `%${setCode}%`)
                )
              )
              .orderBy(desc(cardsTable.id))
              .limit(input.limit * 2);
            const existingIds = new Set(similar.map((c: any) => c.id));
            for (const c of extra) {
              if (!existingIds.has(c.id)) similar.push(c);
              if (similar.length >= input.limit) break;
            }
          }
        }

        // Final fallback: same character name (first word)
        if (similar.length < 6) {
          const characterName = card.name.split(/[\s\[\(]/)[0] || '';
          if (characterName) {
            const extra = await dbConn
              .select()
              .from(cardsTable)
              .where(
                and(
                  ne(cardsTable.id, input.cardId),
                  like(cardsTable.name, `%${characterName}%`)
                )
              )
              .orderBy(desc(cardsTable.id))
              .limit(input.limit * 2);
            const existingIds = new Set(similar.map((c: any) => c.id));
            for (const c of extra) {
              if (!existingIds.has(c.id)) similar.push(c);
              if (similar.length >= input.limit) break;
            }
          }
        }
        return similar.slice(0, input.limit);
      }),

    getBySetCode: publicProcedure
      .input(z.object({
        setCode: z.string(),
        limit: z.number().optional().default(100),
        offset: z.number().optional().default(0),
      }))
      .query(async ({ input }) => {
        const { getDb } = await import('../db');
        const dbConn = await getDb();
        if (!dbConn) return { cards: [], total: 0, setInfo: null };
        const { cards: cardsTable } = await import('../../drizzle/schema_new');
        const { eq, sql, desc, count } = await import('drizzle-orm');

        // Get total count
        const [countResult] = await dbConn
          .select({ count: count() })
          .from(cardsTable)
          .where(eq(cardsTable.setName, input.setCode));
        const total = countResult?.count ?? 0;

        // Get cards
        const cards = await dbConn
          .select({
            id: cardsTable.id,
            name: cardsTable.name,
            nameJa: cardsTable.nameJa,
            cardNumber: cardsTable.cardNumber,
            rarity: cardsTable.rarity,
            imageUrl: cardsTable.imageUrl,
            setName: cardsTable.setName,
            series: cardsTable.series,
          })
          .from(cardsTable)
          .where(eq(cardsTable.setName, input.setCode))
          .orderBy(desc(cardsTable.id))
          .limit(input.limit)
          .offset(input.offset);

        // Get series name from first card
        const setInfo = cards.length > 0 ? {
          setCode: input.setCode,
          series: cards[0].series,
          totalCards: total,
        } : null;

        return { cards, total, setInfo };
      }),

    getAllSetCodes: publicProcedure
      .query(async () => {
        const { getDb } = await import('../db');
        const dbConn = await getDb();
        if (!dbConn) return [];
        const { cards: cardsTable } = await import('../../drizzle/schema_new');
        const { sql, desc } = await import('drizzle-orm');

        const sets = await dbConn.execute(sql`
          SELECT setName, series, COUNT(*) as cardCount
          FROM cards
          WHERE setName IS NOT NULL AND setName != ''
          GROUP BY setName, series
          ORDER BY cardCount DESC
          LIMIT 200
        `);

        return (sets[0] as any[]).map((s: any) => ({
          setCode: s.setName,
          series: s.series,
          cardCount: Number(s.cardCount),
        }));
      }),
});

export const pricesRouter = router({
    getHistory: publicProcedure
      .input(z.object({
        cardId: z.number(),
        source: z.enum(["snkrdunk", "ebay", "tcgplayer", "other"]).optional(),
        grade: z.string().optional(),
        limit: z.number().optional().default(50),
        days: z.number().optional(),
      }))
      .query(async ({ input }) => {
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
});

export const watchlistRouter = router({
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
});

export const trendingRouter = router({
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
          const { getTrendingFromCache } = await import("../trendingCacheManager");
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
          const { getTrendingFromCache } = await import("../trendingCacheManager");
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
          const { getTrendingFromCache } = await import("../trendingCacheManager");
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
});
