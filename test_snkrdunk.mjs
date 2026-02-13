import axios from "axios";
import * as cheerio from "cheerio";

const url = "https://snkrdunk.com/apparels/91279";

const response = await axios.get(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  },
});

const $ = cheerio.load(response.data);

console.log("=== Meta Tags ===");
console.log("og:title:", $('meta[property="og:title"]').attr("content"));
console.log("title:", $("title").text());

console.log("\n=== H1 Tags ===");
$("h1").each((i, el) => {
  console.log(`H1 ${i}:`, $(el).text().trim());
});

console.log("\n=== Product Title Container ===");
$(".product-title, .product-name, .item-title, .item-name, [class*='title'], [class*='name']").each((i, el) => {
  const text = $(el).text().trim();
  if (text.length > 10 && text.length < 500) {
    console.log(`${$(el).attr('class')}:`, text.substring(0, 200));
  }
});
