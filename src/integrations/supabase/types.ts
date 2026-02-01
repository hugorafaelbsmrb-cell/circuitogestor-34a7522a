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
      attendance_records: {
        Row: {
          attendance_date: string
          checked_in_at: string | null
          class_group_id: string | null
          created_at: string
          enrollment_id: string | null
          expected_time: string
          id: string
          notification_sent_at: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          attendance_date?: string
          checked_in_at?: string | null
          class_group_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          expected_time: string
          id?: string
          notification_sent_at?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          checked_in_at?: string | null
          class_group_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          expected_time?: string
          id?: string
          notification_sent_at?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_class_group_id_fkey"
            columns: ["class_group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_settings: {
        Row: {
          config: Json | null
          created_at: string
          description: string | null
          enabled: boolean | null
          id: string
          key: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          description?: string | null
          enabled?: boolean | null
          id?: string
          key: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          description?: string | null
          enabled?: boolean | null
          id?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      bulk_message_templates: {
        Row: {
          created_at: string
          id: string
          message: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaign_images: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          is_active: boolean
          sort_order: number
          title: string | null
          type: string
          updated_at: string
          url: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string | null
          type?: string
          updated_at?: string
          url: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string | null
          type?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_images_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      canteen_consumptions: {
        Row: {
          consumed_at: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          student_id: string
          total_price: number
          unit_price: number
          week_reference: string
        }
        Insert: {
          consumed_at?: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          student_id: string
          total_price: number
          unit_price: number
          week_reference: string
        }
        Update: {
          consumed_at?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          student_id?: string
          total_price?: number
          unit_price?: number
          week_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "canteen_consumptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "canteen_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canteen_consumptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      canteen_products: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      canteen_weekly_summaries: {
        Row: {
          created_at: string
          guardian_id: string
          id: string
          items_count: number
          payment_status: string
          sent_at: string | null
          status: string
          total_value: number
          updated_at: string
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string
          guardian_id: string
          id?: string
          items_count: number
          payment_status?: string
          sent_at?: string | null
          status?: string
          total_value: number
          updated_at?: string
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string
          guardian_id?: string
          id?: string
          items_count?: number
          payment_status?: string
          sent_at?: string | null
          status?: string
          total_value?: number
          updated_at?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "canteen_weekly_summaries_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
        ]
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
          representative_name: string | null
          representative_signature_url: string | null
          school_address: string
          school_cnpj: string
          school_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          representative_name?: string | null
          representative_signature_url?: string | null
          school_address: string
          school_cnpj: string
          school_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          representative_name?: string | null
          representative_signature_url?: string | null
          school_address?: string
          school_cnpj?: string
          school_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_signature_logs: {
        Row: {
          action: string
          contract_id: string
          created_at: string
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          contract_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          contract_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signature_logs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
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
          signature_hash: string | null
          signature_image: string | null
          signature_token: string | null
          signed_at: string | null
          signed_ip: string | null
          signed_user_agent: string | null
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
          signature_hash?: string | null
          signature_image?: string | null
          signature_token?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          signed_user_agent?: string | null
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
          signature_hash?: string | null
          signature_image?: string | null
          signature_token?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          signed_user_agent?: string | null
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
      email_messages: {
        Row: {
          attachments: Json | null
          body_html: string | null
          body_text: string | null
          cc_addresses: string[] | null
          created_at: string
          direction: string
          folder: string
          from_address: string
          id: string
          is_read: boolean
          is_starred: boolean
          message_id: string
          received_at: string
          subject: string | null
          to_addresses: string[]
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: string[] | null
          created_at?: string
          direction?: string
          folder?: string
          from_address: string
          id?: string
          is_read?: boolean
          is_starred?: boolean
          message_id: string
          received_at?: string
          subject?: string | null
          to_addresses?: string[]
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: string[] | null
          created_at?: string
          direction?: string
          folder?: string
          from_address?: string
          id?: string
          is_read?: boolean
          is_starred?: boolean
          message_id?: string
          received_at?: string
          subject?: string | null
          to_addresses?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      enrollment_schedules: {
        Row: {
          class_group_id: string
          created_at: string
          enrollment_id: string
          id: string
        }
        Insert: {
          class_group_id: string
          created_at?: string
          enrollment_id: string
          id?: string
        }
        Update: {
          class_group_id?: string
          created_at?: string
          enrollment_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_schedules_class_group_id_fkey"
            columns: ["class_group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_schedules_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
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
      guardian_support_tickets: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          course_id: string | null
          created_at: string
          guardian_id: string
          id: string
          notes: string | null
          priority: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          guardian_id: string
          id?: string
          notes?: string | null
          priority?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          guardian_id?: string
          id?: string
          notes?: string | null
          priority?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_support_tickets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_support_tickets_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          address: string
          address_number: string | null
          asaas_customer_id: string | null
          avatar_url: string | null
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
          avatar_url?: string | null
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
          avatar_url?: string | null
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
      homework_reports: {
        Row: {
          created_at: string
          error_message: string | null
          guardian_id: string | null
          id: string
          original_message: string
          processed_content: string
          sent_at: string | null
          status: string
          student_id: string | null
          teacher_id: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          guardian_id?: string | null
          id?: string
          original_message: string
          processed_content: string
          sent_at?: string | null
          status?: string
          student_id?: string | null
          teacher_id?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          guardian_id?: string | null
          id?: string
          original_message?: string
          processed_content?: string
          sent_at?: string | null
          status?: string
          student_id?: string | null
          teacher_id?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homework_reports_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_reports_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_reports_whatsapp_message_id_fkey"
            columns: ["whatsapp_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      iot_devices: {
        Row: {
          category: string
          created_at: string
          id: string
          is_on: boolean | null
          is_online: boolean | null
          last_status: Json | null
          last_sync_at: string | null
          name: string
          room: string | null
          tuya_device_id: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_on?: boolean | null
          is_online?: boolean | null
          last_status?: Json | null
          last_sync_at?: string | null
          name: string
          room?: string | null
          tuya_device_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_on?: boolean | null
          is_online?: boolean | null
          last_status?: Json | null
          last_sync_at?: string | null
          name?: string
          room?: string | null
          tuya_device_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      iot_schedules: {
        Row: {
          action: string
          created_at: string
          days_of_week: number[]
          device_id: string | null
          id: string
          is_active: boolean | null
          name: string
          time: string
          updated_at: string
        }
        Insert: {
          action?: string
          created_at?: string
          days_of_week?: number[]
          device_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          time: string
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          days_of_week?: number[]
          device_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iot_schedules_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "iot_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          avatar_url: string | null
          converted_at: string | null
          created_at: string
          email: string | null
          enrollment_id: string | null
          guardian_address: string | null
          guardian_address_number: string | null
          guardian_cpf: string | null
          guardian_postal_code: string | null
          guardian_province: string | null
          id: string
          interested_course_id: string | null
          name: string
          notes: string | null
          phone: string
          preferred_due_day: number | null
          source: string | null
          status: string
          student_birth_date: string | null
          student_name: string | null
          student_sex: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          avatar_url?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          enrollment_id?: string | null
          guardian_address?: string | null
          guardian_address_number?: string | null
          guardian_cpf?: string | null
          guardian_postal_code?: string | null
          guardian_province?: string | null
          id?: string
          interested_course_id?: string | null
          name: string
          notes?: string | null
          phone: string
          preferred_due_day?: number | null
          source?: string | null
          status?: string
          student_birth_date?: string | null
          student_name?: string | null
          student_sex?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          avatar_url?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          enrollment_id?: string | null
          guardian_address?: string | null
          guardian_address_number?: string | null
          guardian_cpf?: string | null
          guardian_postal_code?: string | null
          guardian_province?: string | null
          id?: string
          interested_course_id?: string | null
          name?: string
          notes?: string | null
          phone?: string
          preferred_due_day?: number | null
          source?: string | null
          status?: string
          student_birth_date?: string | null
          student_name?: string | null
          student_sex?: string | null
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
      message_logs: {
        Row: {
          automation_key: string | null
          error_message: string | null
          guardian_id: string | null
          id: string
          lead_id: string | null
          message_preview: string | null
          phone: string
          sent_at: string
          status: string | null
          template_category: string | null
        }
        Insert: {
          automation_key?: string | null
          error_message?: string | null
          guardian_id?: string | null
          id?: string
          lead_id?: string | null
          message_preview?: string | null
          phone: string
          sent_at?: string
          status?: string | null
          template_category?: string | null
        }
        Update: {
          automation_key?: string | null
          error_message?: string | null
          guardian_id?: string | null
          id?: string
          lead_id?: string | null
          message_preview?: string | null
          phone?: string
          sent_at?: string
          status?: string | null
          template_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_logs_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
      quick_reply_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          message: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          message: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          message?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      report_parent_comments: {
        Row: {
          comment: string
          created_at: string | null
          guardian_id: string | null
          id: string
          report_id: string
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          comment: string
          created_at?: string | null
          guardian_id?: string | null
          id?: string
          report_id: string
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          comment?: string
          created_at?: string | null
          guardian_id?: string | null
          id?: string
          report_id?: string
          student_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_parent_comments_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_parent_comments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_bulk_messages: {
        Row: {
          course_filter: string | null
          created_at: string
          error_count: number | null
          id: string
          message: string
          processed_at: string | null
          recipient_ids: string[]
          scheduled_at: string
          sent_count: number | null
          status: string
          updated_at: string
        }
        Insert: {
          course_filter?: string | null
          created_at?: string
          error_count?: number | null
          id?: string
          message: string
          processed_at?: string | null
          recipient_ids: string[]
          scheduled_at: string
          sent_count?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          course_filter?: string | null
          created_at?: string
          error_count?: number | null
          id?: string
          message?: string
          processed_at?: string | null
          recipient_ids?: string[]
          scheduled_at?: string
          sent_count?: number | null
          status?: string
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
      student_reports: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          content: string
          created_at: string
          hidden_from_portal: boolean | null
          id: string
          images: string[] | null
          notification_sent_at: string | null
          read_at: string | null
          read_by_guardian: boolean | null
          rejection_reason: string | null
          report_date: string
          report_type: string | null
          sent_at: string | null
          status: string | null
          student_id: string | null
          teacher_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          content: string
          created_at?: string
          hidden_from_portal?: boolean | null
          id?: string
          images?: string[] | null
          notification_sent_at?: string | null
          read_at?: string | null
          read_by_guardian?: boolean | null
          rejection_reason?: string | null
          report_date?: string
          report_type?: string | null
          sent_at?: string | null
          status?: string | null
          student_id?: string | null
          teacher_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          content?: string
          created_at?: string
          hidden_from_portal?: boolean | null
          id?: string
          images?: string[] | null
          notification_sent_at?: string | null
          read_at?: string | null
          read_by_guardian?: boolean | null
          rejection_reason?: string | null
          report_date?: string
          report_type?: string | null
          sent_at?: string | null
          status?: string | null
          student_id?: string | null
          teacher_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_reports_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_reports_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
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
          teacher_id: string | null
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
          teacher_id?: string | null
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
          teacher_id?: string | null
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
          {
            foreignKeyName: "students_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_credentials: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean | null
          last_login_at: string | null
          matricula: string
          password: string
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          matricula: string
          password: string
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          matricula?: string
          password?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_credentials_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_training_progress: {
        Row: {
          completed_lessons: number
          completion_percentage: number | null
          created_at: string
          current_lesson: string | null
          current_module: string | null
          id: string
          last_sync_at: string | null
          teacher_credential_id: string | null
          teacher_id: string | null
          total_lessons: number
          track_name: string
          updated_at: string
        }
        Insert: {
          completed_lessons?: number
          completion_percentage?: number | null
          created_at?: string
          current_lesson?: string | null
          current_module?: string | null
          id?: string
          last_sync_at?: string | null
          teacher_credential_id?: string | null
          teacher_id?: string | null
          total_lessons?: number
          track_name: string
          updated_at?: string
        }
        Update: {
          completed_lessons?: number
          completion_percentage?: number | null
          created_at?: string
          current_lesson?: string | null
          current_module?: string | null
          id?: string
          last_sync_at?: string | null
          teacher_credential_id?: string | null
          teacher_id?: string | null
          total_lessons?: number
          track_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_training_progress_teacher_credential_id_fkey"
            columns: ["teacher_credential_id"]
            isOneToOne: false
            referencedRelation: "teacher_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_training_progress_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          class_group_id: string | null
          course_id: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string
          updated_at: string
        }
        Insert: {
          class_group_id?: string | null
          course_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone: string
          updated_at?: string
        }
        Update: {
          class_group_id?: string | null
          course_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teachers_class_group_id_fkey"
            columns: ["class_group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teachers_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          created_at: string
          direction: string
          guardian_id: string | null
          id: string
          media_type: string | null
          media_url: string | null
          message: string
          phone: string
          status: string | null
          wapi_message_id: string | null
        }
        Insert: {
          created_at?: string
          direction: string
          guardian_id?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message: string
          phone: string
          status?: string | null
          wapi_message_id?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          guardian_id?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message?: string
          phone?: string
          status?: string | null
          wapi_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_guardian_id_fkey"
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
