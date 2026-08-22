import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';
import type { Env } from '../config/Env.ts';

/**
 * docs/security.md 4.3: ユーザー文脈クライアント(Authorization を引き継ぐ/RLS 有効)と
 * service_role クライアント(RLS バイパス)を明確に分けて生成する。
 * service_role クライアントの使用箇所はリポジトリ実装の内部に限定する。
 */
export class SupabaseClientFactory {
  constructor(private readonly env: Env) {}

  /** ユーザーの本人確認(getUser)専用。RLS が有効なままの匿名キークライアント。 */
  createAuthClient(): SupabaseClient<Database> {
    return createClient<Database>(this.env.SUPABASE_URL, this.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
  }

  /** 共有データ(terms/synonym_generations/synonym_items)の書き込み専用。 */
  createServiceRoleClient(): SupabaseClient<Database> {
    return createClient<Database>(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
}
