import { z } from 'zod';

// docs/deployment.md 3章の環境変数マトリクスに対応。
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY は
// Edge Functions 実行環境が自動注入するため、手動設定は不要
// (ただし取得元の環境変数名はここに集約する)。

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  DEEPSEEK_API_KEY: z.string().min(1),
  DEEPSEEK_BASE_URL: z.string().url().default('https://api.deepseek.com'),
  DEEPSEEK_MODEL: z.string().min(1).default('deepseek-chat'),
  DEEPSEEK_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  SYNONYM_CACHE_TTL_DAYS: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(60),
  ALLOWED_ORIGINS: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

export class InvalidEnvError extends Error {
  constructor(cause: z.ZodError) {
    super(`invalid environment configuration: ${cause.message}`);
  }
}

/** 環境変数の読み出しと検証を1箇所に集約する。 */
export function loadEnv(): Env {
  const raw = {
    SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY'),
    DEEPSEEK_API_KEY: Deno.env.get('DEEPSEEK_API_KEY'),
    DEEPSEEK_BASE_URL: Deno.env.get('DEEPSEEK_BASE_URL') || undefined,
    DEEPSEEK_MODEL: Deno.env.get('DEEPSEEK_MODEL') || undefined,
    DEEPSEEK_TIMEOUT_MS: Deno.env.get('DEEPSEEK_TIMEOUT_MS') || undefined,
    SYNONYM_CACHE_TTL_DAYS: Deno.env.get('SYNONYM_CACHE_TTL_DAYS') || undefined,
    RATE_LIMIT_PER_HOUR: Deno.env.get('RATE_LIMIT_PER_HOUR') || undefined,
    ALLOWED_ORIGINS: Deno.env.get('ALLOWED_ORIGINS'),
  };

  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    throw new InvalidEnvError(parsed.error);
  }
  return parsed.data;
}
