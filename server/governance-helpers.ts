/**
 * Governance Helpers - seller risk profiles, listing moderation logs, anomaly detection
 */
import { getDb } from "./db";
import { sellerRiskProfiles, listingModerationLogs, marketplaceListings, listingReports, sellerProfiles } from "../drizzle/schema_new";
import { eq, and, desc, sql, or, gt } from 'drizzle-orm';

// ============================================================
// SELLER RISK PROFILES
// ============================================================

export async function getOrCreateSellerRiskProfile(sellerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Try to fetch existing profile
  const [existing] = await db.select().from(sellerRiskProfiles).where(eq(sellerRiskProfiles.sellerId, sellerId)).limit(1);
  if (existing) return existing;
  
  // Create new profile with default values
  await db.insert(sellerRiskProfiles).values({
    sellerId,
    riskLevel: 'low',
    totalListings: 0,
    delistedCount: 0,
    reportCount: 0,
    disputeCount: 0,
    isWatched: false,
  });
  
  const [newProfile] = await db.select().from(sellerRiskProfiles).where(eq(sellerRiskProfiles.sellerId, sellerId)).limit(1);
  return newProfile!;
}

export async function updateSellerRiskProfile(sellerId: number, data: {
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  totalListings?: number;
  delistedCount?: number;
  reportCount?: number;
  disputeCount?: number;
  lastReviewAt?: Date;
  adminNote?: string | null;
  isWatched?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(sellerRiskProfiles)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(sellerRiskProfiles.sellerId, sellerId));
}

