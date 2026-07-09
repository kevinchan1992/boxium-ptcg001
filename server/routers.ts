/**
 * App Router — aggregates all feature routers
 *
 * Each namespace lives in server/routers/<name>.ts.
 * Only add top-level wiring here; keep business logic in the sub-routers.
 */
import { gradingRouter } from "./routers/grading";
import { notificationsRouter } from "./routers/notifications";
import { auctionRouter } from "./routers/auction";
import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { pricingRouter } from "./routers/pricing";
import { templatesRouter } from "./routers/templates";
import { diagnosticsRouter } from "./routers/diagnostics";
import { emailRouter } from "./routers/email";
import { blogAiRouter } from "./blogAiProcedures";
import { securityRouter } from "./routers/security";
import { cardInventoryRouter } from "./routers/cardInventory";
import { contactRouter } from "./routers/contact";
import { marketplaceRouter } from "./routers/marketplace";

// Newly extracted routers
import { productsRouter } from "./routers/products";
import { authRouter } from "./routers/auth";
import { cardsRouter, pricesRouter, watchlistRouter, trendingRouter } from "./routers/cards";
import { adminRouter } from "./routers/admin";
import { marketInsightsRouter } from "./routers/marketInsights";
import { blogRouter } from "./routers/blog";
import { profileRouter } from "./routers/profile";
import { pointsRouter } from "./routers/points";
import { lootpoolRouter } from "./routers/lootpool";

export const appRouter = router({
  system: systemRouter,
  pricing: pricingRouter,
  diagnostics: diagnosticsRouter,
  email: emailRouter,
  blogAi: blogAiRouter,
  security: securityRouter,
  products: productsRouter,
  auth: authRouter,
  cards: cardsRouter,
  prices: pricesRouter,
  admin: adminRouter,
  watchlist: watchlistRouter,
  templates: templatesRouter,
  marketInsights: marketInsightsRouter,
  blog: blogRouter,
  trending: trendingRouter,
  profile: profileRouter,
  marketplace: marketplaceRouter,
  contact: contactRouter,
  notifications: notificationsRouter,
  auction: auctionRouter,
  grading: gradingRouter,
  cardInventory: cardInventoryRouter,
  points: pointsRouter,
  lootpool: lootpoolRouter,
});

export type AppRouter = typeof appRouter;
