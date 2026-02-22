import { hashPassword } from './server/auth.ts';
import { getDb } from './server/db.ts';
import { users } from './drizzle/schema.ts';

async function createAdmin() {
  const db = await getDb();
  if (!db) {
    console.error('Database connection failed');
    process.exit(1);
  }

  const email = 'xyz.asia.co@gmail.com';
  const password = 'Admin123'; // Temporary password
  const name = 'Admin';

  try {
    // Hash password
    const passwordHash = await hashPassword(password);

    // Create admin user
    await db.insert(users).values({
      email,
      name,
      passwordHash,
      loginMethod: 'password',
      role: 'admin',
      emailVerified: true,
    });

    console.log('✅ Admin user created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('⚠️  Please change the password after first login');
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

createAdmin();
