import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // /pricing/:id has full SSR for all users — let Express routes handle it
    if (/^\/pricing\/\d+$/.test(req.path)) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

const CRAWLER_UA_REGEX = /facebookexternalhit|facebot|twitterbot|whatsapp|linkedinbot|slackbot|telegrambot|discordbot|googlebot|bingbot|applebot|pinterest|vkshare|w3c_validator|embedly|quora|outbrain|semrushbot|ahrefsbot/i;

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Serve static files. Sitemap files are handled by Express dynamic routes FIRST
  // (which set proper Cache-Control/CDN headers), then fall through to static serving
  // as a backup (SSG-generated files in dist/public/).
  const staticHandler = express.static(distPath);
  app.use((req, res, next) => {
    return staticHandler(req, res, next);
  });

  // fall through to index.html if the file doesn't exist
  // BUT if the request is from a social crawler OR is a dynamic SSR route, pass to Express routes
  app.use("*", (req, res, next) => {
    const ua = req.headers["user-agent"] || "";
    if (CRAWLER_UA_REGEX.test(ua)) {
      // Let OG SSR routes handle this
      return next();
    }
    // /pricing/:id has full SSR for all users (not just crawlers) — skip static serving
    if (/^\/pricing\/\d+$/.test(req.path)) {
      return next();
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
