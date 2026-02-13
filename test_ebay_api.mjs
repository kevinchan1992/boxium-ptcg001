import axios from "axios";

const EBAY_APP_ID = process.env.EBAY_APP_ID;
const EBAY_FINDING_API_URL = "https://svcs.ebay.com/services/search/FindingService/v1";

console.log("Testing eBay API...");
console.log("App ID:", EBAY_APP_ID ? `${EBAY_APP_ID.substring(0, 20)}...` : "NOT SET");

const searchQuery = "Pikachu VMAX SWSH001 PSA 10";

const params = new URLSearchParams({
  "OPERATION-NAME": "findCompletedItems",
  "SERVICE-VERSION": "1.0.0",
  "SECURITY-APPNAME": EBAY_APP_ID,
  "RESPONSE-DATA-FORMAT": "JSON",
  "REST-PAYLOAD": "true",
  "keywords": searchQuery,
  "paginationInput.entriesPerPage": "5",
  "sortOrder": "EndTimeSoonest",
  "itemFilter(0).name": "SoldItemsOnly",
  "itemFilter(0).value": "true",
  "itemFilter(1).name": "CategoryId",
  "itemFilter(1).value": "183454",
});

try {
  const response = await axios.get(`${EBAY_FINDING_API_URL}?${params.toString()}`, {
    headers: {
      "Accept": "application/json",
    },
    timeout: 15000,
  });

  console.log("\n✅ API Response Status:", response.status);
  console.log("\nResponse Data:");
  console.log(JSON.stringify(response.data, null, 2).substring(0, 1000));
} catch (error) {
  console.error("\n❌ API Error:", error.message);
  if (error.response) {
    console.error("\nStatus:", error.response.status);
    console.error("\nError Data:");
    console.error(JSON.stringify(error.response.data, null, 2));
  }
}
