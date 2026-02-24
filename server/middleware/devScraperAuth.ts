import { Request, Response, NextFunction } from 'express';

/**
 * 驗證開發環境爬蟲 API 的認證中間件
 * 檢查 Authorization header 中的 Bearer token
 */
export function verifyDevScraperAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const expectedKey = process.env.DEV_SCRAPER_API_KEY;

  // 檢查環境變量是否配置
  if (!expectedKey) {
    console.error('[DevScraperAuth] DEV_SCRAPER_API_KEY not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // 檢查 Authorization header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  // 提取 token
  const token = authHeader.substring(7);
  
  // 驗證 token
  if (token !== expectedKey) {
    console.warn('[DevScraperAuth] Invalid API key attempt');
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // 驗證通過
  next();
}
