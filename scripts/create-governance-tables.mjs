import { createConnection } from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const conn = await createConnection(DATABASE_URL);

console.log('Creating governance tables...');

// 1. sellerRiskProfiles
await conn.execute(`
  CREATE TABLE IF NOT EXISTS \`sellerRiskProfiles\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`sellerId\` int NOT NULL,
    \`riskLevel\` enum('low','medium','high','critical') NOT NULL DEFAULT 'low',
    \`totalListings\` int NOT NULL DEFAULT 0,
    \`delistedCount\` int NOT NULL DEFAULT 0,
    \`reportCount\` int NOT NULL DEFAULT 0,
    \`disputeCount\` int NOT NULL DEFAULT 0,
    \`lastReviewAt\` timestamp NULL,
    \`adminNote\` text,
    \`isWatched\` boolean NOT NULL DEFAULT false,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY \`srp_sellerId_idx\` (\`sellerId\`),
    KEY \`srp_riskLevel_idx\` (\`riskLevel\`),
    KEY \`srp_isWatched_idx\` (\`isWatched\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);
console.log('✅ sellerRiskProfiles created');

// 2. listingModerationLogs
await conn.execute(`
  CREATE TABLE IF NOT EXISTS \`listingModerationLogs\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`listingId\` int NOT NULL,
    \`listingMode\` enum('direct','auction') NOT NULL DEFAULT 'direct',
    \`adminId\` int NOT NULL,
    \`adminName\` varchar(100),
    \`action\` enum('delist','restore','batch_delist','batch_restore','flag_risk','clear_flag','edit') NOT NULL,
    \`reason\` text,
    \`previousStatus\` varchar(50),
    \`newStatus\` varchar(50),
    \`metadata\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY \`lml_listingId_idx\` (\`listingId\`),
    KEY \`lml_adminId_idx\` (\`adminId\`),
    KEY \`lml_createdAt_idx\` (\`createdAt\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);
console.log('✅ listingModerationLogs created');

// 3. platformRules
await conn.execute(`
  CREATE TABLE IF NOT EXISTS \`platformRules\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`category\` enum('listing','auction','payment','shipping','conduct','seller') NOT NULL,
    \`title\` varchar(200) NOT NULL,
    \`content\` text NOT NULL,
    \`isActive\` boolean NOT NULL DEFAULT true,
    \`sortOrder\` int NOT NULL DEFAULT 0,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY \`pr_category_idx\` (\`category\`),
    KEY \`pr_isActive_idx\` (\`isActive\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);
console.log('✅ platformRules created');

// 4. productCategories
await conn.execute(`
  CREATE TABLE IF NOT EXISTS \`productCategories\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`name\` varchar(100) NOT NULL,
    \`slug\` varchar(100) NOT NULL,
    \`description\` text,
    \`parentId\` int,
    \`tcgSeries\` varchar(50),
    \`isActive\` boolean NOT NULL DEFAULT true,
    \`sortOrder\` int NOT NULL DEFAULT 0,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY \`pc_slug_idx\` (\`slug\`),
    KEY \`pc_isActive_idx\` (\`isActive\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);
console.log('✅ productCategories created');

await conn.end();
console.log('All governance tables created successfully!');
