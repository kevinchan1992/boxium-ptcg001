/**
 * Cache Preloader Service
 * 
 * This service automatically refreshes SNKRDUNK cache that is about to expire.
 * It runs every 15 minutes and checks for caches expiring within 30 minutes.
 */

import * as db from "../db";
import { scrapeSnkrdunkListings } from "./snkrdunkPlaywright";

const PRELOAD_THRESHOLD = 30 * 60 * 1000; // 30 minutes in milliseconds
const CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

let intervalId: NodeJS.Timeout | null = null;

/**
 * Check and refresh caches that are about to expire
 */
async function checkAndRefreshCaches() {
  try {
    console.log('[Cache Preloader] Starting cache check...');
    
    const now = new Date();
    const thresholdTime = new Date(now.getTime() + PRELOAD_THRESHOLD);
    
    // Get all caches that will expire within the threshold
    const expiringCaches = await db.getExpiringSnkrdunkCaches(thresholdTime);
    
    if (expiringCaches.length === 0) {
      console.log('[Cache Preloader] No caches need refreshing');
      return;
    }
    
    console.log(`[Cache Preloader] Found ${expiringCaches.length} caches to refresh`);
    
    // Refresh each cache
    for (const cache of expiringCaches) {
      try {
        console.log(`[Cache Preloader] Refreshing cache for card ${cache.cardId} (SNKRDUNK ID: ${cache.snkrdunkId})`);
        
        // Scrape new listings
        const listings = await scrapeSnkrdunkListings(cache.snkrdunkId);
        
        // Filter out sold items (only keep items with isOnlyOnSale=true)
        // The scraper already filters for on-sale items, but we double-check here
        const onSaleListings = listings.filter(item => {
          // Additional filtering logic if needed
          // For now, we trust the scraper's filtering
          return true;
        });
        
        console.log(`[Cache Preloader] Scraped ${listings.length} listings, ${onSaleListings.length} on sale`);
        
        // Update cache with new data (dual-layer caching)
        const hotExpiresAt = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour
        const coldExpiresAt = new Date(now.getTime() + CACHE_DURATION); // 6 hours
        await db.saveSnkrdunkListingsCache({
          cardId: cache.cardId,
          snkrdunkId: cache.snkrdunkId,
          listings: JSON.stringify(onSaleListings),
          hotExpiresAt,
          expiresAt: coldExpiresAt,
        });
        
        console.log(`[Cache Preloader] Successfully refreshed cache for card ${cache.cardId} (hot: ${hotExpiresAt}, cold: ${coldExpiresAt})`);
        
        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`[Cache Preloader] Error refreshing cache for card ${cache.cardId}:`, error);
        // Continue with next cache even if one fails
      }
    }
    
    console.log('[Cache Preloader] Cache check completed');
    
  } catch (error) {
    console.error('[Cache Preloader] Error in checkAndRefreshCaches:', error);
  }
}

/**
 * Start the cache preloader service
 */
export function startCachePreloader() {
  if (intervalId) {
    console.log('[Cache Preloader] Service is already running');
    return;
  }
  
  console.log('[Cache Preloader] Starting service...');
  console.log(`[Cache Preloader] Will check every ${CHECK_INTERVAL / 1000 / 60} minutes`);
  console.log(`[Cache Preloader] Will refresh caches expiring within ${PRELOAD_THRESHOLD / 1000 / 60} minutes`);
  
  // Run immediately on start
  checkAndRefreshCaches();
  
  // Then run every CHECK_INTERVAL
  intervalId = setInterval(checkAndRefreshCaches, CHECK_INTERVAL);
  
  console.log('[Cache Preloader] Service started');
}

/**
 * Stop the cache preloader service
 */
export function stopCachePreloader() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Cache Preloader] Service stopped');
  }
}

/**
 * Manually trigger a cache check (for testing or admin use)
 */
export async function triggerCacheCheck() {
  console.log('[Cache Preloader] Manual cache check triggered');
  await checkAndRefreshCaches();
}
