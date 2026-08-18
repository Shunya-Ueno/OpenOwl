import { assert } from '@std/assert';
import type { PostgrestError } from '@supabase/supabase-js';

/** 権限拒否を表す Postgres のエラーコード(insufficient_privilege)。 */
const INSUFFICIENT_PRIVILEGE = '42501';

/**
 * 「権限で拒否された」ことを検証する。
 *
 * 単に `error !== null` を見るだけでは、CHECK 制約違反や FK 違反、
 * ネットワーク障害でも通ってしまう。それでは権限が誤って開放される回帰
 * (= このテストが唯一守るべき事象)を検出できないため、拒否の理由まで確認する。
 */
export function assertPermissionDenied(error: PostgrestError | null, message: string): void {
  assert(error !== null, `${message}: 拒否されず成功してしまった`);
  const isPermissionError =
    error.code === INSUFFICIENT_PRIVILEGE ||
    /permission denied|row-level security/i.test(error.message);
  assert(
    isPermissionError,
    `${message}: 拒否はされたが理由が権限ではない (code=${error.code}, message=${error.message})`,
  );
}

/**
 * 「RLS により見えない」ことを検証する。
 *
 * RLS は権限エラーではなく「0行」として現れる場合と、GRANT がない場合の
 * 権限エラーとして現れる場合の両方がある。どちらも許容するが、
 * ネットワーク障害など無関係なエラーは通さない。
 */
export function assertNotVisible(
  result: { data: unknown[] | null; error: PostgrestError | null },
  message: string,
): void {
  if (result.error !== null) {
    assertPermissionDenied(result.error, message);
    return;
  }
  assert(
    (result.data?.length ?? 0) === 0,
    `${message}: ${result.data?.length} 件が見えている`,
  );
}
