/** 必須の環境変数が欠けている場合のエラー。起動時に検知させ、リクエスト時ではなく即座に失敗させる。 */
export class MissingEnvVarError extends Error {
  constructor(name: string) {
    super(`Missing required environment variable: ${name}`);
  }
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new MissingEnvVarError(name);
  return value;
}

function optionalEnvInt(name: string, defaultValue: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got: ${raw}`);
  }
  return parsed;
}

/**
 * Edge Function の設定。`fromEnv()` は起動時(モジュール読み込み時)に呼び出し、
 * 必須変数の欠落をデプロイ直後に検知できるようにする。
 */
export class AppConfig {
  private constructor(
    readonly supabaseUrl: string,
    readonly serviceRoleKey: string,
    readonly publishableKey: string,
    readonly geminiApiKey: string,
    readonly geminiModel: string,
    readonly geminiTimeoutMs: number,
    readonly rateLimitPerDay: number,
    readonly rateLimitPerMinute: number,
    readonly cacheTtlDays: number,
    readonly corsAllowedOrigin: string,
  ) {}

  static fromEnv(): AppConfig {
    return new AppConfig(
      // SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY は
      // Supabase が Edge Functions に自動注入する(手動設定は不可)。
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      requireEnv('SUPABASE_ANON_KEY'),
      requireEnv('GEMINI_API_KEY'),
      Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite',
      optionalEnvInt('GEMINI_TIMEOUT_MS', 10_000),
      optionalEnvInt('SYNONYM_RATE_LIMIT_PER_DAY', 30),
      optionalEnvInt('SYNONYM_RATE_LIMIT_PER_MINUTE', 10),
      optionalEnvInt('SYNONYM_CACHE_TTL_DAYS', 90),
      Deno.env.get('CORS_ALLOWED_ORIGIN') ?? '*',
    );
  }
}
