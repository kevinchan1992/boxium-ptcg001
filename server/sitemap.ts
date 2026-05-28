import { getAllCardIds, getDb } from "./db";
import { getPosts } from "./blogDb";
import { sql } from "drizzle-orm";

const BASE_URL = "https://boxium.asia";
const CARDS_PER_SITEMAP = 10000; // Reduced from 45000 to speed up response time

// ─── In-memory cache to avoid repeated DB queries ────────────────────────────
interface CacheEntry {
  data: string;
  timestamp: number;
}

const sitemapCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

function getCached(key: string): string | null {
  const entry = sitemapCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    sitemapCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: string): void {
  sitemapCache.set(key, { data, timestamp: Date.now() });
}

// ─── Card IDs cache (shared across sitemap generation) ───────────────────────
let cardIdsCache: { ids: { id: number }[]; timestamp: number } | null = null;
const CARD_IDS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getCachedCardIds(): Promise<{ id: number }[]> {
  if (cardIdsCache && Date.now() - cardIdsCache.timestamp < CARD_IDS_CACHE_TTL) {
    return cardIdsCache.ids;
  }
  const ids = await getAllCardIds();
  cardIdsCache = { ids, timestamp: Date.now() };
  return ids;
}

/**
 * Generate sitemap index XML content
 * Uses cached card count to avoid slow DB query on every request
 */
export async function generateSitemapIndex(): Promise<string> {
  const cached = getCached("sitemap-index");
  if (cached) return cached;

  const currentDate = new Date().toISOString().split('T')[0];

  // Get card count for pagination
  const cards = await getCachedCardIds();
  const totalCards = cards.length;
  const cardSitemapCount = Math.ceil(totalCards / CARDS_PER_SITEMAP);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Static pages sitemap
  xml += '  <sitemap>\n';
  xml += `    <loc>${BASE_URL}/sitemap-static.xml</loc>\n`;
  xml += `    <lastmod>${currentDate}</lastmod>\n`;
  xml += '  </sitemap>\n';

  // Sets sitemap
  xml += '  <sitemap>\n';
  xml += `    <loc>${BASE_URL}/sitemap-sets.xml</loc>\n`;
  xml += `    <lastmod>${currentDate}</lastmod>\n`;
  xml += '  </sitemap>\n';

  // Blog posts sitemap
  xml += '  <sitemap>\n';
  xml += `    <loc>${BASE_URL}/sitemap-blog.xml</loc>\n`;
  xml += `    <lastmod>${currentDate}</lastmod>\n`;
  xml += '  </sitemap>\n';

  // Card sitemaps (paginated)
  for (let i = 0; i < cardSitemapCount; i++) {
    xml += '  <sitemap>\n';
    xml += `    <loc>${BASE_URL}/sitemap-cards-${i + 1}.xml</loc>\n`;
    xml += `    <lastmod>${currentDate}</lastmod>\n`;
    xml += '  </sitemap>\n';
  }

  xml += '</sitemapindex>';
  setCache("sitemap-index", xml);
  return xml;
}

/**
 * Generate static pages sitemap
 */
export async function generateStaticSitemap(): Promise<string> {
  const cached = getCached("sitemap-static");
  if (cached) return cached;

  const currentDate = new Date().toISOString().split('T')[0];

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

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const page of staticPages) {
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}${page.url}</loc>\n`;
    xml += `    <lastmod>${currentDate}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += '  </url>\n';
  }

  xml += '</urlset>';
  setCache("sitemap-static", xml);
  return xml;
}

/**
 * Generate blog posts sitemap
 */
export async function generateBlogSitemap(): Promise<string> {
  const cached = getCached("sitemap-blog");
  if (cached) return cached;

  const currentDate = new Date().toISOString().split('T')[0];

  const postsResult = await getPosts({ status: 'published' });
  const posts = postsResult.posts;

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const post of posts) {
    const postDate = post.publishedAt ? new Date(post.publishedAt).toISOString().split('T')[0] : currentDate;
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}/blog/${post.slug}</loc>\n`;
    xml += `    <lastmod>${postDate}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += '  </url>\n';
  }

  xml += '</urlset>';
  setCache("sitemap-blog", xml);
  return xml;
}

/**
 * Generate paginated card sitemap (page is 1-indexed)
 * Returns null if the page doesn't exist
 */
export async function generateCardSitemap(page: number): Promise<string | null> {
  const cacheKey = `sitemap-cards-${page}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const currentDate = new Date().toISOString().split('T')[0];

  const allCards = await getCachedCardIds();
  const start = (page - 1) * CARDS_PER_SITEMAP;
  const end = start + CARDS_PER_SITEMAP;

  if (start >= allCards.length) return null;

  const pageCards = allCards.slice(start, end);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const card of pageCards) {
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}/card/${card.id}</loc>\n`;
    xml += `    <lastmod>${currentDate}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += '  </url>\n';
  }

  xml += '</urlset>';
  setCache(cacheKey, xml);
  return xml;
}

/**
 * Generate sets sitemap — includes /sets index page and all /set/:setCode pages
 */
export async function generateSetsSitemap(): Promise<string> {
  const cached = getCached("sitemap-sets");
  if (cached) return cached;

  const currentDate = new Date().toISOString().split('T')[0];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // /sets index page
  xml += '  <url>\n';
  xml += `    <loc>${BASE_URL}/sets</loc>\n`;
  xml += `    <lastmod>${currentDate}</lastmod>\n`;
  xml += '    <changefreq>weekly</changefreq>\n';
  xml += '    <priority>0.7</priority>\n';
  xml += '  </url>\n';

  // Individual set pages
  try {
    const dbConn = await getDb();
    if (dbConn) {
      const sets = await dbConn.execute(sql`
        SELECT DISTINCT setName
        FROM cards
        WHERE setName IS NOT NULL AND setName != ''
        ORDER BY setName
      `);
      const setRows = (sets[0] as any[]) || [];
      for (const row of setRows) {
        if (row.setName) {
          xml += '  <url>\n';
          xml += `    <loc>${BASE_URL}/set/${encodeURIComponent(row.setName)}</loc>\n`;
          xml += `    <lastmod>${currentDate}</lastmod>\n`;
          xml += '    <changefreq>weekly</changefreq>\n';
          xml += '    <priority>0.6</priority>\n';
          xml += '  </url>\n';
        }
      }
    }
  } catch (e) {
    console.error('[Sitemap] Error generating sets sitemap:', e);
  }

  xml += '</urlset>';
  setCache("sitemap-sets", xml);
  return xml;
}

/**
 * Legacy: Generate full sitemap.xml content (kept for backward compatibility)
 * For large datasets, use generateSitemapIndex + individual sitemaps instead
 */
export async function generateSitemap(): Promise<string> {
  // Redirect to sitemap index for large datasets
  return generateSitemapIndex();
}
