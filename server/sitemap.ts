import { getAllCardIds, getDb } from "./db";
import { getPosts } from "./blogDb";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

const BASE_URL = "https://boxium.asia";
const CARDS_PER_SITEMAP = 10000; // 10k per file keeps each response < 2MB

// ─── Static file paths ────────────────────────────────────────────────────────
// In production, static files are in dist/public/ (same dir as compiled index.js).
// In development, static files are in client/public/ (two levels up from server/).
function getStaticPublicDir(): string {
  if (process.env.NODE_ENV === "production") {
    // In production, __dirname is dist/ (where index.js lives), static files are in dist/public/
    return path.resolve(import.meta.dirname, "public");
  } else {
    // In development, __dirname is server/ (tsx watch), static files are in client/public/
    return path.resolve(import.meta.dirname, "../client/public");
  }
}

function getStaticSitemapPath(filename: string): string {
  return path.join(getStaticPublicDir(), filename);
}

/**
 * Read a static sitemap file from disk.
 * Returns null if the file doesn't exist or can't be read.
 */
function readStaticSitemap(filename: string): string | null {
  try {
    const filePath = getStaticSitemapPath(filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
  } catch (e) {
    // ignore
  }
  return null;
}

// ─── Pre-generated sitemap store (in-memory fallback) ─────────────────────────
interface SitemapStore {
  index: string;
  static: string;
  sets: string;
  blog: string;
  cards: string[]; // cards[0] = sitemap-cards-1.xml, etc.
  generatedAt: number;
}

let sitemapStore: SitemapStore | null = null;
let isGenerating = false;

/**
 * Get a pre-generated sitemap by key.
 * Priority: static file on disk > in-memory store > null
 */
export function getPregenSitemap(key: "index" | "static" | "sets" | "blog"): string | null {
  // Try static file first (fastest, survives restarts)
  const filenameMap = {
    index: "sitemap.xml",
    static: "sitemap-static.xml",
    sets: "sitemap-sets.xml",
    blog: "sitemap-blog.xml",
  };
  const staticContent = readStaticSitemap(filenameMap[key]);
  if (staticContent) return staticContent;

  // Fallback to in-memory store
  return sitemapStore ? sitemapStore[key] : null;
}

export function getPregenCardSitemap(page: number): string | null {
  // Try static file first
  const staticContent = readStaticSitemap(`sitemap-cards-${page}.xml`);
  if (staticContent) return staticContent;

  // Fallback to in-memory store
  if (!sitemapStore) return null;
  return sitemapStore.cards[page - 1] ?? null;
}

export function getSitemapCardCount(): number {
  // Count static card sitemap files
  const publicDir = getStaticPublicDir();
  let count = 0;
  try {
    while (fs.existsSync(path.join(publicDir, `sitemap-cards-${count + 1}.xml`))) {
      count++;
    }
    if (count > 0) return count;
  } catch (e) {
    // ignore
  }
  return sitemapStore ? sitemapStore.cards.length : 0;
}

export function isSitemapReady(): boolean {
  // Ready if static file exists OR in-memory store is populated
  const staticIndex = readStaticSitemap("sitemap.xml");
  if (staticIndex && staticIndex.includes("<sitemap>")) return true;
  return sitemapStore !== null;
}

// ─── Static file generation ───────────────────────────────────────────────────

/**
 * Generate all sitemap XML files and write them to the static public directory.
 * This is the primary method for keeping sitemaps up-to-date.
 * Called:
 *   1. At server startup (5s delay)
 *   2. Via /api/scheduled/refresh-sitemaps (Heartbeat daily)
 *   3. Via CLI: npx tsx server/scripts/generate-sitemaps.ts
 */
export async function generateStaticSitemapFiles(): Promise<void> {
  if (isGenerating) {
    console.log("[Sitemap] Generation already in progress, skipping.");
    return;
  }
  isGenerating = true;
  const startTime = Date.now();
  const publicDir = getStaticPublicDir();
  console.log(`[Sitemap] Generating static sitemap files to: ${publicDir}`);

  try {
    // Ensure output directory exists
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const currentDate = new Date().toISOString().split("T")[0];

    // ── 1. Fetch all card IDs ──────────────────────────────────────────────────
    const allCards = await getAllCardIds();
    const totalCards = allCards.length;
    const cardSitemapCount = Math.ceil(totalCards / CARDS_PER_SITEMAP);
    console.log(`[Sitemap] Fetched ${totalCards} card IDs → ${cardSitemapCount} card sitemap files`);

    // ── 2. Write card sitemaps ─────────────────────────────────────────────────
    const cardSitemaps: string[] = [];
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
      cardSitemaps.push(xml);

      const filename = `sitemap-cards-${i + 1}.xml`;
      fs.writeFileSync(path.join(publicDir, filename), xml, "utf-8");
    }
    console.log(`[Sitemap] Wrote ${cardSitemapCount} card sitemap files`);

    // ── 3. Write static sitemap ────────────────────────────────────────────────
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
    fs.writeFileSync(path.join(publicDir, "sitemap-static.xml"), staticXml, "utf-8");

    // ── 4. Write blog sitemap ──────────────────────────────────────────────────
    let blogXml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    try {
      const postsResult = await getPosts({ status: "published" });
      for (const post of postsResult.posts) {
        const postDate = post.publishedAt
          ? new Date(post.publishedAt).toISOString().split("T")[0]
          : currentDate;
        blogXml += `  <url><loc>${BASE_URL}/blog/${post.slug}</loc><lastmod>${postDate}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
      }
    } catch (e) {
      console.error("[Sitemap] Error fetching blog posts:", e);
    }
    blogXml += "</urlset>";
    fs.writeFileSync(path.join(publicDir, "sitemap-blog.xml"), blogXml, "utf-8");

    // ── 5. Write sets sitemap ──────────────────────────────────────────────────
    let setsXml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    setsXml += `  <url><loc>${BASE_URL}/sets</loc><lastmod>${currentDate}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
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
          }
        }
      }
    } catch (e) {
      console.error("[Sitemap] Error fetching sets:", e);
    }
    setsXml += "</urlset>";
    fs.writeFileSync(path.join(publicDir, "sitemap-sets.xml"), setsXml, "utf-8");

    // ── 6. Write sitemap index ─────────────────────────────────────────────────
    let indexXml = '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    indexXml += `  <sitemap><loc>${BASE_URL}/sitemap-static.xml</loc><lastmod>${currentDate}</lastmod></sitemap>\n`;
    indexXml += `  <sitemap><loc>${BASE_URL}/sitemap-sets.xml</loc><lastmod>${currentDate}</lastmod></sitemap>\n`;
    indexXml += `  <sitemap><loc>${BASE_URL}/sitemap-blog.xml</loc><lastmod>${currentDate}</lastmod></sitemap>\n`;
    for (let i = 0; i < cardSitemapCount; i++) {
      indexXml += `  <sitemap><loc>${BASE_URL}/sitemap-cards-${i + 1}.xml</loc><lastmod>${currentDate}</lastmod></sitemap>\n`;
    }
    indexXml += "</sitemapindex>";
    fs.writeFileSync(path.join(publicDir, "sitemap.xml"), indexXml, "utf-8");

    // ── 7. Also update in-memory store ────────────────────────────────────────
    sitemapStore = {
      index: indexXml,
      static: staticXml,
      sets: setsXml,
      blog: blogXml,
      cards: cardSitemaps,
      generatedAt: Date.now(),
    };

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Sitemap] Static files generated in ${elapsed}s. ${totalCards} cards across ${cardSitemapCount} files.`);
  } catch (err) {
    console.error("[Sitemap] Static file generation failed:", err);
  } finally {
    isGenerating = false;
  }
}

/**
 * Pre-generate ALL sitemaps (alias for generateStaticSitemapFiles).
 * Kept for backward compatibility with existing startup code.
 */
export async function pregenerateSitemaps(): Promise<void> {
  return generateStaticSitemapFiles();
}

// ─── Legacy API (kept for backward compatibility) ─────────────────────────────

export async function generateSitemapIndex(): Promise<string> {
  return getPregenSitemap("index") ?? await _buildIndexFallback();
}

export async function generateStaticSitemap(): Promise<string> {
  return getPregenSitemap("static") ?? '';
}

export async function generateBlogSitemap(): Promise<string> {
  return getPregenSitemap("blog") ?? '';
}

export async function generateCardSitemap(page: number): Promise<string | null> {
  return getPregenCardSitemap(page);
}

export async function generateSetsSitemap(): Promise<string> {
  return getPregenSitemap("sets") ?? '';
}

export async function generateSitemap(): Promise<string> {
  return generateSitemapIndex();
}

async function _buildIndexFallback(): Promise<string> {
  const currentDate = new Date().toISOString().split('T')[0];
  const allCards = await getAllCardIds();
  const cardSitemapCount = Math.ceil(allCards.length / CARDS_PER_SITEMAP);
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  xml += `  <sitemap><loc>${BASE_URL}/sitemap-static.xml</loc><lastmod>${currentDate}</lastmod></sitemap>\n`;
  xml += `  <sitemap><loc>${BASE_URL}/sitemap-sets.xml</loc><lastmod>${currentDate}</lastmod></sitemap>\n`;
  xml += `  <sitemap><loc>${BASE_URL}/sitemap-blog.xml</loc><lastmod>${currentDate}</lastmod></sitemap>\n`;
  for (let i = 0; i < cardSitemapCount; i++) {
    xml += `  <sitemap><loc>${BASE_URL}/sitemap-cards-${i + 1}.xml</loc><lastmod>${currentDate}</lastmod></sitemap>\n`;
  }
  xml += '</sitemapindex>';
  return xml;
}
