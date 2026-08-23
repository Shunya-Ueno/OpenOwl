import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { sessionStorage } from './SessionStorage';
import type { Database } from './database.types';

/**
 * アプリ全体で唯一の Supabase クライアント(docs/frontend-design.md 6)。
 * PKCE フローを両プラットフォームで使う(docs/frontend-design.md 8.2)。
 * - Web: detectSessionInUrl: true で SDK にリダイレクトを処理させる
 * - ネイティブ: false にし、app/auth/callback.tsx で exchangeCodeForSession を自分で呼ぶ
 */
export const supabase = createClient<Database>(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: sessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
  },
);
