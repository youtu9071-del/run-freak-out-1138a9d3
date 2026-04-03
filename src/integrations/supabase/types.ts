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
      challenge_results: {
        Row: {
          challenge_id: string
          completed: boolean | null
          created_at: string | null
          distance_km: number | null
          freak_points: number | null
          id: string
          time_seconds: number | null
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean | null
          created_at?: string | null
          distance_km?: number | null
          freak_points?: number | null
          id?: string
          time_seconds?: number | null
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean | null
          created_at?: string | null
          distance_km?: number | null
          freak_points?: number | null
          id?: string
          time_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_results_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string | null
          distance_km: number
          id: string
          status: Database["public"]["Enums"]["challenge_status"] | null
          team_a_avg_time: number | null
          team_a_id: string
          team_b_avg_time: number | null
          team_b_id: string
          time_limit_hours: number | null
          winner_team_id: string | null
        }
        Insert: {
          created_at?: string | null
          distance_km?: number
          id?: string
          status?: Database["public"]["Enums"]["challenge_status"] | null
          team_a_avg_time?: number | null
          team_a_id: string
          team_b_avg_time?: number | null
          team_b_id: string
          time_limit_hours?: number | null
          winner_team_id?: string | null
        }
        Update: {
          created_at?: string | null
          distance_km?: number
          id?: string
          status?: Database["public"]["Enums"]["challenge_status"] | null
          team_a_avg_time?: number | null
          team_a_id?: string
          team_b_avg_time?: number | null
          team_b_id?: string
          time_limit_hours?: number | null
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenges_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          completed: boolean
          completed_at: string | null
          distance_completed: number
          event_id: string
          fp_earned: number
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          distance_completed?: number
          event_id: string
          fp_earned?: number
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          distance_completed?: number
          event_id?: string
          fp_earned?: number
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          bonus_description: string | null
          created_at: string
          description: string | null
          distance_km: number
          end_date: string
          id: string
          image_url: string | null
          max_participants: number | null
          reward_fp: number
          start_date: string
          status: string
          title: string
        }
        Insert: {
          bonus_description?: string | null
          created_at?: string
          description?: string | null
          distance_km?: number
          end_date: string
          id?: string
          image_url?: string | null
          max_participants?: number | null
          reward_fp?: number
          start_date: string
          status?: string
          title: string
        }
        Update: {
          bonus_description?: string | null
          created_at?: string
          description?: string | null
          distance_km?: number
          end_date?: string
          id?: string
          image_url?: string | null
          max_participants?: number | null
          reward_fp?: number
          start_date?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      followers: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          discount_amount: number
          fp_used: number
          id: string
          product_id: string
          quantity: number
          status: string
          total_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          discount_amount?: number
          fp_used?: number
          id?: string
          product_id: string
          quantity?: number
          status?: string
          total_price: number
          user_id: string
        }
        Update: {
          created_at?: string
          discount_amount?: number
          fp_used?: number
          id?: string
          product_id?: string
          quantity?: number
          status?: string
          total_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          fp_discount_rate: number | null
          id: string
          image_url: string | null
          in_stock: boolean | null
          max_fp_discount: number | null
          name: string
          price: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          fp_discount_rate?: number | null
          id?: string
          image_url?: string | null
          in_stock?: boolean | null
          max_fp_discount?: number | null
          name: string
          price: number
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          fp_discount_rate?: number | null
          id?: string
          image_url?: string | null
          in_stock?: boolean | null
          max_fp_discount?: number | null
          name?: string
          price?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string | null
          fitness_level: Database["public"]["Enums"]["fitness_level"] | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          goal: Database["public"]["Enums"]["fitness_goal"] | null
          id: string
          onboarding_completed: boolean | null
          total_activities: number | null
          total_fp: number | null
          total_km: number | null
          total_steps: number | null
          updated_at: string | null
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          fitness_level?: Database["public"]["Enums"]["fitness_level"] | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          goal?: Database["public"]["Enums"]["fitness_goal"] | null
          id?: string
          onboarding_completed?: boolean | null
          total_activities?: number | null
          total_fp?: number | null
          total_km?: number | null
          total_steps?: number | null
          updated_at?: string | null
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          fitness_level?: Database["public"]["Enums"]["fitness_level"] | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          goal?: Database["public"]["Enums"]["fitness_goal"] | null
          id?: string
          onboarding_completed?: boolean | null
          total_activities?: number | null
          total_fp?: number | null
          total_km?: number | null
          total_steps?: number | null
          updated_at?: string | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          invited_by: string | null
          status: Database["public"]["Enums"]["member_status"] | null
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          status?: Database["public"]["Enums"]["member_status"] | null
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          status?: Database["public"]["Enums"]["member_status"] | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          creator_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          creator_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          creator_id?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_activities: {
        Row: {
          avg_speed: number | null
          calories: number | null
          created_at: string | null
          distance_km: number
          duration_seconds: number
          fp_from_km: number | null
          fp_from_steps: number | null
          gps_points: Json | null
          id: string
          integrity_status:
            | Database["public"]["Enums"]["integrity_status"]
            | null
          steps: number
          total_fp: number | null
          user_id: string
        }
        Insert: {
          avg_speed?: number | null
          calories?: number | null
          created_at?: string | null
          distance_km?: number
          duration_seconds?: number
          fp_from_km?: number | null
          fp_from_steps?: number | null
          gps_points?: Json | null
          id?: string
          integrity_status?:
            | Database["public"]["Enums"]["integrity_status"]
            | null
          steps?: number
          total_fp?: number | null
          user_id: string
        }
        Update: {
          avg_speed?: number | null
          calories?: number | null
          created_at?: string | null
          distance_km?: number
          duration_seconds?: number
          fp_from_km?: number | null
          fp_from_steps?: number | null
          gps_points?: Json | null
          id?: string
          integrity_status?:
            | Database["public"]["Enums"]["integrity_status"]
            | null
          steps?: number
          total_fp?: number | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_team_member_count: { Args: { p_team_id: string }; Returns: number }
      is_team_member: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      update_profile_stats: { Args: { p_user_id: string }; Returns: undefined }
    }
    Enums: {
      challenge_status: "pending" | "active" | "completed"
      fitness_goal: "perdre_poids" | "endurance" | "performance" | "bien_etre"
      fitness_level: "debutant" | "intermediaire" | "avance" | "pro"
      gender_type: "homme" | "femme"
      integrity_status: "clean" | "suspect" | "fraud"
      member_status: "invited" | "accepted"
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
      challenge_status: ["pending", "active", "completed"],
      fitness_goal: ["perdre_poids", "endurance", "performance", "bien_etre"],
      fitness_level: ["debutant", "intermediaire", "avance", "pro"],
      gender_type: ["homme", "femme"],
      integrity_status: ["clean", "suspect", "fraud"],
      member_status: ["invited", "accepted"],
    },
  },
} as const
