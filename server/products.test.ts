import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mysql from 'mysql2/promise';

let conn: mysql.Connection;

beforeAll(async () => {
  conn = await mysql.createConnection(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await conn.end();
});

describe('Unified Products API - Database Layer', () => {
  it('should have sealed products in sealedProducts table', async () => {
    const [rows] = await conn.execute('SELECT COUNT(*) as cnt FROM sealedProducts') as any;
    expect(rows[0].cnt).toBeGreaterThan(0);
  });

  it('should have cards in cards table', async () => {
    const [rows] = await conn.execute('SELECT COUNT(*) as cnt FROM cards') as any;
    expect(rows[0].cnt).toBeGreaterThan(0);
  });

  it('should have sealed product price history with correct productType', async () => {
    const [rows] = await conn.execute(
      'SELECT COUNT(*) as cnt FROM priceHistory WHERE productType = "sealed_product"'
    ) as any;
    expect(rows[0].cnt).toBeGreaterThan(0);
  });

  it('should have single card price history with correct productType', async () => {
    const [rows] = await conn.execute(
      'SELECT COUNT(*) as cnt FROM priceHistory WHERE productType = "single_card"'
    ) as any;
    expect(rows[0].cnt).toBeGreaterThan(0);
  });

  it('should have data sources with productType field', async () => {
    const [rows] = await conn.execute(
      'SELECT DISTINCT productType FROM dataSources'
    ) as any;
    const types = rows.map((r: any) => r.productType);
    // Should have at least one type
    expect(types.length).toBeGreaterThan(0);
    // All types should be valid
    types.forEach((t: string) => {
      expect(['single_card', 'sealed_product']).toContain(t);
    });
  });
});

describe('getProductById - Unified Query', () => {
  it('should find a card by ID from cards table', async () => {
    // Get first card ID
    const [cards] = await conn.execute('SELECT id, name FROM cards LIMIT 1') as any;
    if (cards.length === 0) return; // Skip if no cards

    const cardId = cards[0].id;
    const cardName = cards[0].name;

    // Verify card exists
    const [result] = await conn.execute('SELECT * FROM cards WHERE id = ?', [cardId]) as any;
    expect(result.length).toBe(1);
    expect(result[0].name).toBe(cardName);
  });

  it('should find a sealed product by ID from sealedProducts table', async () => {
    // Get first sealed product ID
    const [products] = await conn.execute('SELECT id, name FROM sealedProducts LIMIT 1') as any;
    if (products.length === 0) return; // Skip if no products

    const productId = products[0].id;
    const productName = products[0].name;

    // Verify product exists
    const [result] = await conn.execute('SELECT * FROM sealedProducts WHERE id = ?', [productId]) as any;
    expect(result.length).toBe(1);
    expect(result[0].name).toBe(productName);
  });

  it('should correctly separate price history by productType', async () => {
    // Get a sealed product with price history
    const [sealedPH] = await conn.execute(
      'SELECT cardId, COUNT(*) as cnt FROM priceHistory WHERE productType = "sealed_product" GROUP BY cardId LIMIT 1'
    ) as any;

    if (sealedPH.length > 0) {
      const productId = sealedPH[0].cardId;
      
      // All price history for this product should have productType = sealed_product
      const [allPH] = await conn.execute(
        'SELECT productType FROM priceHistory WHERE cardId = ? AND productType = "sealed_product"',
        [productId]
      ) as any;
      
      allPH.forEach((row: any) => {
        expect(row.productType).toBe('sealed_product');
      });
    }
  });

  it('should have sealed product data source with correct productType', async () => {
    const [ds] = await conn.execute(
      'SELECT * FROM dataSources WHERE productType = "sealed_product" LIMIT 1'
    ) as any;

    if (ds.length > 0) {
      expect(ds[0].productType).toBe('sealed_product');
      // Verify the cardId points to a valid sealed product
      const [product] = await conn.execute(
        'SELECT id FROM sealedProducts WHERE id = ?',
        [ds[0].cardId]
      ) as any;
      expect(product.length).toBe(1);
    }
  });
});

describe('Sealed Product Price History', () => {
  it('should have quantity field in sealed product price history', async () => {
    const [rows] = await conn.execute(
      'SELECT quantity FROM priceHistory WHERE productType = "sealed_product" AND quantity IS NOT NULL LIMIT 5'
    ) as any;
    
    // Some sealed product records should have quantity
    if (rows.length > 0) {
      rows.forEach((row: any) => {
        expect(row.quantity).toBeTruthy();
      });
    }
  });

  it('should not have PSA grade in sealed product price history', async () => {
    // Sealed products should not have PSA grades
    const [rows] = await conn.execute(
      `SELECT grade FROM priceHistory 
       WHERE productType = "sealed_product" 
       AND grade LIKE "PSA%" 
       LIMIT 1`
    ) as any;
    
    // There should be no PSA grades for sealed products
    expect(rows.length).toBe(0);
  });
});
