import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { SecureSessionStorage } from './SecureSessionStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY が未設定です。' +
      'frontend/.env を用意してください(frontend/.env.example を参照)。',
  );
}

/**
 * アプリ全体で共有する単一の Supabase クライアント。
 * publishable key はクライアントに公開してよい前提(RLS が最終防衛線)。
 * secret key / GEMINI_API_KEY はここに置かない(docs/security.md)。
 */
export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: new SecureSessionStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
