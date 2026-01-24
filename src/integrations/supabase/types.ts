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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_secret: boolean | null
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_secret?: boolean | null
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_secret?: boolean | null
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      asset_categories: {
        Row: {
          created_at: string
          depreciation_rate: number | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
          useful_life_years: number | null
        }
        Insert: {
          created_at?: string
          depreciation_rate?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
          useful_life_years?: number | null
        }
        Update: {
          created_at?: string
          depreciation_rate?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          useful_life_years?: number | null
        }
        Relationships: []
      }
      carnes: {
        Row: {
          asaas_installment_id: string
          contract_id: string | null
          created_at: string
          description: string
          enrollment_id: string | null
          first_due_date: string
          guardian_id: string
          id: string
          installment_count: number
          status: string
          total_value: number
          updated_at: string
        }
        Insert: {
          asaas_installment_id: string
          contract_id?: string | null
          created_at?: string
          description: string
          enrollment_id?: string | null
          first_due_date: string
          guardian_id: string
          id?: string
          installment_count: number
          status?: string
          total_value: number
          updated_at?: string
        }
        Update: {
          asaas_installment_id?: string
          contract_id?: string | null
          created_at?: string
          description?: string
          enrollment_id?: string | null
          first_due_date?: string
          guardian_id?: string
          id?: string
          installment_count?: number
          status?: string
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carnes_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carnes_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carnes_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
        ]
      }
      class_groups: {
        Row: {
          course_id: string
          created_at: string
          current_students: number | null
          id: string
          is_active: boolean | null
          max_students: number | null
          name: string
          schedule_id: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          current_students?: number | null
          id?: string
          is_active?: boolean | null
          max_students?: number | null
          name: string
          schedule_id: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          current_students?: number | null
          id?: string
          is_active?: boolean | null
          max_students?: number | null
          name?: string
          schedule_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_groups_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_groups_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_clauses: {
        Row: {
          clause_order: number
          content: string
          created_at: string
          id: string
          is_active: boolean | null
          title: string
          updated_at: string
        }
        Insert: {
          clause_order: number
          content: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          title: string
          updated_at?: string
        }
        Update: {
          clause_order?: number
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_config: {
        Row: {
          created_at: string
          id: string
          school_address: string
          school_cnpj: string
          school_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          school_address: string
          school_cnpj: string
          school_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          school_address?: string
          school_cnpj?: string
          school_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          contract_content: Json
          course_id: string
          created_at: string
          enrollment_id: string
          guardian_id: string
          id: string
          installment_count: number | null
          signed_at: string | null
          status: string
          student_id: string
          total_value: number
        }
        Insert: {
          contract_content: Json
          course_id: string
          created_at?: string
          enrollment_id: string
          guardian_id: string
          id?: string
          installment_count?: number | null
          signed_at?: string | null
          status?: string
          student_id: string
          total_value: number
        }
        Update: {
          contract_content?: Json
          course_id?: string
          created_at?: string
          enrollment_id?: string
          guardian_id?: string
          id?: string
          installment_count?: number | null
          signed_at?: string | null
          status?: string
          student_id?: string
          total_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "contracts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          contract_duration_months: number | null
          created_at: string
          description: string | null
          duration: string
          id: string
          is_active: boolean | null
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          contract_duration_months?: number | null
          created_at?: string
          description?: string | null
          duration: string
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          contract_duration_months?: number | null
          created_at?: string
          description?: string | null
          duration?: string
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      discounts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          type?: string
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          type?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          class_group_id: string
          contract_generated: boolean | null
          contract_signed_at: string | null
          created_at: string
          enrollment_date: string
          guardian_id: string
          id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          class_group_id: string
          contract_generated?: boolean | null
          contract_signed_at?: string | null
          created_at?: string
          enrollment_date?: string
          guardian_id: string
          id?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          class_group_id?: string
          contract_generated?: boolean | null
          contract_signed_at?: string | null
          created_at?: string
          enrollment_date?: string
          guardian_id?: string
          id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_group_id_fkey"
            columns: ["class_group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_assets: {
        Row: {
          acquisition_date: string
          acquisition_value: number
          category: string
          code: string
          condition: string
          created_at: string
          current_value: number | null
          depreciation_rate: number | null
          description: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          status: string
          updated_at: string
          useful_life_years: number | null
        }
        Insert: {
          acquisition_date: string
          acquisition_value: number
          category: string
          code: string
          condition?: string
          created_at?: string
          current_value?: number | null
          depreciation_rate?: number | null
          description?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
          useful_life_years?: number | null
        }
        Update: {
          acquisition_date?: string
          acquisition_value?: number
          category?: string
          code?: string
          condition?: string
          created_at?: string
          current_value?: number | null
          depreciation_rate?: number | null
          description?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          useful_life_years?: number | null
        }
        Relationships: []
      }
      guardians: {
        Row: {
          address: string
          address_number: string | null
          asaas_customer_id: string | null
          cpf: string
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          postal_code: string | null
          province: string | null
          updated_at: string
        }
        Insert: {
          address: string
          address_number?: string | null
          asaas_customer_id?: string | null
          cpf: string
          created_at?: string
          email: string
          id?: string
          name: string
          phone: string
          postal_code?: string | null
          province?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          address_number?: string | null
          asaas_customer_id?: string | null
          cpf?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          postal_code?: string | null
          province?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          converted_at: string | null
          created_at: string
          email: string | null
          enrollment_id: string | null
          id: string
          interested_course_id: string | null
          name: string
          notes: string | null
          phone: string
          source: string | null
          status: string
          student_birth_date: string | null
          student_name: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          enrollment_id?: string | null
          id?: string
          interested_course_id?: string | null
          name: string
          notes?: string | null
          phone: string
          source?: string | null
          status?: string
          student_birth_date?: string | null
          student_name?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          enrollment_id?: string | null
          id?: string
          interested_course_id?: string | null
          name?: string
          notes?: string | null
          phone?: string
          source?: string | null
          status?: string
          student_birth_date?: string | null
          student_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_interested_course_id_fkey"
            columns: ["interested_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_credentials: {
        Row: {
          completed_lessons: number | null
          completion_percentage: number | null
          created_at: string
          current_lesson: string | null
          current_level: string | null
          current_module: string | null
          email: string
          enrollment_id: string | null
          id: string
          last_sync_at: string | null
          lms_user_id: string | null
          matricula: string
          password: string
          student_id: string
          total_lessons: number | null
          updated_at: string
        }
        Insert: {
          completed_lessons?: number | null
          completion_percentage?: number | null
          created_at?: string
          current_lesson?: string | null
          current_level?: string | null
          current_module?: string | null
          email: string
          enrollment_id?: string | null
          id?: string
          last_sync_at?: string | null
          lms_user_id?: string | null
          matricula: string
          password: string
          student_id: string
          total_lessons?: number | null
          updated_at?: string
        }
        Update: {
          completed_lessons?: number | null
          completion_percentage?: number | null
          created_at?: string
          current_lesson?: string | null
          current_level?: string | null
          current_module?: string | null
          email?: string
          enrollment_id?: string | null
          id?: string
          last_sync_at?: string | null
          lms_user_id?: string | null
          matricula?: string
          password?: string
          student_id?: string
          total_lessons?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_credentials_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_credentials_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          asaas_installment_id: string | null
          asaas_payment_id: string | null
          bank_slip_url: string | null
          billing_type: string | null
          contract_id: string | null
          created_at: string
          description: string
          due_date: string
          enrollment_id: string | null
          external_reference: string | null
          guardian_id: string
          id: string
          installment_number: number | null
          invoice_url: string | null
          payment_date: string | null
          status: string
          updated_at: string
          value: number
        }
        Insert: {
          asaas_installment_id?: string | null
          asaas_payment_id?: string | null
          bank_slip_url?: string | null
          billing_type?: string | null
          contract_id?: string | null
          created_at?: string
          description: string
          due_date: string
          enrollment_id?: string | null
          external_reference?: string | null
          guardian_id: string
          id?: string
          installment_number?: number | null
          invoice_url?: string | null
          payment_date?: string | null
          status?: string
          updated_at?: string
          value: number
        }
        Update: {
          asaas_installment_id?: string | null
          asaas_payment_id?: string | null
          bank_slip_url?: string | null
          billing_type?: string | null
          contract_id?: string | null
          created_at?: string
          description?: string
          due_date?: string
          enrollment_id?: string | null
          external_reference?: string | null
          guardian_id?: string
          id?: string
          installment_number?: number | null
          invoice_url?: string | null
          payment_date?: string | null
          status?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          permissions: Json | null
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          permissions?: Json | null
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          permissions?: Json | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          available_slots: number | null
          course_id: string
          created_at: string
          day_of_week: string
          end_time: string
          id: string
          start_time: string
        }
        Insert: {
          available_slots?: number | null
          course_id: string
          created_at?: string
          day_of_week: string
          end_time: string
          id?: string
          start_time: string
        }
        Update: {
          available_slots?: number | null
          course_id?: string
          created_at?: string
          day_of_week?: string
          end_time?: string
          id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      soroban_credentials: {
        Row: {
          completion_percentage: number | null
          created_at: string
          current_level: number | null
          current_module: string | null
          email: string
          enrollment_id: string | null
          id: string
          last_sync_at: string | null
          matricula: string
          password: string
          soroban_user_id: string | null
          student_id: string | null
          updated_at: string
        }
        Insert: {
          completion_percentage?: number | null
          created_at?: string
          current_level?: number | null
          current_module?: string | null
          email: string
          enrollment_id?: string | null
          id?: string
          last_sync_at?: string | null
          matricula: string
          password: string
          soroban_user_id?: string | null
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          completion_percentage?: number | null
          created_at?: string
          current_level?: number | null
          current_module?: string | null
          email?: string
          enrollment_id?: string | null
          id?: string
          last_sync_at?: string | null
          matricula?: string
          password?: string
          soroban_user_id?: string | null
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "soroban_credentials_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soroban_credentials_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          birth_date: string
          created_at: string
          guardian_id: string
          id: string
          is_active: boolean
          name: string
          sex: string | null
          updated_at: string
        }
        Insert: {
          birth_date: string
          created_at?: string
          guardian_id: string
          id?: string
          is_active?: boolean
          name: string
          sex?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string
          created_at?: string
          guardian_id?: string
          id?: string
          is_active?: boolean
          name?: string
          sex?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { _user_id: string }; Returns: boolean }
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
