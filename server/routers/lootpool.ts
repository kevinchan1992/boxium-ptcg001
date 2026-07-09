/**
 * Loot Pool Router — 福袋系統 tRPC 程序
 * 包含：pool (公開)、vault (用戶)、adminPool (管理員)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure, adminProcedure } from "../_core/trpc";
import {
  getActivePools,
  getPoolById,
  getPoolRewards,
  calcPoolFinancials,
  initializePoolSlots,
  drawSlot,
  getUserVault,
  requestBuyback,
  approveBuyback,
  requestShipping,
  getPoolSlots,
} from "../db/pools";
import { getDb, setSystemSetting, isLootpoolMaintenanceMode } from "../db";
import { sql } from "drizzle-orm";
import { generateImage } from "../_core/imageGeneration";
import { notifyOwner } from "../_core/notification";

// ─── Pool 公開路由 ───────────────────────────────────────────────────────────
const poolRouter = router({
  /** 取得所有活躍卡池列表 */
  list: publicProcedure.query(async () => {
    return getActivePools();
  }),

  /** 取得單一卡池詳情 */
  getById: publicProcedure
    .input(z.object({ poolId: z.number() }))
    .query(async ({ input }) => {
      const pool = await getPoolById(input.poolId);
      if (!pool) throw new TRPCError({ code: "NOT_FOUND", message: "卡池不存在" });
      const rewards = await getPoolRewards(input.poolId);
      return { pool, rewards };
    }),

  /** 取得卡池所有格子狀態（公開顯示用） */
  getSlots: publicProcedure
    .input(z.object({ poolId: z.number() }))
    .query(async ({ input }) => {
      return getPoolSlots(input.poolId);
    }),

  /** 抽取一個格子 */
  draw: protectedProcedure
    .input(z.object({
      poolId: z.number(),
      slotNumber: z.number().min(1).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await drawSlot({
        userId: ctx.user.id,
        poolId: input.poolId,
        slotNumber: input.slotNumber,
      });
      return result;
    }),
});

