import { z } from 'zod';

// README.md の環境変数マトリクス: EXPO_PUBLIC_ 接頭辞はビルド時にバンドルへ
// 埋め込まれ公開される前提の値のみを置く（保護は RLS が担う）。
const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // Google ネイティブサインイン専用。Web は Supabase 側の OAuth 設定を使うため不要
  // (docs/frontend-design.md 8.1)。未設定でも起動時には落とさず、
  // 実際に Google ログインを試みたときにエラーにする(§13: 後追い設定が可能)。
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: z.string().min(1).optional(),
});

export class InvalidEnvError extends Error {
  constructor(cause: z.ZodError) {
    super(
      `frontend/.env.local が未設定、または不正です。frontend/.env.example を参照してください: ${cause.message}`,
    );
    this.name = 'InvalidEnvError';
  }
}

function loadEnv() {
  const parsed = envSchema.safeParse({
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });

  if (!parsed.success) {
    throw new InvalidEnvError(parsed.error);
  }
  return parsed.data;
}

export const env = loadEnv();
