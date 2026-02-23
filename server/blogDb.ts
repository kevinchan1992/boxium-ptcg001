import { getDb } from "./db";
import { posts, categories, tags, postTags, type InsertPost, type InsertCategory, type InsertTag } from "../drizzle/schema_new";
import { eq, like, or, desc, and, inArray } from "drizzle-orm";

/**
 * Get all posts with optional filters
 */
export async function getPosts(filters?: {
  categoryId?: number;
  status?: 'draft' | 'published';
  search?: string;
  sortBy?: 'newest' | 'oldest' | 'views';
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  let query = db.select().from(posts);

  // Apply filters
  const conditions = [];
  if (filters?.categoryId) {
    conditions.push(eq(posts.categoryId, filters.categoryId));
  }
  if (filters?.status) {
    conditions.push(eq(posts.status, filters.status));
  }
  if (filters?.search) {
    conditions.push(
      or(
        like(posts.title, `%${filters.search}%`),
        like(posts.excerpt, `%${filters.search}%`)
      )
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  // Apply sorting
  if (filters?.sortBy === 'oldest') {
    query = query.orderBy(posts.createdAt) as any;
  } else if (filters?.sortBy === 'views') {
    query = query.orderBy(desc(posts.viewCount)) as any;
  } else {
    query = query.orderBy(desc(posts.createdAt)) as any;
  }

  // Apply pagination
  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }
  if (filters?.offset) {
    query = query.offset(filters.offset) as any;
  }

  return await query;
}

/**
 * Get post by slug
 */
export async function getPostBySlug(slug: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Get post by ID
 */
export async function getPostById(id: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Create a new post
 */
export async function createPost(post: InsertPost) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(posts).values(post);
  return Number(result[0].insertId);
}

/**
 * Update a post
 */
export async function updatePost(id: number, updates: Partial<InsertPost>) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(posts).set(updates).where(eq(posts.id, id));
}

/**
 * Delete a post
 */
export async function deletePost(id: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.delete(posts).where(eq(posts.id, id));
}

/**
 * Toggle post publish status
 */
export async function togglePublishPost(id: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const post = await getPostById(id);
  if (!post) {
    throw new Error("Post not found");
  }

  const newStatus = post.status === 'published' ? 'draft' : 'published';
  const publishedAt = newStatus === 'published' ? new Date() : null;

  await db.update(posts).set({
    status: newStatus,
    publishedAt,
  }).where(eq(posts.id, id));
}

/**
 * Increment post view count by slug
 */
export async function incrementPostViewCount(slug: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const post = await getPostBySlug(slug);
  if (!post) {
    throw new Error("Post not found");
  }

  await db.update(posts).set({
    viewCount: post.viewCount + 1,
  }).where(eq(posts.id, post.id));
}

/**
 * Get all categories
 */
export async function getCategories() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db.select().from(categories).orderBy(categories.name);
}

/**
 * Get category by slug
 */
export async function getCategoryBySlug(slug: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Create a new category
 */
export async function createCategory(category: InsertCategory) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(categories).values(category);
  return Number(result[0].insertId);
}

/**
 * Get all tags
 */
export async function getTags() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db.select().from(tags).orderBy(tags.name);
}

/**
 * Get tag by slug
 */
export async function getTagBySlug(slug: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Create a new tag
 */
export async function createTag(tag: InsertTag) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(tags).values(tag);
  return Number(result[0].insertId);
}

/**
 * Add tags to post
 */
export async function addTagsToPost(postId: number, tagIds: number[]) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Filter out invalid tag IDs
  const validTagIds = tagIds.filter(id => id !== undefined && id !== null && !isNaN(id));
  
  if (validTagIds.length === 0) {
    return;
  }

  const values = validTagIds.map(tagId => ({ postId, tagId }));
  await db.insert(postTags).values(values);
}

/**
 * Remove all tags from post
 */
export async function removeTagsFromPost(postId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.delete(postTags).where(eq(postTags.postId, postId));
}

/**
 * Get tags for a post
 */
export async function getPostTags(postId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
    })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(eq(postTags.postId, postId));

  return result;
}

/**
 * Generate slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200);
}


/**
 * Record post share event
 */
export async function recordPostShare(params: {
  slug: string;
  shareType: 'facebook' | 'whatsapp' | 'copy_link';
  userAgent?: string;
  ipAddress?: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Get post ID from slug
  const post = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, params.slug)).limit(1);
  if (!post || post.length === 0) {
    throw new Error(`Post not found with slug: ${params.slug}`);
  }

  const { postShares } = await import("../drizzle/schema_new");
  
  await db.insert(postShares).values({
    postId: post[0].id,
    shareType: params.shareType,
    userAgent: params.userAgent || null,
    ipAddress: params.ipAddress || null,
  });
}

/**
 * Get post share statistics
 */
export async function getPostShareStats(postId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { postShares } = await import("../drizzle/schema_new");
  const { sql } = await import("drizzle-orm");
  
  const result = await db
    .select({
      shareType: postShares.shareType,
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(postShares)
    .where(eq(postShares.postId, postId))
    .groupBy(postShares.shareType);

  return {
    facebook: result.find(r => r.shareType === 'facebook')?.count || 0,
    whatsapp: result.find(r => r.shareType === 'whatsapp')?.count || 0,
    copyLink: result.find(r => r.shareType === 'copy_link')?.count || 0,
    total: result.reduce((sum, r) => sum + Number(r.count), 0),
  };
}

/**
 * Get all posts share statistics (Admin only)
 */
export async function getAllPostsShareStats() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { postShares } = await import("../drizzle/schema_new");
  const { sql } = await import("drizzle-orm");
  
  // Get all posts with their share counts
  const result = await db
    .select({
      postId: postShares.postId,
      postTitle: posts.title,
      postSlug: posts.slug,
      shareType: postShares.shareType,
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(postShares)
    .innerJoin(posts, eq(postShares.postId, posts.id))
    .groupBy(postShares.postId, posts.title, posts.slug, postShares.shareType);

  // Transform to grouped format
  const grouped = new Map<number, {
    postId: number;
    title: string;
    slug: string;
    facebook: number;
    whatsapp: number;
    copyLink: number;
    total: number;
  }>();

  for (const row of result) {
    if (!grouped.has(row.postId)) {
      grouped.set(row.postId, {
        postId: row.postId,
        title: row.postTitle,
        slug: row.postSlug,
        facebook: 0,
        whatsapp: 0,
        copyLink: 0,
        total: 0,
      });
    }

    const stats = grouped.get(row.postId)!;
    const count = Number(row.count);
    
    if (row.shareType === 'facebook') {
      stats.facebook = count;
    } else if (row.shareType === 'whatsapp') {
      stats.whatsapp = count;
    } else if (row.shareType === 'copy_link') {
      stats.copyLink = count;
    }
    stats.total += count;
  }

  return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
}

