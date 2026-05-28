import { getAllCardIds, getDb } from "./db";
import { getPosts } from "./blogDb";
import { sql } from "drizzle-orm";

const BASE_URL = "https://boxium.asia";
const CARDS_PER_SITEMAP = 10000; // 10k per file keeps each response < 2MB

// ─── Pre-generated sitemap store ─────────────────────────────────────────────
// Sitemaps are generated once at startup (and refreshed daily via Heartbeat).
// This means Google always gets a sub-100ms response regardless of cold starts.

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
 * Returns null if not yet generated.
 */
export function getPregenSitemap(key: "index" | "static" | "sets" | "blog"): string | null {
  return sitemapStore ? sitemapStore[key] : null;
}

export function getPregenCardSitemap(page: number): string | null {
  if (!sitemapStore) return null;
  return sitemapStore.cards[page - 1] ?? null;
}

export function getSitemapCardCount(): number {
  return sitemapStore ? sitemapStore.cards.length : 0;
}

export function isSitemapReady(): boolean {
  return sitemapStore !== null;
}

/**
 * Pre-generate ALL sitemaps and store in memory.
 * Called at server startup and via Heartbeat daily refresh.
 */
export async function pregenerateSitemaps(): Promise<void> {
  if (isGenerating) {
    console.log("[Sitemap] Generation already in progress, skipping.");
    return;
  }
  isGenerating = true;
  const startTime = Date.now();
  console.log("[Sitemap] Starting pre-generation of all sitemaps...");

  try {
    const currentDate = new Date().toISOString().split('T')[0];

    // ── 1. Fetch all card IDs once ──────────────────────────────────────────
    const allCards = await getAllCardIds();
    const totalCards = allCards.length;
    const cardSitemapCount = Math.ceil(totalCards / CARDS_PER_SITEMAP);
    console.log(`[Sitemap] Fetched ${totalCards} card IDs, will generate ${cardSitemapCount} card sitemaps.`);

    // ── 2. Generate card sitemaps ───────────────────────────────────────────
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
      xml += '</urlset>';
      cardSitemaps.push(xml);
    }

    // ── 3. Generate static sitemap ──────────────────────────────────────────
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
    staticXml += '</urlset>';

    // ── 4. Generate blog sitemap ────────────────────────────────────────────
    let blogXml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    try {
      const postsResult = await getPosts({ status: 'published' });
      for (const post of postsResult.posts) {
        const postDate = post.publishedAt ? new Date(post.publishedAt).toISOString().split('T')[0] : currentDate;
        blogXml += `  <url><loc>${BASE_URL}/blog/${post.slug}</loc><lastmod>${postDate}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
      }
    } catch (e) {
      console.error('[Sitemap] Error fetching blog posts:', e);
    }
    blogXml += '</urlset>';

    // ── 5. Generate sets sitemap ────────────────────────────────────────────
    let setsXml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    setsXml += `  <url><loc>${BASE_URL}/sets</loc><lastmod>${currentDate}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
    try {
      const dbConn = await getDb();
      if (dbConn) {
        const sets = await dbConn.execute(sql`SELECT DISTINCT setName FROM cards WHERE setName IS NOT NULL AND setName != '' ORDER BY setName`);
        const setRows = (sets[0] as any[]) || [];
        for (const row of setRows) {
          if (row.setName) {
            setsXml += `  <url><loc>${BASE_URL}/set/${encodeURIComponent(row.setName)}</loc><lastmod>${currentDate}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>\n`;
          }
        }
      }
    } catch (e) {
      console.error('[Sitemap] Error fetching sets:', e);
    }
    setsXml += '</urlset>';

    // ── 6. Generate sitemap index ───────────────────────────────────────────
    let indexXml = '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    indexXml += `  <sitemap><loc>${BASE_URL}/sitemap-static.xml</loc><lastmod>${currentDate}</lastmod></sitemap>\n`;
    indexXml += `  <sitemap><loc>${BASE_URL}/sitemap-sets.xml</loc><lastmod>${currentDate}</lastmod></sitemap>\n`;
    indexXml += `  <sitemap><loc>${BASE_URL}/sitemap-blog.xml</loc><lastmod>${currentDate}</lastmod></sitemap>\n`;
    for (let i = 0; i < cardSitemapCount; i++) {
      indexXml += `  <sitemap><loc>${BASE_URL}/sitemap-cards-${i + 1}.xml</loc><lastmod>${currentDate}</lastmod></sitemap>\n`;
    }
    indexXml += '</sitemapindex>';

    // ── 7. Commit to store ──────────────────────────────────────────────────
    sitemapStore = {
      index: indexXml,
      static: staticXml,
      sets: setsXml,
      blog: blogXml,
      cards: cardSitemaps,
      generatedAt: Date.now(),
    };

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Sitemap] Pre-generation complete in ${elapsed}s. ${totalCards} cards across ${cardSitemapCount} files.`);
  } catch (err) {
    console.error('[Sitemap] Pre-generation failed:', err);
  } finally {
    isGenerating = false;
  }
}

// ─── Legacy API (kept for backward compatibility) ─────────────────────────────

export async function generateSitemapIndex(): Promise<string> {
  return sitemapStore?.index ?? await _buildIndexFallback();
}

export async function generateStaticSitemap(): Promise<string> {
  return sitemapStore?.static ?? '';
}

export async function generateBlogSitemap(): Promise<string> {
  return sitemapStore?.blog ?? '';
}

export async function generateCardSitemap(page: number): Promise<string | null> {
  return sitemapStore?.cards[page - 1] ?? null;
}

export async function generateSetsSitemap(): Promise<string> {
  return sitemapStore?.sets ?? '';
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
