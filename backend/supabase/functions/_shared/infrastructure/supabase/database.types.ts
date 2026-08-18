// このファイルは `npm run db:types`(= Supabase の型生成)の出力です。手で編集しないでください。
// スキーマ(backend/supabase/migrations/)を変更したら再生成すること。
//
// 生成元: Supabase project `OpenOwl-feature` (vaaaiatfouoaljsitstv)、
// マイグレーション適用後に `generate_typescript_types` で取得(2026-08-18)。
//
// 1点だけ手動補正している: record_synonym_generation の Args のうち
// p_prompt_tokens / p_completion_tokens。Postgres の関数引数は NOT NULL 制約がない限り
// 呼び出し時に null を渡せる(実際に GeminiHttpClient がトークン数を取得できなかった場合は
// null を渡す)。Supabase の型生成は plpgsql 関数引数の nullability を常に non-null として
// 出力するため、生成結果のままだと SupabaseSynonymRepository.saveGeneration の呼び出しが
// 型エラーになる。次回再生成時もこの2箇所は同様に `| null` を補うこと。

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          learning_language: string
          native_language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          learning_language?: string
          native_language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          learning_language?: string
          native_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      search_history: {
        Row: {
          created_at: string
          generation_id: string | null
          id: string
          outcome: string
          raw_input: string
          user_id: string
          word_id: string
        }
        Insert: {
          created_at?: string
          generation_id?: string | null
          id?: string
          outcome: string
          raw_input: string
          user_id: string
          word_id: string
        }
        Update: {
          created_at?: string
          generation_id?: string | null
          id?: string
          outcome?: string
          raw_input?: string
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_history_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "synonym_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_history_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      synonym_generations: {
        Row: {
          completion_tokens: number | null
          created_at: string
          error_code: string | null
          id: string
          latency_ms: number | null
          model: string
          prompt_tokens: number | null
          prompt_version: string
          status: string
          word_id: string
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          model: string
          prompt_tokens?: number | null
          prompt_version: string
          status: string
          word_id: string
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          model?: string
          prompt_tokens?: number | null
          prompt_version?: string
          status?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "synonym_generations_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      synonyms: {
        Row: {
          created_at: string
          definition: string | null
          generation_id: string
          id: string
          nuance: string | null
          part_of_speech: string | null
          sort_order: number
          term: string
        }
        Insert: {
          created_at?: string
          definition?: string | null
          generation_id: string
          id?: string
          nuance?: string | null
          part_of_speech?: string | null
          sort_order: number
          term: string
        }
        Update: {
          created_at?: string
          definition?: string | null
          generation_id?: string
          id?: string
          nuance?: string | null
          part_of_speech?: string | null
          sort_order?: number
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "synonyms_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "synonym_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      words: {
        Row: {
          created_at: string
          id: string
          language: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          language?: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          text?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      record_synonym_generation: {
        Args: {
          // 手動補正: 生成結果は number だったが、実際は null を渡しうる(上記コメント参照)。
          p_completion_tokens: number | null
          p_latency_ms: number
          p_model: string
          p_prompt_tokens: number | null
          p_prompt_version: string
          p_raw_input: string
          p_synonyms: Json
          p_user_id: string
          p_word_id: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
