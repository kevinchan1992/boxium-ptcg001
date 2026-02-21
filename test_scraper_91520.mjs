import { scrapeSnkrdunkListings } from "./server/services/snkrdunkPlaywright.ts";

console.log("Testing SNKRDUNK scraper for card ID 91520...");
try {
  const listings = await scrapeSnkrdunkListings("91520");
  console.log(`✅ Found ${listings.length} listings`);
  if (listings.length > 0) {
    console.log("First 3 listings:", JSON.stringify(listings.slice(0, 3), null, 2));
  }
} catch (error) {
  console.error("❌ Scraper error:", error.message);
}
