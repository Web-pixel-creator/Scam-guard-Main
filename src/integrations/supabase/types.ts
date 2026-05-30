export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_allowlist: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      checks: {
        Row: {
          ai_explanation: string | null
          created_at: string
          id: string
          input_hash: string
          input_type: Database["public"]["Enums"]["input_type"]
          language: string
          reason_codes: string[]
          redacted_input: string
          risk_level: Database["public"]["Enums"]["risk_level"]
          risk_score: number
        }
        Insert: {
          ai_explanation?: string | null
          created_at?: string
          id?: string
          input_hash: string
          input_type: Database["public"]["Enums"]["input_type"]
          language?: string
          reason_codes?: string[]
          redacted_input: string
          risk_level: Database["public"]["Enums"]["risk_level"]
          risk_score?: number
        }
        Update: {
          ai_explanation?: string | null
          created_at?: string
          id?: string
          input_hash?: string
          input_type?: Database["public"]["Enums"]["input_type"]
          language?: string
          reason_codes?: string[]
          redacted_input?: string
          risk_level?: Database["public"]["Enums"]["risk_level"]
          risk_score?: number
        }
        Relationships: []
      }
      entities: {
        Row: {
          created_at: string
          display_mask: string
          entity_hash: string
          entity_type: Database["public"]["Enums"]["input_type"]
          id: string
          last_seen_at: string
          moderation_status: Database["public"]["Enums"]["report_status"]
          report_count: number
          risk_level: Database["public"]["Enums"]["risk_level"]
        }
        Insert: {
          created_at?: string
          display_mask: string
          entity_hash: string
          entity_type: Database["public"]["Enums"]["input_type"]
          id?: string
          last_seen_at?: string
          moderation_status?: Database["public"]["Enums"]["report_status"]
          report_count?: number
          risk_level?: Database["public"]["Enums"]["risk_level"]
        }
        Update: {
          created_at?: string
          display_mask?: string
          entity_hash?: string
          entity_type?: Database["public"]["Enums"]["input_type"]
          id?: string
          last_seen_at?: string
          moderation_status?: Database["public"]["Enums"]["report_status"]
          report_count?: number
          risk_level?: Database["public"]["Enums"]["risk_level"]
        }
        Relationships: []
      }
      reports: {
        Row: {
          amount_lost_uzs: number | null
          city: string | null
          created_at: string
          description: string
          entity_hash: string
          entity_type: Database["public"]["Enums"]["input_type"]
          id: string
          language: string
          redacted_value: string
          scam_type: string | null
          screenshot_url: string | null
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          amount_lost_uzs?: number | null
          city?: string | null
          created_at?: string
          description: string
          entity_hash: string
          entity_type: Database["public"]["Enums"]["input_type"]
          id?: string
          language?: string
          redacted_value: string
          scam_type?: string | null
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          amount_lost_uzs?: number | null
          city?: string | null
          created_at?: string
          description?: string
          entity_hash?: string
          entity_type?: Database["public"]["Enums"]["input_type"]
          id?: string
          language?: string
          redacted_value?: string
          scam_type?: string | null
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      input_type:
        | "phone"
        | "telegram"
        | "url"
        | "text"
        | "payment"
        | "apk"
        | "unknown"
      report_status:
        | "new"
        | "reviewing"
        | "confirmed"
        | "rejected"
        | "duplicate"
      risk_level: "safe" | "unknown" | "suspicious" | "high_risk"
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
      app_role: ["admin", "moderator", "user"],
      input_type: [
        "phone",
        "telegram",
        "url",
        "text",
        "payment",
        "apk",
        "unknown",
      ],
      report_status: ["new", "reviewing", "confirmed", "rejected", "duplicate"],
      risk_level: ["safe", "unknown", "suspicious", "high_risk"],
    },
  },
} as const
