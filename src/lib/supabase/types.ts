export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      budget_category_policy_templates: {
        Row: {
          category_description: string
          category_key: string
          category_name: string
          caution_guide_message: string
          caution_notes: Json
          created_at: string
          evidence_guide_message: string
          evidence_requirements: Json
          id: string
          is_active: boolean
          restricted_notes: Json
          source_title: string
          source_type: string
          source_version: string | null
          ui_guide_message: string
          updated_at: string
          usage_scope: string
          version: number
        }
        Insert: {
          category_description?: string
          category_key: string
          category_name: string
          caution_guide_message?: string
          caution_notes?: Json
          created_at?: string
          evidence_guide_message?: string
          evidence_requirements?: Json
          id?: string
          is_active?: boolean
          restricted_notes?: Json
          source_title?: string
          source_type?: string
          source_version?: string | null
          ui_guide_message?: string
          updated_at?: string
          usage_scope?: string
          version?: number
        }
        Update: {
          category_description?: string
          category_key?: string
          category_name?: string
          caution_guide_message?: string
          caution_notes?: Json
          created_at?: string
          evidence_guide_message?: string
          evidence_requirements?: Json
          id?: string
          is_active?: boolean
          restricted_notes?: Json
          source_title?: string
          source_type?: string
          source_version?: string | null
          ui_guide_message?: string
          updated_at?: string
          usage_scope?: string
          version?: number
        }
        Relationships: []
      }
      companies: {
        Row: {
          business_registration_number: string
          business_type: string
          company_name: string
          company_size: string
          corporate_registration_number: string | null
          created_at: string
          deleted_at: string | null
          founded_at: string
          id: string
          profile_status: string
          updated_at: string
        }
        Insert: {
          business_registration_number: string
          business_type: string
          company_name: string
          company_size: string
          corporate_registration_number?: string | null
          created_at?: string
          deleted_at?: string | null
          founded_at: string
          id?: string
          profile_status: string
          updated_at?: string
        }
        Update: {
          business_registration_number?: string
          business_type?: string
          company_name?: string
          company_size?: string
          corporate_registration_number?: string | null
          created_at?: string
          deleted_at?: string | null
          founded_at?: string
          id?: string
          profile_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      example: {
        Row: {
          avatar_url: string | null
          bio: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      expense_evidence_files: {
        Row: {
          company_id: string
          deleted_at: string | null
          document_key: string
          duplicate_group_key: string | null
          expense_id: string
          file_extension: string | null
          file_hash: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          original_file_name: string
          project_id: string
          requirement_key: string | null
          storage_bucket: string
          storage_path: string
          stored_file_name: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          company_id: string
          deleted_at?: string | null
          document_key: string
          duplicate_group_key?: string | null
          expense_id: string
          file_extension?: string | null
          file_hash?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          original_file_name: string
          project_id: string
          requirement_key?: string | null
          storage_bucket?: string
          storage_path: string
          stored_file_name: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          deleted_at?: string | null
          document_key?: string
          duplicate_group_key?: string | null
          expense_id?: string
          file_extension?: string | null
          file_hash?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          original_file_name?: string
          project_id?: string
          requirement_key?: string | null
          storage_bucket?: string
          storage_path?: string
          stored_file_name?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_evidence_files_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_evidence_files_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "project_expenses_by_category"
            referencedColumns: ["expense_id"]
          },
          {
            foreignKeyName: "expense_evidence_files_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "project_expenses_by_stage"
            referencedColumns: ["expense_id"]
          },
          {
            foreignKeyName: "expense_evidence_files_expense_project_fk"
            columns: ["expense_id", "project_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "expense_evidence_files_expense_project_fk"
            columns: ["expense_id", "project_id"]
            isOneToOne: false
            referencedRelation: "project_expenses_by_category"
            referencedColumns: ["expense_id", "project_id"]
          },
          {
            foreignKeyName: "expense_evidence_files_expense_project_fk"
            columns: ["expense_id", "project_id"]
            isOneToOne: false
            referencedRelation: "project_expenses_by_stage"
            referencedColumns: ["expense_id", "project_id"]
          },
          {
            foreignKeyName: "expense_evidence_files_project_company_fk"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "project_kpi_summary"
            referencedColumns: ["project_id", "company_id"]
          },
          {
            foreignKeyName: "expense_evidence_files_project_company_fk"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      expense_history_events: {
        Row: {
          after_value: Json | null
          before_value: Json | null
          changed_at: string
          changed_by: string | null
          event_type: string
          expense_id: string
          id: string
          summary: string
        }
        Insert: {
          after_value?: Json | null
          before_value?: Json | null
          changed_at?: string
          changed_by?: string | null
          event_type: string
          expense_id: string
          id?: string
          summary: string
        }
        Update: {
          after_value?: Json | null
          before_value?: Json | null
          changed_at?: string
          changed_by?: string | null
          event_type?: string
          expense_id?: string
          id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_history_events_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_history_events_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "project_expenses_by_category"
            referencedColumns: ["expense_id"]
          },
          {
            foreignKeyName: "expense_history_events_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "project_expenses_by_stage"
            referencedColumns: ["expense_id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_key: string
          created_at: string
          deleted_at: string | null
          execution_progress_status: string | null
          execution_request_date: string | null
          execution_request_status: string | null
          expected_spend_date: string | null
          funding_source_key: string
          id: string
          memo: string | null
          pre_approval_status: string | null
          project_budget_category_id: string
          project_id: string
          stage_fields: Json
          stage_key: string
          title: string
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          amount: number
          category_key: string
          created_at?: string
          deleted_at?: string | null
          execution_progress_status?: string | null
          execution_request_date?: string | null
          execution_request_status?: string | null
          expected_spend_date?: string | null
          funding_source_key?: string
          id?: string
          memo?: string | null
          pre_approval_status?: string | null
          project_budget_category_id: string
          project_id: string
          stage_fields?: Json
          stage_key?: string
          title: string
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          category_key?: string
          created_at?: string
          deleted_at?: string | null
          execution_progress_status?: string | null
          execution_request_date?: string | null
          execution_request_status?: string | null
          expected_spend_date?: string | null
          funding_source_key?: string
          id?: string
          memo?: string | null
          pre_approval_status?: string | null
          project_budget_category_id?: string
          project_id?: string
          stage_fields?: Json
          stage_key?: string
          title?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_project_budget_category_match_fk"
            columns: [
              "project_budget_category_id",
              "project_id",
              "category_key",
            ]
            isOneToOne: false
            referencedRelation: "project_budget_categories"
            referencedColumns: ["id", "project_id", "category_key"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_kpi_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_budget_categories: {
        Row: {
          category_key: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          project_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_key: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          project_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_key?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          project_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_budget_categories_category_key_fkey"
            columns: ["category_key"]
            isOneToOne: false
            referencedRelation: "budget_category_policy_templates"
            referencedColumns: ["category_key"]
          },
          {
            foreignKeyName: "project_budget_categories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_kpi_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_budget_categories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_budget_category_budget_archive: {
        Row: {
          archived_at: string
          budget_amount: number
          category_key: string
          migration_version: string
          original_category_id: string
          project_id: string
          source_created_at: string
          source_deleted_at: string | null
          source_updated_at: string
        }
        Insert: {
          archived_at?: string
          budget_amount: number
          category_key: string
          migration_version?: string
          original_category_id: string
          project_id: string
          source_created_at: string
          source_deleted_at?: string | null
          source_updated_at: string
        }
        Update: {
          archived_at?: string
          budget_amount?: number
          category_key?: string
          migration_version?: string
          original_category_id?: string
          project_id?: string
          source_created_at?: string
          source_deleted_at?: string | null
          source_updated_at?: string
        }
        Relationships: []
      }
      project_documents: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          file_extension: string
          file_size: number
          id: string
          mime_type: string
          original_file_name: string
          project_id: string
          ready_at: string | null
          storage_bucket: string
          storage_path: string
          stored_file_name: string
          updated_at: string
          upload_status: string
          uploaded_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          file_extension: string
          file_size: number
          id?: string
          mime_type: string
          original_file_name: string
          project_id: string
          ready_at?: string | null
          storage_bucket?: string
          storage_path: string
          stored_file_name: string
          updated_at?: string
          upload_status?: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          file_extension?: string
          file_size?: number
          id?: string
          mime_type?: string
          original_file_name?: string
          project_id?: string
          ready_at?: string | null
          storage_bucket?: string
          storage_path?: string
          stored_file_name?: string
          updated_at?: string
          upload_status?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_company_fk"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "project_kpi_summary"
            referencedColumns: ["project_id", "company_id"]
          },
          {
            foreignKeyName: "project_documents_project_company_fk"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      projects: {
        Row: {
          agreement_end_date: string
          agreement_start_date: string
          assignment_name: string
          assignment_number: string
          company_id: string
          created_at: string
          deleted_at: string | null
          government_subsidy_amount: number
          host_institution: string
          id: string
          manager_email: string | null
          manager_name: string
          manager_phone: string | null
          profile_status: string
          project_name: string
          project_notes: string | null
          self_cash_amount: number
          self_contribution_amount: number
          self_in_kind_amount: number
          total_project_budget: number
          updated_at: string
        }
        Insert: {
          agreement_end_date: string
          agreement_start_date: string
          assignment_name: string
          assignment_number: string
          company_id: string
          created_at?: string
          deleted_at?: string | null
          government_subsidy_amount?: number
          host_institution: string
          id?: string
          manager_email?: string | null
          manager_name: string
          manager_phone?: string | null
          profile_status?: string
          project_name: string
          project_notes?: string | null
          self_cash_amount?: number
          self_contribution_amount?: number
          self_in_kind_amount?: number
          total_project_budget?: number
          updated_at?: string
        }
        Update: {
          agreement_end_date?: string
          agreement_start_date?: string
          assignment_name?: string
          assignment_number?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          government_subsidy_amount?: number
          host_institution?: string
          id?: string
          manager_email?: string | null
          manager_name?: string
          manager_phone?: string | null
          profile_status?: string
          project_name?: string
          project_notes?: string | null
          self_cash_amount?: number
          self_contribution_amount?: number
          self_in_kind_amount?: number
          total_project_budget?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      project_category_amount_summary: {
        Row: {
          actual_spent_amount: number | null
          category_key: string | null
          category_name: string | null
          expense_count: number | null
          project_budget_category_id: string | null
          project_id: string | null
          sort_order: number | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_project_budget_category_match_fk"
            columns: [
              "project_budget_category_id",
              "project_id",
              "category_key",
            ]
            isOneToOne: false
            referencedRelation: "project_budget_categories"
            referencedColumns: ["id", "project_id", "category_key"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_kpi_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_expenses_by_category: {
        Row: {
          amount: number | null
          category_key: string | null
          category_name: string | null
          created_at: string | null
          expense_id: string | null
          project_budget_category_id: string | null
          project_id: string | null
          sort_order: number | null
          stage_key: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_project_budget_category_match_fk"
            columns: [
              "project_budget_category_id",
              "project_id",
              "category_key",
            ]
            isOneToOne: false
            referencedRelation: "project_budget_categories"
            referencedColumns: ["id", "project_id", "category_key"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_kpi_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_expenses_by_stage: {
        Row: {
          amount: number | null
          category_key: string | null
          created_at: string | null
          expense_id: string | null
          project_budget_category_id: string | null
          project_id: string | null
          stage_key: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          category_key?: string | null
          created_at?: string | null
          expense_id?: string | null
          project_budget_category_id?: string | null
          project_id?: string | null
          stage_key?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          category_key?: string | null
          created_at?: string | null
          expense_id?: string | null
          project_budget_category_id?: string | null
          project_id?: string | null
          stage_key?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_project_budget_category_match_fk"
            columns: [
              "project_budget_category_id",
              "project_id",
              "category_key",
            ]
            isOneToOne: false
            referencedRelation: "project_budget_categories"
            referencedColumns: ["id", "project_id", "category_key"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_kpi_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_kanban_stage_summary: {
        Row: {
          actual_spent_amount: number | null
          expense_count: number | null
          project_id: string | null
          stage_key: string | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_kpi_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_kpi_summary: {
        Row: {
          actual_spent_amount: number | null
          company_id: string | null
          expense_count: number | null
          project_id: string | null
          project_name: string | null
          remaining_budget_amount: number | null
          spent_ratio: number | null
          total_project_budget: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_expense_evidence_with_history: {
        Args: {
          p_company_id: string
          p_document_key: string
          p_expense_id: string
          p_file_extension: string
          p_file_size: number
          p_id: string
          p_mime_type: string
          p_original_file_name: string
          p_project_id: string
          p_requirement_key: string | null
          p_storage_path: string
          p_stored_file_name: string
          p_uploaded_by?: string | null
        }
        Returns: Database["public"]["Tables"]["expense_evidence_files"]["Row"]
      }
      delete_expense_evidence_with_history: {
        Args: {
          p_changed_by?: string | null
          p_evidence_id: string
          p_expense_id: string
          p_project_id: string
        }
        Returns: string
      }
      get_project_dashboard_snapshot: {
        Args: { project_id: string }
        Returns: Json
      }
      update_expense_stage_with_history: {
        Args: {
          p_changed_by?: string | null
          p_current_stage_key: string
          p_expense_id: string
          p_project_id: string
          p_target_stage_key: string
        }
        Returns: Database["public"]["Tables"]["expenses"]["Row"]
      }
      update_expense_with_history: {
        Args: {
          p_amount: number
          p_category_key: string
          p_changed_by?: string | null
          p_execution_progress_status: string | null
          p_execution_request_date: string | null
          p_execution_request_status: string | null
          p_expected_spend_date: string | null
          p_expense_id: string
          p_funding_source_key: string
          p_history_summary?: string
          p_memo: string | null
          p_pre_approval_status: string | null
          p_project_budget_category_id: string
          p_project_id: string
          p_stage_fields: Json
          p_title: string
          p_vendor_name: string | null
        }
        Returns: Database["public"]["Tables"]["expenses"]["Row"]
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

