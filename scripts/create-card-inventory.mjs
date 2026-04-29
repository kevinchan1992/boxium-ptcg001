import { createConnection } from "mysql2/promise";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await createConnection(dbUrl);

const sql = `
CREATE TABLE IF NOT EXISTS \`cardInventory\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`itemType\` enum('card','sealed') NOT NULL DEFAULT 'card',
  \`cardName\` varchar(512) NOT NULL,
  \`cardSet\` varchar(256) DEFAULT NULL,
  \`cardNumber\` varchar(64) DEFAULT NULL,
  \`grade\` varchar(32) DEFAULT NULL,
  \`buyPriceCurrency\` enum('HKD','JPY','USD') NOT NULL DEFAULT 'HKD',
  \`buyPriceOriginal\` decimal(12,2) NOT NULL,
  \`buyPriceHkd\` decimal(12,2) NOT NULL,
  \`buyExchangeRate\` decimal(10,4) DEFAULT '1.0000',
  \`buyDate\` timestamp NOT NULL,
  \`buySource\` varchar(256) DEFAULT NULL,
  \`status\` enum('holding','sold') NOT NULL DEFAULT 'holding',
  \`sellPriceCurrency\` enum('HKD','JPY','USD') DEFAULT 'HKD',
  \`sellPriceOriginal\` decimal(12,2) DEFAULT NULL,
  \`sellPriceHkd\` decimal(12,2) DEFAULT NULL,
  \`sellExchangeRate\` decimal(10,4) DEFAULT NULL,
  \`sellDate\` timestamp NULL DEFAULT NULL,
  \`sellChannel\` varchar(256) DEFAULT NULL,
  \`notes\` text DEFAULT NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`ci_status_idx\` (\`status\`),
  KEY \`ci_buyDate_idx\` (\`buyDate\`),
  KEY \`ci_itemType_idx\` (\`itemType\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

try {
  await conn.execute(sql);
  console.log("✅ cardInventory table created successfully");
  
  // Verify
  const [rows] = await conn.execute("DESCRIBE `cardInventory`");
  console.log(`✅ Table has ${rows.length} columns`);
} catch (err) {
  console.error("❌ Error:", err.message);
} finally {
  await conn.end();
}
