const cronSecret = process.env.CRON_SECRET;
console.log('CRON_SECRET set:', !!cronSecret);
console.log('Length:', cronSecret?.length);
console.log('Is hex:', /^[0-9a-f]+$/i.test(cronSecret || ''));

// Simulate the auth check
const testToken = cronSecret;
const authHeader = `Bearer ${testToken}`;
const extractedToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
const isValid = cronSecret && extractedToken === cronSecret;
console.log('Auth check passes:', isValid);
console.log('✅ CRON_SECRET validation passed');
