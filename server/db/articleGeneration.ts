import { eq, desc } from "drizzle-orm";
import { getDb } from "../db";
import { articleGenerationHistory, type ArticleGenerationHistory, type InsertArticleGenerationHistory } from "../../drizzle/schema_new";

/**
 * Create a new article generation request
 */
export async function createGenerationRequest(data: InsertArticleGenerationHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const result = await db.insert(articleGenerationHistory).values(data);
  return result[0].insertId;
}

/**
 * Get article generation history by ID
 */
export async function getGenerationById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const result = await db
    .select()
    .from(articleGenerationHistory)
    .where(eq(articleGenerationHistory.id, id))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Update generation status and results
 */
export async function updateGenerationStatus(
  id: number,
  data: Partial<ArticleGenerationHistory>
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  await db
    .update(articleGenerationHistory)
    .set(data)
    .where(eq(articleGenerationHistory.id, id));
}

/**
 * Get user's generation history
 */
export async function getUserGenerationHistory(
  userId: number,
  limit: number = 20,
  offset: number = 0
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  return await db
    .select()
    .from(articleGenerationHistory)
    .where(eq(articleGenerationHistory.userId, userId))
    .orderBy(desc(articleGenerationHistory.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get all generation history (admin only)
 */
export async function getAllGenerationHistory(
  limit: number = 50,
  offset: number = 0
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  return await db
    .select()
    .from(articleGenerationHistory)
    .orderBy(desc(articleGenerationHistory.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Delete generation history
 */
export async function deleteGenerationHistory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  await db
    .delete(articleGenerationHistory)
    .where(eq(articleGenerationHistory.id, id));
}
