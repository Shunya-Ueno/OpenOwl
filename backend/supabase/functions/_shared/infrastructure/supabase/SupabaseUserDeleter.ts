import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserDeleter } from '../../application/DeleteAccountUseCase.ts';
import { InternalError } from '../../domain/error/AppError.ts';

/**
 * UserDeleter の Supabase(Auth Admin API)実装。
 * この Function には service_role で作られたクライアントを渡す必要がある
 * (auth.admin.deleteUser は service_role のみが呼べる)。
 */
export class SupabaseUserDeleter implements UserDeleter {
  constructor(private readonly client: SupabaseClient) {}

  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.client.auth.admin.deleteUser(userId);
    if (error) {
      throw new InternalError(`failed to delete auth user: ${error.message}`, error);
    }
  }
}
