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

type Env = z.infer<typeof envSchema>;

/**
 * 検証に失敗したときのフォールバック。
 *
 * **ここで throw しないことが重要**(docs/frontend-design.md 13.1)。
 * この値はモジュール読み込み時に評価され、_layout.tsx が import 連鎖の先で
 * 参照している。読み込み中に例外を投げると React が描画に入る前にバンドルが
 * 停止し、**画面が真っ白になって原因が何も表示されない**。
 *
 * 代わりにフォールバックで読み込みを通し、`envError` を見た _layout.tsx が
 * 設定エラー画面を描画する。この URL は実在しないドメインなので、
 * 誤って設定不備のまま通信してしまうこともない。
 */
const FALLBACK_ENV: Env = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://invalid.example',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'missing-anon-key',
};

function describe(error: z.ZodError): string {
  const missing = error.issues.map((issue) => issue.path.join('.')).join(', ');
  return `必要な環境変数が設定されていません: ${missing}`;
}

const parsed = envSchema.safeParse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

/** 設定不備の説明。正常なら null。UI に出す用途のみで、値そのものは含めない。 */
export const envError: string | null = parsed.success ? null : describe(parsed.error);

export const env: Env = parsed.success ? parsed.data : FALLBACK_ENV;
