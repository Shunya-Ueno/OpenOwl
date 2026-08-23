import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../../shared/supabase/client';

/**
 * supabase.auth.* の呼び出しをここに集約する。application 層の hook から
 * 直接 supabase.auth を呼ばせない(docs/frontend-design.md 5.2)。
 */
export class SupabaseAuthGateway {
  async signInWithPassword(email: string, password: string): Promise<Session> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw error ?? new Error('sign-in returned no session');
    return data.session;
  }

  async signUpWithPassword(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }

  async signInWithIdToken(
    provider: 'google' | 'apple',
    idToken: string,
    nonce?: string,
  ): Promise<Session> {
    const { data, error } = await supabase.auth.signInWithIdToken({ provider, token: idToken, nonce });
    if (error || !data.session) throw error ?? new Error('sign-in returned no session');
    return data.session;
  }

  async signInWithOAuthRedirect(provider: 'google' | 'apple', redirectTo: string): Promise<void> {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) throw error;
  }

  async exchangeCodeForSession(url: string): Promise<Session> {
    const { data, error } = await supabase.auth.exchangeCodeForSession(url);
    if (error || !data.session) throw error ?? new Error('code exchange returned no session');
    return data.session;
  }

  async resetPasswordForEmail(email: string, redirectTo: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
  }
}

export const authGateway = new SupabaseAuthGateway();
