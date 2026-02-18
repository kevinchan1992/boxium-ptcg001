/**
 * SNKRDUNK Service
 * 
 * This service scrapes SNKRDUNK trading card listings using Firecrawl MCP.
 * It extracts PSA 10 graded Pokemon TCG cards that are currently on sale.
 * 
 * URL Format: https://snkrdunk.com/en/trading-cards/{snkrdunk_id}/used?sort=latest&isOnlyOnSale=true
 */

import { execSync } from 'child_process';

interface SnkrdunkListing {
  id: string;
  market: 'snkrdunk';
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

interface SnkrdunkSearchParams {
  snkrdunkId: string;
}

/**
 * Fetch SNKRDUNK listings for a Pokemon TCG card using Firecrawl MCP
 * 
 * @param params - Search parameters including SNKRDUNK ID
 * @returns Array of formatted SNKRDUNK listings
 */
export async function fetchSnkrdunkListings(params: SnkrdunkSearchParams): Promise<SnkrdunkListing[]> {
  const { snkrdunkId } = params;

  if (!snkrdunkId) {
    console.log('[SNKRDUNK Service] No SNKRDUNK ID provided');
    return [];
  }

  // Construct SNKRDUNK URL
  const url = `https://snkrdunk.com/en/trading-cards/${snkrdunkId}/used?sort=latest&isOnlyOnSale=true`;
  console.log('[SNKRDUNK Service] Scraping URL:', url);

  try {
    // Use Firecrawl MCP to scrape the page with JSON extraction
    const firecrawlInput = JSON.stringify({
      url: url,
      formats: [{
        type: 'json',
        prompt: 'Extract all PSA 10 graded trading card listings that are currently on sale. For each listing, extract: product title, price (in JPY), seller name, condition/grade, product image URL, and product page URL.',
        schema: {
          type: 'object',
          properties: {
            listings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  price: { type: 'number' },
                  sellerName: { type: 'string' },
                  condition: { type: 'string' },
                  imageUrl: { type: 'string' },
                  productUrl: { type: 'string' }
                },
                required: ['title', 'price']
              }
            }
          },
          required: ['listings']
        }
      }],
      waitFor: 5000
    });

    console.log('[SNKRDUNK Service] Calling Firecrawl MCP...');
    
    // Execute Firecrawl MCP command
    const result = execSync(
      `manus-mcp-cli tool call firecrawl_scrape --server firecrawl --input '${firecrawlInput}'`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );

    console.log('[SNKRDUNK Service] Firecrawl response received');

    // Parse the response
    // manus-mcp-cli output may contain extra text, extract JSON part
    let response: any;
    try {
      // Try to find JSON in the output
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        response = JSON.parse(jsonMatch[0]);
      } else {
        console.error('[SNKRDUNK Service] No JSON found in Firecrawl output:', result.substring(0, 200));
        return [];
      }
    } catch (e) {
      console.error('[SNKRDUNK Service] Failed to parse Firecrawl response:', e);
      console.error('[SNKRDUNK Service] Raw output:', result.substring(0, 200));
      return [];
    }
    
    // Extract the JSON data from Firecrawl response
    let scrapedData: any;
    if (response.content && Array.isArray(response.content)) {
      const jsonContent = response.content.find((item: any) => item.type === 'text' && item.text);
      if (jsonContent) {
        try {
          scrapedData = JSON.parse(jsonContent.text);
        } catch (e) {
          console.error('[SNKRDUNK Service] Failed to parse JSON content:', e);
          return [];
        }
      }
    }

    if (!scrapedData || !scrapedData.listings || !Array.isArray(scrapedData.listings)) {
      console.log('[SNKRDUNK Service] No listings found in scraped data');
      return [];
    }

    console.log(`[SNKRDUNK Service] Found ${scrapedData.listings.length} listings`);

    // Format SNKRDUNK listings to unified format
    const listings: SnkrdunkListing[] = scrapedData.listings
      .filter((item: any) => item.price && item.price > 0)
      .map((item: any, index: number) => ({
        id: `snkrdunk-${snkrdunkId}-${index}`,
        market: 'snkrdunk',
        title: item.title || 'Unknown',
        price: item.price,
        currency: 'JPY',
        image: item.imageUrl || '',
        productUrl: item.productUrl || url,
        seller: {
          name: item.sellerName || 'Unknown',
          rating: undefined,
        },
        grade: 'PSA 10',
        condition: item.condition || 'Used',
        lastUpdated: new Date().toISOString(),
      }));

    console.log(`[SNKRDUNK Service] Returning ${listings.length} valid listings`);
    return listings;
  } catch (error) {
    console.error('[SNKRDUNK Service] Error fetching listings:', error);
    // Return empty array instead of throwing to allow graceful degradation
    return [];
  }
}

/**
 * Test function to verify SNKRDUNK scraping integration
 */
export async function testSnkrdunkAPI() {
  try {
    console.log('[SNKRDUNK Service] Testing scraping integration...');
    const results = await fetchSnkrdunkListings({
      snkrdunkId: '93003', // Example SNKRDUNK ID
    });
    console.log(`[SNKRDUNK Service] Test successful: ${results.length} listings found`);
    return results;
  } catch (error) {
    console.error('[SNKRDUNK Service] Test failed:', error);
    throw error;
  }
}
