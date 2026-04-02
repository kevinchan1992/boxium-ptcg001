import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check the winning bid for auction 330004
const [bids] = await conn.execute(`
  SELECT id, listingId, bidderId, amount, status, createdAt
  FROM auctionBids
  WHERE listingId = 330004
  ORDER BY amount DESC
  LIMIT 5
`);
console.log('Bids for auction 330004:', JSON.stringify(bids, null, 2));

// Check the listing details
const [listings] = await conn.execute(`
  SELECT id, title, sellerId, sellerType, winnerId, winningBidId, currentHighestBid, auctionStatus, status
  FROM marketplaceListings
  WHERE id = 330004
`);
console.log('Listing 330004:', JSON.stringify(listings, null, 2));

// Check if there are any orders with listingId = 330004
const [existingOrders] = await conn.execute(`
  SELECT id, orderNo, buyerId, listingId, orderSource, orderStatus
  FROM marketplaceOrders
  WHERE listingId = 330004
`);
console.log('Existing orders for listing 330004:', JSON.stringify(existingOrders, null, 2));

await conn.end();
