import { getAllCardIds } from "./db";
import { getPosts } from "./blogDb";

/**
 * Generate sitemap.xml content
 * Includes all static pages and dynamic card detail pages
 */
export async function generateSitemap(): Promise<string> {
  const baseUrl = "https://boxiumptcg.manus.space";
  const currentDate = new Date().toISOString().split('T')[0];

  // Static pages with their priorities and change frequencies
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

  // Fetch all card IDs from database
  const cards = await getAllCardIds();

  // Fetch all published blog posts
  const posts = await getPosts({ status: 'published' });

  // Build XML content
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Add static pages
  for (const page of staticPages) {
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
    xml += `    <lastmod>${currentDate}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += '  </url>\n';
  }

  // Add card detail pages
  for (const card of cards) {
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}/card/${card.id}</loc>\n`;
    xml += `    <lastmod>${currentDate}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += '  </url>\n';
  }

  // Add blog post pages
  for (const post of posts) {
    const postDate = post.publishedAt ? new Date(post.publishedAt).toISOString().split('T')[0] : currentDate;
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}/blog/${post.slug}</loc>\n`;
    xml += `    <lastmod>${postDate}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += '  </url>\n';
  }

  xml += '</urlset>';

  return xml;
}
