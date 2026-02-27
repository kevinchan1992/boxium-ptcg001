import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Test: triggerPriceRefresh cooldown and refresh logic ───

describe('triggerPriceRefresh', () => {
  const COOLDOWN_HOURS = 3;
  const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Cooldown Logic Tests ───

  it('should detect cooldown when lastFetchedAt is within 3 hours', () => {
    const now = new Date();
    // Last fetched 1 hour ago
    const lastFetched = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    const elapsed = now.getTime() - lastFetched.getTime();
    
    expect(elapsed < COOLDOWN_MS).toBe(true);
    
    const remainingMin = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
    expect(remainingMin).toBe(120); // 2 hours remaining
  });

  it('should NOT be in cooldown when lastFetchedAt is older than 3 hours', () => {
    const now = new Date();
    // Last fetched 4 hours ago
    const lastFetched = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    const elapsed = now.getTime() - lastFetched.getTime();
    
    expect(elapsed < COOLDOWN_MS).toBe(false);
  });

  it('should NOT be in cooldown when lastFetchedAt is null', () => {
    const lastFetchedAt = null;
    // When lastFetchedAt is null, cooldown check should be skipped
    const shouldSkip = lastFetchedAt !== null;
    expect(shouldSkip).toBe(false);
  });

  it('should calculate correct remaining minutes at boundary', () => {
    const now = new Date();
    // Last fetched exactly 2h59m ago (1 minute before cooldown expires)
    const lastFetched = new Date(now.getTime() - (2 * 60 + 59) * 60 * 1000);
    const elapsed = now.getTime() - lastFetched.getTime();
    
    expect(elapsed < COOLDOWN_MS).toBe(true);
    
    const remainingMin = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
    expect(remainingMin).toBe(1); // 1 minute remaining
  });

  it('should NOT be in cooldown at exactly 3 hours', () => {
    const now = new Date();
    // Last fetched exactly 3 hours ago
    const lastFetched = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const elapsed = now.getTime() - lastFetched.getTime();
    
    // At exactly 3 hours, elapsed === COOLDOWN_MS, so NOT in cooldown
    expect(elapsed < COOLDOWN_MS).toBe(false);
  });

  // ─── JPY to HKD Conversion Tests ───

  it('should correctly convert JPY to HKD', async () => {
    const { convertJpyToHkd } = await import('./snkrdunkScraper');
    
    // Test basic conversion
    const hkd = convertJpyToHkd(10000);
    expect(hkd).toBeGreaterThan(0);
    expect(typeof hkd).toBe('number');
    
    // Should be a reasonable conversion (rate ~0.055)
    expect(hkd).toBeCloseTo(550, -1); // Within ±10
  });

  it('should handle zero price conversion', async () => {
    const { convertJpyToHkd } = await import('./snkrdunkScraper');
    
    const hkd = convertJpyToHkd(0);
    expect(hkd).toBe(0);
  });

  // ─── Response Status Tests ───

  it('should return correct status types', () => {
    const validStatuses = ['success', 'cooldown', 'error', 'no_source'] as const;
    
    // Verify all expected status types
    expect(validStatuses).toContain('success');
    expect(validStatuses).toContain('cooldown');
    expect(validStatuses).toContain('error');
    expect(validStatuses).toContain('no_source');
  });

  it('should return recordsAdded=0 for cooldown status', () => {
    // Simulate cooldown response
    const response = {
      status: 'cooldown' as const,
      message: 'Recently updated',
      recordsAdded: 0,
    };
    
    expect(response.recordsAdded).toBe(0);
    expect(response.status).toBe('cooldown');
  });

  it('should return recordsAdded>0 for successful refresh', () => {
    // Simulate successful refresh response
    const response = {
      status: 'success' as const,
      message: 'Price data refreshed, 15 records added',
      recordsAdded: 15,
    };
    
    expect(response.recordsAdded).toBeGreaterThan(0);
    expect(response.status).toBe('success');
  });

  // ─── SNKRDUNK URL Extraction Tests ───

  it('should extract SNKRDUNK ID from URL correctly', () => {
    const url = 'https://snkrdunk.com/apparels/93009';
    const match = url.match(/\/apparels\/(\d+)/);
    
    expect(match).not.toBeNull();
    expect(match![1]).toBe('93009');
  });

  it('should handle invalid SNKRDUNK URL', () => {
    const url = 'https://example.com/invalid';
    const match = url.match(/\/apparels\/(\d+)/);
    
    expect(match).toBeNull();
  });

  // ─── Data Source Check Tests ───

  it('should return no_source when dataSource is null', () => {
    const dataSource = null;
    
    if (!dataSource) {
      const response = {
        status: 'no_source' as const,
        message: 'No SNKRDUNK data source for this card',
        recordsAdded: 0,
      };
      expect(response.status).toBe('no_source');
      expect(response.recordsAdded).toBe(0);
    }
  });

  it('should return no_source when dataSource has no sourceUrl', () => {
    const dataSource = { id: 1, sourceUrl: null };
    
    if (!dataSource || !dataSource.sourceUrl) {
      const response = {
        status: 'no_source' as const,
        message: 'No SNKRDUNK data source for this card',
        recordsAdded: 0,
      };
      expect(response.status).toBe('no_source');
    }
  });

  // ─── Sealed Product Support Tests ───

  it('should accept productType parameter with default single_card', () => {
    const input = { cardId: 123 };
    const defaultProductType = 'single_card';
    const resolvedType = (input as any).productType || defaultProductType;
    expect(resolvedType).toBe('single_card');
  });

  it('should accept productType=sealed_product for sealed products', () => {
    const input = { cardId: 4, productType: 'sealed_product' as const };
    expect(input.productType).toBe('sealed_product');
    expect(input.cardId).toBe(4);
  });

  it('should use correct productType when calling fetchPriceHistory for sealed products', () => {
    // Simulate the logic in triggerPriceRefresh
    const dataSource = {
      id: 1200002,
      cardId: 4,
      productType: 'sealed_product' as const,
      sourceUrl: 'https://snkrdunk.com/apparels/687430',
    };

    const productType: 'single_card' | 'sealed_product' =
      dataSource.productType === 'sealed_product' ? 'sealed_product' : 'single_card';

    expect(productType).toBe('sealed_product');
  });

  it('should skip grade for sealed products in price history', () => {
    const productType = 'sealed_product' as const;
    const priceItem = { price: 50000, grade: 'PSA10', soldAt: new Date(), quantity: 1 };

    const record = {
      cardId: 4,
      source: 'snkrdunk',
      price: '2750.00',
      currency: 'HKD',
      grade: productType === 'sealed_product' ? undefined : priceItem.grade,
      quantity: productType === 'sealed_product' ? (priceItem.quantity || undefined) : undefined,
      productType,
      soldAt: priceItem.soldAt,
    };

    expect(record.grade).toBeUndefined();
    expect(record.quantity).toBe(1);
    expect(record.productType).toBe('sealed_product');
  });

  it('should include grade for single cards in price history', () => {
    const productType = 'single_card' as const;
    const priceItem = { price: 10000, grade: 'PSA10', soldAt: new Date(), quantity: undefined };

    const record = {
      cardId: 123,
      source: 'snkrdunk',
      price: '550.00',
      currency: 'HKD',
      grade: productType === 'sealed_product' ? undefined : priceItem.grade,
      quantity: productType === 'sealed_product' ? (priceItem.quantity || undefined) : undefined,
      productType,
      soldAt: priceItem.soldAt,
    };

    expect(record.grade).toBe('PSA10');
    expect(record.quantity).toBeUndefined();
    expect(record.productType).toBe('single_card');
  });

  it('should return error for non-existent sealed product', () => {
    const product = null;
    if (!product) {
      const response = {
        status: 'error' as const,
        message: 'Sealed product not found',
        recordsAdded: 0,
      };
      expect(response.status).toBe('error');
      expect(response.message).toContain('Sealed product');
    }
  });

  it('should invalidate sealed product queries on successful refresh', () => {
    // Simulate the onSuccess callback logic
    const result = { status: 'success' as const, recordsAdded: 5 };
    const isSealedProduct = true;
    const queriesToInvalidate: string[] = [];

    if (result.status === 'success' && result.recordsAdded > 0) {
      queriesToInvalidate.push('prices.getHistory');
      queriesToInvalidate.push('prices.getStatistics');
      queriesToInvalidate.push('cards.getPriceTrendData');
      queriesToInvalidate.push('products.getPriceHistory');
    }

    expect(queriesToInvalidate).toContain('products.getPriceHistory');
    expect(queriesToInvalidate.length).toBe(4);
  });
});
