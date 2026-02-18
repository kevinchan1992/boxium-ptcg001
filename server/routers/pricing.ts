import { router, publicProcedure } from '../_core/trpc';
import { z } from 'zod';
import { fetchEbayListings } from '../services/ebay';
import { fetchSnkrdunkListings } from '../services/snkrdunk';
import * as db from '../db';

interface PriceListing {
  id: string;
  market: 'ebay' | 'snkrdunk';
  title: string;
  price: number;
  currency: string;
  image: string;
  productUrl: string;
  seller: {
    name: string;
    rating?: number;
  };
  grade: string;
  condition: string;
  lastUpdated: string;
}

interface PriceStats {
  totalCount: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  marketDistribution: {
    ebay: number;
    snkrdunk: number;
  };
}

/**
 * Calculate price statistics from listings
 */
function calculateStats(listings: PriceListing[]): PriceStats {
  if (listings.length === 0) {
    return {
      totalCount: 0,
      minPrice: 0,
      maxPrice: 0,
      avgPrice: 0,
      marketDistribution: {
        ebay: 0,
        snkrdunk: 0,
      },
    };
  }

  const prices = listings.map((l) => l.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

  const ebayCount = listings.filter((l) => l.market === 'ebay').length;
  const snkrdunkCount = listings.filter((l) => l.market === 'snkrdunk').length;

  return {
    totalCount: listings.length,
    minPrice,
    maxPrice,
    avgPrice,
    marketDistribution: {
      ebay: ebayCount,
      snkrdunk: snkrdunkCount,
    },
  };
}

export const pricingRouter = router({
  getListings: publicProcedure
    .input(
      z.object({
        cardId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const { cardId } = input;

      console.log(`[Pricing Router] Get listings for cardId: ${cardId}`);

      try {
        // Step 1: Get card details from database
        const card = await db.getCardById(cardId);
        if (!card) {
          throw new Error('Card not found');
        }

        // Step 2: Fetch from eBay API using English name + card number + PSA10
        console.log('[Pricing Router] Fetching from eBay...');
        let ebayListings: any[] = [];
        try {
          const searchQuery = `${card.name} ${card.cardNumber || ''} PSA10`.trim();
          ebayListings = await fetchEbayListings({ cardName: searchQuery });
          console.log(`[Pricing Router] eBay returned ${ebayListings.length} listings`);
        } catch (error) {
          console.error('[Pricing Router] eBay fetch error:', error);
          // Continue even if eBay fails
        }

        // Step 3: Fetch from SNKRDUNK using Firecrawl MCP
        console.log('[Pricing Router] Fetching from SNKRDUNK...');
        let snkrdunkListings: any[] = [];
        try {
          // Get SNKRDUNK data source for this card
          const snkrdunkSource = await db.getDataSourceByCardIdAndSource(cardId, 'snkrdunk');
          if (snkrdunkSource && snkrdunkSource.sourceIdentifier) {
            snkrdunkListings = await fetchSnkrdunkListings({ snkrdunkId: snkrdunkSource.sourceIdentifier });
            console.log(`[Pricing Router] SNKRDUNK returned ${snkrdunkListings.length} listings`);
          } else {
            console.log('[Pricing Router] Card has no SNKRDUNK data source');
          }
        } catch (error) {
          console.error('[Pricing Router] SNKRDUNK fetch error:', error);
          // Continue even if SNKRDUNK fails
        }

        // Step 4: Transform to unified format
        const listings = [
          ...ebayListings.map((item: any) => ({
            id: item.id,
            title: item.title,
            price: item.price,
            currency: item.currency,
            imageUrl: item.image,
            source: 'ebay' as const,
            buyUrl: item.productUrl,
            seller: item.seller?.name,
            condition: item.condition,
          })),
          ...snkrdunkListings.map((item: any) => ({
            id: item.id,
            title: item.title,
            price: item.price,
            currency: item.currency,
            imageUrl: item.image,
            source: 'snkrdunk' as const,
            buyUrl: item.productUrl,
            seller: item.seller?.name,
            condition: item.condition,
          })),
        ];

        // Step 5: Sort by price (lowest first)
        listings.sort((a, b) => a.price - b.price);

        console.log(`[Pricing Router] Returning ${listings.length} total listings`);

        return {
          card,
          listings,
        };
      } catch (error) {
        console.error('[Pricing Router] Get listings error:', error);
        throw new Error('Failed to fetch pricing listings');
      }
    }),

  search: publicProcedure
    .input(
      z.object({
        query: z.string(),
        forceRefresh: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const { query, forceRefresh } = input;

      console.log(`[Pricing Router] Search request: "${query}", forceRefresh: ${forceRefresh}`);

      try {
        // Step 1: Parse search query
        // For now, treat the entire query as card name
        // TODO: Add more sophisticated parsing (card number, series extraction)
        const cardName = query.trim();

        if (!cardName) {
          return {
            results: [],
            stats: calculateStats([]),
          };
        }

        // Step 2: Fetch from eBay API
        console.log('[Pricing Router] Fetching from eBay...');
        let ebayListings: PriceListing[] = [];
        try {
          ebayListings = await fetchEbayListings({ cardName });
          console.log(`[Pricing Router] eBay returned ${ebayListings.length} listings`);
        } catch (error) {
          console.error('[Pricing Router] eBay fetch error:', error);
          // Continue even if eBay fails
        }

        // Step 3: Fetch from SNKRDUNK
        // TODO: Implement SNKRDUNK service
        console.log('[Pricing Router] SNKRDUNK service not yet implemented');
        const snkrdunkListings: PriceListing[] = [];

        // Step 4: Merge results
        const allListings = [...ebayListings, ...snkrdunkListings];

        // Step 5: Sort by price (lowest first)
        allListings.sort((a, b) => a.price - b.price);

        // Step 6: Calculate stats
        const stats = calculateStats(allListings);

        console.log(`[Pricing Router] Returning ${allListings.length} total listings`);

        return {
          results: allListings,
          stats,
        };
      } catch (error) {
        console.error('[Pricing Router] Search error:', error);
        throw new Error('Failed to search for pricing data');
      }
    }),
});
