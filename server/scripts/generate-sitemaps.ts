/**
 * generate-sitemaps.ts
 *
 * Standalone script: queries the database and writes all sitemap XML files
 * to client/public/ so they are served as static assets by Vite/Express.
 *
 * Usage:
 *   cd /home/ubuntu/boxium-ptcg
 *   npx tsx server/scripts/generate-sitemaps.ts
 *
 * Also called from /api/scheduled/refresh-sitemaps to keep files fresh.
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAllCardIds, getDb } from "../db";
import { getPosts } from "../blogDb";
import { sql } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = "https://boxium.asia";
const CARDS_PER_SITEMAP = 10000;

// Resolve to client/public/ directory (two levels up from server/scripts/)
const PUBLIC_DIR = path.resolve(__dirname, "../../client/public");

async function main() {
  const startTime = Date.now();
  console.log("[generate-sitemaps] Starting...");
  console.log(`[generate-sitemaps] Output directory: ${PUBLIC_DIR}`);

  // Ensure output directory exists
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  const currentDate = new Date().toISOString().split("T")[0];

  // ── 1. Fetch all card IDs ────────────────────────────────────────────────────
  const allCards = await getAllCardIds();
  const totalCards = allCards.length;
  const cardSitemapCount = Math.ceil(totalCards / CARDS_PER_SITEMAP);
  console.log(`[generate-sitemaps] Fetched ${totalCards} card IDs → ${cardSitemapCount} card sitemap files`);

  // ── 2. Write card sitemaps ───────────────────────────────────────────────────
  for (let i = 0; i < cardSitemapCount; i++) {
    const start = i * CARDS_PER_SITEMAP;
    const end = start + CARDS_PER_SITEMAP;
    const pageCards = allCards.slice(start, end);

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    for (const card of pageCards) {
      xml += `  <url><loc>${BASE_URL}/card/${card.id}</loc><lastmod>${currentDate}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>\n`;
    }
    xml += "</urlset>";

    const filename = `sitemap-cards-${i + 1}.xml`;
    fs.writeFileSync(path.join(PUBLIC_DIR, filename), xml, "utf-8");
    console.log(`[generate-sitemaps] Wrote ${filename} (${pageCards.length} URLs)`);
  }

  // ── 3. Write static sitemap ──────────────────────────────────────────────────
  const staticPages = [
    { url: "/", priority: "1.0", changefreq: "daily" },
    { url: "/research", priority: "0.9", changefreq: "daily" },
    { url: "/trending", priority: "0.9", changefreq: "hourly" },
    { url: "/pricing", priority: "0.9", changefreq: "daily" },
    { url: "/sets", priority: "0.8", changefreq: "weekly" },
    { url: "/blog", priority: "0.9", changefreq: "daily" },
    { url: "/marketplace", priority: "0.8", changefreq: "daily" },
    { url: "/about", priority: "0.7", changefreq: "monthly" },
    { url: "/disclaimer", priority: "0.6", changefreq: "monthly" },
    { url: "/terms", priority: "0.6", changefreq: "monthly" },
    { url: "/privacy", priority: "0.6", changefreq: "monthly" },
  ];
  let staticXml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const page of staticPages) {
    staticXml += `  <url><loc>${BASE_URL}${page.url}</loc><lastmod>${currentDate}</lastmod><changefreq>${page.changefreq}</changefreq><priority>${page.priority}</priority></url>\n`;
  }
  staticXml += "</urlset>";
  fs.writeFileSync(path.join(PUBLIC_DIR, "sitemap-static.xml"), staticXml, "utf-8");
  console.log(`[generate-sitemaps] Wrote sitemap-static.xml (${staticPages.length} URLs)`);

  // ── 4. Write blog sitemap ────────────────────────────────────────────────────
  let blogXml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  try {
    const postsResult = await getPosts({ status: "published" });
    for (const post of postsResult.posts) {
      const postDate = post.publishedAt
        ? new Date(post.publishedAt).toISOString().split("T")[0]
        : currentDate;
      blogXml += `  <url><loc>${BASE_URL}/blog/${post.slug}</loc><lastmod>${postDate}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
    }
    console.log(`[generate-sitemaps] Wrote sitemap-blog.xml (${postsResult.posts.length} URLs)`);
  } catch (e) {
    console.error("[generate-sitemaps] Error fetching blog posts:", e);
  }
  blogXml += "</urlset>";
  fs.writeFileSync(path.join(PUBLIC_DIR, "sitemap-blog.xml"), blogXml, "utf-8");

  // ── 5. Write sets sitemap ────────────────────────────────────────────────────
  let setsXml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  setsXml += `  <url><loc>${BASE_URL}/sets</loc><lastmod>${currentDate}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
  let setsCount = 1;
  try {
    const dbConn = await getDb();
    if (dbConn) {
      const sets = await dbConn.execute(
        sql`SELECT DISTINCT setName FROM cards WHERE setName IS NOT NULL AND setName != '' ORDER BY setName`
      );
      const setRows = (sets[0] as any[]) || [];
      for (const row of setRows) {
        if (row.setName) {
          setsXml += `  <url><loc>${BASE_URL}/set/${encodeURIComponent(row.setName)}</loc><lastmod>${currentDate}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>\n`;
          setsCount++;
        }
      }
    }
    console.log(`[generate-sitemaps] Wrote sitemap-sets.xml (${setsCount} URLs)`);
  } catch (e) {
    console.error("[generate-sitemaps] Error fetching sets:", e);
  }
  setsXml += "</urlset>";
  fs.writeFileSync(path.join(PUBLIC_DIR, "sitemap-sets.xml"), setsXml, "utf-8");

  // ── 6. Write sitemap index ───────────────────────────────────────────────────
  let indexXml = '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  indexXml += `  <sitemap><loc>${BASE_URL}/sitemap-static.xml</loc><lastmod>${currentDate}</lastmod></sitemap>\n`;
  indexXml += `  <sitemap><loc>${BASE_URL}/sitemap-sets.xml</loc><lastmod>${currentDate}</lastmod></sitemap>\n`;
  indexXml += `  <sitemap><loc>${BASE_URL}/sitemap-blog.xml</loc><lastmod>${currentDate}</lastmod></sitemap>\n`;
  for (let i = 0; i < cardSitemapCount; i++) {
    indexXml += `  <sitemap><loc>${BASE_URL}/sitemap-cards-${i + 1}.xml</loc><lastmod>${currentDate}</lastmod></sitemap>\n`;
  }
  indexXml += "</sitemapindex>";
  fs.writeFileSync(path.join(PUBLIC_DIR, "sitemap.xml"), indexXml, "utf-8");
  console.log(`[generate-sitemaps] Wrote sitemap.xml (index with ${3 + cardSitemapCount} child sitemaps)`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[generate-sitemaps] Done in ${elapsed}s. Total cards: ${totalCards}`);

  // Exit cleanly (DB connections may keep process alive)
  process.exit(0);
}

main().catch((err) => {
  console.error("[generate-sitemaps] Fatal error:", err);
  process.exit(1);
});