// ─── Vault 用戶倉庫路由 ──────────────────────────────────────────────────────
const vaultRouter = router({
  /** 取得用戶虛擬倉庫 */
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["in_vault", "processing_buyback", "sold_to_official", "shipping_requested", "shipped"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return getUserVault(ctx.user.id, input.status);
    }),

  /** 申請官方回購 */
  requestBuyback: protectedProcedure
    .input(z.object({ vaultId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requestBuyback(input.vaultId, ctx.user.id);
      await notifyOwner({
        title: "新回購申請",
        content: `用戶 ${ctx.user.id} 申請回購 vault #${input.vaultId}`,
      }).catch(() => {});
      return { success: true };
    }),

  /** 申請出貨 */
  requestShipping: protectedProcedure
    .input(z.object({
      vaultId: z.number(),
      shippingAddressId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requestShipping({
        userId: ctx.user.id,
        vaultId: input.vaultId,
        shippingAddressId: input.shippingAddressId,
      });
      await notifyOwner({
        title: "新出貨申請",
        content: `用戶 ${ctx.user.id} 申請出貨 vault #${input.vaultId}，地址 #${input.shippingAddressId}`,
      }).catch(() => {});
      return { success: true };
    }),
});

// ─── Admin Pool 管理路由 ─────────────────────────────────────────────────────
const adminPoolRouter = router({
  /** 列出所有卡池（含草稿） */
  listAll: adminProcedure.query(async () => {
    const db = await getDb();
    const rows = await db.execute(sql`
      SELECT p.*,
        (SELECT COUNT(*) FROM poolSlots WHERE poolId = p.id AND buyerUserId IS NOT NULL) AS soldSlots
      FROM pools p
      ORDER BY p.createdAt DESC
      LIMIT 100
    `);
    return rows as any[];
  }),

  /** 計算財務指標（即時預覽，不儲存） */
  calcFinancials: adminProcedure
    .input(z.object({
      pricePoints: z.number().min(1),
      visibleCardCost: z.number().min(0),
      miscCost: z.number().min(0).default(0),
      rewards: z.array(z.object({
        rewardType: z.enum(["rainbow", "gold", "blue", "milestone"]),
        cost: z.number().min(0),
        quantity: z.number().min(1),
      })),
      totalSlots: z.number().min(10).max(100).default(100),
    }))
    .mutation(async ({ input }) => {
      return await calcPoolFinancials({
        pricePoints: input.pricePoints,
        visibleCardCost: input.visibleCardCost,
        rewards: input.rewards.map(r => ({
          rewardType: (r.rewardType === "rainbow" || r.rewardType === "gold" || r.rewardType === "blue") ? "hidden" : r.rewardType,
          cost: r.cost,
          quantity: r.quantity,
        })),
        totalSlots: input.totalSlots,
        miscCost: input.miscCost,
      });
    }),

  /** 建立新卡池（草稿） */
  create: adminProcedure
    .input(z.object({
      title: z.string().min(1).max(100),
      description: z.string().optional(),
      pricePoints: z.number().min(1),
      visibleCardCost: z.number().min(0),
      visibleCardName: z.string().default("AR PSA10"),
      buybackPoints: z.number().min(0).default(300),
      totalSlots: z.number().min(10).max(100).default(100),
      miscCost: z.number().min(0).default(0),
      rewards: z.array(z.object({
        name: z.string(),
        rewardType: z.enum(["rainbow", "gold", "blue", "milestone"]),
        effectTier: z.number().min(1).max(3),
        cost: z.number().min(0),
        quantity: z.number().min(1),
        triggerAt: z.number().optional(),
      })),
      generateCover: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      // 財務風險檢查
      const fin = await calcPoolFinancials({
        pricePoints: input.pricePoints,
        visibleCardCost: input.visibleCardCost,
        rewards: input.rewards.map(r => ({
          rewardType: (r.rewardType === "rainbow" || r.rewardType === "gold" || r.rewardType === "blue") ? "hidden" : r.rewardType,
          cost: r.cost,
          quantity: r.quantity,
        })),
        totalSlots: input.totalSlots,
        miscCost: input.miscCost,
      });
      if (fin.riskLight === "red") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `毛利率 ${fin.grossMargin.toFixed(1)}% 過低，無法建立卡池（需 ≥ 10%）`,
        });
      }

      // 生成封面圖（可選）
      let coverImageUrl: string | null = null;
      if (input.generateCover) {
        try {
          const { url } = await generateImage({
            prompt: `Pokemon TCG mystery box loot pool cover art, title: "${input.title}", holographic foil effect, dark background, premium collectible card game aesthetic`,
          });
          coverImageUrl = url ?? null;
        } catch (e) {
          console.error("封面圖生成失敗:", e);
        }
      }

      const db = await getDb();
      const descVal = input.description ?? null;

      // 插入 pool
      const insertResult = await db.execute(sql`
        INSERT INTO pools (title, description, totalSlots, pricePoints,
          visibleCardCost, officialBuybackPoints, coverImageUrl,
          maintenanceMode, createdAt, updatedAt)
        VALUES (
          ${input.title}, ${descVal}, ${input.totalSlots},
          ${input.pricePoints}, ${input.visibleCardCost},
          ${input.buybackPoints}, ${coverImageUrl},
          0, NOW(), NOW()
        )
      `);
      const poolId = (insertResult as any).insertId ?? (insertResult as any)[0]?.insertId;

      // 插入 rewards
      for (const r of input.rewards) {
        const triggerAtVal = r.triggerAt ?? null;
        await db.execute(sql`
          INSERT INTO poolRewards (poolId, name, pr_rewardType, effectTier, cost, quantity, triggerAt, createdAt)
          VALUES (${poolId}, ${r.name}, ${r.rewardType}, ${r.effectTier}, ${r.cost}, ${r.quantity}, ${triggerAtVal}, NOW())
        `);
      }

      return { poolId, coverImageUrl, financials: fin };
    }),

  /** 更新卡池基本資訊（僅草稿狀態） */
  update: adminProcedure
    .input(z.object({
      poolId: z.number(),
      title: z.string().min(1).max(100).optional(),
      description: z.string().nullable().optional(),
      pricePoints: z.number().min(1).optional(),
      visibleCardCost: z.number().min(0).optional(),
      buybackPoints: z.number().min(0).optional(),
      maintenanceMode: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const pool = await getPoolById(input.poolId);
      if (!pool) throw new TRPCError({ code: "NOT_FOUND" });

      const db = await getDb();
      const setClauses: string[] = [];
      if (input.title !== undefined) setClauses.push(`title = '${input.title.replace(/'/g, "''")}'`);
      if (input.description !== undefined) setClauses.push(`description = ${input.description === null ? "NULL" : `'${input.description.replace(/'/g, "''")}'`}`);
      if (input.pricePoints !== undefined) setClauses.push(`pricePoints = ${input.pricePoints}`);
      if (input.visibleCardCost !== undefined) setClauses.push(`visibleCardCost = ${input.visibleCardCost}`);
      if (input.buybackPoints !== undefined) setClauses.push(`buybackPoints = ${input.buybackPoints}`);
      if (input.maintenanceMode !== undefined) setClauses.push(`maintenanceMode = ${input.maintenanceMode ? 1 : 0}`);
      setClauses.push(`updatedAt = NOW()`);

      if (setClauses.length > 1) {
        await db.execute(sql.raw(`UPDATE pools SET ${setClauses.join(", ")} WHERE id = ${input.poolId}`));
      }
      return { success: true };
    }),

  /** 發布卡池（draft → active，同時初始化 slots） */
  publish: adminProcedure
    .input(z.object({ poolId: z.number() }))
    .mutation(async ({ input }) => {
      const pool = await getPoolById(input.poolId);
      if (!pool) throw new TRPCError({ code: "NOT_FOUND" });
      if (pool.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "只有草稿狀態的卡池可以發布" });
      }

      // 財務風險最終檢查
      const rewards = await getPoolRewards(input.poolId);
      const fin = await calcPoolFinancials({
        pricePoints: pool.pricePoints,
        visibleCardCost: pool.visibleCardCost,
        rewards: rewards.map(r => ({
          rewardType: (r.rewardType === "rainbow" || r.rewardType === "gold" || r.rewardType === "blue") ? "hidden" : r.rewardType,
          cost: r.cost,
          quantity: r.quantity,
        })),
        totalSlots: pool.totalSlots,
        miscCost: 0,
      });
      if (fin.riskLight === "red") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `毛利率 ${fin.grossMargin.toFixed(1)}% 過低，無法發布（需 ≥ 10%）`,
        });
      }

      // 初始化 slots（Fisher-Yates 洗牌）
      await initializePoolSlots(input.poolId);

      const db = await getDb();
      await db.execute(sql`UPDATE pools SET pool_status = 'active', updatedAt = NOW() WHERE id = ${input.poolId}`);

      return { success: true, financials: fin };
    }),

  /** 切換維護模式 */
  setMaintenance: adminProcedure
    .input(z.object({ poolId: z.number(), maintenance: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.execute(sql`
        UPDATE pools SET maintenanceMode = ${input.maintenance ? 1 : 0}, updatedAt = NOW()
        WHERE id = ${input.poolId}
      `);
      return { success: true };
    }),

  /** 取得福袋系統全域維護模式狀態 */
  getMaintenanceMode: adminProcedure.query(async () => {
    const enabled = await isLootpoolMaintenanceMode();
    return { enabled };
  }),
  /** 設定福袋系統全域維護模式 */
  setMaintenanceMode: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      await setSystemSetting('lootpool_maintenance_mode', input.enabled ? 'true' : 'false', '福袋系統維護模式開關');
      return { success: true, enabled: input.enabled };
    }),
  /** 審核回購申請 */
  approveBuyback: adminProcedure
    .input(z.object({ vaultId: z.number() }))
    .mutation(async ({ input }) => {
      await approveBuyback(input.vaultId);
      return { success: true };
    }),
});

// ─── 匯出合併路由 ────────────────────────────────────────────────────────────
export const lootpoolRouter = router({
  pool: poolRouter,
  vault: vaultRouter,
  adminPool: adminPoolRouter,
});
