import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';
import type { TermRepository, ResolvedTerm } from '../../domain/ports/TermRepository.ts';
import type { Term } from '../../domain/Term.ts';
import { InternalDomainError } from '../../domain/errors.ts';

/** service_role クライアントで find_or_create_term RPC を呼ぶ。 */
export class SupabaseTermRepository implements TermRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async findOrCreate(term: Term): Promise<ResolvedTerm> {
    const { data, error } = await this.client.rpc('find_or_create_term', {
      p_language: term.language,
      p_display_text: term.displayText,
      p_normalized_text: term.normalizedText,
    });

    if (error || !data) {
      throw new InternalDomainError(`failed to resolve term: ${error?.message ?? 'no row returned'}`, error);
    }

    return { id: data.id, displayText: data.display_text, language: data.language };
  }
}