export async function recalculateSellerRiskProfile(sellerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Count total listings
  const [totalListingsResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(marketplaceListings)
    .where(eq(marketplaceListings.sellerId, sellerId));
  const totalListings = Number(totalListingsResult?.count ?? 0);
  
  // Count delisted listings (adminDelisted=true)
  const [delistedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(marketplaceListings)
    .where(and(
      eq(marketplaceListings.sellerId, sellerId),
      eq(marketplaceListings.adminDelisted, true)
    ));
  const delistedCount = Number(delistedResult?.count ?? 0);
  
  // Count reports against this seller's listings
  const [reportResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(listingReports)
    .innerJoin(marketplaceListings, eq(listingReports.listingId, marketplaceListings.id))
    .where(eq(marketplaceListings.sellerId, sellerId));
  const reportCount = Number(reportResult?.count ?? 0);
  
  // Calculate risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (delistedCount >= 10 || reportCount >= 5) riskLevel = 'critical';
  else if (delistedCount >= 5 || reportCount >= 3) riskLevel = 'high';
  else if (delistedCount >= 2 || reportCount >= 1) riskLevel = 'medium';
  
  await updateSellerRiskProfile(sellerId, {
    totalListings,
    delistedCount,
    reportCount,
    riskLevel,
  });
  
  return { totalListings, delistedCount, reportCount, riskLevel };
}

// ============================================================
// LISTING MODERATION LOGS
// ============================================================

export async function getListingModerationLogs(options: {
  page?: number;
  pageSize?: number;
  listingId?: number;
  adminId?: number;
  action?: string;
  listingMode?: 'direct' | 'auction';
} = {}) {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };
  
  const { page = 1, pageSize = 50, listingId, adminId, action, listingMode } = options;
  const offset = (page - 1) * pageSize;
  
  const conditions: import("drizzle-orm").SQL[] = [];
  if (listingId) conditions.push(eq(listingModerationLogs.listingId, listingId));
  if (adminId) conditions.push(eq(listingModerationLogs.adminId, adminId));
  if (action) conditions.push(eq(listingModerationLogs.action, action as any));
  if (listingMode) conditions.push(eq(listingModerationLogs.listingMode, listingMode));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(listingModerationLogs)
    .where(whereClause);
  
  const logs = await db
    .select({
      id: listingModerationLogs.id,
      listingId: listingModerationLogs.listingId,
      listingMode: listingModerationLogs.listingMode,
      adminId: listingModerationLogs.adminId,
      adminName: listingModerationLogs.adminName,
      action: listingModerationLogs.action,
      reason: listingModerationLogs.reason,
      previousStatus: listingModerationLogs.previousStatus,
      newStatus: listingModerationLogs.newStatus,
      metadata: listingModerationLogs.metadata,
      createdAt: listingModerationLogs.createdAt,
      // Join listing info
      listingTitle: marketplaceListings.title,
      listingImages: marketplaceListings.images,
    })
    .from(listingModerationLogs)
    .leftJoin(marketplaceListings, eq(listingModerationLogs.listingId, marketplaceListings.id))
    .where(whereClause)
    .orderBy(desc(listingModerationLogs.createdAt))
    .limit(pageSize)
    .offset(offset);
  
  return { logs, total: Number(countResult?.count ?? 0) };
}

// ============================================================
// ANOMALY DETECTION
// ============================================================

export async function getAnomalousListings(options: {
  page?: number;
  pageSize?: number;
  anomalyType?: 'high_value' | 'reported' | 'all';
} = {}) {
  const db = await getDb();
  if (!db) return { listings: [], total: 0 };
  
  const { page = 1, pageSize = 20, anomalyType = 'all' } = options;
  const offset = (page - 1) * pageSize;
  
  // Get listings with pending reports (join approach)
  const reportedListingIds = await db
    .selectDistinct({ listingId: listingReports.listingId })
    .from(listingReports)
    .where(eq(listingReports.status, 'pending'));
  const reportedIds = reportedListingIds.map(r => r.listingId);
  
  // Build conditions based on anomaly type
  let listings: any[] = [];
  let total = 0;
  
  if (anomalyType === 'high_value') {
    // Listings with price > 5000 HKD
    const conditions = [
      eq(marketplaceListings.status, 'active'),
      gt(marketplaceListings.priceHkd, '5000'),
    ];
    const whereClause = and(...conditions);
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(marketplaceListings)
      .where(whereClause);
    total = Number(countResult?.count ?? 0);
    listings = await db
      .select({
        id: marketplaceListings.id,
        title: marketplaceListings.title,
        images: marketplaceListings.images,
        priceHkd: marketplaceListings.priceHkd,
        status: marketplaceListings.status,
        adminDelisted: marketplaceListings.adminDelisted,
        sellerId: marketplaceListings.sellerId,
        sellerType: marketplaceListings.sellerType,
        createdAt: marketplaceListings.createdAt,
        sellerDisplayName: sellerProfiles.displayName,
      })
      .from(marketplaceListings)
      .leftJoin(sellerProfiles, eq(marketplaceListings.sellerId, sellerProfiles.id))
      .where(whereClause)
      .orderBy(desc(marketplaceListings.priceHkd))
      .limit(pageSize)
      .offset(offset);
    return { listings: listings.map(l => ({ ...l, anomalyType: 'high_value', reportCount: 0 })), total };
  } else if (anomalyType === 'reported') {
    if (reportedIds.length === 0) return { listings: [], total: 0 };
    // Get listings with pending reports
    const reportedListings = await db
      .select({
        id: marketplaceListings.id,
        title: marketplaceListings.title,
        images: marketplaceListings.images,
        priceHkd: marketplaceListings.priceHkd,
        status: marketplaceListings.status,
        adminDelisted: marketplaceListings.adminDelisted,
        sellerId: marketplaceListings.sellerId,
        sellerType: marketplaceListings.sellerType,
        createdAt: marketplaceListings.createdAt,
        sellerDisplayName: sellerProfiles.displayName,
        reportCount: sql<number>`(SELECT COUNT(*) FROM listingReports WHERE listingReports.listingId = marketplaceListings.id AND listingReports.status = 'pending')`,
      })
      .from(marketplaceListings)
      .leftJoin(sellerProfiles, eq(marketplaceListings.sellerId, sellerProfiles.id))
      .where(and(
        eq(marketplaceListings.status, 'active'),
        sql`marketplaceListings.id IN (${reportedIds.join(',')})`,
      ))
      .orderBy(desc(marketplaceListings.createdAt))
      .limit(pageSize)
      .offset(offset);
    return { listings: reportedListings.map(l => ({ ...l, anomalyType: 'reported' })), total: reportedIds.length };
  } else {
    // All anomalies: high value + reported
    const allAnomalies: any[] = [];
    
    // High value listings
    const highValueListings = await db
      .select({
        id: marketplaceListings.id,
        title: marketplaceListings.title,
        images: marketplaceListings.images,
        priceHkd: marketplaceListings.priceHkd,
        status: marketplaceListings.status,
        adminDelisted: marketplaceListings.adminDelisted,
        sellerId: marketplaceListings.sellerId,
        sellerType: marketplaceListings.sellerType,
        createdAt: marketplaceListings.createdAt,
        sellerDisplayName: sellerProfiles.displayName,
      })
      .from(marketplaceListings)
      .leftJoin(sellerProfiles, eq(marketplaceListings.sellerId, sellerProfiles.id))
      .where(and(
        eq(marketplaceListings.status, 'active'),
        gt(marketplaceListings.priceHkd, '5000'),
      ))
      .orderBy(desc(marketplaceListings.priceHkd))
      .limit(10);
    allAnomalies.push(...highValueListings.map(l => ({ ...l, anomalyType: 'high_value', reportCount: 0 })));
    
    // Reported listings
    if (reportedIds.length > 0) {
      const reportedListings = await db
        .select({
          id: marketplaceListings.id,
          title: marketplaceListings.title,
          images: marketplaceListings.images,
          priceHkd: marketplaceListings.priceHkd,
          status: marketplaceListings.status,
          adminDelisted: marketplaceListings.adminDelisted,
          sellerId: marketplaceListings.sellerId,
          sellerType: marketplaceListings.sellerType,
          createdAt: marketplaceListings.createdAt,
          sellerDisplayName: sellerProfiles.displayName,
        })
        .from(marketplaceListings)
        .leftJoin(sellerProfiles, eq(marketplaceListings.sellerId, sellerProfiles.id))
        .where(and(
          eq(marketplaceListings.status, 'active'),
          sql`marketplaceListings.id IN (${reportedIds.join(',')})`,
        ))
        .orderBy(desc(marketplaceListings.createdAt))
        .limit(10);
      allAnomalies.push(...reportedListings.map(l => ({ ...l, anomalyType: 'reported', reportCount: 1 })));
    }
    
    // Deduplicate by id
    const seen = new Set<number>();
    const deduplicated = allAnomalies.filter(l => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
    
    return { listings: deduplicated.slice(offset, offset + pageSize), total: deduplicated.length };
  }
}

// ============================================================
// REPORT STATS
// ============================================================

export async function getReportStats() {
  const db = await getDb();
  if (!db) return { byStatus: {} as Record<string, number>, byReason: [], bySeller: [], total: 0 };
  
  // Stats by status
  const byStatusRows = await db
    .select({
      status: listingReports.status,
      count: sql<number>`count(*)`,
    })
    .from(listingReports)
    .groupBy(listingReports.status);
  const byStatus: Record<string, number> = {};
  for (const row of byStatusRows) {
    byStatus[row.status] = Number(row.count);
  }

  // Stats by reason
  const byReason = await db
    .select({
      reason: listingReports.reason,
      count: sql<number>`count(*)`,
    })
    .from(listingReports)
    .groupBy(listingReports.reason);
  
  // Stats by seller (top 10 most reported sellers)
  const bySeller = await db
    .select({
      sellerId: marketplaceListings.sellerId,
      sellerDisplayName: sellerProfiles.displayName,
      reportCount: sql<number>`count(*)`,
    })
    .from(listingReports)
    .innerJoin(marketplaceListings, eq(listingReports.listingId, marketplaceListings.id))
    .leftJoin(sellerProfiles, eq(marketplaceListings.sellerId, sellerProfiles.id))
    .where(eq(listingReports.status, 'pending'))
    .groupBy(marketplaceListings.sellerId, sellerProfiles.displayName)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);
  
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(listingReports);
  
  return {
    byStatus,
    byReason: byReason.map(r => ({ reason: r.reason, count: Number(r.count) })),
    bySeller: bySeller.map(s => ({ sellerId: s.sellerId, sellerDisplayName: s.sellerDisplayName, reportCount: Number(s.reportCount) })),
    total: Number(totalResult?.count ?? 0),
  };
}

// ============================================================
// ENHANCED ADMIN GET REPORTS (with listing info)
// ============================================================

export async function getAdminListingReportsEnhanced(options: {
  page?: number;
  pageSize?: number;
  status?: string;
} = {}) {
  const db = await getDb();
  if (!db) return { reports: [], total: 0 };
  
  const { page = 1, pageSize = 20, status } = options;
  const offset = (page - 1) * pageSize;
  
  const conditions = status && status !== 'all' ? [eq(listingReports.status, status as any)] : [];
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(listingReports)
    .where(whereClause);
  
  const reports = await db
    .select({
      id: listingReports.id,
      listingId: listingReports.listingId,
      reporterId: listingReports.reporterId,
      reason: listingReports.reason,
      details: listingReports.details,
      status: listingReports.status,
      adminNote: listingReports.adminNote,
      reviewedAt: listingReports.reviewedAt,
      createdAt: listingReports.createdAt,
      // Listing info
      listingTitle: marketplaceListings.title,
      listingImages: marketplaceListings.images,
      listingStatus: marketplaceListings.status,
      // Seller info
      sellerId: marketplaceListings.sellerId,
      sellerDisplayName: sellerProfiles.displayName,
    })
    .from(listingReports)
    .leftJoin(marketplaceListings, eq(listingReports.listingId, marketplaceListings.id))
    .leftJoin(sellerProfiles, eq(marketplaceListings.sellerId, sellerProfiles.id))
    .where(whereClause)
    .orderBy(desc(listingReports.createdAt))
    .limit(pageSize)
    .offset(offset);
  
  return { reports, total: Number(countResult?.count ?? 0) };
}
