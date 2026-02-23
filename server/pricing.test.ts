import { describe, it, expect } from 'vitest';
import * as db from './db';
import { fetchEbayListings } from './services/ebay';
import { scrapeSnkrdunkListings } from './services/snkrdunkPuppeteer';

describe('Pricing API Functionality', () => {
  it('should find cards with SNKRDUNK data source', async () => {
    // Get a card with SNKRDUNK data source
    const card = await db.getCardById(1); // Assuming card ID 1 exists
    
    expect(card).toBeTruthy();
    if (card) {
      console.log(`Found card: ${card.name} (ID: ${card.id})`);
      
      // Check if it has SNKRDUNK data source
      const dataSource = await db.getDataSourceByCardIdAndSource(card.id, 'snkrdunk');
      console.log(`SNKRDUNK data source:`, dataSource);
      
      expect(dataSource).toBeTruthy();
    }
  });

  it('should extract SNKRDUNK ID from URL', () => {
    const testUrls = [
      'https://snkrdunk.com/apparels/93009',
      'https://snkrdunk.com/en/apparels/93009',
      'https://snkrdunk.com/apparels/93009/used',
    ];

    testUrls.forEach(url => {
      const match = url.match(/\/apparels\/(\d+)/);
      expect(match).toBeTruthy();
      if (match) {
        console.log(`Extracted SNKRDUNK ID from ${url}: ${match[1]}`);
        expect(match[1]).toBe('93009');
      }
    });
  });

  it('should check eBay listings cache', async () => {
    const cardId = 1;
    const searchQuery = 'Pikachu PSA10';
    
    const cache = await db.getEbayListingsCache(cardId, searchQuery);
    console.log('eBay cache:', cache);
    
    // Cache may or may not exist, just log the result
    if (cache) {
      console.log(`Cache expires at: ${cache.expiresAt}`);
      console.log(`Hot cache expires at: ${cache.hotExpiresAt}`);
    } else {
      console.log('No eBay cache found');
    }
  });

  it('should check SNKRDUNK listings cache', async () => {
    const cardId = 1;
    
    const cache = await db.getSnkrdunkListingsCache(cardId);
    console.log('SNKRDUNK cache:', cache);
    
    // Cache may or may not exist, just log the result
    if (cache) {
      console.log(`Cache expires at: ${cache.expiresAt}`);
      console.log(`Hot cache expires at: ${cache.hotExpiresAt}`);
      const listings = JSON.parse(cache.listings);
      console.log(`Cached listings count: ${listings.length}`);
    } else {
      console.log('No SNKRDUNK cache found');
    }
  });
});
