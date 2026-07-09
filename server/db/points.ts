/**
 * points.ts — 點數系統 DB helpers
 * 使用 SELECT ... FOR UPDATE 悲觀鎖確保 Autoscale 多實例下的原子操作
 */
import { getDb } from "../db";
import { userPointBalance, pointTransactions } from "../../drizzle/schema_new";
import { eq, sql } from "drizzle-orm";

export type PointTxType = "topup" | "purchase" | "buyback" | "refund" | "admin_adjust";

/**
 * 取得用戶點數餘額（如不存在則返回 0）
 */
export async function getUserPointBalance(userId: number): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ balance: userPointBalance.balance })
    .from(userPointBalance)
    .where(eq(userPointBalance.userId, userId))
    .limit(1);
  return rows[0]?.balance ?? 0;
}

/**
 * 原子性增加點數（用於儲值 topup）
 * 使用 INSERT ... ON DUPLICATE KEY UPDATE 確保原子操作
 * referenceId 唯一索引防止重複入帳
 */
export async function addPoints(params: {
  userId: number;
  amount: number;
  type: PointTxType;
  referenceId: string;
  note?: string;
}): Promise<{ success: boolean; balance: number; alreadyProcessed?: boolean }> {
  const db = await getDb();
  const rawDb = (db as any).session?.client ?? (db as any).$client;

  // 先檢查是否已處理過（冪等性）
  const existing = await db
    .select({ id: pointTransactions.id })
    .from(pointTransactions)
    .where(
      sql`${pointTransactions.type} = ${params.type} AND ${pointTransactions.referenceId} = ${params.referenceId}`
    )
    .limit(1);

  if (existing.length > 0) {
    const balance = await getUserPointBalance(params.userId);
    return { success: true, balance, alreadyProcessed: true };
  }

  // 使用 raw SQL 在單一 transaction 內完成悲觀鎖操作
  // 1. UPSERT userPointBalance（INSERT ... ON DUPLICATE KEY UPDATE）
  // 2. 記錄 pointTransactions
  await db.transaction(async (tx) => {
    // 1. Upsert balance
    await tx.execute(
      sql`INSERT INTO userPointBalance (userId, balance, updatedAt)
          VALUES (${params.userId}, ${params.amount}, NOW())
          ON DUPLICATE KEY UPDATE
            balance = balance + ${params.amount},
            updatedAt = NOW()`
    );

    // 2. Get new balance
    const balRows = await tx
      .select({ balance: userPointBalance.balance })
      .from(userPointBalance)
      .where(eq(userPointBalance.userId, params.userId))
      .limit(1);
    const newBalance = balRows[0]?.balance ?? params.amount;

    // 3. Insert transaction record
    await tx.insert(pointTransactions).values({
      userId: params.userId,
      type: params.type,
      amount: params.amount,
      balanceAfter: newBalance,
      referenceId: params.referenceId,
      note: params.note,
    });
  });

  const balance = await getUserPointBalance(params.userId);
  return { success: true, balance };
}

/**
 * 原子性扣減點數（用於購買）
 * 使用 SELECT ... FOR UPDATE 行級鎖防止超賣
 */
export async function deductPoints(params: {
  userId: number;
  amount: number;
  type: PointTxType;
  referenceId: string;
  note?: string;
}): Promise<{ success: boolean; balance: number; error?: string }> {
  const db = await getDb();

  let finalBalance = 0;

  try {
    await db.transaction(async (tx) => {
      // SELECT FOR UPDATE — 行級鎖，防止多實例並發超賣
      const rows = await tx.execute(
        sql`SELECT balance FROM userPointBalance WHERE userId = ${params.userId} FOR UPDATE`
      );
      const rowsArr = rows as any;
      const currentBalance: number = rowsArr?.[0]?.[0]?.balance ?? rowsArr?.[0]?.balance ?? 0;

      if (currentBalance < params.amount) {
        throw new Error(`INSUFFICIENT_POINTS:${currentBalance}`);
      }

      const newBalance = currentBalance - params.amount;

      // Update balance
      await tx.execute(
        sql`UPDATE userPointBalance SET balance = ${newBalance}, updatedAt = NOW() WHERE userId = ${params.userId}`
      );

      // Record transaction
      await tx.insert(pointTransactions).values({
        userId: params.userId,
        type: params.type,
        amount: -params.amount,
        balanceAfter: newBalance,
        referenceId: params.referenceId,
        note: params.note,
      });

      finalBalance = newBalance;
    });

    return { success: true, balance: finalBalance };
  } catch (err: any) {
    if (err?.message?.startsWith("INSUFFICIENT_POINTS:")) {
      const current = parseInt(err.message.split(":")[1] ?? "0");
      return { success: false, balance: current, error: "點數不足" };
    }
    throw err;
  }
}

/**
 * 取得用戶點數交易記錄
 */
export async function getPointTransactions(userId: number, limit = 20, offset = 0) {
  const db = await getDb();
  return db
    .select()
    .from(pointTransactions)
    .where(eq(pointTransactions.userId, userId))
    .orderBy(sql`${pointTransactions.createdAt} DESC`)
    .limit(limit)
    .offset(offset);
}
