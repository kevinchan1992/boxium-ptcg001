import { scrapeSnkrdunkPage } from "./server/snkrdunkScraper.ts";

const url = "https://snkrdunk.com/apparels/91279";

console.log("Testing SNKRDUNK scraper...");
console.log("URL:", url);

try {
  const result = await scrapeSnkrdunkPage(url);
  console.log("\n=== Scraping Result ===");
  console.log("English Name:", result.name);
  console.log("Japanese Name:", result.nameJa);
  console.log("Image URL:", result.imageUrl);
  console.log("Price History Count:", result.priceHistory.length);
  
  if (result.priceHistory.length > 0) {
    console.log("\nFirst 3 price records:");
    result.priceHistory.slice(0, 3).forEach((record, i) => {
      console.log(`  ${i + 1}. ¥${record.price} (${record.grade || 'N/A'}) - ${record.soldAt.toLocaleDateString()}`);
    });
  }
} catch (error) {
  console.error("Error:", error.message);
}
