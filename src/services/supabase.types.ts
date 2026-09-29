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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          created_at: string
          email: string | null
          event_date: string | null
          event_type: string | null
          id: string
          message: string | null
          name: string
          phone: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_date?: string | null
          event_type?: string | null
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          event_date?: string | null
          event_type?: string | null
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          status?: string
        }
        Relationships: []
      }
      client_sessions: {
        Row: {
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          device_info: string | null
          gallery_id: string
          id: string
          last_seen_at: string
          notes: string | null
          recovery_code: string | null
          selected_count: number
          session_token: string
          status: string
          submitted_at: string | null
          user_id: string | null
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          device_info?: string | null
          gallery_id: string
          id?: string
          last_seen_at?: string
          notes?: string | null
          recovery_code?: string | null
          selected_count?: number
          session_token?: string
          status?: string
          submitted_at?: string | null
          user_id?: string | null
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          device_info?: string | null
          gallery_id?: string
          id?: string
          last_seen_at?: string
          notes?: string | null
          recovery_code?: string | null
          selected_count?: number
          session_token?: string
          status?: string
          submitted_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_sessions_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
        ]
      }
      galleries: {
        Row: {
          allow_downloads: boolean
          allow_editing: boolean
          ask_customer_name: boolean
          ask_customer_phone: boolean
          client_email: string | null
          client_name: string | null
          client_notes: string | null
          client_phone: string | null
          collected_folder_id: string | null
          cover_photo_url: string | null
          created_at: string
          created_by: string | null
          drive_account: string | null
          drive_folder_id: string | null
          drive_folder_name: string | null
          event_date: string | null
          event_name: string | null
          gallery_name: string | null
          id: string
          include_subfolders: boolean
          legacy_id: string | null
          notes_for_customer: string | null
          pin_enabled: boolean
          pin_hash: string | null
          secure_token: string
          selected_count: number
          selection_deadline: string | null
          selection_limit: number | null
          status: string
          submitted_at: string | null
          title: string
          total_photos: number
          updated_at: string
          zip_admin_notes: string | null
          zip_download_url: string | null
          zip_fulfilled_at: string | null
          zip_request_email: string | null
          zip_request_notes: string | null
          zip_request_phone: string | null
          zip_request_status: string | null
          zip_requested: boolean
          zip_requested_at: string | null
          zip_requested_count: number | null
        }
        Insert: {
          allow_downloads?: boolean
          allow_editing?: boolean
          ask_customer_name?: boolean
          ask_customer_phone?: boolean
          client_email?: string | null
          client_name?: string | null
          client_notes?: string | null
          client_phone?: string | null
          collected_folder_id?: string | null
          cover_photo_url?: string | null
          created_at?: string
          created_by?: string | null
          drive_account?: string | null
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          event_date?: string | null
          event_name?: string | null
          gallery_name?: string | null
          id?: string
          include_subfolders?: boolean
          legacy_id?: string | null
          notes_for_customer?: string | null
          pin_enabled?: boolean
          pin_hash?: string | null
          secure_token?: string
          selected_count?: number
          selection_deadline?: string | null
          selection_limit?: number | null
          status?: string
          submitted_at?: string | null
          title: string
          total_photos?: number
          updated_at?: string
          zip_admin_notes?: string | null
          zip_download_url?: string | null
          zip_fulfilled_at?: string | null
          zip_request_email?: string | null
          zip_request_notes?: string | null
          zip_request_phone?: string | null
          zip_request_status?: string | null
          zip_requested?: boolean
          zip_requested_at?: string | null
          zip_requested_count?: number | null
        }
        Update: {
          allow_downloads?: boolean
          allow_editing?: boolean
          ask_customer_name?: boolean
          ask_customer_phone?: boolean
          client_email?: string | null
          client_name?: string | null
          client_notes?: string | null
          client_phone?: string | null
          collected_folder_id?: string | null
          cover_photo_url?: string | null
          created_at?: string
          created_by?: string | null
          drive_account?: string | null
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          event_date?: string | null
          event_name?: string | null
          gallery_name?: string | null
          id?: string
          include_subfolders?: boolean
          legacy_id?: string | null
          notes_for_customer?: string | null
          pin_enabled?: boolean
          pin_hash?: string | null
          secure_token?: string
          selected_count?: number
          selection_deadline?: string | null
          selection_limit?: number | null
          status?: string
          submitted_at?: string | null
          title?: string
          total_photos?: number
          updated_at?: string
          zip_admin_notes?: string | null
          zip_download_url?: string | null
          zip_fulfilled_at?: string | null
          zip_request_email?: string | null
          zip_request_notes?: string | null
          zip_request_phone?: string | null
          zip_request_status?: string | null
          zip_requested?: boolean
          zip_requested_at?: string | null
          zip_requested_count?: number | null
        }
        Relationships: []
      }
      gallery_access: {
        Row: {
          created_at: string
          gallery_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gallery_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          gallery_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_access_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
        ]
      }
      photographer_profiles: {
        Row: {
          display_name: string | null
          drive_connected: boolean
          email: string | null
          last_connected_at: string | null
          scopes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          display_name?: string | null
          drive_connected?: boolean
          email?: string | null
          last_connected_at?: string | null
          scopes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          display_name?: string | null
          drive_connected?: boolean
          email?: string | null
          last_connected_at?: string | null
          scopes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      photos: {
        Row: {
          created_at: string
          download_url: string | null
          drive_created_time: string | null
          drive_file_id: string
          file_name: string
          folder_id: string | null
          gallery_id: string
          height: number | null
          id: string
          mime_type: string | null
          preview_url: string | null
          size_text: string | null
          sort_order: number
          thumbnail_url: string | null
          width: number | null
        }
        Insert: {
          created_at?: string
          download_url?: string | null
          drive_created_time?: string | null
          drive_file_id: string
          file_name: string
          folder_id?: string | null
          gallery_id: string
          height?: number | null
          id?: string
          mime_type?: string | null
          preview_url?: string | null
          size_text?: string | null
          sort_order?: number
          thumbnail_url?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string
          download_url?: string | null
          drive_created_time?: string | null
          drive_file_id?: string
          file_name?: string
          folder_id?: string | null
          gallery_id?: string
          height?: number | null
          id?: string
          mime_type?: string | null
          preview_url?: string | null
          size_text?: string | null
          sort_order?: number
          thumbnail_url?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
        ]
      }
      selection_history: {
        Row: {
          action: string
          affected_photo_id: string | null
          affected_photo_name: string | null
          client_name: string | null
          created_at: string
          description: string
          gallery_id: string
          id: string
          selected_count: number
          selected_photo_ids: string[]
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          affected_photo_id?: string | null
          affected_photo_name?: string | null
          client_name?: string | null
          created_at?: string
          description: string
          gallery_id: string
          id?: string
          selected_count?: number
          selected_photo_ids?: string[]
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          affected_photo_id?: string | null
          affected_photo_name?: string | null
          client_name?: string | null
          created_at?: string
          description?: string
          gallery_id?: string
          id?: string
          selected_count?: number
          selected_photo_ids?: string[]
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "selection_history_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selection_history_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "client_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      selections: {
        Row: {
          created_at: string
          drive_file_id: string | null
          file_name: string | null
          gallery_id: string
          id: string
          photo_id: string
          selected: boolean
          selected_at: string
          selection_order: number
          session_token: string
          thumbnail_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          drive_file_id?: string | null
          file_name?: string | null
          gallery_id: string
          id?: string
          photo_id: string
          selected?: boolean
          selected_at?: string
          selection_order?: number
          session_token: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          drive_file_id?: string | null
          file_name?: string | null
          gallery_id?: string
          id?: string
          photo_id?: string
          selected?: boolean
          selected_at?: string
          selection_order?: number
          session_token?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "selections_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selections_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_gallery_access: { Args: { p_identifier: string }; Returns: string }
      client_request_zip: {
        Args: {
          p_email: string
          p_gallery_id: string
          p_notes: string
          p_phone: string
          p_selected_count: number
        }
        Returns: undefined
      }
      client_set_gallery_state: {
        Args: {
          p_client_notes?: string
          p_gallery_id: string
          p_selected_count: number
          p_status: string
        }
        Returns: undefined
      }
      recover_client_session: {
        Args: { p_identifier: string; p_recovery_code: string }
        Returns: {
          client_name: string
          client_phone: string
          created_at: string
          device_info: string
          gallery_id: string
          id: string
          last_seen_at: string
          notes: string
          recovery_code: string
          selected_count: number
          session_token: string
          status: string
          submitted_at: string
        }[]
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
