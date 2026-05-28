import { getAllCardIds, getDb } from "./db";
import { getPosts } from "./blogDb";
import { sql } from "drizzle-orm";

const BASE_URL = "https://boxium.asia";
const CARDS_PER_SITEMAP = 45000; // Google limit is 50,000 URLs per sitemap file

/**
 * Generate sitemap index XML content
 * Points to individual sitemap files for static pages, cards, and blog posts
 */
export async function generateSitemapIndex(): Promise<string> {
  const currentDate = new Date().toISOString().split('T')[0];

  // Count cards to determine how many card sitemaps we need
  const cards = await getAllCardIds();
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
  return xml;
}

/**
 * Generate static pages sitemap
 */
export async function generateStaticSitemap(): Promise<string> {
  const currentDate = new Date().toISOString().split('T')[0];

  const staticPages = [
    { url: "/", priority: "1.0", changefreq: "daily" },
    { url: "/research", priority: "0.9", changefreq: "daily" },
    { url: "/trending", priority: "0.9", changefreq: "hourly" },
    { url: "/blog", priority: "0.9", changefreq: "daily" },
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
  return xml;
}

/**
 * Generate blog posts sitemap
 */
export async function generateBlogSitemap(): Promise<string> {
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
  return xml;
}

/**
 * Generate paginated card sitemap (page is 1-indexed)
 * Returns null if the page doesn't exist
 */
export async function generateCardSitemap(page: number): Promise<string | null> {
  const currentDate = new Date().toISOString().split('T')[0];

  const allCards = await getAllCardIds();
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
  return xml;
}

/**
 * Generate sets sitemap — includes /sets index page and all /set/:setCode pages
 */
export async function generateSetsSitemap(): Promise<string> {
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
