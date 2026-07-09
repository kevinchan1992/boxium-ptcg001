/**
 * pools.ts — 卡池系統 DB helpers
 * Fisher-Yates 洗牌、DB 悲觀鎖抽卡引擎、虛擬倉庫操作
 */
import { getDb } from "../db";
import { pools, poolRewards, poolSlots, userVault } from "../../drizzle/schema_new";
import { eq, sql, and, isNull, asc } from "drizzle-orm";
import { deductPoints, addPoints } from "./points";

// ─── Pool CRUD ───────────────────────────────────────────────────────────────

export async function getActivePools() {
  const db = await getDb();
  return db
    .select()
    .from(pools)
    .where(eq(pools.status, "active"))
    .orderBy(asc(pools.sortOrder));
}

export async function getAllPools() {
  const db = await getDb();
  return db.select().from(pools).orderBy(sql`${pools.sortOrder} ASC, ${pools.createdAt} DESC`);
}

export async function getPoolById(poolId: number) {
  const db = await getDb();
  const rows = await db.select().from(pools).where(eq(pools.id, poolId)).limit(1);
  return rows[0] ?? null;
}

export async function getPoolRewards(poolId: number) {
  const db = await getDb();
  return db.select().from(poolRewards).where(eq(poolRewards.poolId, poolId));
}

export async function getPoolSlots(poolId: number) {
  const db = await getDb();
  return db
    .select()
    .from(poolSlots)
    .where(eq(poolSlots.poolId, poolId))
    .orderBy(asc(poolSlots.slotNumber));
}

export async function getPoolSlotsPurchased(poolId: number) {
  const db = await getDb();
  return db
    .select()
    .from(poolSlots)
    .where(and(eq(poolSlots.poolId, poolId), sql`${poolSlots.buyerUserId} IS NOT NULL`));
}

/**
 * 計算卡池精算數據（即時 Reactive）
 */
export async function calcPoolFinancials(params: {
  totalSlots: number;
  pricePoints: number;
  visibleCardCost: number;
  miscCost: number;
  rewards: Array<{ cost: number; quantity: number; rewardType: string }>;
}) {
  const gmv = params.totalSlots * params.pricePoints;
  const visibleCardTotalCost = params.totalSlots * params.visibleCardCost;
  const hiddenRewardsCost = params.rewards
    .filter((r) => r.rewardType === "hidden")
    .reduce((sum, r) => sum + r.cost * r.quantity, 0);
  const milestoneCost = params.rewards
    .filter((r) => r.rewardType === "milestone")
    .reduce((sum, r) => sum + r.cost * r.quantity, 0);
  const totalCost = visibleCardTotalCost + hiddenRewardsCost + milestoneCost + params.miscCost;
  const grossProfit = gmv - totalCost;
  const grossMargin = gmv > 0 ? (grossProfit / gmv) * 100 : 0;
  const returnRate = gmv > 0 ? (totalCost / gmv) * 100 : 0;

  // 風控燈號
  let riskLight: "green" | "yellow" | "red";
  if (grossMargin >= 20 && returnRate >= 60) {
    riskLight = "green";
  } else if (grossMargin >= 10) {
    riskLight = "yellow";
  } else {
    riskLight = "red";
  }

  return {
    gmv,
    visibleCardTotalCost,
    hiddenRewardsCost,
    milestoneCost,
    totalCost,
    grossProfit,
    grossMargin: Math.round(grossMargin * 100) / 100,
    returnRate: Math.round(returnRate * 100) / 100,
    riskLight,
    canPublish: riskLight !== "red",
  };
}

/**
 * Fisher-Yates 洗牌並初始化 poolSlots
 * 在發佈卡池時呼叫，將所有獎品隨機分配到 slot 1~N
 */
export async function initializePoolSlots(poolId: number): Promise<void> {
  const db = await getDb();
  const pool = await getPoolById(poolId);
  if (!pool) throw new Error("Pool not found");

  const rewards = await getPoolRewards(poolId);
  const milestoneRewards = rewards.filter((r) => r.rewardType === "milestone");
  const hiddenRewards = rewards.filter((r) => r.rewardType === "hidden");

  // 建立獎品陣列（按 quantity 展開）
  const rewardPool: Array<{
    rewardId: number;
    rewardName: string;
    rewardImageUrl: string | null;
    effectTier: number;
  }> = [];

  for (const r of hiddenRewards) {
    for (let i = 0; i < r.quantity; i++) {
      rewardPool.push({
        rewardId: r.id,
        rewardName: r.name,
        rewardImageUrl: r.imageUrl,
        effectTier: r.effectTier,
      });
    }
  }

  // 確保數量等於 totalSlots
  if (rewardPool.length !== pool.totalSlots) {
    throw new Error(
      `獎品總數 (${rewardPool.length}) 與卡池總份數 (${pool.totalSlots}) 不符`
    );
  }

  // Fisher-Yates 洗牌
  for (let i = rewardPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rewardPool[i], rewardPool[j]] = [rewardPool[j], rewardPool[i]];
  }

  // 確定階梯賞觸發的 slotNumber
  const milestoneSlots = new Map<number, (typeof milestoneRewards)[0]>();
  for (const m of milestoneRewards) {
    if (m.triggerAt) milestoneSlots.set(m.triggerAt, m);
  }

  // 刪除舊 slots（重新發佈時）
  await db.delete(poolSlots).where(eq(poolSlots.poolId, poolId));

  // 批量插入 slots
  const slotValues = rewardPool.map((r, idx) => {
    const slotNumber = idx + 1;
    const milestone = milestoneSlots.get(slotNumber);
    return {
      poolId,
      slotNumber,
      visibleCardName: "AR PSA10",
      visibleCardImageUrl: null,
      hiddenRewardId: r.rewardId,
      hiddenRewardName: r.rewardName,
      hiddenRewardImageUrl: r.rewardImageUrl,
      effectTier: r.effectTier,
      isMilestone: !!milestone,
      milestoneRewardId: milestone?.id ?? null,
      milestoneRewardName: milestone?.name ?? null,
    };
  });

  // 分批插入（每批 50 筆）
  for (let i = 0; i < slotValues.length; i += 50) {
    await db.insert(poolSlots).values(slotValues.slice(i, i + 50));
  }
}

