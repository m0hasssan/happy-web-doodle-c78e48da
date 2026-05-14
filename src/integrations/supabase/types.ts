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
      gold_prices: {
        Row: {
          buy: number | null
          fetched_at: string
          id: string
          karat: string
          sell: number | null
          updated_at: string
        }
        Insert: {
          buy?: number | null
          fetched_at?: string
          id?: string
          karat: string
          sell?: number | null
          updated_at?: string
        }
        Update: {
          buy?: number | null
          fetched_at?: string
          id?: string
          karat?: string
          sell?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      manufacturing_sections: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      metal_categories: {
        Row: {
          created_at: string
          id: string
          metal_id: string
          name: string
          parent_id: string | null
          requires_count: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metal_id: string
          name: string
          parent_id?: string | null
          requires_count?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metal_id?: string
          name?: string
          parent_id?: string | null
          requires_count?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metal_categories_metal_id_fkey"
            columns: ["metal_id"]
            isOneToOne: false
            referencedRelation: "metals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metal_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "metal_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      metal_karats: {
        Row: {
          created_at: string
          id: string
          karat: string
          metal_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          karat: string
          metal_id: string
        }
        Update: {
          created_at?: string
          id?: string
          karat?: string
          metal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metal_karats_metal_id_fkey"
            columns: ["metal_id"]
            isOneToOne: false
            referencedRelation: "metals"
            referencedColumns: ["id"]
          },
        ]
      }
      metals: {
        Row: {
          code: string
          color: string
          created_at: string
          id: string
          kind: string
          name_ar: string
          updated_at: string
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          id?: string
          kind?: string
          name_ar: string
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          id?: string
          kind?: string
          name_ar?: string
          updated_at?: string
        }
        Relationships: []
      }
      movements: {
        Row: {
          category_id: string | null
          code: string
          count: number | null
          created_at: string
          created_by_user_id: string | null
          employee_name: string | null
          from_id: string
          from_type: string
          id: string
          karat: string | null
          metal_id: string
          shift_id: string | null
          to_id: string
          to_type: string
          weight: number
          work_order_id: string | null
        }
        Insert: {
          category_id?: string | null
          code?: string
          count?: number | null
          created_at?: string
          created_by_user_id?: string | null
          employee_name?: string | null
          from_id: string
          from_type: string
          id?: string
          karat?: string | null
          metal_id: string
          shift_id?: string | null
          to_id: string
          to_type: string
          weight?: number
          work_order_id?: string | null
        }
        Update: {
          category_id?: string | null
          code?: string
          count?: number | null
          created_at?: string
          created_by_user_id?: string | null
          employee_name?: string | null
          from_id?: string
          from_type?: string
          id?: string
          karat?: string | null
          metal_id?: string
          shift_id?: string | null
          to_id?: string
          to_type?: string
          weight?: number
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "metal_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_metal_id_fkey"
            columns: ["metal_id"]
            isOneToOne: false
            referencedRelation: "metals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recovery_entries: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          employee_name: string | null
          id: string
          is_waste: boolean
          metal_id: string
          movement_id: string | null
          operation_id: string | null
          section_id: string
          shift_id: string | null
          to_vault_id: string | null
          weight_999: number
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          employee_name?: string | null
          id?: string
          is_waste?: boolean
          metal_id: string
          movement_id?: string | null
          operation_id?: string | null
          section_id: string
          shift_id?: string | null
          to_vault_id?: string | null
          weight_999: number
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          employee_name?: string | null
          id?: string
          is_waste?: boolean
          metal_id?: string
          movement_id?: string | null
          operation_id?: string | null
          section_id?: string
          shift_id?: string | null
          to_vault_id?: string | null
          weight_999?: number
        }
        Relationships: [
          {
            foreignKeyName: "recovery_entries_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "recovery_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_operation_sections: {
        Row: {
          created_at: string
          id: string
          initial_loss_999: number
          metal_id: string
          operation_id: string
          recovered_999: number
          section_id: string
          waste_999: number
        }
        Insert: {
          created_at?: string
          id?: string
          initial_loss_999?: number
          metal_id: string
          operation_id: string
          recovered_999?: number
          section_id: string
          waste_999?: number
        }
        Update: {
          created_at?: string
          id?: string
          initial_loss_999?: number
          metal_id?: string
          operation_id?: string
          recovered_999?: number
          section_id?: string
          waste_999?: number
        }
        Relationships: [
          {
            foreignKeyName: "recovery_operation_sections_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "recovery_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_operations: {
        Row: {
          closed_at: string | null
          closed_by_name: string | null
          closed_by_user_id: string | null
          closed_shift_id: string | null
          code: string
          created_at: string
          id: string
          notes: string | null
          opened_by_name: string | null
          opened_by_user_id: string | null
          opened_shift_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by_name?: string | null
          closed_by_user_id?: string | null
          closed_shift_id?: string | null
          code?: string
          created_at?: string
          id?: string
          notes?: string | null
          opened_by_name?: string | null
          opened_by_user_id?: string | null
          opened_shift_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by_name?: string | null
          closed_by_user_id?: string | null
          closed_shift_id?: string | null
          code?: string
          created_at?: string
          id?: string
          notes?: string | null
          opened_by_name?: string | null
          opened_by_user_id?: string | null
          opened_shift_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      section_inventory: {
        Row: {
          category_id: string | null
          id: string
          karat: string | null
          metal_id: string
          section_id: string
          total_count: number | null
          total_weight: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          id?: string
          karat?: string | null
          metal_id: string
          section_id: string
          total_count?: number | null
          total_weight?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          id?: string
          karat?: string | null
          metal_id?: string
          section_id?: string
          total_count?: number | null
          total_weight?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_inventory_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "metal_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_inventory_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      section_metal_rules: {
        Row: {
          allowed: boolean
          created_at: string
          direction: string
          id: string
          karat: string | null
          metal_id: string
          section_id: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          direction: string
          id?: string
          karat?: string | null
          metal_id: string
          section_id: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          direction?: string
          id?: string
          karat?: string | null
          metal_id?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_metal_rules_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      section_metals: {
        Row: {
          created_at: string
          metal_id: string
          section_id: string
        }
        Insert: {
          created_at?: string
          metal_id: string
          section_id: string
        }
        Update: {
          created_at?: string
          metal_id?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_metals_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      section_settings: {
        Row: {
          allow_category_change: boolean
          allow_count_change: boolean
          allow_karat_change: boolean
          created_at: string
          section_id: string
          updated_at: string
        }
        Insert: {
          allow_category_change?: boolean
          allow_count_change?: boolean
          allow_karat_change?: boolean
          created_at?: string
          section_id: string
          updated_at?: string
        }
        Update: {
          allow_category_change?: boolean
          allow_count_change?: boolean
          allow_karat_change?: boolean
          created_at?: string
          section_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_settings_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: true
            referencedRelation: "manufacturing_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      section_shrinkage_inventory: {
        Row: {
          created_at: string
          id: string
          metal_id: string
          section_id: string
          total_weight: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metal_id: string
          section_id: string
          total_weight?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metal_id?: string
          section_id?: string
          total_weight?: number
          updated_at?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          code: string
          created_at: string
          ended_at: string | null
          ended_by_name: string | null
          ended_by_user_id: string | null
          id: string
          started_at: string
          started_by_name: string | null
          started_by_user_id: string | null
          updated_at: string
        }
        Insert: {
          code?: string
          created_at?: string
          ended_at?: string | null
          ended_by_name?: string | null
          ended_by_user_id?: string | null
          id?: string
          started_at?: string
          started_by_name?: string | null
          started_by_user_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          ended_at?: string | null
          ended_by_name?: string | null
          ended_by_user_id?: string | null
          id?: string
          started_at?: string
          started_by_name?: string | null
          started_by_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          gold_tolerance: number
          id: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          gold_tolerance?: number
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          gold_tolerance?: number
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          resource_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          resource_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          resource_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          number_format: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          number_format?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          number_format?: Json
          updated_at?: string
          user_id?: string
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
      vault_inventory: {
        Row: {
          category_id: string | null
          id: string
          karat: string | null
          metal_id: string
          total_count: number | null
          total_weight: number
          updated_at: string
          vault_id: string
        }
        Insert: {
          category_id?: string | null
          id?: string
          karat?: string | null
          metal_id: string
          total_count?: number | null
          total_weight?: number
          updated_at?: string
          vault_id: string
        }
        Update: {
          category_id?: string | null
          id?: string
          karat?: string | null
          metal_id?: string
          total_count?: number | null
          total_weight?: number
          updated_at?: string
          vault_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_inventory_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "metal_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_inventory_metal_id_fkey"
            columns: ["metal_id"]
            isOneToOne: false
            referencedRelation: "metals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_inventory_vault_id_fkey"
            columns: ["vault_id"]
            isOneToOne: false
            referencedRelation: "vaults"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_item_adjustments: {
        Row: {
          adjustment_id: string
          category_id: string | null
          created_at: string
          created_by_user_id: string | null
          delta_count: number | null
          delta_weight: number
          employee_name: string | null
          id: string
          karat: string | null
          metal_id: string
          shift_id: string | null
          vault_id: string
        }
        Insert: {
          adjustment_id: string
          category_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          delta_count?: number | null
          delta_weight?: number
          employee_name?: string | null
          id?: string
          karat?: string | null
          metal_id: string
          shift_id?: string | null
          vault_id: string
        }
        Update: {
          adjustment_id?: string
          category_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          delta_count?: number | null
          delta_weight?: number
          employee_name?: string | null
          id?: string
          karat?: string | null
          metal_id?: string
          shift_id?: string | null
          vault_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_item_adjustments_vault_id_fkey"
            columns: ["vault_id"]
            isOneToOne: false
            referencedRelation: "vaults"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_metals: {
        Row: {
          created_at: string
          metal_id: string
          vault_id: string
        }
        Insert: {
          created_at?: string
          metal_id: string
          vault_id: string
        }
        Update: {
          created_at?: string
          metal_id?: string
          vault_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_metals_metal_id_fkey"
            columns: ["metal_id"]
            isOneToOne: false
            referencedRelation: "metals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_metals_vault_id_fkey"
            columns: ["vault_id"]
            isOneToOne: false
            referencedRelation: "vaults"
            referencedColumns: ["id"]
          },
        ]
      }
      vaults: {
        Row: {
          created_at: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      work_order_shrinkage: {
        Row: {
          created_at: string
          id: string
          karat: string
          metal_id: string
          missing_weight: number
          pure_999_weight: number
          section_id: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          karat: string
          metal_id: string
          missing_weight: number
          pure_999_weight: number
          section_id: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          karat?: string
          metal_id?: string
          missing_weight?: number
          pure_999_weight?: number
          section_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_shrinkage_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          code: string
          created_at: string
          created_by_user_id: string | null
          current_holder_id: string | null
          current_holder_type: string | null
          from_vault_id: string
          id: string
          notes: string | null
          shift_id: string | null
          status: string
          temp_returned_to_vault: boolean
          to_section_id: string
          updated_at: string
        }
        Insert: {
          code?: string
          created_at?: string
          created_by_user_id?: string | null
          current_holder_id?: string | null
          current_holder_type?: string | null
          from_vault_id: string
          id?: string
          notes?: string | null
          shift_id?: string | null
          status?: string
          temp_returned_to_vault?: boolean
          to_section_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by_user_id?: string | null
          current_holder_id?: string | null
          current_holder_type?: string | null
          from_vault_id?: string
          id?: string
          notes?: string | null
          shift_id?: string | null
          status?: string
          temp_returned_to_vault?: boolean
          to_section_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_all_data: { Args: never; Returns: undefined }
      admin_reset_movements: { Args: never; Returns: undefined }
      apply_vault_item_adjustment: {
        Args: {
          p_employee_name: string
          p_items: Json
          p_shift_id: string
          p_vault_id: string
        }
        Returns: string
      }
      get_gold_tolerance: { Args: never; Returns: number }
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["app_permission"]
          _resource_id?: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_section_workorder_return: {
        Args: {
          p_dest_vault_id: string
          p_employee_name: string
          p_items: Json
          p_shift_id: string
          p_work_order_id: string
        }
        Returns: Json
      }
      recovery_add_entry: {
        Args: {
          p_employee_name: string
          p_metal_id: string
          p_operation_id: string
          p_section_id: string
          p_shift_id: string
          p_to_vault_id: string
          p_weight: number
        }
        Returns: string
      }
      recovery_add_entry_v2:
        | {
            Args: {
              p_employee_name: string
              p_karat: string
              p_metal_id: string
              p_operation_id: string
              p_section_id: string
              p_shift_id: string
              p_to_vault_id: string
              p_weight: number
            }
            Returns: string
          }
        | {
            Args: {
              p_category_id?: string
              p_count?: number
              p_employee_name: string
              p_karat: string
              p_metal_id: string
              p_operation_id: string
              p_section_id: string
              p_shift_id: string
              p_to_vault_id: string
              p_weight: number
            }
            Returns: string
          }
      recovery_close: {
        Args: {
          p_employee_name: string
          p_operation_id: string
          p_shift_id: string
        }
        Returns: undefined
      }
      recovery_open: {
        Args: {
          p_employee_name: string
          p_section_ids: string[]
          p_shift_id: string
        }
        Returns: string
      }
      recovery_quick_entry: {
        Args: {
          p_category_id?: string
          p_count?: number
          p_employee_name: string
          p_karat: string
          p_metal_id: string
          p_section_id: string
          p_shift_id: string
          p_to_vault_id: string
          p_weight: number
        }
        Returns: string
      }
      section_available_loss_999: {
        Args: { p_metal_id: string; p_section_id: string }
        Returns: number
      }
      work_order_apply_shrinkage: {
        Args: { p_work_order_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_permission:
        | "view_dashboard"
        | "export_data"
        | "view_users"
        | "manage_users"
        | "create_users"
        | "view_control_panel"
        | "view_current_shift"
        | "start_shift"
        | "end_shift"
        | "view_stats"
        | "export_stats"
        | "view_vaults"
        | "create_vault"
        | "access_vault"
        | "edit_vault"
        | "delete_vault"
        | "create_vault_entry"
        | "view_vault_data"
        | "view_vault_movements"
        | "view_sections"
        | "create_section"
        | "access_section"
        | "edit_section"
        | "delete_section"
        | "view_section_data"
        | "view_section_movements"
        | "view_movements"
        | "view_suppliers"
        | "edit_supplier"
        | "delete_supplier"
        | "view_supplier_account"
        | "view_shifts_history"
        | "view_shift_details"
        | "edit_user_profile"
        | "edit_user_permissions"
        | "delete_users"
        | "edit_movement"
        | "delete_movement"
        | "view_work_orders"
        | "transfer_work_order"
        | "settle_work_order"
        | "delete_work_order"
        | "create_supplier"
        | "view_system_settings"
        | "manage_metals"
        | "manage_categories"
        | "manage_number_format"
        | "export_system_data"
        | "import_system_data"
        | "reset_system_movements"
        | "delete_system_data"
        | "view_vault"
        | "view_section"
        | "view_recovery"
        | "manage_recovery"
      app_role: "admin" | "user"
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
      app_permission: [
        "view_dashboard",
        "export_data",
        "view_users",
        "manage_users",
        "create_users",
        "view_control_panel",
        "view_current_shift",
        "start_shift",
        "end_shift",
        "view_stats",
        "export_stats",
        "view_vaults",
        "create_vault",
        "access_vault",
        "edit_vault",
        "delete_vault",
        "create_vault_entry",
        "view_vault_data",
        "view_vault_movements",
        "view_sections",
        "create_section",
        "access_section",
        "edit_section",
        "delete_section",
        "view_section_data",
        "view_section_movements",
        "view_movements",
        "view_suppliers",
        "edit_supplier",
        "delete_supplier",
        "view_supplier_account",
        "view_shifts_history",
        "view_shift_details",
        "edit_user_profile",
        "edit_user_permissions",
        "delete_users",
        "edit_movement",
        "delete_movement",
        "view_work_orders",
        "transfer_work_order",
        "settle_work_order",
        "delete_work_order",
        "create_supplier",
        "view_system_settings",
        "manage_metals",
        "manage_categories",
        "manage_number_format",
        "export_system_data",
        "import_system_data",
        "reset_system_movements",
        "delete_system_data",
        "view_vault",
        "view_section",
        "view_recovery",
        "manage_recovery",
      ],
      app_role: ["admin", "user"],
    },
  },
} as const
