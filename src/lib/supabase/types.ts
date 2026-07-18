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
          account_manager: string
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
          account_manager?: string
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
          account_manager?: string
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
      discord_briefing_test_deliveries: {
        Row: {
          account_manager: string
          created_at: string
          error_message: string | null
          id: string
          status: string
        }
        Insert: {
          account_manager: string
          created_at?: string
          error_message?: string | null
          id?: string
          status: string
        }
        Update: {
          account_manager?: string
          created_at?: string
          error_message?: string | null
          id?: string
          status?: string
        }
        Relationships: []
      }
      discord_manager_channels: {
        Row: {
          account_manager: string
          created_at: string
          discord_channel_id: string
          updated_at: string
        }
        Insert: {
          account_manager: string
          created_at?: string
          discord_channel_id: string
          updated_at?: string
        }
        Update: {
          account_manager?: string
          created_at?: string
          discord_channel_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      discord_schedule_reminder_deliveries: {
        Row: {
          account_manager: string
          attempt_count: number
          claim_token: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          event_date: string
          external_request_started_at: string | null
          external_request_step: string | null
          id: string
          last_error: string | null
          lease_expires_at: string | null
          message_content: string
          notification_kind: string
          project_id: string
          schedule_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_manager: string
          attempt_count?: number
          claim_token?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          event_date: string
          external_request_started_at?: string | null
          external_request_step?: string | null
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          message_content: string
          notification_kind: string
          project_id: string
          schedule_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_manager?: string
          attempt_count?: number
          claim_token?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          event_date?: string
          external_request_started_at?: string | null
          external_request_step?: string | null
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          message_content?: string
          notification_kind?: string
          project_id?: string
          schedule_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discord_schedule_reminder_deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discord_schedule_reminder_deliveries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discord_schedule_reminder_deliveries_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "project_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      discord_weekly_briefing_deliveries: {
        Row: {
          account_manager: string
          attempt_count: number
          claim_token: string | null
          company_id: string | null
          completed_at: string | null
          created_at: string
          external_request_started_at: string | null
          external_request_step: string | null
          id: string
          kind: string
          last_error: string | null
          lease_expires_at: string | null
          message_chunks: Json
          parent_message_id: string | null
          scope_key: string
          sent_message_count: number
          seoul_week_key: string
          status: string
          thread_id: string | null
          updated_at: string
        }
        Insert: {
          account_manager: string
          attempt_count?: number
          claim_token?: string | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          external_request_started_at?: string | null
          external_request_step?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          lease_expires_at?: string | null
          message_chunks?: Json
          parent_message_id?: string | null
          scope_key: string
          sent_message_count?: number
          seoul_week_key: string
          status?: string
          thread_id?: string | null
          updated_at?: string
        }
        Update: {
          account_manager?: string
          attempt_count?: number
          claim_token?: string | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          external_request_started_at?: string | null
          external_request_step?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          lease_expires_at?: string | null
          message_chunks?: Json
          parent_message_id?: string | null
          scope_key?: string
          sent_message_count?: number
          seoul_week_key?: string
          status?: string
          thread_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discord_weekly_briefing_deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      expense_evidence_requirement_statuses: {
        Row: {
          changed_at: string
          changed_by: string | null
          expense_id: string
          id: string
          policy_snapshot_hash: string
          policy_version_id: string | null
          project_id: string
          requirement_key: string
          status: string
          waived_reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          expense_id: string
          id?: string
          policy_snapshot_hash: string
          policy_version_id?: string | null
          project_id: string
          requirement_key: string
          status: string
          waived_reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          expense_id?: string
          id?: string
          policy_snapshot_hash?: string
          policy_version_id?: string | null
          project_id?: string
          requirement_key?: string
          status?: string
          waived_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_evidence_requirement_statuses_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_evidence_requirement_statuses_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "project_expenses_by_category"
            referencedColumns: ["expense_id"]
          },
          {
            foreignKeyName: "expense_evidence_requirement_statuses_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "project_expenses_by_stage"
            referencedColumns: ["expense_id"]
          },
          {
            foreignKeyName: "expense_evidence_requirement_statuses_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "program_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_evidence_requirement_statuses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_kpi_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "expense_evidence_requirement_statuses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
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
          policy_snapshot: Json | null
          policy_version_id: string | null
          pre_approval_status: string | null
          project_budget_category_id: string | null
          project_id: string
          stage_fields: Json
          stage_key: string
          subcategory_key: string | null
          subcategory_name: string | null
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
          policy_snapshot?: Json | null
          policy_version_id?: string | null
          pre_approval_status?: string | null
          project_budget_category_id?: string | null
          project_id: string
          stage_fields?: Json
          stage_key?: string
          subcategory_key?: string | null
          subcategory_name?: string | null
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
          policy_snapshot?: Json | null
          policy_version_id?: string | null
          pre_approval_status?: string | null
          project_budget_category_id?: string | null
          project_id?: string
          stage_fields?: Json
          stage_key?: string
          subcategory_key?: string | null
          subcategory_name?: string | null
          title?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "program_policy_versions"
            referencedColumns: ["id"]
          },
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
      program_policy_categories: {
        Row: {
          category_key: string
          category_name: string
          created_at: string
          id: string
          policy_version_id: string
          raw_category_name: string | null
          review_status: string
          sort_order: number
          source_reference: Json
          updated_at: string
        }
        Insert: {
          category_key: string
          category_name: string
          created_at?: string
          id?: string
          policy_version_id: string
          raw_category_name?: string | null
          review_status?: string
          sort_order?: number
          source_reference?: Json
          updated_at?: string
        }
        Update: {
          category_key?: string
          category_name?: string
          created_at?: string
          id?: string
          policy_version_id?: string
          raw_category_name?: string | null
          review_status?: string
          sort_order?: number
          source_reference?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_policy_categories_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "program_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      program_policy_documents: {
        Row: {
          created_at: string
          file_size: number
          id: string
          mime_type: string
          original_file_name: string
          policy_version_id: string
          project_id: string
          ready_at: string | null
          role: string
          storage_bucket: string
          storage_path: string
          updated_at: string
          upload_status: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_size: number
          id?: string
          mime_type?: string
          original_file_name: string
          policy_version_id: string
          project_id: string
          ready_at?: string | null
          role: string
          storage_bucket?: string
          storage_path: string
          updated_at?: string
          upload_status?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_size?: number
          id?: string
          mime_type?: string
          original_file_name?: string
          policy_version_id?: string
          project_id?: string
          ready_at?: string | null
          role?: string
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
          upload_status?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_policy_documents_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "program_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_policy_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_kpi_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "program_policy_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      program_policy_evidence_requirements: {
        Row: {
          accepted_documents: Json
          category_id: string | null
          condition_text: string | null
          created_at: string
          document_key: string | null
          evidence_key: string
          evidence_name: string
          fulfillment_type: string
          id: string
          policy_version_id: string
          requirement_type: string
          review_status: string
          sort_order: number
          source_reference: Json
          subcategory_id: string | null
          updated_at: string
        }
        Insert: {
          accepted_documents?: Json
          category_id?: string | null
          condition_text?: string | null
          created_at?: string
          document_key?: string | null
          evidence_key: string
          evidence_name: string
          fulfillment_type: string
          id?: string
          policy_version_id: string
          requirement_type: string
          review_status?: string
          sort_order?: number
          source_reference?: Json
          subcategory_id?: string | null
          updated_at?: string
        }
        Update: {
          accepted_documents?: Json
          category_id?: string | null
          condition_text?: string | null
          created_at?: string
          document_key?: string | null
          evidence_key?: string
          evidence_name?: string
          fulfillment_type?: string
          id?: string
          policy_version_id?: string
          requirement_type?: string
          review_status?: string
          sort_order?: number
          source_reference?: Json
          subcategory_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_policy_evidence_requirements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "program_policy_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_policy_evidence_requirements_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "program_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_policy_evidence_requirements_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "program_policy_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      program_policy_subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          policy_version_id: string
          raw_subcategory_name: string | null
          review_status: string
          sort_order: number
          source_reference: Json
          subcategory_key: string
          subcategory_name: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          policy_version_id: string
          raw_subcategory_name?: string | null
          review_status?: string
          sort_order?: number
          source_reference?: Json
          subcategory_key: string
          subcategory_name: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          policy_version_id?: string
          raw_subcategory_name?: string | null
          review_status?: string
          sort_order?: number
          source_reference?: Json
          subcategory_key?: string
          subcategory_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_policy_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "program_policy_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_policy_subcategories_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "program_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      program_policy_versions: {
        Row: {
          archived_at: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          confirmed_summary: Json
          created_at: string
          created_by: string | null
          extraction_failure_reason: string | null
          extraction_status: string
          id: string
          operation_status: string
          project_id: string
          status: string
          updated_at: string
          version_number: number
        }
        Insert: {
          archived_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_summary?: Json
          created_at?: string
          created_by?: string | null
          extraction_failure_reason?: string | null
          extraction_status?: string
          id?: string
          operation_status?: string
          project_id: string
          status?: string
          updated_at?: string
          version_number: number
        }
        Update: {
          archived_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_summary?: Json
          created_at?: string
          created_by?: string | null
          extraction_failure_reason?: string | null
          extraction_status?: string
          id?: string
          operation_status?: string
          project_id?: string
          status?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_policy_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_kpi_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "program_policy_versions_project_id_fkey"
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
      project_document_template_links: {
        Row: {
          created_at: string
          document_type_id: string
          id: string
          project_document_id: string
          project_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          document_type_id: string
          id?: string
          project_document_id: string
          project_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          document_type_id?: string
          id?: string
          project_document_id?: string
          project_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_document_template_links_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "project_evidence_document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_document_template_links_project_document_id_fkey"
            columns: ["project_document_id"]
            isOneToOne: false
            referencedRelation: "project_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_document_template_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_kpi_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_document_template_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          document_purpose: string
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
          document_purpose?: string
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
          document_purpose?: string
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
      project_evidence_document_types: {
        Row: {
          category_key: string | null
          category_name: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          document_key: string
          id: string
          project_id: string
          sort_order: number
          source: string
          stage_key: string
          subcategory_key: string | null
          subcategory_name: string | null
          updated_at: string
        }
        Insert: {
          category_key?: string | null
          category_name?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          document_key: string
          id?: string
          project_id: string
          sort_order?: number
          source: string
          stage_key?: string
          subcategory_key?: string | null
          subcategory_name?: string | null
          updated_at?: string
        }
        Update: {
          category_key?: string | null
          category_name?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          document_key?: string
          id?: string
          project_id?: string
          sort_order?: number
          source?: string
          stage_key?: string
          subcategory_key?: string | null
          subcategory_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_evidence_document_types_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_kpi_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_evidence_document_types_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_schedules: {
        Row: {
          created_at: string
          id: string
          memo: string | null
          project_id: string
          scheduled_on: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          memo?: string | null
          project_id: string
          scheduled_on: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          memo?: string | null
          project_id?: string
          scheduled_on?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          agreement_end_date: string
          agreement_start_date: string
          assignment_name: string
          assignment_number: string | null
          company_id: string
          confirmed_policy_version_id: string | null
          created_at: string
          deleted_at: string | null
          government_subsidy_amount: number
          government_subsidy_ratio: number
          host_institution: string
          id: string
          manager_email: string | null
          manager_name: string | null
          manager_phone: string | null
          profile_status: string
          project_name: string
          project_notes: string | null
          self_cash_amount: number
          self_cash_ratio: number
          self_contribution_amount: number
          self_in_kind_amount: number
          self_in_kind_ratio: number
          total_project_budget: number
          updated_at: string
        }
        Insert: {
          agreement_end_date: string
          agreement_start_date: string
          assignment_name: string
          assignment_number?: string | null
          company_id: string
          confirmed_policy_version_id?: string | null
          created_at?: string
          deleted_at?: string | null
          government_subsidy_amount?: number
          government_subsidy_ratio?: number
          host_institution: string
          id?: string
          manager_email?: string | null
          manager_name?: string | null
          manager_phone?: string | null
          profile_status?: string
          project_name: string
          project_notes?: string | null
          self_cash_amount?: number
          self_cash_ratio?: number
          self_contribution_amount?: number
          self_in_kind_amount?: number
          self_in_kind_ratio?: number
          total_project_budget?: number
          updated_at?: string
        }
        Update: {
          agreement_end_date?: string
          agreement_start_date?: string
          assignment_name?: string
          assignment_number?: string | null
          company_id?: string
          confirmed_policy_version_id?: string | null
          created_at?: string
          deleted_at?: string | null
          government_subsidy_amount?: number
          government_subsidy_ratio?: number
          host_institution?: string
          id?: string
          manager_email?: string | null
          manager_name?: string | null
          manager_phone?: string | null
          profile_status?: string
          project_name?: string
          project_notes?: string | null
          self_cash_amount?: number
          self_cash_ratio?: number
          self_contribution_amount?: number
          self_in_kind_amount?: number
          self_in_kind_ratio?: number
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
          {
            foreignKeyName: "projects_confirmed_policy_version_id_fkey"
            columns: ["confirmed_policy_version_id"]
            isOneToOne: false
            referencedRelation: "program_policy_versions"
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
      budget_category_sort_order: {
        Args: { category_key: string }
        Returns: number
      }
      claim_discord_weekly_briefing_delivery: {
        Args: {
          p_account_manager: string
          p_company_id: string
          p_message_chunks: Json
          p_scope_key: string
          p_seoul_week_key: string
        }
        Returns: {
          claim_token: string
          id: string
          message_chunks: Json
          parent_message_id: string
          sent_message_count: number
          thread_id: string
        }[]
      }
      claim_discord_schedule_reminder_delivery: {
        Args: {
          p_account_manager: string
          p_company_id: string
          p_event_date: string
          p_message_content: string
          p_notification_kind: string
          p_project_id: string
          p_schedule_id: string
        }
        Returns: {
          claim_token: string
          id: string
          message_content: string
        }[]
      }
      confirm_program_policy_version: {
        Args: {
          p_confirmed_by: string
          p_confirmed_summary: Json
          p_policy_version_id: string
          p_project_id: string
        }
        Returns: {
          archived_at: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          confirmed_summary: Json
          created_at: string
          created_by: string | null
          extraction_failure_reason: string | null
          extraction_status: string
          id: string
          operation_status: string
          project_id: string
          status: string
          updated_at: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "program_policy_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
          p_requirement_key: string
          p_storage_path: string
          p_stored_file_name: string
          p_uploaded_by?: string
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "expense_evidence_files"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_expense_with_policy_lock: {
        Args: {
          p_amount: number
          p_category_key: string
          p_expected_spend_date: string
          p_funding_source_key: string
          p_memo: string
          p_project_id: string
          p_subcategory_key: string
          p_title: string
        }
        Returns: {
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
          policy_snapshot: Json | null
          policy_version_id: string | null
          pre_approval_status: string | null
          project_budget_category_id: string | null
          project_id: string
          stage_fields: Json
          stage_key: string
          subcategory_key: string | null
          subcategory_name: string | null
          title: string
          updated_at: string
          vendor_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_expense_evidence_with_history: {
        Args: {
          p_changed_by?: string
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
      renew_discord_weekly_briefing_delivery_lease: {
        Args: { p_claim_token: string; p_delivery_id: string }
        Returns: boolean
      }
      renew_discord_schedule_reminder_delivery_lease: {
        Args: { p_claim_token: string; p_delivery_id: string }
        Returns: boolean
      }
      replace_program_policy_draft: {
        Args: {
          p_categories: Json
          p_evidence_requirements: Json
          p_policy_version_id: string
          p_subcategories: Json
        }
        Returns: undefined
      }
      save_project_evidence_template_setup: {
        Args: { p_document_types: Json; p_links: Json; p_project_id: string }
        Returns: Json
      }
      seed_project_budget_categories: {
        Args: { target_project_id: string }
        Returns: undefined
      }
      update_expense_stage_with_history: {
        Args: {
          p_changed_by?: string
          p_current_stage_key: string
          p_expense_id: string
          p_project_id: string
          p_target_stage_key: string
        }
        Returns: {
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
          policy_snapshot: Json | null
          policy_version_id: string | null
          pre_approval_status: string | null
          project_budget_category_id: string | null
          project_id: string
          stage_fields: Json
          stage_key: string
          subcategory_key: string | null
          subcategory_name: string | null
          title: string
          updated_at: string
          vendor_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_expense_with_history: {
        Args: {
          p_amount: number
          p_category_key: string
          p_changed_by?: string
          p_execution_progress_status: string
          p_execution_request_date: string
          p_execution_request_status: string
          p_expected_spend_date: string
          p_expense_id: string
          p_funding_source_key: string
          p_history_summary?: string
          p_memo: string
          p_pre_approval_status: string
          p_project_budget_category_id: string
          p_project_id: string
          p_stage_fields: Json
          p_title: string
          p_vendor_name: string
        }
        Returns: {
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
          policy_snapshot: Json | null
          policy_version_id: string | null
          pre_approval_status: string | null
          project_budget_category_id: string | null
          project_id: string
          stage_fields: Json
          stage_key: string
          subcategory_key: string | null
          subcategory_name: string | null
          title: string
          updated_at: string
          vendor_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_policy_expense_with_history: {
        Args: {
          p_amount: number
          p_category_key: string
          p_changed_by?: string
          p_execution_progress_status: string
          p_execution_request_date: string
          p_execution_request_status: string
          p_expected_spend_date: string
          p_expense_id: string
          p_funding_source_key: string
          p_history_summary?: string
          p_memo: string
          p_policy_snapshot: Json
          p_policy_version_id: string
          p_pre_approval_status: string
          p_project_id: string
          p_stage_fields: Json
          p_subcategory_key: string
          p_subcategory_name: string
          p_title: string
          p_vendor_name: string
        }
        Returns: {
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
          policy_snapshot: Json | null
          policy_version_id: string | null
          pre_approval_status: string | null
          project_budget_category_id: string | null
          project_id: string
          stage_fields: Json
          stage_key: string
          subcategory_key: string | null
          subcategory_name: string | null
          title: string
          updated_at: string
          vendor_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "expenses"
          isOneToOne: true
          isSetofReturn: false
        }
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
