import { describe, it, expect } from 'vitest';
import { AuthError } from '@supabase/supabase-js';
import { getAuthErrorMessage } from './authErrorMessage';

/**
 * CLAUDE.md「エラーは型で表現する」: メッセージ文字列ではなく AuthError#code で分岐する。
 *
 * ここで作る AuthError は supabase-js の実物のクラスであってモックではない(ADR-0016)。
 * Supabase が実際に返すのと同じ形のインスタンスを組み立てている。
 */
function authError(code: string): AuthError {
  // AuthError(message, status, code)
  return new AuthError('server side message that must not be shown', 400, code);
}

describe('getAuthErrorMessage', () => {
  it('既知の code に対応する日本語を返す', () => {
    const cases = [
      'invalid_credentials',
      'user_already_exists',
      'email_not_confirmed',
      'weak_password',
      'over_request_rate_limit',
      'same_password',
    ];

    for (const code of cases) {
      const message = getAuthErrorMessage(authError(code));

      expect(message.length).toBeGreaterThan(0);
      // サーバーの英語メッセージをそのまま出していないこと。
      expect(message).not.toContain('server side message');
    }
  });

  it('code ごとに異なるメッセージを返す', () => {
    const invalid = getAuthErrorMessage(authError('invalid_credentials'));
    const exists = getAuthErrorMessage(authError('user_already_exists'));

    expect(invalid).not.toBe(exists);
  });

  it('未知の code はフォールバックに丸める', () => {
    const message = getAuthErrorMessage(authError('some_new_supabase_code'));

    expect(message).toBe('エラーが発生しました。もう一度お試しください。');
  });

  it('AuthError 以外の例外もフォールバックに丸める', () => {
    for (const thrown of [new Error('boom'), 'string', null, undefined, { code: 'invalid_credentials' }]) {
      expect(getAuthErrorMessage(thrown)).toBe('エラーが発生しました。もう一度お試しください。');
    }
  });

  it('メッセージ文字列ではなく code で分岐している', () => {
    // message に既知コードの文字列が入っていても、code が未知ならフォールバックになる。
    const misleading = new AuthError('invalid_credentials', 400, 'totally_unknown_code');

    expect(getAuthErrorMessage(misleading)).toBe('エラーが発生しました。もう一度お試しください。');
  });
});
