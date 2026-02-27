import { mysqlTable, int, varchar, text, boolean, timestamp, index, mysqlEnum, decimal } from "drizzle-orm/mysql-core";

/**
 * Games table - manages TCG game types
 */
export const games = mysqlTable("games", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(), // Game code (e.g., 'pokemon', 'one_piece')
  name: varchar("name", { length: 128 }).notNull(), // English name
  nameJa: varchar("nameJa", { length: 128 }), // Japanese name
  nameZh: varchar("nameZh", { length: 128 }), // Chinese name
  publisher: varchar("publisher", { length: 128 }), // Publisher
  isActive: boolean("isActive").default(true).notNull(), // Is active
  sortOrder: int("sortOrder").default(0).notNull(), // Sort order
  icon: text("icon"), // Game icon URL
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  codeIdx: index("idx_games_code").on(table.code),
  isActiveIdx: index("idx_games_isActive").on(table.isActive),
}));

export type Game = typeof games.$inferSelect;
export type InsertGame = typeof games.$inferInsert;

/**
 * Sealed products table - stores booster boxes and other sealed products
 */
export const sealedProducts = mysqlTable("sealedProducts", {
  id: int("id").autoincrement().primaryKey(),
  gameId: int("gameId").notNull(), // Game type ID (foreign key to games table)
  name: text("name").notNull(), // Product name
  nameJa: text("nameJa"), // Japanese name
  nameZh: text("nameZh"), // Chinese name
  boxType: mysqlEnum("boxType", ["booster_box", "other"]).notNull().default("booster_box"), // Product type
  itemCount: int("itemCount"), // Item count (e.g., 30 packs per box)
  setName: text("setName"), // Set name
  series: text("series"), // Expansion series
  imageUrl: text("imageUrl"), // Product image URL
  releaseDate: timestamp("releaseDate"), // Release date
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  gameIdIdx: index("idx_sealed_gameId").on(table.gameId),
  boxTypeIdx: index("idx_sealed_boxType").on(table.boxType),
}));

export type SealedProduct = typeof sealedProducts.$inferSelect;
export type InsertSealedProduct = typeof sealedProducts.$inferInsert;
