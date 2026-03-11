// ===== Force Hong Kong timezone for the entire Node.js process =====
// Must be set before any imports that use Date objects
process.env.TZ = 'Asia/Hong_Kong';

import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
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
import { initPriceUpdateScheduler, startTrendingCardsScheduler, startAutoCompleteOrdersScheduler, startShippingReminderScheduler, startOfferExpiryReminderScheduler, startOfferExpiryCleanupScheduler, startPaymentTimeoutCancelScheduler, startPaymentReminderScheduler } from "../priceUpdateScheduler";
import { generateSitemap } from "../sitemap";
import { Sentry } from "./sentry";
import { getListingById, getCardById, getSealedProductById } from "../db";
import { composeOgImage, composeAndCacheOgImage, getDefaultOgImageUrl } from "../ogImageComposer";

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
            type: 'trade',
            title: '付款成功 ✅',
            body: `訂單 ${order.orderNo} 的 Stripe 付款已確認，訂單現在進入處理中。`,

            linkUrl: `/orders/${order.orderNo}`,
          }).catch(() => {});
          // Send order confirmed email to buyer
          try {
            const { sendOrderEmail, buildOrderConfirmedEmail, getOrderEmailData } = await import('../emailService');
            const emailData = await getOrderEmailData(order);
            const { subject, html } = buildOrderConfirmedEmail({ orderNo: order.orderNo, itemName: emailData.itemName, priceHkd: emailData.priceHkd });
            await sendOrderEmail({ userId: order.buyerId, subject, html });
          } catch (emailErr: any) {
            console.warn('[Webhook] Order confirmed email failed:', emailErr.message);
          }
          // Notify seller of new paid order
          if (order.sellerId) {
            await createNotification({
              userId: order.sellerId,
              type: 'trade',
              title: '新訂單已付款 🎉',
              body: `訂單 ${order.orderNo} 買家已完成 Stripe 付款，請盡快安排出貨。`,

              linkUrl: "/seller",
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
          // Correctly classify disabled_reason:
          // - "under_review", "requirements.pending_verification" = still under review → pending
          // - "rejected.*" or "other" = truly disabled
          const disabledReason = account.requirements?.disabled_reason ?? null;
          const trulyDisabled = disabledReason && (
            disabledReason.startsWith('rejected.') ||
            disabledReason === 'other'
          );
          if (account.charges_enabled && account.payouts_enabled) {
            newStatus = "active";
          } else if (trulyDisabled) {
            newStatus = "disabled";
          } else if ((account.requirements?.pending_verification?.length ?? 0) > 0) {
            newStatus = "pending"; // under review by Stripe
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
              body: "你的 Stripe Connect 帳戶已通過驗證並啟用，現在可以接收付款轉帳了。",

              linkUrl: "/seller",
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

  // ─── OG Image Composer API: returns card image with BOXIUM logo watermark ────────
  app.get("/api/og-image/:cardId", async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId, 10);
      if (isNaN(cardId)) return res.redirect(getDefaultOgImageUrl());

      // Look up card image URL
      let cardImageUrl: string | null = null;
      const card = await getCardById(cardId);
      if (card) {
        cardImageUrl = card.imageUrl || null;
      } else {
        const sealed = await getSealedProductById(cardId);
        if (sealed) cardImageUrl = sealed.imageUrl || null;
      }

      if (!cardImageUrl) return res.redirect(getDefaultOgImageUrl());

      // Compose image with logo watermark
      const composed = await composeOgImage(cardImageUrl);
      if (!composed) return res.redirect(getDefaultOgImageUrl());

      // Cache for 1 hour (3600s)
      res.set({
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
        "Content-Length": composed.length.toString(),
      });
      res.status(200).end(composed);
    } catch (err) {
      console.error("[OG Image API] Error:", err);
      res.redirect(getDefaultOgImageUrl());
    }
  });

  // ─── OG Meta JSON API: for Cloudflare Workers edge-level OG injection ──────
  app.get("/api/og-meta/:cardId", async (req, res) => {
    try {
      const id = parseInt(req.params.cardId, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid card ID" });
      let name: string | null = null;
      let imageUrl: string | null = null;
      let description: string | null = null;
      const card = await getCardById(id);
      if (card) {
        name = card.name || null;
        imageUrl = card.imageUrl || null;
        description = card.setName ? `${card.setName} | PSA 10 價格追蹤` : null;
      } else {
        const sealed = await getSealedProductById(id);
        if (sealed) {
          name = sealed.name || null;
          imageUrl = sealed.imageUrl || null;
          description = sealed.setName ? `${sealed.setName} | 卡盒價格追蹤` : null;
        }
      }
      if (!name) return res.status(404).json({ error: "Card not found" });
      // Get composed OG image with BOXIUM logo watermark (S3 cached)
      let ogImageUrl = getDefaultOgImageUrl();
      if (imageUrl) {
        const s3Url = await composeAndCacheOgImage(id, imageUrl);
        if (s3Url) ogImageUrl = s3Url;
      }
      res.set({
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      }).json({
        title: `${name} - BOXIUM PTCG`,
        description: description || `查看 ${name} 的最新 PSA 10 成交價格、價格趨勢與市場分析。`,
        image: ogImageUrl,
        url: `https://boxium.asia/card/${id}`,
      });
    } catch (err) {
      console.error("[OG Meta API] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Card Preview API: works in production (Express handles /api/* routes) ──
  // Share links point to /api/card-preview/:id which redirects to /card/:id
  // Crawlers (WhatsApp, Facebook, Telegram) see dynamic OG tags
  // Users get immediately redirected to the real card page
  app.get("/api/card-preview/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.redirect(`https://boxium.asia/`);

      let cardName: string | null = null;
      let cardImageUrl: string | null = null;
      let cardDesc: string | null = null;

      const card = await getCardById(id);
      if (card) {
        cardName = card.name || null;
        cardImageUrl = card.imageUrl || null;
        cardDesc = card.setName ? `${card.setName} | PSA 10 價格追蹤` : null;
      } else {
        const sealed = await getSealedProductById(id);
        if (sealed) {
          cardName = sealed.name || null;
          cardImageUrl = sealed.imageUrl || null;
          cardDesc = sealed.setName ? `${sealed.setName} | 卡盒價格追蹤` : null;
        }
      }

      if (!cardName) return res.redirect(`https://boxium.asia/card/${id}`);

      // Get composed OG image with BOXIUM logo watermark (S3 cached)
      let ogImageUrl = getDefaultOgImageUrl();
      if (cardImageUrl) {
        const s3Url = await composeAndCacheOgImage(id, cardImageUrl);
        if (s3Url) ogImageUrl = s3Url;
      }

      const ogTitle = `${cardName} - BOXIUM PTCG`;
      const ogDescription = cardDesc || `查看 ${cardName} 的最新 PSA 10 成交價格、價格趨勢與市場分析。`;
      const cardUrl = `https://boxium.asia/card/${id}`;
      const previewUrl = `https://boxium.asia/api/card-preview/${id}`;

      // Return a minimal HTML page with OG tags + instant JS redirect
      // Crawlers read the OG tags; users are redirected to the real card page
      const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="0; url=${cardUrl}" />
  <title>${ogTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${previewUrl}" />
  <meta property="og:title" content="${ogTitle.replace(/"/g, '&quot;')}" />
  <meta property="og:description" content="${ogDescription.replace(/"/g, '&quot;')}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="BOXIUM PTCG" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${ogTitle.replace(/"/g, '&quot;')}" />
  <meta name="twitter:description" content="${ogDescription.replace(/"/g, '&quot;')}" />
  <meta name="twitter:image" content="${ogImageUrl}" />
  <link rel="canonical" href="${cardUrl}" />
</head>
<body>
  <script>window.location.replace("${cardUrl}");</script>
  <p>正在跳轉到卡牌頁面... <a href="${cardUrl}">點此前往</a></p>
</body>
</html>`;

      res.status(200).set({
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      }).end(html);
    } catch (err) {
      console.error("[Card Preview API] Error:", err);
      res.redirect(`https://boxium.asia/card/${req.params.id}`);
    }
  });

  // ─── OG SSR: Card detail page for social crawlers ─────────────────────────
  app.get("/card/:id", async (req, res, next) => {
    const ua = (req.headers["user-agent"] || "").toLowerCase();
    const isCrawler = /facebookexternalhit|facebot|twitterbot|whatsapp|linkedinbot|slackbot|telegrambot|discordbot|googlebot|bingbot|applebot|pinterest|vkshare|w3c_validator|embedly|quora|outbrain|semrushbot|ahrefsbot/.test(ua);
    if (!isCrawler) return next();
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return next();
      // Try single card first, then sealed product
      let cardName: string | null = null;
      let cardImageUrl: string | null = null;
      let cardDesc: string | null = null;
      const card = await getCardById(id);
      if (card) {
        cardName = card.name || null;
        cardImageUrl = card.imageUrl || null;
        cardDesc = card.setName ? `${card.setName} | PSA 10 價格追蹤` : null;
      } else {
        const sealed = await getSealedProductById(id);
        if (sealed) {
          cardName = sealed.name || null;
          cardImageUrl = sealed.imageUrl || null;
          cardDesc = sealed.setName ? `${sealed.setName} | 卡盒價格追蹤` : null;
        }
      }
      if (!cardName) return next();
      // Use composed OG image with BOXIUM logo watermark, uploaded to S3 for stable URL
      // S3 URLs are permanent and accessible by all crawlers (WhatsApp, Facebook, etc.)
      let imageUrl = getDefaultOgImageUrl();
      if (cardImageUrl) {
        const s3Url = await composeAndCacheOgImage(id, cardImageUrl);
        if (s3Url) imageUrl = s3Url;
      }
      const ogTitle = `${cardName} - BOXIUM PTCG`;
      const ogDescription = cardDesc || `查看 ${cardName} 的最新 PSA 10 成交價格、價格趨勢與市場分析。`;
      const pageUrl = `https://boxium.asia/card/${id}`;
      let template: string;
      if (process.env.NODE_ENV === "development") {
        const clientTemplate = path.resolve(import.meta.dirname, "../..", "client", "index.html");
        template = await fs.promises.readFile(clientTemplate, "utf-8");
      } else {
        const distTemplate = path.resolve(import.meta.dirname, "public", "index.html");
        template = await fs.promises.readFile(distTemplate, "utf-8");
      }
      const ogTags = [
        `<meta property="og:type" content="website" />`,
        `<meta property="og:url" content="${pageUrl}" />`,
        `<meta property="og:title" content="${ogTitle.replace(/"/g, '&quot;')}" />`,
        `<meta property="og:description" content="${ogDescription.replace(/"/g, '&quot;')}" />`,
        `<meta property="og:image" content="${imageUrl}" />`,
        `<meta property="og:image:width" content="1200" />`,
        `<meta property="og:image:height" content="630" />`,
        `<meta property="og:site_name" content="BOXIUM PTCG" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${ogTitle.replace(/"/g, '&quot;')}" />`,
        `<meta name="twitter:description" content="${ogDescription.replace(/"/g, '&quot;')}" />`,
        `<meta name="twitter:image" content="${imageUrl}" />`,
        `<title>${ogTitle.replace(/<[^>]*>/g, '')}</title>`,
      ].join("\n    ");
      const injected = template
        .replace(/<title>[^<]*<\/title>/, '') // remove existing title
        .replace(/<meta\s+property="og:[^"]*"[^>]*\/>/g, '') // remove all og: meta tags
        .replace(/<meta\s+name="twitter:[^"]*"[^>]*\/>/g, '') // remove all twitter: meta tags
        .replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    ${ogTags}`);
      res.status(200).set({
        "Content-Type": "text/html",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Surrogate-Control": "no-store",
        "CDN-Cache-Control": "no-store",
        "Cloudflare-CDN-Cache-Control": "no-store",
      }).end(injected);
    } catch (err) {
      console.error("[OG SSR Card] Error:", err);
      next();
    }
  });

  // ─── OG SSR: Marketplace listing page for social crawlers ───────────────────
  app.get("/marketplace/:id", async (req, res, next) => {
    // Only intercept social media crawlers (bots that need SSR meta tags)
    const ua = (req.headers["user-agent"] || "").toLowerCase();
    const isCrawler = /facebookexternalhit|facebot|twitterbot|whatsapp|linkedinbot|slackbot|telegrambot|discordbot|googlebot|bingbot|applebot|pinterest|vkshare|w3c_validator|embedly|quora|outbrain|semrushbot|ahrefsbot/.test(ua);
    if (!isCrawler) return next();

    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return next();

      const listing = await getListingById(id);
      if (!listing) return next();

      const price = parseFloat(listing.priceHkd as string);
      const rawImages = listing.images;
      let images: string[] | null = null;
      if (rawImages) {
        if (Array.isArray(rawImages)) images = rawImages as string[];
        else if (typeof rawImages === "string") {
          try { const p = JSON.parse(rawImages); images = Array.isArray(p) ? p : null; } catch {}
        }
      }
      const imageUrl = images && images.length > 0 ? images[0] : "https://boxiumptcg.manus.space/og-image.png";
      const ogTitle = `${listing.title} - HKD ${price.toFixed(2)} | BOXIUM PTCG`;
      const ogDescription = listing.description
        ? `${(listing.description as string).slice(0, 120)}${(listing.description as string).length > 120 ? "..." : ""} | HKD ${price.toFixed(2)}`
        : `商品狀況：${listing.condition} | 價格：HKD ${price.toFixed(2)} | BOXIUM PTCG 卡牌商城`;
      const pageUrl = `https://boxiumptcg.manus.space/marketplace/${id}`;

      // Read the base HTML template
      let template: string;
      if (process.env.NODE_ENV === "development") {
        const clientTemplate = path.resolve(import.meta.dirname, "../..", "client", "index.html");
        template = await fs.promises.readFile(clientTemplate, "utf-8");
      } else {
        const distTemplate = path.resolve(import.meta.dirname, "public", "index.html");
        template = await fs.promises.readFile(distTemplate, "utf-8");
      }

      // Inject dynamic OG meta tags
      const ogTags = [
        `<meta property="og:type" content="product" />`,
        `<meta property="og:url" content="${pageUrl}" />`,
        `<meta property="og:title" content="${ogTitle.replace(/"/g, '&quot;')}" />`,
        `<meta property="og:description" content="${ogDescription.replace(/"/g, '&quot;')}" />`,
        `<meta property="og:image" content="${imageUrl}" />`,
        `<meta property="og:image:width" content="1200" />`,
        `<meta property="og:image:height" content="630" />`,
        `<meta property="og:site_name" content="BOXIUM PTCG" />`,
        `<meta property="og:price:amount" content="${price.toFixed(2)}" />`,
        `<meta property="og:price:currency" content="HKD" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${ogTitle.replace(/"/g, '&quot;')}" />`,
        `<meta name="twitter:description" content="${ogDescription.replace(/"/g, '&quot;')}" />`,
        `<meta name="twitter:image" content="${imageUrl}" />`,
        `<title>${ogTitle.replace(/<[^>]*>/g, '')}</title>`,
      ].join("\n    ");

      // Replace the default OG tags in the template
      const injected = template
        .replace(/<title>[^<]*<\/title>/, '') // remove existing title
        .replace(/<meta\s+property="og:[^"]*"[^>]*\/>/g, '') // remove all og: meta tags
        .replace(/<meta\s+name="twitter:[^"]*"[^>]*\/>/g, '') // remove all twitter: meta tags
        .replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    ${ogTags}`);

      res.status(200).set({ "Content-Type": "text/html" }).end(injected);
    } catch (err) {
      console.error("[OG SSR] Error:", err);
      next();
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
    // Start the shipping overdue reminder scheduler (every hour at :30)
    startShippingReminderScheduler();
    // Start the offer expiry reminder scheduler (every hour at :15)
    startOfferExpiryReminderScheduler();
    // Start the offer expiry cleanup scheduler (every hour at :45)
    startOfferExpiryCleanupScheduler();
    // Start the payment timeout cancel scheduler (every hour at :30)
    startPaymentTimeoutCancelScheduler();
    // Start the payment reminder scheduler (every hour at :45, reminds buyers 12h before auto-cancel)
    startPaymentReminderScheduler();
    // Start the cache preloader service
    import('../services/cachePreloader').then(({ startCachePreloader }) => {
      startCachePreloader();
    }).catch(err => {
      console.error('[Server] Failed to start cache preloader:', err);
    });
  });
}

startServer().catch(console.error);
