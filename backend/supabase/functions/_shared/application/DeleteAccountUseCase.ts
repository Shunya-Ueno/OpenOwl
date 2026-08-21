import { InternalError } from '../domain/error/AppError.ts';
import type { StructuredLogger } from '../infrastructure/logging/StructuredLogger.ts';

export interface DeleteAccountCommand {
  /** JWT 検証済みのユーザーID。クライアントが送った識別子は使わない。 */
  readonly userId: string;
  readonly requestId: string;
}

/**
 * `auth.users` からユーザーを削除する抽象。
 * 具体的な削除手段(Supabase Auth Admin API)を差し替える理由がある箇所にのみ存在する。
 */
export interface UserDeleter {
  deleteUser(userId: string): Promise<void>;
}

/**
 * アカウント削除のユースケース。
 *
 * `auth.users` の削除は、`profiles`(on delete cascade) と `search_history`
 * (on delete cascade)を連鎖的に削除する(db-schema.md)。`words` / `synonym_generations` /
 * `synonyms` はユーザーに紐づかない辞書データのため削除しない(意図的な設計)。
 */
export class DeleteAccountUseCase {
  constructor(
    private readonly userDeleter: UserDeleter,
    private readonly logger: StructuredLogger,
  ) {}

  async execute(command: DeleteAccountCommand): Promise<void> {
    try {
      await this.userDeleter.deleteUser(command.userId);
      this.logger.info({
        requestId: command.requestId,
        userId: command.userId,
        outcome: 'succeeded',
      });
    } catch (error) {
      this.logger.error({
        requestId: command.requestId,
        userId: command.userId,
        outcome: 'failed',
        message: error instanceof Error ? error.message : 'unknown error',
      });
      throw new InternalError('failed to delete account', error);
    }
  }
}
