import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// 載入環境變數
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function initDatabase() {
  console.log('🚀 Initializing Supabase database...')

  try {
    // 創建 user_profiles 表
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        auth_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        name TEXT,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_id ON user_profiles(auth_id);
    `

    const { data, error } = await supabase.rpc('exec_sql', { sql: createTableSQL })

    if (error) {
      console.error('❌ Failed to create table:', error)
      
      // 如果 RPC 不存在，嘗試使用 REST API
      console.log('ℹ️  Trying alternative method...')
      
      // 檢查表是否已存在
      const { data: existingTable, error: checkError } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1)

      if (checkError && checkError.code === '42P01') {
        console.error('❌ Table does not exist and cannot be created via API')
        console.log('\n📝 Please create the table manually in Supabase Dashboard:')
        console.log('\n' + createTableSQL)
        process.exit(1)
      } else if (!checkError) {
        console.log('✅ Table user_profiles already exists')
      }
    } else {
      console.log('✅ Table user_profiles created successfully')
    }

    console.log('\n✅ Database initialization completed!')
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

initDatabase()
