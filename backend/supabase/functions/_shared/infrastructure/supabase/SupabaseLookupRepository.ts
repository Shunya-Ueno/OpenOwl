import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';
import type { LookupRepository } from '../../domain/ports/LookupRepository.ts';
import { InternalDomainError } from '../../domain/errors.ts';

export class SupabaseLookupRepository implements LookupRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async recordCacheHit(userId: string, termId: string, generationId: string): Promise<void> {
    const { error } = await this.client.rpc('record_cached_lookup', {
      p_user_id: userId,
      p_term_id: termId,
      p_generation_id: generationId,
    });

    if (error) {
      throw new InternalDomainError(`failed to record cache hit: ${error.message}`, error);
    }
  }
}
