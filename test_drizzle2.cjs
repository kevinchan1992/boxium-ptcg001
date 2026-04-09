const mysql = require('mysql2');
const pool = mysql.createPool({ uri: process.env.DATABASE_URL, charset: 'utf8mb4' });

// The drizzle error was: "Failed query: insert into marketplaceBanners ... params: ...,true"
// The "true" string is the problem - mysql2 doesn't accept boolean strings
// Let's see what the actual SQL error is
pool.execute(
  "INSERT INTO marketplaceBanners (title,subtitle,cta,ctaConditions,ctaSellerType,gradient,accentColor,badge,badgeClass,emoji,imageUrl,sortOrder,isActive) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
  ['Test123','sub','立即選購','[]','all','from-[#06038d]','#FFD700','','bg-yellow-400','🏆','',0,'true'],
  function(err, result) {
    if (err) {
      console.error('ERR with "true" string:', err.message, err.code);
    } else {
      console.log('SUCCESS with "true" string! id=' + result.insertId);
      pool.execute('DELETE FROM marketplaceBanners WHERE id=?', [result.insertId], function() { pool.end(); });
    }
  }
);