// ─── 抽卡引擎（DB 悲觀鎖）─────────────────────────────────────────────────────

export interface DrawResult {
  slotNumber: number;
  visibleCardName: string | null;
  hiddenRewardName: string | null;
  hiddenRewardImageUrl: string | null;
  effectTier: number;
  isMilestone: boolean;
  milestoneRewardName: string | null;
  milestoneRewardImageUrl: string | null;
  vaultId: number;
  remainingSlots: number;
  remainingPoints: number;
}

/**
 * 原子性抽卡（DB 悲觀鎖）
 * 1. 扣減點數（SELECT FOR UPDATE）
 * 2. 鎖定並分配 slot（SELECT FOR UPDATE）
 * 3. 寫入虛擬倉庫
 * 4. 更新卡池狀態（如已售完）
 */
export async function drawSlot(params: {
  userId: number;
  poolId: number;
  slotNumber?: number; // 如指定則為明卡自選
}): Promise<DrawResult> {
  const db = await getDb();
  const pool = await getPoolById(params.poolId);
  if (!pool) throw new Error("卡池不存在");
  if (pool.status !== "active") throw new Error("卡池目前不開放");
  if (pool.maintenanceMode) throw new Error(pool.maintenanceMessage ?? "卡池維護中");

  let drawResult!: DrawResult;

  await db.transaction(async (tx) => {
    // 1. 扣減點數（在 transaction 外用 deductPoints 的 FOR UPDATE 邏輯）
    // 這裡直接在 tx 內執行，確保整個操作原子性
    const balRows = await tx.execute(
      sql`SELECT balance FROM userPointBalance WHERE userId = ${params.userId} FOR UPDATE`
    );
    const balArr = balRows as any;
    const currentBalance: number =
      balArr?.[0]?.[0]?.balance ?? balArr?.[0]?.balance ?? 0;

    if (currentBalance < pool.pricePoints) {
      throw new Error(`INSUFFICIENT_POINTS:${currentBalance}`);
    }

    // 2. 選取 slot（FOR UPDATE 行級鎖）
    let slotRow: typeof poolSlots.$inferSelect | null = null;

    if (params.slotNumber) {
      // 明卡自選：指定 slotNumber
      const rows = await tx.execute(
        sql`SELECT * FROM poolSlots 
            WHERE poolId = ${params.poolId} 
              AND slotNumber = ${params.slotNumber} 
              AND buyerUserId IS NULL 
            FOR UPDATE LIMIT 1`
      );
      const rowsArr = rows as any;
      slotRow = rowsArr?.[0]?.[0] ?? rowsArr?.[0] ?? null;
      if (!slotRow) throw new Error("此卡位已被選走，請選擇其他號碼");
    } else {
      // 隨機抽取：選取第一個未購買的 slot
      const rows = await tx.execute(
        sql`SELECT * FROM poolSlots 
            WHERE poolId = ${params.poolId} 
              AND buyerUserId IS NULL 
            ORDER BY slotNumber ASC 
            LIMIT 1 
            FOR UPDATE`
      );
      const rowsArr = rows as any;
      slotRow = rowsArr?.[0]?.[0] ?? rowsArr?.[0] ?? null;
      if (!slotRow) throw new Error("卡池已售罄");
    }

    const slotId = slotRow.id;
    const slotNumber = slotRow.slotNumber;

    // 3. 扣減點數
    const newBalance = currentBalance - pool.pricePoints;
    await tx.execute(
      sql`UPDATE userPointBalance SET balance = ${newBalance}, updatedAt = NOW() WHERE userId = ${params.userId}`
    );

    // 4. 標記 slot 已購買
    await tx.execute(
      sql`UPDATE poolSlots SET buyerUserId = ${params.userId}, purchasedAt = NOW() WHERE id = ${slotId}`
    );

    // 5. 記錄點數交易
    await tx.execute(
      sql`INSERT INTO pointTransactions (userId, type, amount, balanceAfter, referenceId, note, createdAt)
          VALUES (${params.userId}, 'purchase', ${-pool.pricePoints}, ${newBalance}, 
                  ${'pool_' + params.poolId + '_slot_' + slotNumber}, 
                  ${'卡池 #' + params.poolId + ' 第 ' + slotNumber + ' 號'},
                  NOW())
          ON DUPLICATE KEY UPDATE id=id`
    );

    // 6. 寫入虛擬倉庫
    const milestoneCardName = slotRow.milestoneRewardName ?? null;
    const vaultInsert = await tx.execute(
      sql`INSERT INTO userVault 
          (userId, poolSlotId, poolId, poolTitle, cardName, cardImageUrl, 
           effectTier, isMilestone, milestoneCardName, milestoneCardImageUrl, status, createdAt, updatedAt)
          VALUES (
            ${params.userId}, ${slotId}, ${params.poolId}, ${pool.title},
            ${slotRow.hiddenRewardName}, ${slotRow.hiddenRewardImageUrl},
            ${slotRow.effectTier}, ${slotRow.isMilestone ? 1 : 0},
            ${milestoneCardName}, ${null},
            'in_vault', NOW(), NOW()
          )`
    );
    const vaultId = (vaultInsert as any).insertId ?? (vaultInsert as any)[0]?.insertId ?? 0;

    // 7. 計算剩餘 slots
    const remainRows = await tx.execute(
      sql`SELECT COUNT(*) as cnt FROM poolSlots WHERE poolId = ${params.poolId} AND buyerUserId IS NULL`
    );
    const remainArr = remainRows as any;
    const remainingSlots: number =
      parseInt(remainArr?.[0]?.[0]?.cnt ?? remainArr?.[0]?.cnt ?? "0");

    // 8. 如已售完，更新卡池狀態
    if (remainingSlots === 0) {
      await tx.execute(
        sql`UPDATE pools SET status = 'sold_out', updatedAt = NOW() WHERE id = ${params.poolId}`
      );
    }

    drawResult = {
      slotNumber,
      visibleCardName: slotRow.visibleCardName,
      hiddenRewardName: slotRow.hiddenRewardName,
      hiddenRewardImageUrl: slotRow.hiddenRewardImageUrl,
      effectTier: slotRow.effectTier,
      isMilestone: !!slotRow.isMilestone,
      milestoneRewardName: slotRow.milestoneRewardName,
      milestoneRewardImageUrl: null,
      vaultId,
      remainingSlots,
      remainingPoints: newBalance,
    };
  });

  return drawResult;
}

