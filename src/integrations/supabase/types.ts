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
      access_rules: {
        Row: {
          access_direction: string | null
          created_at: string | null
          days: string[] | null
          description: string | null
          end_time: string | null
          id: number
          is_active: boolean | null
          is_template: boolean | null
          name: string
          priority: number | null
          project_id: number | null
          start_time: string | null
          target_type: string | null
          template_name: string | null
          updated_at: string | null
        }
        Insert: {
          access_direction?: string | null
          created_at?: string | null
          days?: string[] | null
          description?: string | null
          end_time?: string | null
          id?: number
          is_active?: boolean | null
          is_template?: boolean | null
          name: string
          priority?: number | null
          project_id?: number | null
          start_time?: string | null
          target_type?: string | null
          template_name?: string | null
          updated_at?: string | null
        }
        Update: {
          access_direction?: string | null
          created_at?: string | null
          days?: string[] | null
          description?: string | null
          end_time?: string | null
          id?: number
          is_active?: boolean | null
          is_template?: boolean | null
          name?: string
          priority?: number | null
          project_id?: number | null
          start_time?: string | null
          target_type?: string | null
          template_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      card_readings: {
        Row: {
          access_granted: boolean
          access_rule_granted: boolean | null
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
          project_id: number | null
          raw_data: string | null
          read_time: string | null
          read_type: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          access_granted?: boolean
          access_rule_granted?: boolean | null
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
          project_id?: number | null
          raw_data?: string | null
          read_time?: string | null
          read_type?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          access_granted?: boolean
          access_rule_granted?: boolean | null
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
          project_id?: number | null
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
          {
            foreignKeyName: "card_readings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
        ]
      }
      departments: {
        Row: {
          created_at: string | null
          id: number
          level: number | null
          name: string
          parent_id: number | null
          project_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          level?: number | null
          name: string
          parent_id?: number | null
          project_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          level?: number | null
          name?: string
          parent_id?: number | null
          project_id?: number | null
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
          {
            foreignKeyName: "departments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          access_direction:
            | Database["public"]["Enums"]["access_direction_enum"]
            | null
          created_at: string
          description: string | null
          device_firmware: string | null
          device_hardware: string | null
          device_location: string | null
          device_mac: string | null
          device_model: string | null
          device_serial: string | null
          door_id: number | null
          id: number
          is_active: boolean | null
          last_connection: string | null
          last_seen: string | null
          last_sync: string | null
          name: string
          old_type: string | null
          project_id: number | null
          status: string | null
          type: Database["public"]["Enums"]["device_type_enum"]
          updated_at: string
          zone_id: number | null
        }
        Insert: {
          access_direction?:
            | Database["public"]["Enums"]["access_direction_enum"]
            | null
          created_at?: string
          description?: string | null
          device_firmware?: string | null
          device_hardware?: string | null
          device_location?: string | null
          device_mac?: string | null
          device_model?: string | null
          device_serial?: string | null
          door_id?: number | null
          id?: number
          is_active?: boolean | null
          last_connection?: string | null
          last_seen?: string | null
          last_sync?: string | null
          name: string
          old_type?: string | null
          project_id?: number | null
          status?: string | null
          type?: Database["public"]["Enums"]["device_type_enum"]
          updated_at?: string
          zone_id?: number | null
        }
        Update: {
          access_direction?:
            | Database["public"]["Enums"]["access_direction_enum"]
            | null
          created_at?: string
          description?: string | null
          device_firmware?: string | null
          device_hardware?: string | null
          device_location?: string | null
          device_mac?: string | null
          device_model?: string | null
          device_serial?: string | null
          door_id?: number | null
          id?: number
          is_active?: boolean | null
          last_connection?: string | null
          last_seen?: string | null
          last_sync?: string | null
          name?: string
          old_type?: string | null
          project_id?: number | null
          status?: string | null
          type?: Database["public"]["Enums"]["device_type_enum"]
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
          project_id: number | null
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
          project_id?: number | null
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
          project_id?: number | null
          status?: string | null
          updated_at?: string | null
          zone_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "doors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
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
      employee_auth: {
        Row: {
          created_at: string
          email: string | null
          employee_id: number
          id: string
          last_login: string | null
          password_hash: string | null
          phone: string | null
          project_id: number | null
          setup_token: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          employee_id: number
          id?: string
          last_login?: string | null
          password_hash?: string | null
          phone?: string | null
          project_id?: number | null
          setup_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          employee_id?: number
          id?: string
          last_login?: string | null
          password_hash?: string | null
          phone?: string | null
          project_id?: number | null
          setup_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_auth_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_auth_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          access_permission: boolean | null
          access_rule_id: number | null
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
          password: string | null
          photo_url: string | null
          position_id: number | null
          project_id: number | null
          shift: string | null
          shift_id: number | null
          tc_no: string
          updated_at: string | null
        }
        Insert: {
          access_permission?: boolean | null
          access_rule_id?: number | null
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
          password?: string | null
          photo_url?: string | null
          position_id?: number | null
          project_id?: number | null
          shift?: string | null
          shift_id?: number | null
          tc_no: string
          updated_at?: string | null
        }
        Update: {
          access_permission?: boolean | null
          access_rule_id?: number | null
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
          password?: string | null
          photo_url?: string | null
          position_id?: number | null
          project_id?: number | null
          shift?: string | null
          shift_id?: number | null
          tc_no?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_access_rule_id_fkey"
            columns: ["access_rule_id"]
            isOneToOne: false
            referencedRelation: "access_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
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
          mail_settings: Json | null
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
          mail_settings?: Json | null
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
          mail_settings?: Json | null
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
          project_id: number | null
        }
        Insert: {
          created_at?: string
          device_id: number
          group_id: number
          id?: number
          project_id?: number | null
        }
        Update: {
          created_at?: string
          device_id?: number
          group_id?: number
          id?: number
          project_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_group_devices_device_id"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "device_locations"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "fk_group_devices_device_id"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_group_devices_device_id"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_latest_readings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_group_devices_group_id"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "access_rules"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "access_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_devices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          project_id: number | null
        }
        Insert: {
          created_at?: string
          employee_id: number
          group_id: number
          id?: number
          project_id?: number | null
        }
        Update: {
          created_at?: string
          employee_id?: number
          group_id?: number
          id?: number
          project_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_group_members_employee_id"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_group_members_group_id"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "access_rules"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "access_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          project_id: number | null
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
          project_id?: number | null
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
          project_id?: number | null
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
          {
            foreignKeyName: "pdks_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          project_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          project_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          project_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
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
            foreignKeyName: "positions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          project_id: number | null
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
          project_id?: number | null
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
          project_id?: number | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          photo_url: string | null
          role: Database["public"]["Enums"]["user_role"]
          setup_token: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          photo_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          setup_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          photo_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          setup_token?: string | null
          token_expires_at?: string | null
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
          project_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          name: string
          project_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
          project_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          access_direction:
            | Database["public"]["Enums"]["access_direction_enum"]
            | null
          actual_last_seen: string | null
          created_at: string | null
          description: string | null
          device_firmware: string | null
          device_hardware: string | null
          device_location: string | null
          device_mac: string | null
          device_model: string | null
          device_serial: string | null
          door_id: number | null
          id: number | null
          is_active: boolean | null
          last_connection: string | null
          last_seen: string | null
          last_sync: string | null
          name: string | null
          project_id: number | null
          status: string | null
          type: Database["public"]["Enums"]["device_type_enum"] | null
          updated_at: string | null
          zone_id: number | null
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
      latest_device_readings: {
        Row: {
          device_serial: string | null
          last_seen: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_employee_access: {
        Args: {
          p_employee_id: number
          p_device_id: number
          p_access_time?: string
        }
        Returns: boolean
      }
      employee_login: {
        Args: { email_or_phone: string; password: string }
        Returns: Json
      }
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
      get_authenticated_employee_id: {
        Args: Record<PropertyKey, never>
        Returns: number
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
      access_direction_enum: "entry" | "exit" | "both"
      device_model_type:
        | "QR Reader"
        | "Fingerprint Reader"
        | "RFID Reader"
        | "Access Control Terminal"
        | "Other"
      device_type_enum:
        | "fingerprint_reader"
        | "card_reader"
        | "face_recognition"
        | "qr_reader"
        | "access_terminal"
        | "turnstile"
        | "door_controller"
        | "other"
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
      access_direction_enum: ["entry", "exit", "both"],
      device_model_type: [
        "QR Reader",
        "Fingerprint Reader",
        "RFID Reader",
        "Access Control Terminal",
        "Other",
      ],
      device_type_enum: [
        "fingerprint_reader",
        "card_reader",
        "face_recognition",
        "qr_reader",
        "access_terminal",
        "turnstile",
        "door_controller",
        "other",
      ],
      user_role: ["super_admin", "project_admin", "project_user"],
    },
  },
} as const
