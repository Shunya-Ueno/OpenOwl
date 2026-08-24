import { supabase } from '../../../shared/supabase/client';

export interface LookupSummary {
  readonly id: string;
  readonly createdAt: string;
  readonly cacheHit: boolean;
  readonly term: {
    readonly id: string;
    readonly text: string;
    readonly language: string;
  };
}

const RECENT_LIMIT = 30;

/**
 * docs/api-spec.md 4.1。user_id の条件は書かない(RLS が自動で絞る)。
 * PostgREST は DISTINCT ON を提供しないため、「単語重複を除いた最新」
 * (docs/db-schema.md 3.5)はここで de-dup する。
 */
export class LookupsApi {
  async listRecent(): Promise<LookupSummary[]> {
    const { data, error } = await supabase
      .from('lookups')
      .select(
        `
          id,
          created_at,
          cache_hit,
          terms!lookups_term_id_fkey ( id, display_text, language )
        `,
      )
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT);

    if (error) throw error;

    const seenTermIds = new Set<string>();
    const summaries: LookupSummary[] = [];

    for (const row of data) {
      if (!row.terms || seenTermIds.has(row.terms.id)) continue;
      seenTermIds.add(row.terms.id);
      summaries.push({
        id: row.id,
        createdAt: row.created_at,
        cacheHit: row.cache_hit,
        term: { id: row.terms.id, text: row.terms.display_text, language: row.terms.language },
      });
    }

    return summaries;
  }

  async delete(lookupId: string): Promise<void> {
    // RLS の lookups_delete_own により他人の行は削除できない(docs/api-spec.md 4.2)。
    const { error } = await supabase.from('lookups').delete().eq('id', lookupId);
    if (error) throw error;
  }
}

export const lookupsApi = new LookupsApi();
