import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// The order was already created with id=450001, but orderItem and listing update failed
// Let's check if the order exists and complete the missing steps

const orderId = 450001;
const listingId = 330004;
const sellerId = 1;
const sellerType = 'seller';
const winAmount = 160.00;

// Check if order exists
const [existingOrders] = await conn.execute(`
  SELECT id, orderNo, buyerId, listingId, orderSource, orderStatus, subtotalHkd
  FROM marketplaceOrders WHERE id = ?
`, [orderId]);
console.log('Existing order:', JSON.stringify(existingOrders, null, 2));

// Check if order item already exists
const [existingItems] = await conn.execute(`
  SELECT id FROM marketplaceOrderItems WHERE orderId = ?
`, [orderId]);
console.log('Existing order items:', JSON.stringify(existingItems, null, 2));

if (existingItems.length === 0) {
  // Create order item
  await conn.execute(`
    INSERT INTO marketplaceOrderItems (
      orderId, listingId, sellerId, sellerType, title, price, quantity, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
  `, [orderId, listingId, sellerId, sellerType, 'Pikachu Munch', winAmount.toFixed(2), 1]);
  console.log('Order item created');
} else {
  console.log('Order item already exists, skipping');
}

// Update the listing to set auctionOrderId
await conn.execute(`
  UPDATE marketplaceListings SET auctionOrderId = ? WHERE id = ?
`, [orderId, listingId]);
console.log('Listing updated with auctionOrderId:', orderId);

// Verify the complete order
const [verifyOrders] = await conn.execute(`
  SELECT o.id, o.orderNo, o.buyerId, o.listingId, o.auctionListingId, o.orderSource, o.orderStatus, o.subtotalHkd,
         i.id as itemId, i.title
  FROM marketplaceOrders o
  LEFT JOIN marketplaceOrderItems i ON i.orderId = o.id
  WHERE o.id = ?
`, [orderId]);
console.log('Verified complete order:', JSON.stringify(verifyOrders, null, 2));

await conn.end();
console.log('Done! The auction order has been completed successfully.');
