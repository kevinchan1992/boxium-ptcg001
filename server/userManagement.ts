import { eq, like, or, sql, desc, and, gte } from "drizzle-orm";
import { getDb } from "./db";
import { users } from "../drizzle/schema_new";
import type { User } from "../drizzle/schema_new";
import { hashPassword } from "./auth";

/**
 * Get paginated user list with optional search and filters
 */
export async function getUserList(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: "admin" | "user";
  loginMethod?: "password" | "google";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const offset = (page - 1) * pageSize;

  // Build where conditions
  const conditions = [];
  
  if (params.search) {
    conditions.push(
      or(
        like(users.email, `%${params.search}%`),
        like(users.name, `%${params.search}%`)
      )
    );
  }
  
  if (params.role) {
    conditions.push(eq(users.role, params.role));
  }
  
  if (params.loginMethod) {
    conditions.push(eq(users.loginMethod, params.loginMethod));
  }

  // Get total count
  const countQuery = conditions.length > 0
    ? db.select({ count: sql<number>`count(*)` }).from(users).where(and(...conditions))
    : db.select({ count: sql<number>`count(*)` }).from(users);
  
  const [{ count: total }] = await countQuery;

  // Get paginated users
  const query = db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      loginMethod: users.loginMethod,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset(offset);

  const userList = conditions.length > 0
    ? await query.where(and(...conditions))
    : await query;

  return {
    users: userList,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Get user statistics
 */
export async function getUserStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Total users
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(users);

  // Admin count
  const [{ adminCount }] = await db
    .select({ adminCount: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.role, "admin"));

  // Password login count
  const [{ passwordCount }] = await db
    .select({ passwordCount: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.loginMethod, "password"));

  // Google login count
  const [{ googleCount }] = await db
    .select({ googleCount: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.loginMethod, "google"));

  // New users in last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const [{ newUsers }] = await db
    .select({ newUsers: sql<number>`count(*)` })
    .from(users)
    .where(gte(users.createdAt, sevenDaysAgo));

  return {
    total,
    adminCount,
    userCount: total - adminCount,
    passwordCount,
    googleCount,
    newUsersLast7Days: newUsers,
  };
}

/**
 * Update user role
 */
export async function updateUserRole(userId: number, role: "admin" | "user") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return { success: true };
}

/**
 * Update user information
 */
export async function updateUser(userId: number, data: { name?: string; email?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return { success: true };
}

/**
 * Reset user password (only for password login users)
 */
export async function resetUserPassword(userId: number, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if user uses password login
  const [user] = await db
    .select({ loginMethod: users.loginMethod })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    throw new Error("User not found");
  }

  if (user.loginMethod !== "password") {
    throw new Error("Cannot reset password for OAuth users");
  }

  const passwordHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return { success: true };
}

/**
 * Delete user
 */
export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(users).where(eq(users.id, userId));

  return { success: true };
}

/**
 * Get user by ID
 */
export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      loginMethod: users.loginMethod,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .where(eq(users.id, userId));

  return user || null;
}

/**
 * Get user detail with order stats and shipping addresses
 */
export async function getUserDetailWithStats(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      loginMethod: users.loginMethod,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) return null;

  // Get order stats
  const { marketplaceOrders } = await import("../drizzle/schema_new");
  const { count, and: andOp, eq: eqOp } = await import("drizzle-orm");

  const [orderStats] = await db
    .select({
      totalOrders: sql<number>`count(*)`,
      completedOrders: sql<number>`sum(case when ${marketplaceOrders.orderStatus} = 'completed' then 1 else 0 end)`,
      totalSpent: sql<number>`sum(case when ${marketplaceOrders.paymentStatus} = 'paid' then cast(${marketplaceOrders.subtotalHkd} as decimal(10,2)) else 0 end)`,
    })
    .from(marketplaceOrders)
    .where(eq(marketplaceOrders.buyerId, userId));

  // Get shipping addresses
  const { userShippingAddresses } = await import("../drizzle/schema_new");
  const addresses = await db
    .select()
    .from(userShippingAddresses)
    .where(eq(userShippingAddresses.userId, userId))
    .orderBy(desc(userShippingAddresses.isDefault));

  return {
    ...user,
    orderStats: {
      totalOrders: Number(orderStats?.totalOrders ?? 0),
      completedOrders: Number(orderStats?.completedOrders ?? 0),
      totalSpent: Number(orderStats?.totalSpent ?? 0),
    },
    shippingAddresses: addresses,
  };
}
