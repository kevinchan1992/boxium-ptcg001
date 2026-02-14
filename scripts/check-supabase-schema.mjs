import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  try {
    // 嘗試查詢 user_profiles 表
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1)

    if (error) {
      console.error('Error querying user_profiles:', error)
      return
    }

    console.log('user_profiles table exists!')
    if (data && data.length > 0) {
      console.log('Sample row:', data[0])
      console.log('Available columns:', Object.keys(data[0]))
    } else {
      console.log('Table is empty')
    }
  } catch (err) {
    console.error('Unexpected error:', err)
  }
}

checkSchema()
