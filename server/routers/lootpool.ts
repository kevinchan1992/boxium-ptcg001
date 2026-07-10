/**
 * Loot Pool tRPC Router
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import { getSystemSetting, setSystemSetting } from "../db";
import { eq, and, sql } from "drizzle-orm";
import {
  pools, poolRewards, poolSlots, userVault, userPointBalance, pointTransactions
} from "../../drizzle/schema_new";

async function getDbInstance() {
  const { getDb } = await import("../db");
  return getDb();
}

async function getPointBalance(userId: number): Promise<number> {
  const db = await getDbInstance();
  const [row] = await db.select().from(userPointBalance).where(eq(userPointBalance.userId, userId)).limit(1);
  return row?.balance ?? 0;
}

async function adjustPoints(
  userId: number,
  amount: number,
  type: "topup" | "draw" | "buyback" | "refund" | "admin_adjust",
  description: string,
  referenceId?: string
) {
  const db = await getDbInstance();
  const current = await getPointBalance(userId);
  const newBalance = current + amount;
  if (newBalance < 0) throw new TRPCError({ code: "BAD_REQUEST", message: "點數不足" });

  await db.execute(sql`
    INSERT INTO userPointBalance (userId, balance) VALUES (${userId}, ${newBalance})
    ON DUPLICATE KEY UPDATE balance = ${newBalance}
  `);

  await db.insert(pointTransactions).values({
    userId,
    type,
    amount,
    balanceAfter: newBalance,
    description,
    referenceId,
  });

  return newBalance;
}

export const lootpoolRouter = router({
  checkMaintenanceMode: publicProcedure.query(async () => {
    const setting = await getSystemSetting("lootpool_maintenance_mode");
    return { enabled: setting?.settingValue === "true" };
  }),
  list: publicProcedure.query(async () => {
    const db = await getDbInstance();
    const isMaintenanceMode = await getSystemSetting("lootpool_maintenance_mode");
    if (isMaintenanceMode?.settingValue === "true") {
      return { pools: [], maintenanceMode: true, maintenanceMessage: isMaintenanceMode.description ?? "福袋系統維護中" };
    }
    const rows = await db.select().from(pools).where(eq(pools.status, "active")).orderBy(pools.sortOrder);
    return { pools: rows, maintenanceMode: false };
  }),

  getDetail: publicProcedure
    .input(z.object({ poolId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDbInstance();
      const [pool] = await db.select().from(pools).where(eq(pools.id, input.poolId)).limit(1);
      if (!pool) throw new TRPCError({ code: "NOT_FOUND", message: "卡池不存在" });
      const rewards = await db.select().from(poolRewards).where(eq(poolRewards.poolId, input.poolId));
      const slots = await db.select().from(poolSlots).where(eq(poolSlots.poolId, input.poolId));
      return { pool, rewards, slots };
    }),

  myBalance: protectedProcedure.query(async ({ ctx }) => {
    const balance = await getPointBalance(ctx.user.id);
    return { balance };
  }),

  myTransactions: protectedProcedure
    .input(z.object({ limit: z.number().optional().default(20), offset: z.number().optional().default(0) }))
    .query(async ({ ctx, input }) => {
      const db = await getDbInstance();
      const rows = await db.select().from(pointTransactions)
        .where(eq(pointTransactions.userId, ctx.user.id))
        .orderBy(sql`pointTransactions.createdAt DESC`)
        .limit(input.limit).offset(input.offset);
      return rows;
    }),

  draw: protectedProcedure
    .input(z.object({ poolId: z.number(), slotIndex: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDbInstance();
      const [pool] = await db.select().from(pools).where(and(eq(pools.id, input.poolId), eq(pools.status, "active"))).limit(1);
      if (!pool) throw new TRPCError({ code: "NOT_FOUND", message: "卡池不存在或已關閉" });
      if (pool.maintenanceMode) throw new TRPCError({ code: "PRECONDITION_FAILED", message: pool.maintenanceMessage ?? "卡池維護中" });

      const [slot] = await db.select().from(poolSlots)
        .where(and(eq(poolSlots.poolId, input.poolId), eq(poolSlots.slotIndex, input.slotIndex))).limit(1);
      if (!slot) throw new TRPCError({ code: "NOT_FOUND", message: "格子不存在" });
      if (slot.isDrawn) throw new TRPCError({ code: "CONFLICT", message: "此格子已被抽取" });

      const balance = await getPointBalance(ctx.user.id);
      if (balance < pool.pricePoints) throw new TRPCError({ code: "PAYMENT_REQUIRED", message: "點數不足" });

      await adjustPoints(ctx.user.id, -pool.pricePoints, "draw", `抽取卡池 #${pool.id} 第 ${input.slotIndex + 1} 格`, `pool_${pool.id}_slot_${input.slotIndex}`);
      await db.update(poolSlots).set({ isDrawn: true, drawnByUserId: ctx.user.id, drawnAt: new Date() }).where(eq(poolSlots.id, slot.id));

      let reward = null;
      if (slot.rewardId) {
        const [r] = await db.select().from(poolRewards).where(eq(poolRewards.id, slot.rewardId)).limit(1);
        reward = r ?? null;
      }

      if (reward) {
        await db.execute(sql`
          INSERT INTO userVault (userId, poolId, rewardId, slotIndex, uv_status)
          VALUES (${ctx.user.id}, ${input.poolId}, ${slot.rewardId!}, ${input.slotIndex}, 'pending')
        `);
      }

      return { success: true, reward, slotIndex: input.slotIndex };
    }),

  myVault: protectedProcedure
    .input(z.object({ limit: z.number().optional().default(20), offset: z.number().optional().default(0) }))
    .query(async ({ ctx, input }) => {
      const db = await getDbInstance();
      const rows = await db.select({
        vault: userVault,
        reward: poolRewards,
        pool: pools,
      }).from(userVault)
        .leftJoin(poolRewards, eq(userVault.rewardId, poolRewards.id))
        .leftJoin(pools, eq(userVault.poolId, pools.id))
        .where(eq(userVault.userId, ctx.user.id))
        .orderBy(sql`userVault.createdAt DESC`)
        .limit(input.limit).offset(input.offset);
      return rows;
    }),

  requestBuyback: protectedProcedure
    .input(z.object({ vaultId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDbInstance();
      const [item] = await db.select().from(userVault)
        .where(and(eq(userVault.id, input.vaultId), eq(userVault.userId, ctx.user.id))).limit(1);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "倉庫項目不存在" });
      if (item.status !== "pending") throw new TRPCError({ code: "CONFLICT", message: "此項目狀態不允許回購" });
      await db.execute(sql`UPDATE userVault SET uv_status = 'buyback_requested' WHERE id = ${input.vaultId}`);
      return { success: true };
    }),

  requestShipping: protectedProcedure
    .input(z.object({ vaultId: z.number(), address: z.string().min(10) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDbInstance();
      const [item] = await db.select().from(userVault)
        .where(and(eq(userVault.id, input.vaultId), eq(userVault.userId, ctx.user.id))).limit(1);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "倉庫項目不存在" });
      if (item.status !== "pending") throw new TRPCError({ code: "CONFLICT", message: "此項目狀態不允許出貨" });
      await db.execute(sql`UPDATE userVault SET uv_status = 'shipping_requested', shippingAddress = ${input.address} WHERE id = ${input.vaultId}`);
      return { success: true };
    }),

  adminPool: router({
    list: adminProcedure.query(async () => {
      const db = await getDbInstance();
      return db.select().from(pools).orderBy(sql`pools.createdAt DESC`);
    }),

    getWithRewards: adminProcedure
      .input(z.object({ poolId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDbInstance();
        const [pool] = await db.select().from(pools).where(eq(pools.id, input.poolId)).limit(1);
        if (!pool) throw new TRPCError({ code: "NOT_FOUND", message: "卡池不存在" });
        const rewards = await db.select().from(poolRewards).where(eq(poolRewards.poolId, input.poolId));
        return { pool, rewards };
      }),

    create: adminProcedure
      .input(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        totalSlots: z.number().min(1).max(1000),
        pricePoints: z.number().min(1),
        officialBuybackPoints: z.number().min(0),
        visibleCardCost: z.number().min(0),
        miscCost: z.number().min(0).default(0),
        rewards: z.array(z.object({
          name: z.string().min(1),
          rewardType: z.enum(["rainbow", "gold", "blue", "hidden", "milestone"]),
          cost: z.number().min(0),
          quantity: z.number().min(1),
          triggerAt: z.number().optional(),
          imageUrl: z.string().optional(),
          cardId: z.number().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        const db = await getDbInstance();
        const [result] = await db.execute(sql`
          INSERT INTO pools (title, description, totalSlots, pricePoints, officialBuybackPoints, visibleCardCost, miscCost, pool_status)
          VALUES (${input.title}, ${input.description ?? null}, ${input.totalSlots}, ${input.pricePoints},
                  ${input.officialBuybackPoints}, ${input.visibleCardCost}, ${input.miscCost}, 'draft')
        `);
        const poolId = (result as any).insertId as number;

        for (const r of input.rewards) {
          await db.execute(sql`
            INSERT INTO poolRewards (poolId, name, pr_rewardType, cost, quantity, triggerAt, imageUrl, cardId)
            VALUES (${poolId}, ${r.name}, ${r.rewardType}, ${r.cost}, ${r.quantity},
                    ${r.triggerAt ?? null}, ${r.imageUrl ?? null}, ${r.cardId ?? null})
          `);
        }

        return { poolId };
      }),

    update: adminProcedure
      .input(z.object({
        poolId: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        totalSlots: z.number().optional(),
        pricePoints: z.number().optional(),
        officialBuybackPoints: z.number().optional(),
        visibleCardCost: z.number().optional(),
        miscCost: z.number().optional(),
        coverImageUrl: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDbInstance();
        const { poolId, ...fields } = input;
        if (Object.keys(fields).length === 0) return { success: true };
        await db.update(pools).set(fields as any).where(eq(pools.id, poolId));
        return { success: true };
      }),

    updateWithRewards: adminProcedure
      .input(z.object({
        poolId: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        totalSlots: z.number().min(1).max(1000),
        pricePoints: z.number().min(1),
        officialBuybackPoints: z.number().min(0),
        visibleCardCost: z.number().min(0),
        miscCost: z.number().min(0).default(0),
        rewards: z.array(z.object({
          name: z.string().min(1),
          rewardType: z.enum(["rainbow", "gold", "blue", "hidden", "milestone"]),
          cost: z.number().min(0),
          quantity: z.number().min(1),
          triggerAt: z.number().optional(),
          imageUrl: z.string().optional(),
          cardId: z.number().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        const db = await getDbInstance();
        const [pool] = await db.select().from(pools).where(eq(pools.id, input.poolId)).limit(1);
        if (!pool) throw new TRPCError({ code: "NOT_FOUND", message: "卡池不存在" });
        if (pool.status !== "draft") throw new TRPCError({ code: "CONFLICT", message: "只有草稿狀態可以修改" });
        // Update pool basic fields
        await db.execute(sql`
          UPDATE pools SET
            title = ${input.title},
            description = ${input.description ?? null},
            totalSlots = ${input.totalSlots},
            pricePoints = ${input.pricePoints},
            officialBuybackPoints = ${input.officialBuybackPoints},
            visibleCardCost = ${input.visibleCardCost},
            miscCost = ${input.miscCost}
          WHERE id = ${input.poolId}
        `);
        // Replace all rewards
        await db.delete(poolRewards).where(eq(poolRewards.poolId, input.poolId));
        for (const r of input.rewards) {
          await db.execute(sql`
            INSERT INTO poolRewards (poolId, name, pr_rewardType, cost, quantity, triggerAt, imageUrl, cardId)
            VALUES (${input.poolId}, ${r.name}, ${r.rewardType}, ${r.cost}, ${r.quantity},
                    ${r.triggerAt ?? null}, ${r.imageUrl ?? null}, ${r.cardId ?? null})
          `);
        }
        return { success: true };
      }),

    publish: adminProcedure
      .input(z.object({ poolId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDbInstance();
        const [pool] = await db.select().from(pools).where(eq(pools.id, input.poolId)).limit(1);
        if (!pool) throw new TRPCError({ code: "NOT_FOUND", message: "卡池不存在" });
        if (pool.status !== "draft") throw new TRPCError({ code: "CONFLICT", message: "只有草稿狀態可以發布" });

        const rewards = await db.select().from(poolRewards).where(eq(poolRewards.poolId, input.poolId));
        const slotAssignments: { rewardId: number | null; slotIndex: number }[] = [];
        let slotIdx = 0;

        for (const r of rewards) {
          if (r.rewardType === "milestone") continue;
          for (let i = 0; i < r.quantity; i++) {
            slotAssignments.push({ rewardId: r.id, slotIndex: slotIdx++ });
          }
        }
        while (slotIdx < pool.totalSlots) {
          slotAssignments.push({ rewardId: null, slotIndex: slotIdx++ });
        }

        // Fisher-Yates shuffle
        for (let i = slotAssignments.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [slotAssignments[i], slotAssignments[j]] = [slotAssignments[j], slotAssignments[i]];
        }

        for (const s of slotAssignments) {
          await db.execute(sql`
            INSERT INTO poolSlots (poolId, slotIndex, rewardId, isDrawn)
            VALUES (${input.poolId}, ${s.slotIndex}, ${s.rewardId}, false)
          `);
        }

        await db.update(pools).set({ status: "active", publishedAt: new Date() }).where(eq(pools.id, input.poolId));
        return { success: true };
      }),

    archive: adminProcedure
      .input(z.object({ poolId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDbInstance();
        await db.update(pools).set({ status: "archived" }).where(eq(pools.id, input.poolId));
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ poolId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDbInstance();
        const [pool] = await db.select().from(pools).where(eq(pools.id, input.poolId)).limit(1);
        if (!pool) throw new TRPCError({ code: "NOT_FOUND", message: "卡池不存在" });
        if (pool.status !== "draft") throw new TRPCError({ code: "CONFLICT", message: "只有草稿狀態的卡池可以刪除" });
        // Delete child records first
        await db.delete(poolSlots).where(eq(poolSlots.poolId, input.poolId));
        await db.delete(poolRewards).where(eq(poolRewards.poolId, input.poolId));
        await db.delete(pools).where(eq(pools.id, input.poolId));
        return { success: true };
      }),

    getMaintenanceMode: adminProcedure.query(async () => {
      const setting = await getSystemSetting("lootpool_maintenance_mode");
      return { enabled: setting?.settingValue === "true", message: setting?.description ?? "" };
    }),

    setMaintenanceMode: adminProcedure
      .input(z.object({ enabled: z.boolean(), message: z.string().optional() }))
      .mutation(async ({ input }) => {
        await setSystemSetting("lootpool_maintenance_mode", input.enabled ? "true" : "false", input.message ?? "");
        return { success: true };
      }),
  }),
});
