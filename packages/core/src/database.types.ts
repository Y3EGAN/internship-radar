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
      application_events: {
        Row: {
          actor_type: string
          application_id: string
          created_at: string
          event_type: string
          from_state: Database["public"]["Enums"]["application_state"] | null
          id: number
          owner_id: string
          sanitized_detail: Json
          to_state: Database["public"]["Enums"]["application_state"] | null
        }
        Insert: {
          actor_type: string
          application_id: string
          created_at?: string
          event_type: string
          from_state?: Database["public"]["Enums"]["application_state"] | null
          id?: never
          owner_id: string
          sanitized_detail?: Json
          to_state?: Database["public"]["Enums"]["application_state"] | null
        }
        Update: {
          actor_type?: string
          application_id?: string
          created_at?: string
          event_type?: string
          from_state?: Database["public"]["Enums"]["application_state"] | null
          id?: never
          owner_id?: string
          sanitized_detail?: Json
          to_state?: Database["public"]["Enums"]["application_state"] | null
        }
        Relationships: [
          {
            foreignKeyName: "application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      application_packages: {
        Row: {
          answer_manifest: Json
          application_id: string
          cover_letter_path: string | null
          created_at: string
          evidence_manifest: Json
          expires_at: string
          id: string
          owner_id: string
          resume_path: string | null
          state: Database["public"]["Enums"]["package_state"]
          superseded_at: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          answer_manifest?: Json
          application_id: string
          cover_letter_path?: string | null
          created_at?: string
          evidence_manifest?: Json
          expires_at?: string
          id?: string
          owner_id: string
          resume_path?: string | null
          state?: Database["public"]["Enums"]["package_state"]
          superseded_at?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          answer_manifest?: Json
          application_id?: string
          cover_letter_path?: string | null
          created_at?: string
          evidence_manifest?: Json
          expires_at?: string
          id?: string
          owner_id?: string
          resume_path?: string | null
          state?: Database["public"]["Enums"]["package_state"]
          superseded_at?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_packages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          created_at: string
          id: string
          job_id: number
          manual_submission_confirmed_at: string | null
          notes: string | null
          owner_id: string
          queued_at: string | null
          state: Database["public"]["Enums"]["application_state"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: number
          manual_submission_confirmed_at?: string | null
          notes?: string | null
          owner_id: string
          queued_at?: string | null
          state?: Database["public"]["Enums"]["application_state"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: number
          manual_submission_confirmed_at?: string | null
          notes?: string | null
          owner_id?: string
          queued_at?: string | null
          state?: Database["public"]["Enums"]["application_state"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          career_url: string
          created_at: string
          id: number
          is_active: boolean
          name: string
          owner_id: string
          priority: number
          tier: string
          updated_at: string
        }
        Insert: {
          career_url: string
          created_at?: string
          id?: never
          is_active?: boolean
          name: string
          owner_id: string
          priority?: number
          tier: string
          updated_at?: string
        }
        Update: {
          career_url?: string
          created_at?: string
          id?: never
          is_active?: boolean
          name?: string
          owner_id?: string
          priority?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_pairings: {
        Row: {
          consumed_at: string | null
          created_at: string
          device_label: string
          expires_at: string
          id: number
          owner_id: string
          pairing_code_hash: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          device_label: string
          expires_at: string
          id?: never
          owner_id: string
          pairing_code_hash: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          device_label?: string
          expires_at?: string
          id?: never
          owner_id?: string
          pairing_code_hash?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          device_label: string
          expires_at: string
          id: number
          last_used_at: string | null
          owner_id: string
          revoked_at: string | null
          token_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_label: string
          expires_at: string
          id?: never
          last_used_at?: string | null
          owner_id: string
          revoked_at?: string | null
          token_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_label?: string
          expires_at?: string
          id?: never
          last_used_at?: string | null
          owner_id?: string
          revoked_at?: string | null
          token_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_deliveries: {
        Row: {
          created_at: string
          id: number
          last_event_at: string
          outbox_id: number
          owner_id: string
          resend_message_id: string
          state: Database["public"]["Enums"]["delivery_state"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: never
          last_event_at?: string
          outbox_id: number
          owner_id: string
          resend_message_id: string
          state?: Database["public"]["Enums"]["delivery_state"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: never
          last_event_at?: string
          outbox_id?: number
          owner_id?: string
          resend_message_id?: string
          state?: Database["public"]["Enums"]["delivery_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_deliveries_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: true
            referencedRelation: "email_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          attempts: number
          created_at: string
          expires_at: string
          id: number
          last_error_code: string | null
          logical_event_key: string
          max_attempts: number
          message_type: string
          next_attempt_at: string
          owner_id: string
          payload: Json
          recipient: string
          sent_at: string | null
          state: Database["public"]["Enums"]["email_outbox_state"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          expires_at?: string
          id?: never
          last_error_code?: string | null
          logical_event_key: string
          max_attempts?: number
          message_type: string
          next_attempt_at?: string
          owner_id: string
          payload: Json
          recipient: string
          sent_at?: string | null
          state?: Database["public"]["Enums"]["email_outbox_state"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          expires_at?: string
          id?: never
          last_error_code?: string | null
          logical_event_key?: string
          max_attempts?: number
          message_type?: string
          next_attempt_at?: string
          owner_id?: string
          payload?: Json
          recipient?: string
          sent_at?: string | null
          state?: Database["public"]["Enums"]["email_outbox_state"]
          updated_at?: string
        }
        Relationships: []
      }
      email_suppressions: {
        Row: {
          created_at: string
          id: number
          owner_id: string
          reason: string
          recipient: string
          source_message_id: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          owner_id: string
          reason: string
          recipient: string
          source_message_id?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          owner_id?: string
          reason?: string
          recipient?: string
          source_message_id?: string | null
        }
        Relationships: []
      }
      job_scores: {
        Row: {
          created_at: string
          domain_fit: number
          eligibility_freshness: number
          evidence_fit: number
          explanation_inputs: Json
          id: number
          job_id: number
          location_fit: number
          owner_id: string
          skill_fit: number
          total_score: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain_fit: number
          eligibility_freshness: number
          evidence_fit: number
          explanation_inputs?: Json
          id?: never
          job_id: number
          location_fit: number
          owner_id: string
          skill_fit: number
          total_score?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain_fit?: number
          eligibility_freshness?: number
          evidence_fit?: number
          explanation_inputs?: Json
          id?: never
          job_id?: number
          location_fit?: number
          owner_id?: string
          skill_fit?: number
          total_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_scores_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_snapshots: {
        Row: {
          captured_at: string
          content_hash: string
          expires_at: string
          id: number
          job_source_id: number
          normalized_content: Json
          owner_id: string
        }
        Insert: {
          captured_at?: string
          content_hash: string
          expires_at?: string
          id?: never
          job_source_id: number
          normalized_content: Json
          owner_id: string
        }
        Update: {
          captured_at?: string
          content_hash?: string
          expires_at?: string
          id?: never
          job_source_id?: number
          normalized_content?: Json
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_snapshots_job_source_id_fkey"
            columns: ["job_source_id"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      job_sources: {
        Row: {
          content_hash: string
          created_at: string
          external_job_id: string
          first_seen_at: string
          id: number
          is_verified: boolean
          job_id: number
          last_seen_at: string
          owner_id: string
          source_endpoint_id: number
          source_url: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_job_id: string
          first_seen_at?: string
          id?: never
          is_verified?: boolean
          job_id: number
          last_seen_at?: string
          owner_id: string
          source_endpoint_id: number
          source_url: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_job_id?: string
          first_seen_at?: string
          id?: never
          is_verified?: boolean
          job_id?: number
          last_seen_at?: string
          owner_id?: string
          source_endpoint_id?: number
          source_url?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_sources_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sources_source_endpoint_id_fkey"
            columns: ["source_endpoint_id"]
            isOneToOne: false
            referencedRelation: "source_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          applied_at: string | null
          canonical_url: string | null
          closes_at: string | null
          company_id: number | null
          created_at: string
          description: string | null
          discovered_at: string
          id: number
          last_seen_at: string
          location_text: string | null
          normalized_location: string | null
          normalized_title: string
          owner_id: string
          posted_at: string | null
          preliminary_score: number
          role_family: string | null
          saved_at: string | null
          state: Database["public"]["Enums"]["job_state"]
          title: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          canonical_url?: string | null
          closes_at?: string | null
          company_id?: number | null
          created_at?: string
          description?: string | null
          discovered_at?: string
          id?: never
          last_seen_at?: string
          location_text?: string | null
          normalized_location?: string | null
          normalized_title: string
          owner_id: string
          posted_at?: string | null
          preliminary_score?: number
          role_family?: string | null
          saved_at?: string | null
          state?: Database["public"]["Enums"]["job_state"]
          title: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          canonical_url?: string | null
          closes_at?: string | null
          company_id?: number | null
          created_at?: string
          description?: string | null
          discovered_at?: string
          id?: never
          last_seen_at?: string
          location_text?: string | null
          normalized_location?: string | null
          normalized_title?: string
          owner_id?: string
          posted_at?: string | null
          preliminary_score?: number
          role_family?: string | null
          saved_at?: string | null
          state?: Database["public"]["Enums"]["job_state"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_evidence: {
        Row: {
          created_at: string
          evidence_type: string
          expires_at: string | null
          fact: string
          id: number
          label: string
          owner_id: string
          source_reference: string
          updated_at: string
          verified_at: string
        }
        Insert: {
          created_at?: string
          evidence_type: string
          expires_at?: string | null
          fact: string
          id?: never
          label: string
          owner_id: string
          source_reference: string
          updated_at?: string
          verified_at: string
        }
        Update: {
          created_at?: string
          evidence_type?: string
          expires_at?: string | null
          fact?: string
          id?: never
          label?: string
          owner_id?: string
          source_reference?: string
          updated_at?: string
          verified_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          alert_settings: Json
          contact_preferences: Json
          created_at: string
          daily_email_cap: number
          database_soft_limit_mb: number
          monthly_email_cap: number
          non_contact_preferences: Json
          owner_id: string
          storage_soft_limit_mb: number
          targeting_criteria: Json
          updated_at: string
        }
        Insert: {
          alert_settings?: Json
          contact_preferences?: Json
          created_at?: string
          daily_email_cap?: number
          database_soft_limit_mb?: number
          monthly_email_cap?: number
          non_contact_preferences?: Json
          owner_id: string
          storage_soft_limit_mb?: number
          targeting_criteria?: Json
          updated_at?: string
        }
        Update: {
          alert_settings?: Json
          contact_preferences?: Json
          created_at?: string
          daily_email_cap?: number
          database_soft_limit_mb?: number
          monthly_email_cap?: number
          non_contact_preferences?: Json
          owner_id?: string
          storage_soft_limit_mb?: number
          targeting_criteria?: Json
          updated_at?: string
        }
        Relationships: []
      }
      resend_webhook_events: {
        Row: {
          delivery_id: number | null
          event_id: string
          event_type: string
          id: number
          owner_id: string
          processed_at: string
          sanitized_metadata: Json
        }
        Insert: {
          delivery_id?: number | null
          event_id: string
          event_type: string
          id?: never
          owner_id: string
          processed_at?: string
          sanitized_metadata?: Json
        }
        Update: {
          delivery_id?: number | null
          event_id?: string
          event_type?: string
          id?: never
          owner_id?: string
          processed_at?: string
          sanitized_metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "resend_webhook_events_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "email_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_answers: {
        Row: {
          approved_answer: string
          confirmed_at: string
          created_at: string
          expires_at: string | null
          id: number
          normalized_question: string
          owner_id: string
          question_fingerprint: string
          scope: string
          sensitivity: Database["public"]["Enums"]["answer_sensitivity"]
          updated_at: string
        }
        Insert: {
          approved_answer: string
          confirmed_at: string
          created_at?: string
          expires_at?: string | null
          id?: never
          normalized_question: string
          owner_id: string
          question_fingerprint: string
          scope: string
          sensitivity: Database["public"]["Enums"]["answer_sensitivity"]
          updated_at?: string
        }
        Update: {
          approved_answer?: string
          confirmed_at?: string
          created_at?: string
          expires_at?: string | null
          id?: never
          normalized_question?: string
          owner_id?: string
          question_fingerprint?: string
          scope?: string
          sensitivity?: Database["public"]["Enums"]["answer_sensitivity"]
          updated_at?: string
        }
        Relationships: []
      }
      source_endpoints: {
        Row: {
          ats: Database["public"]["Enums"]["ats_type"]
          board_identifier: string
          company_id: number | null
          created_at: string
          disabled_reason: string | null
          endpoint_url: string
          failure_count: number
          id: number
          interval_seconds: number
          last_checked_at: string | null
          last_success_at: string | null
          next_due_at: string
          owner_id: string
          state: Database["public"]["Enums"]["source_state"]
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          ats: Database["public"]["Enums"]["ats_type"]
          board_identifier: string
          company_id?: number | null
          created_at?: string
          disabled_reason?: string | null
          endpoint_url: string
          failure_count?: number
          id?: never
          interval_seconds: number
          last_checked_at?: string | null
          last_success_at?: string | null
          next_due_at?: string
          owner_id: string
          state?: Database["public"]["Enums"]["source_state"]
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          ats?: Database["public"]["Enums"]["ats_type"]
          board_identifier?: string
          company_id?: number | null
          created_at?: string
          disabled_reason?: string | null
          endpoint_url?: string
          failure_count?: number
          id?: never
          interval_seconds?: number
          last_checked_at?: string | null
          last_success_at?: string | null
          next_due_at?: string
          owner_id?: string
          state?: Database["public"]["Enums"]["source_state"]
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_endpoints_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      source_runs: {
        Row: {
          attempted_count: number
          changed_count: number
          created_at: string
          discovered_count: number
          duration_ms: number | null
          failed_count: number
          finished_at: string | null
          id: number
          outcome: Database["public"]["Enums"]["run_outcome"]
          owner_id: string
          partition_key: string
          sanitized_error: string | null
          started_at: string
          succeeded_count: number
          workflow_run_id: string | null
        }
        Insert: {
          attempted_count?: number
          changed_count?: number
          created_at?: string
          discovered_count?: number
          duration_ms?: number | null
          failed_count?: number
          finished_at?: string | null
          id?: never
          outcome?: Database["public"]["Enums"]["run_outcome"]
          owner_id: string
          partition_key: string
          sanitized_error?: string | null
          started_at?: string
          succeeded_count?: number
          workflow_run_id?: string | null
        }
        Update: {
          attempted_count?: number
          changed_count?: number
          created_at?: string
          discovered_count?: number
          duration_ms?: number | null
          failed_count?: number
          finished_at?: string | null
          id?: never
          outcome?: Database["public"]["Enums"]["run_outcome"]
          owner_id?: string
          partition_key?: string
          sanitized_error?: string | null
          started_at?: string
          succeeded_count?: number
          workflow_run_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      authenticate_device_token: {
        Args: { p_token_hash: string }
        Returns: {
          device_label: string
          owner_id: string
          token_id: number
        }[]
      }
      claim_email_outbox: {
        Args: { p_limit?: number; p_owner_id: string }
        Returns: {
          attempt: number
          logical_event_key: string
          message_type: string
          outbox_id: number
          payload: Json
          recipient: string
        }[]
      }
      claim_next_application_preparation: {
        Args: { p_worker_id: string }
        Returns: {
          application_id: string
          approved_answers: Json
          cover_letter_requested: boolean
          evidence: Json
          job: Json
          owner_id: string
        }[]
      }
      claim_next_companion_application: {
        Args: { p_token_hash: string }
        Returns: {
          application_id: string
          job: Json
          owner_id: string
          package: Json
        }[]
      }
      consume_device_pairing: {
        Args: { p_pairing_code_hash: string; p_token_hash: string }
        Returns: {
          device_label: string
          expires_at: string
          owner_id: string
          token_id: number
        }[]
      }
      create_device_pairing: {
        Args: { p_device_label: string; p_pairing_code_hash: string }
        Returns: number
      }
      fail_application_preparation: {
        Args: {
          p_application_id: string
          p_error_code?: string
          p_questions: Json
        }
        Returns: undefined
      }
      finish_source_run: {
        Args: { p_source_run_id: number }
        Returns: Database["public"]["Enums"]["run_outcome"]
      }
      queue_application_preparation: {
        Args: { p_cover_letter_requested?: boolean; p_job_id: number }
        Returns: string
      }
      record_application_package: {
        Args: {
          p_answer_manifest: Json
          p_application_id: string
          p_cover_letter_path: string
          p_evidence_manifest: Json
          p_resume_path: string
        }
        Returns: string
      }
      record_companion_event: {
        Args: {
          p_application_id: string
          p_detail: Json
          p_event_type: string
          p_token_hash: string
        }
        Returns: Database["public"]["Enums"]["application_state"]
      }
      record_email_failure: {
        Args: {
          p_error_code: string
          p_outbox_id: number
          p_retryable: boolean
        }
        Returns: Database["public"]["Enums"]["email_outbox_state"]
      }
      record_email_send: {
        Args: { p_outbox_id: number; p_resend_message_id: string }
        Returns: undefined
      }
      record_resend_webhook: {
        Args: {
          p_event_id: string
          p_event_type: string
          p_owner_id: string
          p_recipient: string
          p_resend_message_id: string
          p_sanitized_metadata: Json
        }
        Returns: boolean
      }
      record_source_result: {
        Args: {
          p_changed_count: number
          p_discovered_count: number
          p_sanitized_error?: string
          p_source_endpoint_id: number
          p_source_run_id: number
          p_succeeded: boolean
        }
        Returns: Database["public"]["Enums"]["source_state"]
      }
      revoke_device_token: { Args: { p_token_id: number }; Returns: boolean }
      start_source_run: {
        Args: {
          p_owner_id: string
          p_partition_key: string
          p_workflow_run_id: string
        }
        Returns: number
      }
      try_start_source_run: {
        Args: {
          p_owner_id: string
          p_partition_key: string
          p_workflow_run_id: string
        }
        Returns: number
      }
      upsert_discovered_job: {
        Args: {
          p_canonical_url: string
          p_closes_at: string
          p_content_hash: string
          p_description: string
          p_domain_fit: number
          p_eligibility_freshness: number
          p_evidence_fit: number
          p_explanation_inputs: Json
          p_external_job_id: string
          p_location_fit: number
          p_location_text: string
          p_normalized_location: string
          p_normalized_title: string
          p_owner_id: string
          p_posted_at: string
          p_role_family: string
          p_skill_fit: number
          p_source_endpoint_id: number
          p_source_url: string
          p_title: string
          p_verification_state: Database["public"]["Enums"]["job_state"]
        }
        Returns: {
          content_changed: boolean
          job_id: number
          source_new: boolean
        }[]
      }
      upsert_discovered_job_with_alert: {
        Args: {
          p_alert_recipient: string
          p_canonical_url: string
          p_closes_at: string
          p_content_hash: string
          p_description: string
          p_domain_fit: number
          p_eligibility_freshness: number
          p_evidence_fit: number
          p_explanation_inputs: Json
          p_external_job_id: string
          p_location_fit: number
          p_location_text: string
          p_normalized_location: string
          p_normalized_title: string
          p_owner_id: string
          p_posted_at: string
          p_role_family: string
          p_skill_fit: number
          p_source_endpoint_id: number
          p_source_run_id: number
          p_source_url: string
          p_title: string
          p_verification_state: Database["public"]["Enums"]["job_state"]
        }
        Returns: {
          content_changed: boolean
          job_id: number
          source_new: boolean
        }[]
      }
    }
    Enums: {
      answer_sensitivity: "safe_reuse" | "contextual" | "never_infer"
      application_state:
        | "not_started"
        | "queued_for_codex"
        | "preparing"
        | "needs_input"
        | "package_ready"
        | "filling"
        | "ready_for_review"
        | "submitted"
        | "interviewing"
        | "rejected"
        | "withdrawn"
        | "offer"
        | "failed"
      ats_type:
        | "greenhouse"
        | "lever"
        | "ashby"
        | "workday"
        | "smartrecruiters"
        | "hosted_json"
        | "simplify"
        | "secondary"
      delivery_state:
        | "sent"
        | "delivered"
        | "delivery_delayed"
        | "bounced"
        | "complained"
        | "suppressed"
      email_outbox_state:
        | "pending"
        | "sending"
        | "sent"
        | "delivered"
        | "retry_wait"
        | "suppressed"
        | "failed"
      job_state:
        | "discovered"
        | "needs_verification"
        | "verified"
        | "shortlisted"
        | "dismissed"
        | "closed"
      package_state:
        | "draft"
        | "needs_input"
        | "rendering"
        | "verified"
        | "superseded"
      run_outcome: "running" | "succeeded" | "partial" | "failed" | "skipped"
      source_state: "healthy" | "degraded" | "failing" | "disabled"
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
      answer_sensitivity: ["safe_reuse", "contextual", "never_infer"],
      application_state: [
        "not_started",
        "queued_for_codex",
        "preparing",
        "needs_input",
        "package_ready",
        "filling",
        "ready_for_review",
        "submitted",
        "interviewing",
        "rejected",
        "withdrawn",
        "offer",
        "failed",
      ],
      ats_type: [
        "greenhouse",
        "lever",
        "ashby",
        "workday",
        "smartrecruiters",
        "hosted_json",
        "simplify",
        "secondary",
      ],
      delivery_state: [
        "sent",
        "delivered",
        "delivery_delayed",
        "bounced",
        "complained",
        "suppressed",
      ],
      email_outbox_state: [
        "pending",
        "sending",
        "sent",
        "delivered",
        "retry_wait",
        "suppressed",
        "failed",
      ],
      job_state: [
        "discovered",
        "needs_verification",
        "verified",
        "shortlisted",
        "dismissed",
        "closed",
      ],
      package_state: [
        "draft",
        "needs_input",
        "rendering",
        "verified",
        "superseded",
      ],
      run_outcome: ["running", "succeeded", "partial", "failed", "skipped"],
      source_state: ["healthy", "degraded", "failing", "disabled"],
    },
  },
} as const
