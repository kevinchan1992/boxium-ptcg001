import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check recent auction orders
const [orders] = await conn.execute(`
  SELECT id, orderNo, buyerId, listingId, auctionListingId, orderSource, orderStatus, subtotalHkd, createdAt
  FROM marketplaceOrders
  WHERE orderSource = 'auction'
  ORDER BY createdAt DESC
  LIMIT 10
`);
console.log('Auction orders:', JSON.stringify(orders, null, 2));

// Check if listing 330004 exists and its status
const [listings] = await conn.execute(`
  SELECT id, title, listingMode, auctionStatus, status, winnerId, auctionOrderId
  FROM marketplaceListings
  WHERE id = 330004 OR (listingMode = 'auction' AND auctionStatus = 'ended')
  ORDER BY id DESC
  LIMIT 5
`);
console.log('Auction listings:', JSON.stringify(listings, null, 2));

await conn.end();
