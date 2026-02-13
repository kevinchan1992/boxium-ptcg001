/**
 * eBay Finding API Integration
 * Searches for sold PSA10 Pokemon cards on eBay
 */

import axios from "axios";

const EBAY_APP_ID = process.env.EBAY_APP_ID;
const EBAY_FINDING_API_URL = "https://svcs.ebay.com/services/search/FindingService/v1";

export interface EbaySoldItem {
  title: string;
  price: number;
  currency: string;
  soldDate: Date;
  imageUrl: string | null;
  itemUrl: string;
  condition: string;
}

/**
 * Search for sold PSA10 Pokemon cards on eBay
 * @param cardName - English card name (e.g., "Solgaleo & Lunala GX Lillie")
 * @param cardNumber - Card number (e.g., "SM11b 063/049")
 * @param limit - Maximum number of results to return (default: 20)
 */
export async function searchEbaySoldItems(
  cardName: string,
  cardNumber: string,
  limit: number = 20
): Promise<EbaySoldItem[]> {
  if (!EBAY_APP_ID) {
    throw new Error("EBAY_APP_ID is not configured");
  }

  try {
    // Construct search query: card name + card number + PSA 10
    const searchQuery = `${cardName} ${cardNumber} PSA 10`;

    // Build eBay Finding API request
    const params = new URLSearchParams({
      "OPERATION-NAME": "findCompletedItems",
      "SERVICE-VERSION": "1.0.0",
      "SECURITY-APPNAME": EBAY_APP_ID,
      "RESPONSE-DATA-FORMAT": "JSON",
      "REST-PAYLOAD": "true",
      "keywords": searchQuery,
      "paginationInput.entriesPerPage": limit.toString(),
      "sortOrder": "EndTimeSoonest", // Most recent first
      // Filter for sold items only
      "itemFilter(0).name": "SoldItemsOnly",
      "itemFilter(0).value": "true",
      // Filter for Pokemon TCG category (183454)
      "itemFilter(1).name": "CategoryId",
      "itemFilter(1).value": "183454",
    });

    const response = await axios.get(`${EBAY_FINDING_API_URL}?${params.toString()}`, {
      headers: {
        "Accept": "application/json",
      },
      timeout: 15000,
    });

    const data = response.data;

    // Parse eBay API response
    const searchResult = data.findCompletedItemsResponse?.[0]?.searchResult?.[0];
    
    if (!searchResult || searchResult["@count"] === "0") {
      console.log(`[eBay] No sold items found for: ${searchQuery}`);
      return [];
    }

    const items = searchResult.item || [];
    const soldItems: EbaySoldItem[] = [];

    for (const item of items) {
      try {
        const title = item.title?.[0] || "Unknown";
        const priceStr = item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__;
        const currency = item.sellingStatus?.[0]?.currentPrice?.[0]?.["@currencyId"] || "USD";
        const soldDateStr = item.listingInfo?.[0]?.endTime?.[0];
        const imageUrl = item.galleryURL?.[0] || null;
        const itemUrl = item.viewItemURL?.[0] || "";
        const condition = item.condition?.[0]?.conditionDisplayName?.[0] || "Unknown";

        if (!priceStr || !soldDateStr) {
          continue;
        }

        soldItems.push({
          title,
          price: parseFloat(priceStr),
          currency,
          soldDate: new Date(soldDateStr),
          imageUrl,
          itemUrl,
          condition,
        });
      } catch (error) {
        console.error("[eBay] Error parsing item:", error);
        continue;
      }
    }

    console.log(`[eBay] Found ${soldItems.length} sold items for: ${searchQuery}`);
    return soldItems;
  } catch (error: any) {
    console.error("[eBay] Error searching sold items:", error.message);
    
    if (error.response) {
      console.error("[eBay] API Response:", error.response.data);
      throw new Error(`eBay API error: ${error.response.status}`);
    } else if (error.request) {
      throw new Error("Network error: Unable to reach eBay API");
    } else {
      throw new Error(error.message || String(error));
    }
  }
}

/**
 * Extract card number from full card name
 * Example: "Solgaleo & Lunala GX (Lillie) SR :SA [SM11b 063/049]" → "SM11b 063/049"
 */
export function extractCardNumber(fullName: string): string | null {
  const match = fullName.match(/\[([^\]]+)\]/);
  return match ? match[1] : null;
}

/**
 * Clean card name for eBay search
 * Example: "Solgaleo & Lunala GX (Lillie) SR :SA [SM11b 063/049]" → "Solgaleo Lunala GX Lillie"
 */
export function cleanCardNameForSearch(fullName: string): string {
  // Remove card number in brackets
  let cleaned = fullName.replace(/\[([^\]]+)\]/g, "");
  
  // Remove special characters and extra spaces
  cleaned = cleaned.replace(/[:\-&]/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ");
  cleaned = cleaned.trim();
  
  return cleaned;
}
