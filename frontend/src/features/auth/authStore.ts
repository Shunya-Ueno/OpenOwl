import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

/**
 * 認証セッションの唯一の書き込み口。docs/frontend-design.md 5.2。
 * サーバー由来のデータ(履歴・プロフィール等)はここに写さない(ADR-0004)。
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  readonly status: AuthStatus;
  readonly session: Session | null;
  readonly userId: string | null;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  session: null,
  userId: null,
  setSession: (session) =>
    set({
      session,
      userId: session?.user.id ?? null,
      status: session ? 'authenticated' : 'unauthenticated',
    }),
}));

export function useAuthStatus(): AuthStatus {
  return useAuthStore((state) => state.status);
}

export function useUserId(): string | null {
  return useAuthStore((state) => state.userId);
}
