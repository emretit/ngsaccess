export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      access_groups: {
        Row: {
          created_at: string
          description: string | null
          id: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      access_logs: {
        Row: {
          access_time: string | null
          door_id: number | null
          id: number
          notes: string | null
          status: string
          user_id: number
        }
        Insert: {
          access_time?: string | null
          door_id?: number | null
          id?: number
          notes?: string | null
          status: string
          user_id: number
        }
        Update: {
          access_time?: string | null
          door_id?: number | null
          id?: number
          notes?: string | null
          status?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_door_id_fkey"
            columns: ["door_id"]
            isOneToOne: false
            referencedRelation: "device_locations"
            referencedColumns: ["door_id"]
          },
          {
            foreignKeyName: "access_logs_door_id_fkey"
            columns: ["door_id"]
            isOneToOne: false
            referencedRelation: "doors"
            referencedColumns: ["id"]
          },
        ]
      }
      access_permissions: {
        Row: {
          created_at: string
          device_id: number
          employee_id: number
          has_access: boolean
          id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_id: number
          employee_id: number
          has_access?: boolean
          id?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_id?: number
          employee_id?: number
          has_access?: boolean
          id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_permissions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "device_locations"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "access_permissions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_permissions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_latest_readings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_permissions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      access_rules: {
        Row: {
          created_at: string
          days: string[]
          device_id: number | null
          employee_id: number | null
          end_time: string
          id: number
          is_active: boolean | null
          start_time: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days: string[]
          device_id?: number | null
          employee_id?: number | null
          end_time: string
          id?: number
          is_active?: boolean | null
          start_time: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days?: string[]
          device_id?: number | null
          employee_id?: number | null
          end_time?: string
          id?: number
          is_active?: boolean | null
          start_time?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_rules_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "device_locations"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "access_rules_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_rules_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_latest_readings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_rules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_report_queries: {
        Row: {
          created_at: string | null
          generated_sql: string
          id: number
          project_id: number | null
          query_text: string
          result_data: Json | null
          updated_at: string | null
          user_id: string | null
          visualization_config: Json | null
          visualization_type: string | null
        }
        Insert: {
          created_at?: string | null
          generated_sql: string
          id?: number
          project_id?: number | null
          query_text: string
          result_data?: Json | null
          updated_at?: string | null
          user_id?: string | null
          visualization_config?: Json | null
          visualization_type?: string | null
        }
        Update: {
          created_at?: string | null
          generated_sql?: string
          id?: number
          project_id?: number | null
          query_text?: string
          result_data?: Json | null
          updated_at?: string | null
          user_id?: string | null
          visualization_config?: Json | null
          visualization_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_report_queries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_report_queries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "users_with_projects"
            referencedColumns: ["project_id"]
          },
        ]
      }
      ai_report_results: {
        Row: {
          created_at: string | null
          error_message: string | null
          execution_time: unknown | null
          id: number
          query_id: number | null
          result_data: Json | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          execution_time?: unknown | null
          id?: number
          query_id?: number | null
          result_data?: Json | null
          status: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          execution_time?: unknown | null
          id?: number
          query_id?: number | null
          result_data?: Json | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_report_results_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "ai_report_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_report_templates: {
        Row: {
          created_at: string | null
          default_visualization_config: Json | null
          default_visualization_type: string | null
          description: string | null
          id: number
          name: string
          project_id: number | null
          query_template: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          default_visualization_config?: Json | null
          default_visualization_type?: string | null
          description?: string | null
          id?: number
          name: string
          project_id?: number | null
          query_template: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          default_visualization_config?: Json | null
          default_visualization_type?: string | null
          description?: string | null
          id?: number
          name?: string
          project_id?: number | null
          query_template?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_report_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_report_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "users_with_projects"
            referencedColumns: ["project_id"]
          },
        ]
      }
      card_readings: {
        Row: {
          access_granted: boolean
          access_time: string
          card_no: string
          created_at: string | null
          device_id: number | null
          device_ip: string | null
          device_location: string | null
          device_mac: string | null
          device_name: string | null
          device_serial: string | null
          employee_id: number | null
          employee_name: string | null
          employee_photo_url: string | null
          id: number
          raw_data: string | null
          read_time: string | null
          read_type: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          access_granted?: boolean
          access_time?: string
          card_no: string
          created_at?: string | null
          device_id?: number | null
          device_ip?: string | null
          device_location?: string | null
          device_mac?: string | null
          device_name?: string | null
          device_serial?: string | null
          employee_id?: number | null
          employee_name?: string | null
          employee_photo_url?: string | null
          id?: number
          raw_data?: string | null
          read_time?: string | null
          read_type?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          access_granted?: boolean
          access_time?: string
          card_no?: string
          created_at?: string | null
          device_id?: number | null
          device_ip?: string | null
          device_location?: string | null
          device_mac?: string | null
          device_name?: string | null
          device_serial?: string | null
          employee_id?: number | null
          employee_name?: string | null
          employee_photo_url?: string | null
          id?: number
          raw_data?: string | null
          read_time?: string | null
          read_type?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_readings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "device_locations"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "card_readings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_readings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_latest_readings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_readings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string | null
          id: number
          name: string
          project_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
          project_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
          project_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_companies_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_companies_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "users_with_projects"
            referencedColumns: ["project_id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string | null
          id: number
          level: number | null
          name: string
          parent_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          level?: number | null
          name: string
          parent_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          level?: number | null
          name?: string
          parent_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          description: string | null
          device_firmware: string | null
          device_hardware: string | null
          device_location: string | null
          device_mac: string | null
          device_model: string | null
          device_serial: string | null
          device_status: string | null
          device_type: string | null
          door_id: number | null
          id: number
          is_active: boolean | null
          last_connection: string | null
          last_seen: string | null
          last_sync: string | null
          location: string
          name: string
          project_id: number | null
          serial_number: string | null
          status: string | null
          type: string
          updated_at: string
          zone_id: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          device_firmware?: string | null
          device_hardware?: string | null
          device_location?: string | null
          device_mac?: string | null
          device_model?: string | null
          device_serial?: string | null
          device_status?: string | null
          device_type?: string | null
          door_id?: number | null
          id?: number
          is_active?: boolean | null
          last_connection?: string | null
          last_seen?: string | null
          last_sync?: string | null
          location: string
          name: string
          project_id?: number | null
          serial_number?: string | null
          status?: string | null
          type: string
          updated_at?: string
          zone_id?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          device_firmware?: string | null
          device_hardware?: string | null
          device_location?: string | null
          device_mac?: string | null
          device_model?: string | null
          device_serial?: string | null
          device_status?: string | null
          device_type?: string | null
          door_id?: number | null
          id?: number
          is_active?: boolean | null
          last_connection?: string | null
          last_seen?: string | null
          last_sync?: string | null
          location?: string
          name?: string
          project_id?: number | null
          serial_number?: string | null
          status?: string | null
          type?: string
          updated_at?: string
          zone_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_door_id_fkey"
            columns: ["door_id"]
            isOneToOne: false
            referencedRelation: "device_locations"
            referencedColumns: ["door_id"]
          },
          {
            foreignKeyName: "devices_door_id_fkey"
            columns: ["door_id"]
            isOneToOne: false
            referencedRelation: "doors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "users_with_projects"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "devices_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "device_locations"
            referencedColumns: ["zone_id"]
          },
          {
            foreignKeyName: "devices_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      doors: {
        Row: {
          created_at: string | null
          door_code: string | null
          id: number
          location: string | null
          name: string
          status: string | null
          updated_at: string | null
          zone_id: number | null
        }
        Insert: {
          created_at?: string | null
          door_code?: string | null
          id?: number
          location?: string | null
          name: string
          status?: string | null
          updated_at?: string | null
          zone_id?: number | null
        }
        Update: {
          created_at?: string | null
          door_code?: string | null
          id?: number
          location?: string | null
          name?: string
          status?: string | null
          updated_at?: string | null
          zone_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "doors_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "device_locations"
            referencedColumns: ["zone_id"]
          },
          {
            foreignKeyName: "doors_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          access_permission: boolean | null
          card_number: string
          company_id: number | null
          created_at: string | null
          department_id: number | null
          email: string
          first_name: string
          id: number
          is_active: boolean | null
          last_name: string
          notes: string | null
          photo_url: string | null
          position_id: number | null
          shift: string | null
          shift_id: number | null
          tc_no: string
          updated_at: string | null
        }
        Insert: {
          access_permission?: boolean | null
          card_number: string
          company_id?: number | null
          created_at?: string | null
          department_id?: number | null
          email: string
          first_name: string
          id?: number
          is_active?: boolean | null
          last_name: string
          notes?: string | null
          photo_url?: string | null
          position_id?: number | null
          shift?: string | null
          shift_id?: number | null
          tc_no: string
          updated_at?: string | null
        }
        Update: {
          access_permission?: boolean | null
          card_number?: string
          company_id?: number | null
          created_at?: string | null
          department_id?: number | null
          email?: string
          first_name?: string
          id?: number
          is_active?: boolean | null
          last_name?: string
          notes?: string | null
          photo_url?: string | null
          position_id?: number | null
          shift?: string | null
          shift_id?: number | null
          tc_no?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_employees_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_employees_department"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_employees_position"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_employees_shift"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      general_settings: {
        Row: {
          address: string | null
          company_name: string
          created_at: string | null
          currency: string | null
          dark_mode: boolean | null
          date_format: string | null
          email: string | null
          id: string
          logo_url: string | null
          notifications_enabled: boolean | null
          phone: string | null
          project_id: number | null
          system_language: string | null
          tax_number: string | null
          timezone: string | null
          updated_at: string | null
          website: string | null
          working_days: string[] | null
          working_hours_end: string | null
          working_hours_start: string | null
        }
        Insert: {
          address?: string | null
          company_name: string
          created_at?: string | null
          currency?: string | null
          dark_mode?: boolean | null
          date_format?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          notifications_enabled?: boolean | null
          phone?: string | null
          project_id?: number | null
          system_language?: string | null
          tax_number?: string | null
          timezone?: string | null
          updated_at?: string | null
          website?: string | null
          working_days?: string[] | null
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          created_at?: string | null
          currency?: string | null
          dark_mode?: boolean | null
          date_format?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          notifications_enabled?: boolean | null
          phone?: string | null
          project_id?: number | null
          system_language?: string | null
          tax_number?: string | null
          timezone?: string | null
          updated_at?: string | null
          website?: string | null
          working_days?: string[] | null
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Relationships: []
      }
      group_devices: {
        Row: {
          created_at: string
          device_id: number
          group_id: number
          id: number
        }
        Insert: {
          created_at?: string
          device_id: number
          group_id: number
          id?: number
        }
        Update: {
          created_at?: string
          device_id?: number
          group_id?: number
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_devices_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "device_locations"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "group_devices_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_devices_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_latest_readings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_devices_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "access_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          employee_id: number
          group_id: number
          id: number
        }
        Insert: {
          created_at?: string
          employee_id: number
          group_id: number
          id?: number
        }
        Update: {
          created_at?: string
          employee_id?: number
          group_id?: number
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "access_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      pdks_records: {
        Row: {
          created_at: string
          date: string
          employee_first_name: string
          employee_id: number
          employee_last_name: string
          entry_time: string | null
          exit_time: string | null
          id: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          employee_first_name: string
          employee_id: number
          employee_last_name: string
          entry_time?: string | null
          exit_time?: string | null
          id?: number
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          employee_first_name?: string
          employee_id?: number
          employee_last_name?: string
          entry_time?: string | null
          exit_time?: string | null
          id?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_pdks_records_employee"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      positions: {
        Row: {
          created_at: string | null
          id: number
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      project_users: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          project_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          project_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          project_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_users_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_users_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "users_with_projects"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      rule_departments: {
        Row: {
          created_at: string | null
          department_id: number
          id: number
          rule_id: number | null
        }
        Insert: {
          created_at?: string | null
          department_id: number
          id?: number
          rule_id?: number | null
        }
        Update: {
          created_at?: string | null
          department_id?: number
          id?: number
          rule_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rule_departments_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "access_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_doors: {
        Row: {
          created_at: string | null
          door_id: number | null
          id: number
          rule_id: number | null
        }
        Insert: {
          created_at?: string | null
          door_id?: number | null
          id?: number
          rule_id?: number | null
        }
        Update: {
          created_at?: string | null
          door_id?: number | null
          id?: number
          rule_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rule_doors_door_id_fkey"
            columns: ["door_id"]
            isOneToOne: false
            referencedRelation: "device_locations"
            referencedColumns: ["door_id"]
          },
          {
            foreignKeyName: "rule_doors_door_id_fkey"
            columns: ["door_id"]
            isOneToOne: false
            referencedRelation: "doors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_doors_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "access_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_users: {
        Row: {
          created_at: string | null
          id: number
          rule_id: number | null
          user_id: number
        }
        Insert: {
          created_at?: string | null
          id?: number
          rule_id?: number | null
          user_id: number
        }
        Update: {
          created_at?: string | null
          id?: number
          rule_id?: number | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "rule_users_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "access_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_zones: {
        Row: {
          created_at: string | null
          id: number
          rule_id: number | null
          zone_id: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          rule_id?: number | null
          zone_id?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          rule_id?: number | null
          zone_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rule_zones_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "access_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_zones_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "device_locations"
            referencedColumns: ["zone_id"]
          },
          {
            foreignKeyName: "rule_zones_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      server_devices: {
        Row: {
          created_at: string | null
          date_added: string | null
          device_model: string | null
          device_model_enum:
            | Database["public"]["Enums"]["device_model_type"]
            | null
          device_type: string | null
          expiry_date: string | null
          id: string
          last_used_at: string | null
          name: string
          project_id: number | null
          serial_number: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_added?: string | null
          device_model?: string | null
          device_model_enum?:
            | Database["public"]["Enums"]["device_model_type"]
            | null
          device_type?: string | null
          expiry_date?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          project_id?: number | null
          serial_number: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_added?: string | null
          device_model?: string | null
          device_model_enum?:
            | Database["public"]["Enums"]["device_model_type"]
            | null
          device_type?: string | null
          expiry_date?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          project_id?: number | null
          serial_number?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_devices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_devices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "users_with_projects"
            referencedColumns: ["project_id"]
          },
        ]
      }
      settings: {
        Row: {
          allow_late_entry: boolean | null
          id: number
          lunch_break_end: string | null
          lunch_break_start: string | null
          max_late_minutes: number | null
          project_id: number | null
          updated_at: string | null
          work_end_time: string | null
          work_start_time: string | null
        }
        Insert: {
          allow_late_entry?: boolean | null
          id?: number
          lunch_break_end?: string | null
          lunch_break_start?: string | null
          max_late_minutes?: number | null
          project_id?: number | null
          updated_at?: string | null
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Update: {
          allow_late_entry?: boolean | null
          id?: number
          lunch_break_end?: string | null
          lunch_break_start?: string | null
          max_late_minutes?: number | null
          project_id?: number | null
          updated_at?: string | null
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_settings_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_settings_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "users_with_projects"
            referencedColumns: ["project_id"]
          },
        ]
      }
      shifts: {
        Row: {
          break_end: string | null
          break_start: string | null
          created_at: string
          end_time: string
          id: number
          name: string
          start_time: string
          updated_at: string
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          created_at?: string
          end_time: string
          id?: number
          name: string
          start_time: string
          updated_at?: string
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          created_at?: string
          end_time?: string
          id?: number
          name?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_projects: {
        Row: {
          created_at: string | null
          id: string
          project_id: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_id?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          project_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_projects_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_projects_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "users_with_projects"
            referencedColumns: ["project_id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      zones: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      device_locations: {
        Row: {
          device_id: number | null
          device_name: string | null
          door_id: number | null
          door_name: string | null
          zone_id: number | null
          zone_name: string | null
        }
        Relationships: []
      }
      devices_with_latest_readings: {
        Row: {
          actual_last_seen: string | null
          created_at: string | null
          description: string | null
          device_firmware: string | null
          device_hardware: string | null
          device_location: string | null
          device_mac: string | null
          device_model: string | null
          device_serial: string | null
          device_status: string | null
          device_type: string | null
          id: number | null
          is_active: boolean | null
          last_connection: string | null
          last_seen: string | null
          last_sync: string | null
          location: string | null
          name: string | null
          project_id: number | null
          serial_number: string | null
          status: string | null
          type: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "users_with_projects"
            referencedColumns: ["project_id"]
          },
        ]
      }
      latest_device_readings: {
        Row: {
          device_serial: string | null
          last_seen: string | null
        }
        Relationships: []
      }
      users_with_projects: {
        Row: {
          email: string | null
          id: string | null
          is_admin: boolean | null
          project_id: number | null
          project_name: string | null
          role: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      execute_query: {
        Args: { query_text: string }
        Returns: Json
      }
      execute_report_query: {
        Args: { query_text: string; query_params?: Json }
        Returns: Json
      }
      generate_random_card_readings: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_employee_access_rules: {
        Args: { p_employee_id: number }
        Returns: {
          rule_id: number
          device_id: number
          device_name: string
          door_name: string
          zone_name: string
          start_time: string
          end_time: string
          days: string[]
        }[]
      }
      is_device_online: {
        Args: { last_seen: string }
        Returns: boolean
      }
      is_project_admin: {
        Args: { project_id: number }
        Returns: boolean
      }
      is_super_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_superadmin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      validate_report_query: {
        Args: { query_text: string }
        Returns: Json
      }
    }
    Enums: {
      device_model_type:
        | "QR Reader"
        | "Fingerprint Reader"
        | "RFID Reader"
        | "Access Control Terminal"
        | "Other"
      user_role: "super_admin" | "project_admin" | "project_user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      device_model_type: [
        "QR Reader",
        "Fingerprint Reader",
        "RFID Reader",
        "Access Control Terminal",
        "Other",
      ],
      user_role: ["super_admin", "project_admin", "project_user"],
    },
  },
} as const
