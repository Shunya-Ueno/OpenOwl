// このファイルは `supabase gen types typescript` の出力である。手書きしないこと。
// (CLAUDE.md「生成された DB 型はコミットする。手書きしない。」)
// 再生成: cd backend && supabase gen types typescript --linked > supabase/functions/_shared/infrastructure/supabase/database.types.ts

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
      generation_attempts: {
        Row: {
          created_at: string
          id: string
          term_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          term_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          term_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_attempts_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      lookups: {
        Row: {
          cache_hit: boolean
          created_at: string
          generation_id: string | null
          id: string
          kind: Database["public"]["Enums"]["lookup_kind"]
          term_id: string
          user_id: string
        }
        Insert: {
          cache_hit?: boolean
          created_at?: string
          generation_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["lookup_kind"]
          term_id: string
          user_id: string
        }
        Update: {
          cache_hit?: boolean
          created_at?: string
          generation_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["lookup_kind"]
          term_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lookups_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "synonym_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lookups_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          native_language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          native_language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          native_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      synonym_generations: {
        Row: {
          cached_prompt_tokens: number | null
          completion_tokens: number | null
          created_at: string
          id: string
          latency_ms: number | null
          max_results: number
          model: string
          prompt_tokens: number | null
          prompt_version: string
          term_id: string
        }
        Insert: {
          cached_prompt_tokens?: number | null
          completion_tokens?: number | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          max_results: number
          model: string
          prompt_tokens?: number | null
          prompt_version: string
          term_id: string
        }
        Update: {
          cached_prompt_tokens?: number | null
          completion_tokens?: number | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          max_results?: number
          model?: string
          prompt_tokens?: number | null
          prompt_version?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "synonym_generations_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      synonym_items: {
        Row: {
          generation_id: string
          id: string
          nuance: string | null
          part_of_speech: string | null
          position: number
          register: string | null
          synonym_text: string
        }
        Insert: {
          generation_id: string
          id?: string
          nuance?: string | null
          part_of_speech?: string | null
          position: number
          register?: string | null
          synonym_text: string
        }
        Update: {
          generation_id?: string
          id?: string
          nuance?: string | null
          part_of_speech?: string | null
          position?: number
          register?: string | null
          synonym_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "synonym_items_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "synonym_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          created_at: string
          display_text: string
          id: string
          language: string
          normalized_text: string
        }
        Insert: {
          created_at?: string
          display_text: string
          id?: string
          language?: string
          normalized_text: string
        }
        Update: {
          created_at?: string
          display_text?: string
          id?: string
          language?: string
          normalized_text?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_recent_generations: {
        Args: { p_since: string; p_user_id: string }
        Returns: number
      }
      find_latest_generation: {
        Args: { p_model: string; p_prompt_version: string; p_term_id: string }
        Returns: {
          created_at: string
          id: string
        }[]
      }
      find_or_create_term: {
        Args: {
          p_display_text: string
          p_language: string
          p_normalized_text: string
        }
        Returns: {
          created_at: string
          display_text: string
          id: string
          language: string
          normalized_text: string
        }
        SetofOptions: {
          from: "*"
          to: "terms"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      oldest_generation_attempt_at: {
        Args: { p_since: string; p_user_id: string }
        Returns: string
      }
      record_cached_lookup: {
        Args: { p_generation_id: string; p_term_id: string; p_user_id: string }
        Returns: string
      }
      record_generation_attempt: {
        Args: { p_term_id: string; p_user_id: string }
        Returns: string
      }
      save_synonym_generation: {
        Args: {
          p_cached_prompt_tokens?: number
          p_completion_tokens?: number
          p_items?: Json
          p_latency_ms?: number
          p_max_results: number
          p_model: string
          p_prompt_tokens?: number
          p_prompt_version: string
          p_term_id: string
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      lookup_kind: "synonym"
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
    Enums: {
      lookup_kind: ["synonym"],
    },
  },
} as const
