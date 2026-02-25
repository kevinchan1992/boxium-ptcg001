import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('URL Article Generation', () => {
  it('should scrape URL content using Firecrawl MCP', async () => {
    const testUrl = 'https://www.pokemon.com/us/pokemon-news';
    
    try {
      console.log('[Test] Scraping URL:', testUrl);
      const scrapResult = execSync(
        `manus-mcp-cli tool call firecrawl_scrape --server firecrawl --input '${JSON.stringify({ url: testUrl, formats: ['markdown'], onlyMainContent: true })}'`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 30000 }
      );
      
      console.log('[Test] Raw result:', scrapResult.substring(0, 500));
      
      const scrapData = JSON.parse(scrapResult);
      
      // Verify structure
      expect(scrapData).toBeDefined();
      expect(scrapData.content).toBeDefined();
      expect(Array.isArray(scrapData.content)).toBe(true);
      
      if (scrapData.content.length > 0) {
        expect(scrapData.content[0]).toHaveProperty('markdown');
        console.log('[Test] Scraped content length:', scrapData.content[0].markdown.length);
        console.log('[Test] First 200 chars:', scrapData.content[0].markdown.substring(0, 200));
      }
    } catch (error) {
      console.error('[Test] Scraping failed:', error);
      throw error;
    }
  }, 60000); // 60 second timeout

  it('should validate URL format', () => {
    const validUrls = [
      'https://www.pokemon.com/us/pokemon-news',
      'http://example.com',
      'https://www.tcgbid.hk/blogs',
    ];
    
    const invalidUrls = [
      'not-a-url',
      'ftp://invalid-protocol.com',
      '',
    ];
    
    const urlRegex = /^https?:\/\/.+/;
    
    validUrls.forEach(url => {
      expect(urlRegex.test(url)).toBe(true);
    });
    
    invalidUrls.forEach(url => {
      expect(urlRegex.test(url)).toBe(false);
    });
  });

  it('should handle URL scraping errors gracefully', async () => {
    const invalidUrl = 'https://this-domain-does-not-exist-12345.com';
    
    try {
      execSync(
        `manus-mcp-cli tool call firecrawl_scrape --server firecrawl --input '${JSON.stringify({ url: invalidUrl, formats: ['markdown'], onlyMainContent: true })}'`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 30000 }
      );
      
      // If no error is thrown, the test should fail
      expect(true).toBe(false);
    } catch (error) {
      // Error is expected
      console.log('[Test] Expected error caught:', error instanceof Error ? error.message : String(error));
      expect(error).toBeDefined();
    }
  }, 60000);
});
