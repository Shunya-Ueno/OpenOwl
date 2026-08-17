// このファイルは `npm run db:types` で自動生成される想定のファイルです。手で編集しないでください。
// スキーマ(backend/supabase/migrations/)を変更したら、ローカルスタックを起動してから
// 再生成すること: npm run supabase:start && npm run db:types
//
// ローカルにSupabase CLIがない状態で先行実装したため、現時点ではマイグレーションSQLに基づき
// 手書きしています。Phase 3 の完了条件としてローカルスタックに対して再生成し、
// この手書き版と差分がないことを確認してください。

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          native_language: string;
          learning_language: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          native_language?: string;
          learning_language?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      words: {
        Row: {
          id: string;
          language: string;
          text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          language?: string;
          text: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['words']['Insert']>;
      };
      synonym_generations: {
        Row: {
          id: string;
          word_id: string;
          model: string;
          prompt_version: string;
          status: 'succeeded' | 'failed';
          error_code: string | null;
          prompt_tokens: number | null;
          completion_tokens: number | null;
          latency_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          word_id: string;
          model: string;
          prompt_version: string;
          status: 'succeeded' | 'failed';
          error_code?: string | null;
          prompt_tokens?: number | null;
          completion_tokens?: number | null;
          latency_ms?: number | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['synonym_generations']['Insert']>;
      };
      synonyms: {
        Row: {
          id: string;
          generation_id: string;
          sort_order: number;
          term: string;
          part_of_speech: string | null;
          definition: string | null;
          nuance: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          generation_id: string;
          sort_order: number;
          term: string;
          part_of_speech?: string | null;
          definition?: string | null;
          nuance?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['synonyms']['Insert']>;
      };
      search_history: {
        Row: {
          id: string;
          user_id: string;
          word_id: string;
          generation_id: string | null;
          raw_input: string;
          outcome: 'generated' | 'cache' | 'failed';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          word_id: string;
          generation_id?: string | null;
          raw_input: string;
          outcome: 'generated' | 'cache' | 'failed';
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['search_history']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      record_synonym_generation: {
        Args: {
          p_user_id: string;
          p_word_id: string;
          p_raw_input: string;
          p_model: string;
          p_prompt_version: string;
          p_prompt_tokens: number | null;
          p_completion_tokens: number | null;
          p_latency_ms: number;
          p_synonyms: unknown;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
}
