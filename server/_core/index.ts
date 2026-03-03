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
import { initPriceUpdateScheduler, startTrendingCardsScheduler } from "../priceUpdateScheduler";
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
    // Start the cache preloader service
    import('../services/cachePreloader').then(({ startCachePreloader }) => {
      startCachePreloader();
    }).catch(err => {
      console.error('[Server] Failed to start cache preloader:', err);
    });
  });
}

startServer().catch(console.error);
