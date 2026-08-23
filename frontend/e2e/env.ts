import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * E2E に必要な環境変数の読み出し。
 *
 * ローカルでは frontend/.env.local から読む(dotenv を入れないための最小実装)。
 * CI では GitHub Actions が環境変数として渡す(docs/testing-ci.md 6.6)。
 *
 * ここで扱う E2E_USER_* は「ふつうのユーザー 1 人分」の資格情報にすぎない。
 * service_role キーは CI にもローカルの .env にも置かない(docs/security.md 2.2)。
 */
function loadDotEnvLocal(): void {
  const path = resolve(__dirname, '..', '.env.local');
  if (!existsSync(path)) return;

  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    // 既に環境変数として与えられている値を .env.local で上書きしない
    // (CI の設定がローカルファイルに負けないようにするため)。
    if (process.env[key] !== undefined) continue;

    const value = line.slice(separator + 1).trim();
    process.env[key] = value.replace(/^(['"])(.*)\1$/, '$2');
  }
}

loadDotEnvLocal();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `E2E に必要な環境変数 ${name} が未設定です。` +
        'ローカルでは frontend/.env.local に、CI では GitHub Secrets に設定してください' +
        '(docs/testing-ci.md 6.3)。',
    );
  }
  return value;
}

export const e2eEnv = {
  get userEmail(): string {
    return required('E2E_USER_EMAIL');
  },
  get userPassword(): string {
    return required('E2E_USER_PASSWORD');
  },
  /**
   * 生成に使う固定の単語。同じ語を使い続けることで、初回以降は
   * 生成キャッシュ(TTL 既定 30 日)に当たり DeepSeek のトークンを消費しない
   * (docs/testing-ci.md 6.5)。
   */
  get word(): string {
    return process.env.E2E_WORD ?? 'improve';
  },
  /** 実生成を伴うスペックを走らせてよいか。日次のスケジュール実行でのみ 1 になる。 */
  get allowGeneration(): boolean {
    return process.env.E2E_ALLOW_GENERATION === '1';
  },
};

/** Edge Function 呼び出しかどうかの判定(docs/api-spec.md 2.1 のパス)。 */
export function isSynonymsFunctionCall(url: string): boolean {
  return url.includes('/functions/v1/synonyms');
}
