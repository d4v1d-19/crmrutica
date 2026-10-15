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
      client_billing: {
        Row: {
          actividad_economica: string | null
          canton: string | null
          cedula: string | null
          client_id: string
          direccion_fiscal: string | null
          distrito: string | null
          email: string | null
          empresa: string | null
          nombre_comercial: string | null
          nombre_completo: string | null
          provincia: string | null
          razon_social: string | null
          telefono: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          actividad_economica?: string | null
          canton?: string | null
          cedula?: string | null
          client_id: string
          direccion_fiscal?: string | null
          distrito?: string | null
          email?: string | null
          empresa?: string | null
          nombre_comercial?: string | null
          nombre_completo?: string | null
          provincia?: string | null
          razon_social?: string | null
          telefono?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          actividad_economica?: string | null
          canton?: string | null
          cedula?: string | null
          client_id?: string
          direccion_fiscal?: string | null
          distrito?: string | null
          email?: string | null
          empresa?: string | null
          nombre_comercial?: string | null
          nombre_completo?: string | null
          provincia?: string | null
          razon_social?: string | null
          telefono?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_billing_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          agente_id: string | null
          canal: string
          codigo: string
          company: string | null
          created_at: string
          dni: string | null
          email: string | null
          estado: string
          id: string
          medida_interes: string | null
          name: string
          notas: string | null
          pais: string | null
          phone: string | null
          tipo_facturacion: string
          user_id: string
        }
        Insert: {
          agente_id?: string | null
          canal?: string
          codigo?: string
          company?: string | null
          created_at?: string
          dni?: string | null
          email?: string | null
          estado?: string
          id?: string
          medida_interes?: string | null
          name: string
          notas?: string | null
          pais?: string | null
          phone?: string | null
          tipo_facturacion?: string
          user_id: string
        }
        Update: {
          agente_id?: string | null
          canal?: string
          codigo?: string
          company?: string | null
          created_at?: string
          dni?: string | null
          email?: string | null
          estado?: string
          id?: string
          medida_interes?: string | null
          name?: string
          notas?: string | null
          pais?: string | null
          phone?: string | null
          tipo_facturacion?: string
          user_id?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          actividad_economica: string | null
          cedula_juridica: string | null
          correo: string | null
          direccion: string | null
          id: number
          logo_url: string | null
          nombre: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          actividad_economica?: string | null
          cedula_juridica?: string | null
          correo?: string | null
          direccion?: string | null
          id?: number
          logo_url?: string | null
          nombre?: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          actividad_economica?: string | null
          cedula_juridica?: string | null
          correo?: string | null
          direccion?: string | null
          id?: number
          logo_url?: string | null
          nombre?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      form_fields: {
        Row: {
          etiqueta: string
          form_id: string
          id: string
          mapea_a_campo_cliente: string | null
          obligatorio: boolean
          opciones: Json | null
          orden: number
          regla_condicional: Json | null
          tipo: string
          variable: string
        }
        Insert: {
          etiqueta: string
          form_id: string
          id?: string
          mapea_a_campo_cliente?: string | null
          obligatorio?: boolean
          opciones?: Json | null
          orden?: number
          regla_condicional?: Json | null
          tipo: string
          variable: string
        }
        Update: {
          etiqueta?: string
          form_id?: string
          id?: string
          mapea_a_campo_cliente?: string | null
          obligatorio?: boolean
          opciones?: Json | null
          orden?: number
          regla_condicional?: Json | null
          tipo?: string
          variable?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          client_id: string | null
          created_at: string
          data: Json
          email_error: string | null
          email_estado: string
          form_id: string
          id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          data?: Json
          email_error?: string | null
          email_estado?: string
          form_id: string
          id?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          data?: Json
          email_error?: string | null
          email_estado?: string
          form_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          activo: boolean
          crea_cliente: boolean
          created_at: string
          created_by: string | null
          descripcion: string | null
          email_notificacion: string | null
          id: string
          plantilla_correo: string | null
          slug: string
          titulo: string
          validaciones: Json
        }
        Insert: {
          activo?: boolean
          crea_cliente?: boolean
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          email_notificacion?: string | null
          id?: string
          plantilla_correo?: string | null
          slug: string
          titulo: string
          validaciones?: Json
        }
        Update: {
          activo?: boolean
          crea_cliente?: boolean
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          email_notificacion?: string | null
          id?: string
          plantilla_correo?: string | null
          slug?: string
          titulo?: string
          validaciones?: Json
        }
        Relationships: []
      }
      invoices: {
        Row: {
          agente_id: string | null
          client_id: string
          created_at: string
          fecha_vencimiento: string | null
          id: string
          moneda: string
          numero: string
          quote_id: string | null
          snapshot: Json
          total: number
        }
        Insert: {
          agente_id?: string | null
          client_id: string
          created_at?: string
          fecha_vencimiento?: string | null
          id?: string
          moneda?: string
          numero?: string
          quote_id?: string | null
          snapshot: Json
          total?: number
        }
        Update: {
          agente_id?: string | null
          client_id?: string
          created_at?: string
          fecha_vencimiento?: string | null
          id?: string
          moneda?: string
          numero?: string
          quote_id?: string | null
          snapshot?: Json
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes_view"
            referencedColumns: ["id"]
          },
        ]
      }
      package_variables: {
        Row: {
          descripcion: string | null
          id: string
          monto: number
          nombre: string
          orden: number
          package_id: string
          unidad: string
        }
        Insert: {
          descripcion?: string | null
          id?: string
          monto?: number
          nombre: string
          orden?: number
          package_id: string
          unidad?: string
        }
        Update: {
          descripcion?: string | null
          id?: string
          monto?: number
          nombre?: string
          orden?: number
          package_id?: string
          unidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_variables_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          cenas_por_persona: number
          created_at: string
          desayunos_por_persona: number
          dias: number
          id: string
          incluye_cena: boolean
          incluye_desayuno: boolean
          incluye_hospedaje: boolean
          meriendas_por_persona: number
          moneda: string
          noches: number
          precio_4x4: number
          precio_barco: number
          titulo: string
          transporte_4x4: boolean
          transporte_barco: boolean
          unidad_4x4: string
          unidad_barco: string
        }
        Insert: {
          cenas_por_persona?: number
          created_at?: string
          desayunos_por_persona?: number
          dias?: number
          id?: string
          incluye_cena?: boolean
          incluye_desayuno?: boolean
          incluye_hospedaje?: boolean
          meriendas_por_persona?: number
          moneda?: string
          noches?: number
          precio_4x4?: number
          precio_barco?: number
          titulo: string
          transporte_4x4?: boolean
          transporte_barco?: boolean
          unidad_4x4?: string
          unidad_barco?: string
        }
        Update: {
          cenas_por_persona?: number
          created_at?: string
          desayunos_por_persona?: number
          dias?: number
          id?: string
          incluye_cena?: boolean
          incluye_desayuno?: boolean
          incluye_hospedaje?: boolean
          meriendas_por_persona?: number
          moneda?: string
          noches?: number
          precio_4x4?: number
          precio_barco?: number
          titulo?: string
          transporte_4x4?: boolean
          transporte_barco?: boolean
          unidad_4x4?: string
          unidad_barco?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          created_at: string
          fecha: string
          id: string
          invoice_id: string
          metodo: string
          monto: number
          nota: string | null
          registrado_por: string | null
          registrado_por_nombre: string | null
        }
        Insert: {
          created_at?: string
          fecha?: string
          id?: string
          invoice_id: string
          metodo: string
          monto: number
          nota?: string | null
          registrado_por?: string | null
          registrado_por_nombre?: string | null
        }
        Update: {
          created_at?: string
          fecha?: string
          id?: string
          invoice_id?: string
          metodo?: string
          monto?: number
          nota?: string | null
          registrado_por?: string | null
          registrado_por_nombre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      percentages: {
        Row: {
          aplica_a: string[]
          aplicar_por_defecto: boolean
          created_at: string
          id: string
          nombre: string
          porcion: number
        }
        Insert: {
          aplica_a?: string[]
          aplicar_por_defecto?: boolean
          created_at?: string
          id?: string
          nombre: string
          porcion: number
        }
        Update: {
          aplica_a?: string[]
          aplicar_por_defecto?: boolean
          created_at?: string
          id?: string
          nombre?: string
          porcion?: number
        }
        Relationships: []
      }
      price_settings: {
        Row: {
          cena: number
          desayuno: number
          entrada_extranjero: number
          entrada_nacional: number
          hospedaje: number
          id: number
          merienda: number
          moneda: string
          updated_at: string
          updated_by: string | null
          updated_by_nombre: string | null
        }
        Insert: {
          cena?: number
          desayuno?: number
          entrada_extranjero?: number
          entrada_nacional?: number
          hospedaje?: number
          id?: number
          merienda?: number
          moneda?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_nombre?: string | null
        }
        Update: {
          cena?: number
          desayuno?: number
          entrada_extranjero?: number
          entrada_nacional?: number
          hospedaje?: number
          id?: number
          merienda?: number
          moneda?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_nombre?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activo: boolean
          comision_porcentaje: number
          created_at: string
          email: string | null
          id: string
          nombre: string | null
        }
        Insert: {
          activo?: boolean
          comision_porcentaje?: number
          created_at?: string
          email?: string | null
          id: string
          nombre?: string | null
        }
        Update: {
          activo?: boolean
          comision_porcentaje?: number
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          agente_id: string | null
          client_id: string
          created_at: string
          estado: string
          fecha_envio: string | null
          fecha_vencimiento: string | null
          id: string
          moneda: string
          snapshot: Json
          total: number
        }
        Insert: {
          agente_id?: string | null
          client_id: string
          created_at?: string
          estado?: string
          fecha_envio?: string | null
          fecha_vencimiento?: string | null
          id?: string
          moneda?: string
          snapshot: Json
          total?: number
        }
        Update: {
          agente_id?: string | null
          client_id?: string
          created_at?: string
          estado?: string
          fecha_envio?: string | null
          fecha_vencimiento?: string | null
          id?: string
          moneda?: string
          snapshot?: Json
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          id: string
          permiso: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permiso: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permiso?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      quotes_view: {
        Row: {
          agente_id: string | null
          client_id: string | null
          created_at: string | null
          estado: string | null
          estado_efectivo: string | null
          fecha_envio: string | null
          fecha_vencimiento: string | null
          id: string | null
          moneda: string | null
          numero: number | null
          snapshot: Json | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      dashboard_agents: {
        Args: never
        Returns: {
          activo: boolean
          comision_porcentaje: number
          email: string
          id: string
          nombre: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_user: { Args: { _user_id: string }; Returns: boolean }
      list_active_agents: {
        Args: never
        Returns: {
          email: string
          id: string
          nombre: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "agente"
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
    Enums: {
      app_role: ["admin", "agente"],
    },
  },
} as const