// ─── 虛擬倉庫 ─────────────────────────────────────────────────────────────────

export async function getUserVault(userId: number, status?: string) {
  const db = await getDb();
  const conditions = [eq(userVault.userId, userId)];
  if (status) {
    conditions.push(sql`${userVault.status} = ${status}`);
  }
  return db
    .select()
    .from(userVault)
    .where(and(...conditions))
    .orderBy(sql`${userVault.createdAt} DESC`);
}

export async function requestBuyback(vaultId: number, userId: number) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(userVault)
    .where(and(eq(userVault.id, vaultId), eq(userVault.userId, userId)))
    .limit(1);
  const item = rows[0];
  if (!item) throw new Error("找不到此倉庫物品");
  if (item.status !== "in_vault") throw new Error("此物品狀態不允許收購");

  const pool = await getPoolById(item.poolId);
  const buybackPoints = pool?.officialBuybackPoints ?? 300;

  await db.transaction(async (tx) => {
    // 更新倉庫狀態
    await tx.execute(
      sql`UPDATE userVault SET status = 'processing_buyback', buybackPoints = ${buybackPoints}, updatedAt = NOW() WHERE id = ${vaultId}`
    );
  });

  return { buybackPoints };
}

export async function approveBuyback(vaultId: number) {
  const db = await getDb();
  const rows = await db.select().from(userVault).where(eq(userVault.id, vaultId)).limit(1);
  const item = rows[0];
  if (!item) throw new Error("找不到此倉庫物品");
  if (item.status !== "processing_buyback") throw new Error("此物品不在收購處理中");

  const buybackPoints = item.buybackPoints ?? 300;

  // 加回點數
  await addPoints({
    userId: item.userId,
    amount: buybackPoints,
    type: "buyback",
    referenceId: `buyback_vault_${vaultId}`,
    note: `官方收購 #${vaultId} — ${item.cardName}`,
  });

  // 更新倉庫狀態
  await db.execute(
    sql`UPDATE userVault SET status = 'sold_to_official', updatedAt = NOW() WHERE id = ${vaultId}`
  );

  return { buybackPoints };
}

export async function requestShipping(params: {
  vaultId: number;
  userId: number;
  shippingAddressId: number;
}) {
  const db = await getDb();
  await db.execute(
    sql`UPDATE userVault 
        SET status = 'shipping_requested', shippingAddressId = ${params.shippingAddressId}, updatedAt = NOW()
        WHERE id = ${params.vaultId} AND userId = ${params.userId} AND status = 'in_vault'`
  );
}
