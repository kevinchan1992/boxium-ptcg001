// ===== Force Hong Kong timezone for the entire Node.js process =====
// Must be set before any imports that use Date objects
process.env.TZ = 'Asia/Hong_Kong';

import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
// Manus OAuth removed
import { appRouter } from "../routers";
import googleOAuthRouter from "../googleOAuth";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
// import { startScheduler } from "../scheduler"; // Disabled: use priceUpdateScheduler instead
import { initPriceUpdateScheduler, startTrendingCardsScheduler, startAutoCompleteOrdersScheduler } from "../priceUpdateScheduler";
import { generateSitemap } from "../sitemap";
import { Sentry } from "./sentry";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Configure CORS to allow credentials
  app.use(cors({
    origin: true, // Allow all origins in development
    credentials: true,
  }));
  
  // Add cookie parser middleware
  app.use(cookieParser());
  
  // ============================================================
  // Stripe Webhook - MUST be before express.json() for signature verification
  // ============================================================
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Webhook] STRIPE_WEBHOOK_SECRET not configured");
      return res.status(500).json({ error: "Webhook secret not configured" });
    }
    let event: any;
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error("[Webhook] Signature verification failed:", err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }
    // Handle test events
    if (event.id.startsWith("evt_test_")) {
      console.log("[Webhook] Test event detected, returning verification response");
      return res.json({ verified: true });
    }
    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const orderNo = session.metadata?.order_no;
        const orderId = session.metadata?.orderId;
        console.log(`[Webhook] checkout.session.completed: orderNo=${orderNo}, orderId=${orderId}`);
        const { updateMarketplaceOrder, getMarketplaceOrderById } = await import("../db");
        const { createNotification } = await import("../db/notifications");
        let order: any = null;
        if (orderId) {
          order = await getMarketplaceOrderById(parseInt(orderId));
        } else if (orderNo) {
          const { getMarketplaceOrderByNo } = await import("../db");
          order = await getMarketplaceOrderByNo(orderNo);
        }
        if (order && order.orderStatus === "pending_payment") {
          await updateMarketplaceOrder(order.id, {
            paymentStatus: "paid",
            orderStatus: "payment_received",
            stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : order.stripePaymentIntentId,
          });
          console.log(`[Webhook] Order ${order.orderNo} marked as payment_received`);
          // Mark listing as sold
          if (order.listingId) {
            const { updateListing } = await import("../db");
            await updateListing(order.listingId, { status: "sold" });
            console.log(`[Webhook] Listing ${order.listingId} marked as sold`);
          }
          // Notify buyer of payment confirmation
          await createNotification({
            userId: order.buyerId,
            type: "trade",
            title: "付款成功 ✅",
            content: `訂單 ${order.orderNo} 的 Stripe 付款已確認，訂單現在進入處理中。`,
            priority: "high",
            relatedUrl: `/orders/${order.orderNo}`,
          }).catch(() => {});
          // Notify seller of new paid order
          if (order.sellerId) {
            await createNotification({
              userId: order.sellerId,
              type: "trade",
              title: "新訂單已付款 🎉",
              content: `訂單 ${order.orderNo} 買家已完成 Stripe 付款，請盡快安排出貨。`,
              priority: "high",
              relatedUrl: "/seller",
            }).catch(() => {});
          }
        }
      } else if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object;
        console.log(`[Webhook] payment_intent.payment_failed: ${paymentIntent.id}`);
      } else if (event.type === "account.updated") {
        // KYC / Stripe Connect onboarding status sync
        const account = event.data.object;
        const stripeConnectId = account.id;
        console.log(`[Webhook] account.updated: ${stripeConnectId}, charges_enabled=${account.charges_enabled}, payouts_enabled=${account.payouts_enabled}`);
        const { getSellerProfileByStripeConnectId, updateSellerProfile } = await import("../db");
        const sellerProfile = await getSellerProfileByStripeConnectId(stripeConnectId);
        if (sellerProfile) {
          let newStatus: "pending" | "active" | "restricted" | "disabled";
          if (account.charges_enabled && account.payouts_enabled) {
            newStatus = "active";
          } else if (account.requirements?.disabled_reason) {
            newStatus = "disabled";
          } else if ((account.requirements?.currently_due?.length ?? 0) > 0) {
            newStatus = "restricted";
          } else {
            newStatus = "pending";
          }
          const prevStatus = sellerProfile.stripeConnectStatus;
          await updateSellerProfile(sellerProfile.id, { stripeConnectStatus: newStatus });
          console.log(`[Webhook] Seller ${sellerProfile.id} stripeConnectStatus: ${prevStatus} -> ${newStatus}`);
          if (newStatus === "active" && prevStatus !== "active") {
            const { createNotification } = await import("../db/notifications");
            await createNotification({
              userId: sellerProfile.userId,
              type: "system",
              title: "Stripe 收款帳戶已啟用 ✅",
              content: "你的 Stripe Connect 帳戶已通過驗證並啟用，現在可以接收付款轉帳了。",
              priority: "high",
              relatedUrl: "/seller",
            }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error("[Webhook] Error processing event:", err);
    }
    res.json({ received: true });
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Manus OAuth removed
  
  // Google OAuth routes under /api/auth/google
  app.use("/api/auth", googleOAuthRouter);
  
  // Sitemap.xml route
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const sitemap = await generateSitemap();
      res.header("Content-Type", "application/xml");
      res.send(sitemap);
    } catch (error) {
      console.error("[Sitemap] Error generating sitemap:", error);
      res.status(500).send("Error generating sitemap");
    }
  });
  
  // Development environment scraper API (only available in development)
  if (process.env.NODE_ENV === "development") {
    const { verifyDevScraperAuth } = await import("../middleware/devScraperAuth");
    const { devScraperLimiter } = await import("../middleware/rateLimiter");
    const { scrapeSnkrdunkListings } = await import("../services/snkrdunkScraperService");

    // Health check endpoint
    app.get("/api/dev/health", (req, res) => {
      res.json({
        status: "healthy",
        playwrightReady: true,
        timestamp: new Date().toISOString()
      });
    });

    // Scrape endpoint
    app.post(
      "/api/dev/scrape",
      devScraperLimiter,
      verifyDevScraperAuth,
      async (req, res) => {
        const { snkrdunkId } = req.body;

        if (!snkrdunkId) {
          return res.status(400).json({
            success: false,
            error: "Missing snkrdunkId parameter"
          });
        }

        try {
          console.log(`[DevScraper] Scraping ${snkrdunkId}...`);
          const listings = await scrapeSnkrdunkListings(snkrdunkId);
          
          res.json({
            success: true,
            snkrdunkId,
            listings,
            scrapedAt: new Date().toISOString(),
            totalListings: listings.length
          });
        } catch (error: any) {
          console.error(`[DevScraper] Error scraping ${snkrdunkId}:`, error);
          res.status(500).json({
            success: false,
            error: error.message || "Scraping failed",
            snkrdunkId
          });
        }
      }
    );

    console.log("[DevScraper] Development scraper API enabled");

    // ── Dev mock login (DEVELOPMENT ONLY) ──────────────────────────────
    // Signs a JWT for a given user and sets the session cookie.
    // NEVER exposed in production (guarded by NODE_ENV === 'development').
    app.post("/api/dev/mock-login", async (req, res) => {
      try {
        const { getDb } = await import("../db");
        const { users } = await import("../../drizzle/schema_new");
        const { eq } = await import("drizzle-orm");
        const jwt = (await import("jsonwebtoken")).default;
        const { getSessionCookieOptions } = await import("./cookies");

        const db = await getDb();
        if (!db) return res.status(500).json({ error: "DB unavailable" });

        // Default to admin user (id=1); caller can pass { userId } to switch
        const targetId = Number(req.body?.userId) || 1;
        const userRows = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
        const user = userRows[0];
        if (!user) return res.status(404).json({ error: `User id=${targetId} not found` });

        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET || "your-secret-key",
          { expiresIn: "7d" } as any
        );

        res.cookie("session", token, getSessionCookieOptions(req));
        console.log(`[DevMockLogin] Logged in as ${user.email} (id=${user.id}, role=${user.role})`);
        return res.json({
          success: true,
          user: { id: user.id, email: user.email, name: user.name, role: user.role },
        });
      } catch (err: any) {
        console.error("[DevMockLogin] Error:", err);
        return res.status(500).json({ error: err.message });
      }
    });
    console.log("[DevMockLogin] Dev mock login enabled at POST /api/dev/mock-login");
  }

  // Blog image upload API
  const multer = (await import("multer")).default;
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
  
  app.post("/api/upload-blog-image", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const { processAndUploadMultiSizeImages } = await import("../imageProcessor");
      
      // Get file data from multer
      const fileBuffer = req.file.buffer;
      const originalFilename = req.file.originalname || 'image';
      
      // Process and upload multi-size images
      const urls = await processAndUploadMultiSizeImages(
        fileBuffer,
        'blog-images',
        originalFilename
      );
      
      // Return multi-size URLs (and also return medium URL as 'url' for backward compatibility)
      res.json({ url: urls.medium, urls });
    } catch (error) {
      console.error("[Blog] Error uploading image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });
  // Marketplace listing image upload API (up to 5 images per listing, 10MB each)
  app.post("/api/upload-marketplace-image", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const { processAndUploadMultiSizeImages } = await import("../imageProcessor");
      const fileBuffer = req.file.buffer;
      const originalFilename = req.file.originalname || "listing-image";
      const urls = await processAndUploadMultiSizeImages(
        fileBuffer,
        "marketplace-images",
        originalFilename
      );
      res.json({ url: urls.original ?? urls.medium, urls });
    } catch (error) {
      console.error("[Marketplace] Error uploading image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Payment proof image upload API (for Alipay HK payment verification)
  app.post("/api/upload-payment-proof", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const fileBuffer = req.file.buffer;
      const mimeType = req.file.mimetype || "image/jpeg";
      const ext = mimeType.split("/")[1] || "jpg";
      const key = `payment-proofs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { storagePut } = await import("../storage");
      const { url } = await storagePut(key, fileBuffer, mimeType);
      res.json({ url });
    } catch (error) {
      console.error("[PaymentProof] Error uploading proof:", error);
      res.status(500).json({ error: "Failed to upload payment proof" });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError: ({ error, type, path, input, ctx, req }) => {
        console.error(`[tRPC Error] ${type} at ${path}:`, error);
        
        // Send to Sentry
        if (process.env.SENTRY_DSN_BACKEND) {
          Sentry.captureException(error, {
            tags: {
              type: 'trpc_error',
              procedure_type: type,
            },
            contexts: {
              trpc: {
                path,
                input: JSON.stringify(input),
                user: ctx?.user?.email || 'anonymous',
              },
            },
          });
        }
      },
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // Recover stalled batch tasks from previous server instance, then auto-resume if eligible
    import('../batchTaskManager').then(({ recoverStalledTasks }) => {
      recoverStalledTasks(30).then(async result => {
        if (result.recoveredCount > 0) {
          console.log(`[Server] Recovered ${result.recoveredCount} stalled task(s) from previous instance`);
        }
        // Auto-resume: if a stalled task was just marked as failed, try to continue from where it left off
        try {
          const { autoResumeOnStartup } = await import('../persistentSnkrdunkBatchUpdate');
          await autoResumeOnStartup();
        } catch (resumeErr: any) {
          console.error('[Server] Auto-resume check failed:', resumeErr.message);
        }
      }).catch(err => {
        console.error('[Server] Failed to recover stalled tasks:', err);
      });
    }).catch(err => {
      console.error('[Server] Failed to import batchTaskManager:', err);
    });
    
    // Start the auto-update scheduler
    // startScheduler(); // Disabled: use priceUpdateScheduler instead
    // Start the price update scheduler
    initPriceUpdateScheduler().catch(err => {
      console.error('[Server] Failed to initialize price update scheduler:', err);
    });
    // Start the trending cards scheduler (daily at 06:00 HKT)
    startTrendingCardsScheduler();
    // Start the auto-complete orders scheduler (every hour)
    startAutoCompleteOrdersScheduler();
    // Start the cache preloader service
    import('../services/cachePreloader').then(({ startCachePreloader }) => {
      startCachePreloader();
    }).catch(err => {
      console.error('[Server] Failed to start cache preloader:', err);
    });
  });
}

startServer().catch(console.error);
