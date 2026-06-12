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
      claves_log: {
        Row: {
          clave: string
          created_at: string
          descripcion: string
          id: string
          indicativo_recurso: string
          servicio_id: string
        }
        Insert: {
          clave: string
          created_at?: string
          descripcion: string
          id?: string
          indicativo_recurso: string
          servicio_id: string
        }
        Update: {
          clave?: string
          created_at?: string
          descripcion?: string
          id?: string
          indicativo_recurso?: string
          servicio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claves_log_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      historial: {
        Row: {
          fecha: string
          id: string
          numero: number
          pdf_url: string | null
          resumen: Json | null
        }
        Insert: {
          fecha?: string
          id?: string
          numero: number
          pdf_url?: string | null
          resumen?: Json | null
        }
        Update: {
          fecha?: string
          id?: string
          numero?: number
          pdf_url?: string | null
          resumen?: Json | null
        }
        Relationships: []
      }
      intervinientes: {
        Row: {
          created_at: string
          funcion: string
          id: string
          indicativo_intervinientes: string
          indicativo_recurso: string
          servicio_id: string
          subtipo: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          funcion: string
          id?: string
          indicativo_intervinientes: string
          indicativo_recurso: string
          servicio_id: string
          subtipo?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          funcion?: string
          id?: string
          indicativo_intervinientes?: string
          indicativo_recurso?: string
          servicio_id?: string
          subtipo?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervinientes_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      servicios: {
        Row: {
          created_at: string
          estado: string
          finished_at: string | null
          id: string
          mando_indicativo: string | null
          numero: number
        }
        Insert: {
          created_at?: string
          estado?: string
          finished_at?: string | null
          id?: string
          mando_indicativo?: string | null
          numero: number
        }
        Update: {
          created_at?: string
          estado?: string
          finished_at?: string | null
          id?: string
          mando_indicativo?: string | null
          numero?: number
        }
        Relationships: []
      }
      stickers: {
        Row: {
          c2_at: string | null
          c3_at: string | null
          clave: string
          created_at: string
          dashed: boolean
          id: string
          interviniente_id: string
          lat: number | null
          lng: number | null
          panel: string
          removed: boolean
          servicio_id: string
          updated_at: string
          x: number
          y: number
        }
        Insert: {
          c2_at?: string | null
          c3_at?: string | null
          clave?: string
          created_at?: string
          dashed?: boolean
          id?: string
          interviniente_id: string
          lat?: number | null
          lng?: number | null
          panel: string
          removed?: boolean
          servicio_id: string
          updated_at?: string
          x?: number
          y?: number
        }
        Update: {
          c2_at?: string | null
          c3_at?: string | null
          clave?: string
          created_at?: string
          dashed?: boolean
          id?: string
          interviniente_id?: string
          lat?: number | null
          lng?: number | null
          panel?: string
          removed?: boolean
          servicio_id?: string
          updated_at?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "stickers_interviniente_id_fkey"
            columns: ["interviniente_id"]
            isOneToOne: false
            referencedRelation: "intervinientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stickers_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      zonas: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          nombre: string
          puntos: Json
          servicio_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nombre?: string
          puntos?: Json
          servicio_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nombre?: string
          puntos?: Json
          servicio_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
