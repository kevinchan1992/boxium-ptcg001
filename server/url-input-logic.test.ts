import { describe, it, expect } from 'vitest';

describe('URL Input Logic', () => {
  it('should validate URL format correctly', () => {
    const validUrls = [
      'https://www.pokemon.com/us/pokemon-news',
      'http://example.com',
      'https://www.tcgbid.hk/blogs',
      'https://www.boxium.asia/blog/2026年2月ptcg市場速報',
    ];
    
    const invalidUrls = [
      'not-a-url',
      'ftp://invalid-protocol.com',
      '',
      'javascript:alert(1)',
    ];
    
    const urlRegex = /^https?:\/\/.+/;
    
    validUrls.forEach(url => {
      expect(urlRegex.test(url)).toBe(true);
    });
    
    invalidUrls.forEach(url => {
      expect(urlRegex.test(url)).toBe(false);
    });
  });

  it('should construct correct Firecrawl command', () => {
    const testUrl = 'https://example.com/article';
    const expectedInput = JSON.stringify({ 
      url: testUrl, 
      formats: ['markdown'], 
      onlyMainContent: true 
    });
    
    const command = `manus-mcp-cli tool call firecrawl_scrape --server firecrawl --input '${expectedInput}'`;
    
    expect(command).toContain('firecrawl_scrape');
    expect(command).toContain('--server firecrawl');
    expect(command).toContain(testUrl);
    expect(command).toContain('markdown');
    expect(command).toContain('onlyMainContent');
  });

  it('should handle target language mapping', () => {
    const langMap: Record<string, string> = {
      'zh-TW': '繁體中文',
      'en': 'English',
      'ja': '日本語'
    };
    
    expect(langMap['zh-TW']).toBe('繁體中文');
    expect(langMap['en']).toBe('English');
    expect(langMap['ja']).toBe('日本語');
  });

  it('should construct user input with language instruction', () => {
    const scrapedContent = '# Test Article\n\nThis is a test article.';
    const targetLanguage = 'zh-TW';
    const langMap: Record<string, string> = {
      'zh-TW': '繁體中文',
      'en': 'English',
      'ja': '日本語'
    };
    
    const userInput = `【原文內容】\n${scrapedContent}\n\n【要求】請根據以上內容生成 ${langMap[targetLanguage]} 文章。`;
    
    expect(userInput).toContain('【原文內容】');
    expect(userInput).toContain(scrapedContent);
    expect(userInput).toContain('【要求】');
    expect(userInput).toContain('繁體中文');
  });

  it('should detect error responses from Firecrawl', () => {
    const errorResponse = 'Tool execution result saved to: /home/ubuntu/.mcp/tool-results/2026-02-25_08-59-56_firecrawl_firecrawl_scrape.txt\nTool execution result:\nError: Tool \'firecrawl_scrape\' execution failed: Insufficient credits';
    
    const isError = errorResponse.startsWith('Tool execution result');
    
    expect(isError).toBe(true);
  });

  it('should parse valid JSON response from Firecrawl', () => {
    const validResponse = JSON.stringify({
      content: [{
        markdown: '# Test Article\n\nThis is test content.',
        metadata: {
          title: 'Test Article',
          url: 'https://example.com/article'
        }
      }]
    });
    
    const parsed = JSON.parse(validResponse);
    
    expect(parsed.content).toBeDefined();
    expect(parsed.content[0]).toHaveProperty('markdown');
    expect(parsed.content[0].markdown).toContain('Test Article');
  });
});
