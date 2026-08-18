import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { queryClient } from '@/shared/lib/queryClient';
import { authClient } from '../api/SupabaseAuthClient';
import { AuthUser } from '../domain/AuthUser';

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  readonly status: AuthStatus;
  readonly session: Session | null;
  readonly user: AuthUser | null;
}

const INITIAL_STATE: AuthState = { status: 'initializing', session: null, user: null };

const AuthContext = createContext<AuthState | undefined>(undefined);

function toState(session: Session | null): AuthState {
  if (!session) {
    return { status: 'unauthenticated', session: null, user: null };
  }
  return {
    status: 'authenticated',
    session,
    user: new AuthUser(session.user.id, session.user.email ?? null),
  };
}

/**
 * 認証状態の単一の真実は supabase-js のセッションであり、この Provider はそれを
 * 購読して配るだけで、独自にトークンを複製しない(docs/frontend/state-management.md)。
 *
 * `status: 'initializing'` の間はスプラッシュを維持する側の責務
 * (app/_layout.tsx)。サインイン画面が一瞬見えるチラつきを防ぐため。
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);
  const previousStatus = useRef<AuthStatus>('initializing');

  useEffect(() => {
    let isMounted = true;

    authClient
      .getSession()
      .then((session) => {
        if (isMounted) setState(toState(session));
      })
      .catch(() => {
        if (isMounted) setState({ status: 'unauthenticated', session: null, user: null });
      });

    const unsubscribe = authClient.onAuthStateChange((session) => {
      // サインアウト(認証済み → 未認証)を検知したら、前のユーザーのサーバ状態
      // キャッシュを消す。userId をクエリキーに含めていても、消し忘れの
      // 古いキャッシュが一瞬見える事故を避けるための保険。
      if (previousStatus.current === 'authenticated' && !session) {
        queryClient.clear();
      }
      const next = toState(session);
      previousStatus.current = next.status;
      setState(next);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth() は AuthProvider の内側でのみ使用できます。');
  }
  return context;
}
