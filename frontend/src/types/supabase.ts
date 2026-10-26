/* Tự sinh bởi supabase/scripts/gen-types.ts, đừng sửa tay. Chạy lại: npm run supabase:types */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      academic_records: {
        Row: {
          user_id: string;
          latest_score: number | null;
          subject_combination: string | null;
          admission_method: string | null;
          recorded_year: number | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          latest_score?: number | null;
          subject_combination?: string | null;
          admission_method?: string | null;
          recorded_year?: number | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          latest_score?: number | null;
          subject_combination?: string | null;
          admission_method?: string | null;
          recorded_year?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "academic_records_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      admission_data: {
        Row: {
          id: string;
          training_program_id: string;
          admission_year: number;
          admission_method: string;
          subject_combination: string | null;
          quota: number | null;
          cutoff_score: number | null;
          minimum_score: number | null;
          source_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          training_program_id: string;
          admission_year: number;
          admission_method: string;
          subject_combination?: string | null;
          quota?: number | null;
          cutoff_score?: number | null;
          minimum_score?: number | null;
          source_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          training_program_id?: string;
          admission_year?: number;
          admission_method?: string;
          subject_combination?: string | null;
          quota?: number | null;
          cutoff_score?: number | null;
          minimum_score?: number | null;
          source_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admission_data_training_program_id_fkey";
            columns: ["training_program_id"];
            isOneToOne: false;
            referencedRelation: "training_programs";
            referencedColumns: ["id"];
          },
        ];
      };
      approved_roadmap_activities: {
        Row: {
          id: string;
          pillar: string;
          title: string;
          duration_weeks: number;
          hours: number;
          criteria_id: string | null;
          repeatable: boolean;
          is_active: boolean;
          created_at: string;
          activity_type: string | null;
          is_partner: boolean;
          source_url: string | null;
          expected_result: string | null;
        };
        Insert: {
          id?: string;
          pillar: string;
          title: string;
          duration_weeks?: number;
          hours?: number;
          criteria_id?: string | null;
          repeatable?: boolean;
          is_active?: boolean;
          created_at?: string;
          activity_type?: string | null;
          is_partner?: boolean;
          source_url?: string | null;
          expected_result?: string | null;
        };
        Update: {
          id?: string;
          pillar?: string;
          title?: string;
          duration_weeks?: number;
          hours?: number;
          criteria_id?: string | null;
          repeatable?: boolean;
          is_active?: boolean;
          created_at?: string;
          activity_type?: string | null;
          is_partner?: boolean;
          source_url?: string | null;
          expected_result?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "approved_roadmap_activities_criteria_id_fkey";
            columns: ["criteria_id"];
            isOneToOne: false;
            referencedRelation: "criteria";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_360_answers: {
        Row: {
          id: string;
          submission_id: string;
          question_id: string | null;
          criteria_id: string;
          score: number | null;
          is_insufficient_basis: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          question_id?: string | null;
          criteria_id: string;
          score?: number | null;
          is_insufficient_basis?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          question_id?: string | null;
          criteria_id?: string;
          score?: number | null;
          is_insufficient_basis?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_360_answers_criteria_id_fkey";
            columns: ["criteria_id"];
            isOneToOne: false;
            referencedRelation: "criteria";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_360_answers_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_360_answers_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "assessment_360_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_360_submissions: {
        Row: {
          id: string;
          subject_user_id: string;
          rater_group: Database["public"]["Enums"]["rater_group"];
          submission_channel: string;
          invitation_link_id: string | null;
          grid_student_id: string | null;
          resume_token: string;
          rater_nickname: string | null;
          relationship_label: string | null;
          acquaintance_duration: number | null;
          contact_frequency: number | null;
          observation_depth: number | null;
          understanding_score: number | null;
          submitter_ip: string | null;
          status: string;
          quality_flag: string;
          completion_seconds: number | null;
          started_at: string;
          submitted_at: string | null;
          decided_at: string | null;
          created_at: string;
          updated_at: string;
          understanding_quality_score: number | null;
          trust_index: number | null;
          trust_label: string | null;
          idle_seconds: number;
        };
        Insert: {
          id?: string;
          subject_user_id: string;
          rater_group: Database["public"]["Enums"]["rater_group"];
          submission_channel: string;
          invitation_link_id?: string | null;
          grid_student_id?: string | null;
          resume_token?: string;
          rater_nickname?: string | null;
          relationship_label?: string | null;
          acquaintance_duration?: number | null;
          contact_frequency?: number | null;
          observation_depth?: number | null;
          understanding_score?: number | null;
          submitter_ip?: string | null;
          status?: string;
          quality_flag?: string;
          completion_seconds?: number | null;
          started_at?: string;
          submitted_at?: string | null;
          decided_at?: string | null;
          created_at?: string;
          updated_at?: string;
          understanding_quality_score?: number | null;
          trust_index?: number | null;
          trust_label?: string | null;
          idle_seconds?: number;
        };
        Update: {
          id?: string;
          subject_user_id?: string;
          rater_group?: Database["public"]["Enums"]["rater_group"];
          submission_channel?: string;
          invitation_link_id?: string | null;
          grid_student_id?: string | null;
          resume_token?: string;
          rater_nickname?: string | null;
          relationship_label?: string | null;
          acquaintance_duration?: number | null;
          contact_frequency?: number | null;
          observation_depth?: number | null;
          understanding_score?: number | null;
          submitter_ip?: string | null;
          status?: string;
          quality_flag?: string;
          completion_seconds?: number | null;
          started_at?: string;
          submitted_at?: string | null;
          decided_at?: string | null;
          created_at?: string;
          updated_at?: string;
          understanding_quality_score?: number | null;
          trust_index?: number | null;
          trust_label?: string | null;
          idle_seconds?: number;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_360_submissions_grid_student_id_fkey";
            columns: ["grid_student_id"];
            isOneToOne: true;
            referencedRelation: "class_assessment_grid_students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_360_submissions_invitation_link_id_fkey";
            columns: ["invitation_link_id"];
            isOneToOne: false;
            referencedRelation: "invitation_links";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_360_submissions_subject_user_id_fkey";
            columns: ["subject_user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_answers: {
        Row: {
          id: string;
          session_id: string;
          question_id: string;
          criteria_id: string;
          score: number | null;
          is_insufficient_basis: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          question_id: string;
          criteria_id: string;
          score?: number | null;
          is_insufficient_basis?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          question_id?: string;
          criteria_id?: string;
          score?: number | null;
          is_insufficient_basis?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_answers_criteria_id_fkey";
            columns: ["criteria_id"];
            isOneToOne: false;
            referencedRelation: "criteria";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_answers_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_answers_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "assessment_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_core_values: {
        Row: {
          id: string;
          session_id: string;
          core_value_id: string;
          priority_rank: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          core_value_id: string;
          priority_rank: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          core_value_id?: string;
          priority_rank?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_core_values_core_value_id_fkey";
            columns: ["core_value_id"];
            isOneToOne: false;
            referencedRelation: "core_values";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_core_values_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "assessment_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_evidences: {
        Row: {
          id: string;
          session_id: string;
          grade_point_average: number | null;
          certificates: Json;
          achievements: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          grade_point_average?: number | null;
          certificates?: Json;
          achievements?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          grade_point_average?: number | null;
          certificates?: Json;
          achievements?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_evidences_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: true;
            referencedRelation: "assessment_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_result_group_scores: {
        Row: {
          id: string;
          result_id: string;
          group_id: string;
          score_source: string;
          score_1_5: number | null;
          score_percent: number | null;
          competency_level: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          result_id: string;
          group_id: string;
          score_source: string;
          score_1_5?: number | null;
          score_percent?: number | null;
          competency_level?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          result_id?: string;
          group_id?: string;
          score_source?: string;
          score_1_5?: number | null;
          score_percent?: number | null;
          competency_level?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_result_group_scores_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "criteria_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_result_group_scores_result_id_fkey";
            columns: ["result_id"];
            isOneToOne: false;
            referencedRelation: "assessment_results";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_result_scores: {
        Row: {
          id: string;
          result_id: string;
          criteria_id: string;
          score_source: string;
          score_1_5: number | null;
          score_percent: number | null;
          competency_level: string | null;
          created_at: string;
          updated_at: string;
          coverage: number | null;
          confidence: string | null;
        };
        Insert: {
          id?: string;
          result_id: string;
          criteria_id: string;
          score_source: string;
          score_1_5?: number | null;
          score_percent?: number | null;
          competency_level?: string | null;
          created_at?: string;
          updated_at?: string;
          coverage?: number | null;
          confidence?: string | null;
        };
        Update: {
          id?: string;
          result_id?: string;
          criteria_id?: string;
          score_source?: string;
          score_1_5?: number | null;
          score_percent?: number | null;
          competency_level?: string | null;
          created_at?: string;
          updated_at?: string;
          coverage?: number | null;
          confidence?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_result_scores_criteria_id_fkey";
            columns: ["criteria_id"];
            isOneToOne: false;
            referencedRelation: "criteria";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_result_scores_result_id_fkey";
            columns: ["result_id"];
            isOneToOne: false;
            referencedRelation: "assessment_results";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_result_snapshots: {
        Row: {
          id: string;
          result_id: string;
          user_id: string;
          status_label: Database["public"]["Enums"]["result_status_label"];
          snapshot_data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          result_id: string;
          user_id: string;
          status_label: Database["public"]["Enums"]["result_status_label"];
          snapshot_data: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          result_id?: string;
          user_id?: string;
          status_label?: Database["public"]["Enums"]["result_status_label"];
          snapshot_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_result_snapshots_result_id_fkey";
            columns: ["result_id"];
            isOneToOne: false;
            referencedRelation: "assessment_results";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_result_snapshots_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_result_weights: {
        Row: {
          id: string;
          result_id: string;
          submission_id: string;
          weight: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          result_id: string;
          submission_id: string;
          weight: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          result_id?: string;
          submission_id?: string;
          weight?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_result_weights_result_id_fkey";
            columns: ["result_id"];
            isOneToOne: false;
            referencedRelation: "assessment_results";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_result_weights_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "assessment_360_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_results: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          framework_version_id: string;
          status_label: Database["public"]["Enums"]["result_status_label"];
          invite_enabled: boolean;
          accepted_count: number;
          expected_count: number;
          groups_count: number;
          thin_data_flag: boolean;
          insufficient_basis_warning: boolean;
          finalized_mode: string | null;
          finalized_at: string | null;
          calculated_at: string | null;
          created_at: string;
          updated_at: string;
          qualitative_weight_status: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          framework_version_id: string;
          status_label?: Database["public"]["Enums"]["result_status_label"];
          invite_enabled?: boolean;
          accepted_count?: number;
          expected_count?: number;
          groups_count?: number;
          thin_data_flag?: boolean;
          insufficient_basis_warning?: boolean;
          finalized_mode?: string | null;
          finalized_at?: string | null;
          calculated_at?: string | null;
          created_at?: string;
          updated_at?: string;
          qualitative_weight_status?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          framework_version_id?: string;
          status_label?: Database["public"]["Enums"]["result_status_label"];
          invite_enabled?: boolean;
          accepted_count?: number;
          expected_count?: number;
          groups_count?: number;
          thin_data_flag?: boolean;
          insufficient_basis_warning?: boolean;
          finalized_mode?: string | null;
          finalized_at?: string | null;
          calculated_at?: string | null;
          created_at?: string;
          updated_at?: string;
          qualitative_weight_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_results_framework_version_id_fkey";
            columns: ["framework_version_id"];
            isOneToOne: false;
            referencedRelation: "framework_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_results_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: true;
            referencedRelation: "assessment_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_results_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_sessions: {
        Row: {
          id: string;
          user_id: string;
          framework_version_id: string;
          package_size: number;
          current_part: number;
          status: string;
          draft_expires_at: string | null;
          started_at: string;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          framework_version_id: string;
          package_size: number;
          current_part?: number;
          status?: string;
          draft_expires_at?: string | null;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          framework_version_id?: string;
          package_size?: number;
          current_part?: number;
          status?: string;
          draft_expires_at?: string | null;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_sessions_framework_version_id_fkey";
            columns: ["framework_version_id"];
            isOneToOne: false;
            referencedRelation: "framework_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          subject_user_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          ip_address: string | null;
          details: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          subject_user_id?: string | null;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          ip_address?: string | null;
          details?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          subject_user_id?: string | null;
          action?: string;
          target_type?: string | null;
          target_id?: string | null;
          ip_address?: string | null;
          details?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_subject_user_id_fkey";
            columns: ["subject_user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      career_events: {
        Row: {
          id: string;
          school_id: string | null;
          title: string;
          description: string | null;
          location: string | null;
          starts_at: string;
          created_by: string;
          created_at: string;
          seat_limit: number | null;
          registration_deadline: string | null;
        };
        Insert: {
          id?: string;
          school_id?: string | null;
          title: string;
          description?: string | null;
          location?: string | null;
          starts_at: string;
          created_by: string;
          created_at?: string;
          seat_limit?: number | null;
          registration_deadline?: string | null;
        };
        Update: {
          id?: string;
          school_id?: string | null;
          title?: string;
          description?: string | null;
          location?: string | null;
          starts_at?: string;
          created_by?: string;
          created_at?: string;
          seat_limit?: number | null;
          registration_deadline?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "career_events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "career_events_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      career_fields: {
        Row: {
          id: string;
          field_code: string;
          parent_field_id: string | null;
          field_name: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          field_code: string;
          parent_field_id?: string | null;
          field_name: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          field_code?: string;
          parent_field_id?: string | null;
          field_name?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "career_fields_parent_field_id_fkey";
            columns: ["parent_field_id"];
            isOneToOne: false;
            referencedRelation: "career_fields";
            referencedColumns: ["id"];
          },
        ];
      };
      career_fit_results: {
        Row: {
          id: string;
          result_id: string;
          user_id: string;
          career_id: string;
          matrix_version_id: string;
          match_g1_g5: number | null;
          match_g6: number | null;
          match_g7: number | null;
          applied_weight_g1_g5: number | null;
          applied_weight_g6: number | null;
          applied_weight_g7: number | null;
          riasec_method: string;
          career_fit_raw: number;
          component_completeness: number;
          rank_band: number;
          highest_weight_gap: number;
          unmet_criteria_count: number;
          calculated_at: string;
        };
        Insert: {
          id?: string;
          result_id: string;
          user_id: string;
          career_id: string;
          matrix_version_id: string;
          match_g1_g5?: number | null;
          match_g6?: number | null;
          match_g7?: number | null;
          applied_weight_g1_g5?: number | null;
          applied_weight_g6?: number | null;
          applied_weight_g7?: number | null;
          riasec_method: string;
          career_fit_raw: number;
          component_completeness: number;
          rank_band: number;
          highest_weight_gap?: number;
          unmet_criteria_count?: number;
          calculated_at?: string;
        };
        Update: {
          id?: string;
          result_id?: string;
          user_id?: string;
          career_id?: string;
          matrix_version_id?: string;
          match_g1_g5?: number | null;
          match_g6?: number | null;
          match_g7?: number | null;
          applied_weight_g1_g5?: number | null;
          applied_weight_g6?: number | null;
          applied_weight_g7?: number | null;
          riasec_method?: string;
          career_fit_raw?: number;
          component_completeness?: number;
          rank_band?: number;
          highest_weight_gap?: number;
          unmet_criteria_count?: number;
          calculated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "career_fit_results_career_id_fkey";
            columns: ["career_id"];
            isOneToOne: false;
            referencedRelation: "careers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "career_fit_results_matrix_version_id_fkey";
            columns: ["matrix_version_id"];
            isOneToOne: false;
            referencedRelation: "career_matrix_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "career_fit_results_result_id_fkey";
            columns: ["result_id"];
            isOneToOne: false;
            referencedRelation: "assessment_results";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "career_fit_results_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      career_fit_runs: {
        Row: {
          result_id: string;
          user_id: string;
          fingerprint: string;
          reason: string;
          calculated_at: string;
        };
        Insert: {
          result_id: string;
          user_id: string;
          fingerprint: string;
          reason: string;
          calculated_at?: string;
        };
        Update: {
          result_id?: string;
          user_id?: string;
          fingerprint?: string;
          reason?: string;
          calculated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "career_fit_runs_result_id_fkey";
            columns: ["result_id"];
            isOneToOne: true;
            referencedRelation: "assessment_results";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "career_fit_runs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      career_holland_profiles: {
        Row: {
          id: string;
          career_id: string;
          holland_code: string;
          strength: number;
          jd_count: number;
          verification_level: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          career_id: string;
          holland_code: string;
          strength: number;
          jd_count?: number;
          verification_level?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          career_id?: string;
          holland_code?: string;
          strength?: number;
          jd_count?: number;
          verification_level?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "career_holland_profiles_career_id_fkey";
            columns: ["career_id"];
            isOneToOne: false;
            referencedRelation: "careers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "career_holland_profiles_holland_code_fkey";
            columns: ["holland_code"];
            isOneToOne: false;
            referencedRelation: "holland_codes";
            referencedColumns: ["holland_code"];
          },
        ];
      };
      career_job_description_criteria: {
        Row: {
          id: string;
          job_description_id: string;
          criteria_id: string;
          selection_basis: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_description_id: string;
          criteria_id: string;
          selection_basis?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          job_description_id?: string;
          criteria_id?: string;
          selection_basis?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "career_job_description_criteria_criteria_id_fkey";
            columns: ["criteria_id"];
            isOneToOne: false;
            referencedRelation: "criteria";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "career_job_description_criteria_job_description_id_fkey";
            columns: ["job_description_id"];
            isOneToOne: false;
            referencedRelation: "career_job_descriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      career_job_descriptions: {
        Row: {
          id: string;
          career_id: string;
          source_id: number;
          jd_code: string | null;
          company_name: string | null;
          job_title: string | null;
          sub_branch: string | null;
          company_industry: string | null;
          work_location: string | null;
          work_mode: string | null;
          jd_url: string | null;
          career_level_raw: string | null;
          career_level: number | null;
          required_level_raw: string | null;
          required_level: number | null;
          career_summary: string | null;
          position_objective: string | null;
          main_tasks: string | null;
          daily_activities: string | null;
          work_outputs: string | null;
          key_stakeholders: string | null;
          required_knowledge: string | null;
          professional_skills: string | null;
          soft_skills: string | null;
          tools_technologies: string | null;
          education_requirement: string | null;
          certifications: string | null;
          experience_requirement: string | null;
          language_requirement: string | null;
          special_requirements: string | null;
          career_path: string | null;
          work_environment: string | null;
          benefits: string | null;
          salary_reference: string | null;
          behavior_evidence: string | null;
          data_source: string | null;
          created_at: string;
          updated_at: string;
          data_checked_at: string | null;
          data_checked_kind: string | null;
        };
        Insert: {
          id?: string;
          career_id: string;
          source_id: number;
          jd_code?: string | null;
          company_name?: string | null;
          job_title?: string | null;
          sub_branch?: string | null;
          company_industry?: string | null;
          work_location?: string | null;
          work_mode?: string | null;
          jd_url?: string | null;
          career_level_raw?: string | null;
          career_level?: number | null;
          required_level_raw?: string | null;
          required_level?: number | null;
          career_summary?: string | null;
          position_objective?: string | null;
          main_tasks?: string | null;
          daily_activities?: string | null;
          work_outputs?: string | null;
          key_stakeholders?: string | null;
          required_knowledge?: string | null;
          professional_skills?: string | null;
          soft_skills?: string | null;
          tools_technologies?: string | null;
          education_requirement?: string | null;
          certifications?: string | null;
          experience_requirement?: string | null;
          language_requirement?: string | null;
          special_requirements?: string | null;
          career_path?: string | null;
          work_environment?: string | null;
          benefits?: string | null;
          salary_reference?: string | null;
          behavior_evidence?: string | null;
          data_source?: string | null;
          created_at?: string;
          updated_at?: string;
          data_checked_at?: string | null;
          data_checked_kind?: string | null;
        };
        Update: {
          id?: string;
          career_id?: string;
          source_id?: number;
          jd_code?: string | null;
          company_name?: string | null;
          job_title?: string | null;
          sub_branch?: string | null;
          company_industry?: string | null;
          work_location?: string | null;
          work_mode?: string | null;
          jd_url?: string | null;
          career_level_raw?: string | null;
          career_level?: number | null;
          required_level_raw?: string | null;
          required_level?: number | null;
          career_summary?: string | null;
          position_objective?: string | null;
          main_tasks?: string | null;
          daily_activities?: string | null;
          work_outputs?: string | null;
          key_stakeholders?: string | null;
          required_knowledge?: string | null;
          professional_skills?: string | null;
          soft_skills?: string | null;
          tools_technologies?: string | null;
          education_requirement?: string | null;
          certifications?: string | null;
          experience_requirement?: string | null;
          language_requirement?: string | null;
          special_requirements?: string | null;
          career_path?: string | null;
          work_environment?: string | null;
          benefits?: string | null;
          salary_reference?: string | null;
          behavior_evidence?: string | null;
          data_source?: string | null;
          created_at?: string;
          updated_at?: string;
          data_checked_at?: string | null;
          data_checked_kind?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "career_job_descriptions_career_id_fkey";
            columns: ["career_id"];
            isOneToOne: false;
            referencedRelation: "careers";
            referencedColumns: ["id"];
          },
        ];
      };
      career_major_links: {
        Row: {
          id: string;
          career_id: string;
          major_id: string;
          link_level: string;
          link_source: string;
          is_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          career_id: string;
          major_id: string;
          link_level?: string;
          link_source?: string;
          is_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          career_id?: string;
          major_id?: string;
          link_level?: string;
          link_source?: string;
          is_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "career_major_links_career_id_fkey";
            columns: ["career_id"];
            isOneToOne: false;
            referencedRelation: "careers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "career_major_links_major_id_fkey";
            columns: ["major_id"];
            isOneToOne: false;
            referencedRelation: "majors";
            referencedColumns: ["id"];
          },
        ];
      };
      career_match_snapshots: {
        Row: {
          id: string;
          result_id: string;
          user_id: string;
          career_matrix_version: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          result_id: string;
          user_id: string;
          career_matrix_version?: string | null;
          payload: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          result_id?: string;
          user_id?: string;
          career_matrix_version?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "career_match_snapshots_result_id_fkey";
            columns: ["result_id"];
            isOneToOne: false;
            referencedRelation: "assessment_results";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "career_match_snapshots_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      career_matrix_versions: {
        Row: {
          id: string;
          version_code: string;
          is_current: boolean;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          version_code: string;
          is_current?: boolean;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          version_code?: string;
          is_current?: boolean;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      career_requirements: {
        Row: {
          id: string;
          career_id: string;
          criteria_id: string;
          matrix_version_id: string;
          required_score: number;
          career_weight: number;
          jd_count: number;
          verification_level: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          career_id: string;
          criteria_id: string;
          matrix_version_id: string;
          required_score: number;
          career_weight: number;
          jd_count?: number;
          verification_level?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          career_id?: string;
          criteria_id?: string;
          matrix_version_id?: string;
          required_score?: number;
          career_weight?: number;
          jd_count?: number;
          verification_level?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "career_requirements_career_id_fkey";
            columns: ["career_id"];
            isOneToOne: false;
            referencedRelation: "careers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "career_requirements_criteria_id_fkey";
            columns: ["criteria_id"];
            isOneToOne: false;
            referencedRelation: "criteria";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "career_requirements_matrix_version_id_fkey";
            columns: ["matrix_version_id"];
            isOneToOne: false;
            referencedRelation: "career_matrix_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      careers: {
        Row: {
          id: string;
          career_code: string;
          career_field_id: string;
          career_name: string;
          source_group_id: string;
          status: string;
          holland_top3: string | null;
          qualifying_jd_count: number;
          is_standard_complete: boolean;
          data_checked_at: string | null;
          created_at: string;
          updated_at: string;
          growth_level: string | null;
          data_checked_kind: string | null;
        };
        Insert: {
          id?: string;
          career_code: string;
          career_field_id: string;
          career_name: string;
          source_group_id: string;
          status?: string;
          holland_top3?: string | null;
          qualifying_jd_count?: number;
          is_standard_complete?: boolean;
          data_checked_at?: string | null;
          created_at?: string;
          updated_at?: string;
          growth_level?: string | null;
          data_checked_kind?: string | null;
        };
        Update: {
          id?: string;
          career_code?: string;
          career_field_id?: string;
          career_name?: string;
          source_group_id?: string;
          status?: string;
          holland_top3?: string | null;
          qualifying_jd_count?: number;
          is_standard_complete?: boolean;
          data_checked_at?: string | null;
          created_at?: string;
          updated_at?: string;
          growth_level?: string | null;
          data_checked_kind?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "careers_career_field_id_fkey";
            columns: ["career_field_id"];
            isOneToOne: false;
            referencedRelation: "career_fields";
            referencedColumns: ["id"];
          },
        ];
      };
      class_assessment_grid_details: {
        Row: {
          id: string;
          grid_student_id: string;
          criteria_id: string;
          score: number | null;
          is_insufficient_basis: boolean;
          created_at: string;
          updated_at: string;
          question_id: string | null;
        };
        Insert: {
          id?: string;
          grid_student_id: string;
          criteria_id: string;
          score?: number | null;
          is_insufficient_basis?: boolean;
          created_at?: string;
          updated_at?: string;
          question_id?: string | null;
        };
        Update: {
          id?: string;
          grid_student_id?: string;
          criteria_id?: string;
          score?: number | null;
          is_insufficient_basis?: boolean;
          created_at?: string;
          updated_at?: string;
          question_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "class_assessment_grid_details_criteria_id_fkey";
            columns: ["criteria_id"];
            isOneToOne: false;
            referencedRelation: "criteria";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_assessment_grid_details_grid_student_id_fkey";
            columns: ["grid_student_id"];
            isOneToOne: false;
            referencedRelation: "class_assessment_grid_students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_assessment_grid_details_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      class_assessment_grid_questions: {
        Row: {
          id: string;
          grid_id: string;
          question_id: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          grid_id: string;
          question_id: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          grid_id?: string;
          question_id?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_assessment_grid_questions_grid_id_fkey";
            columns: ["grid_id"];
            isOneToOne: false;
            referencedRelation: "class_assessment_grids";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_assessment_grid_questions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      class_assessment_grid_students: {
        Row: {
          id: string;
          grid_id: string;
          student_id: string;
          acquaintance_duration: number | null;
          contact_frequency: number | null;
          observation_depth: number | null;
          understanding_score: number | null;
          created_at: string;
          updated_at: string;
          submitted_at: string | null;
          qualitative_note: string | null;
        };
        Insert: {
          id?: string;
          grid_id: string;
          student_id: string;
          acquaintance_duration?: number | null;
          contact_frequency?: number | null;
          observation_depth?: number | null;
          understanding_score?: number | null;
          created_at?: string;
          updated_at?: string;
          submitted_at?: string | null;
          qualitative_note?: string | null;
        };
        Update: {
          id?: string;
          grid_id?: string;
          student_id?: string;
          acquaintance_duration?: number | null;
          contact_frequency?: number | null;
          observation_depth?: number | null;
          understanding_score?: number | null;
          created_at?: string;
          updated_at?: string;
          submitted_at?: string | null;
          qualitative_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "class_assessment_grid_students_grid_id_fkey";
            columns: ["grid_id"];
            isOneToOne: false;
            referencedRelation: "class_assessment_grids";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_assessment_grid_students_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      class_assessment_grids: {
        Row: {
          id: string;
          class_id: string;
          teacher_id: string;
          status: string;
          default_acquaintance_duration: number | null;
          default_contact_frequency: number | null;
          default_observation_depth: number | null;
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
          package_size: number | null;
          grading_mode: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          teacher_id: string;
          status?: string;
          default_acquaintance_duration?: number | null;
          default_contact_frequency?: number | null;
          default_observation_depth?: number | null;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          package_size?: number | null;
          grading_mode?: string;
        };
        Update: {
          id?: string;
          class_id?: string;
          teacher_id?: string;
          status?: string;
          default_acquaintance_duration?: number | null;
          default_contact_frequency?: number | null;
          default_observation_depth?: number | null;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          package_size?: number | null;
          grading_mode?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_assessment_grids_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_assessment_grids_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      class_members: {
        Row: {
          id: string;
          class_id: string;
          user_id: string | null;
          member_role: string;
          status: string;
          joined_via: string | null;
          roster_student_code: string | null;
          roster_full_name: string | null;
          joined_at: string | null;
          created_at: string;
          updated_at: string;
          roster_date_of_birth: string | null;
        };
        Insert: {
          id?: string;
          class_id: string;
          user_id?: string | null;
          member_role: string;
          status?: string;
          joined_via?: string | null;
          roster_student_code?: string | null;
          roster_full_name?: string | null;
          joined_at?: string | null;
          created_at?: string;
          updated_at?: string;
          roster_date_of_birth?: string | null;
        };
        Update: {
          id?: string;
          class_id?: string;
          user_id?: string | null;
          member_role?: string;
          status?: string;
          joined_via?: string | null;
          roster_student_code?: string | null;
          roster_full_name?: string | null;
          joined_at?: string | null;
          created_at?: string;
          updated_at?: string;
          roster_date_of_birth?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      classes: {
        Row: {
          id: string;
          school_id: string;
          class_name: string;
          grade: number | null;
          school_year: string;
          class_code: string;
          created_by: string | null;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          class_name: string;
          grade?: number | null;
          school_year: string;
          class_code?: string;
          created_by?: string | null;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          class_name?: string;
          grade?: number | null;
          school_year?: string;
          class_code?: string;
          created_by?: string | null;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classes_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      communities: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "communities_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      community_comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "community_posts";
            referencedColumns: ["id"];
          },
        ];
      };
      community_members: {
        Row: {
          community_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          community_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          community_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey";
            columns: ["community_id"];
            isOneToOne: false;
            referencedRelation: "communities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      community_posts: {
        Row: {
          id: string;
          community_id: string;
          author_id: string;
          body: string;
          hidden_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          community_id: string;
          author_id: string;
          body: string;
          hidden_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          community_id?: string;
          author_id?: string;
          body?: string;
          hidden_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_posts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_posts_community_id_fkey";
            columns: ["community_id"];
            isOneToOne: false;
            referencedRelation: "communities";
            referencedColumns: ["id"];
          },
        ];
      };
      community_topics: {
        Row: {
          id: string;
          community_id: string;
          title: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          community_id: string;
          title: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          community_id?: string;
          title?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_topics_community_id_fkey";
            columns: ["community_id"];
            isOneToOne: false;
            referencedRelation: "communities";
            referencedColumns: ["id"];
          },
        ];
      };
      comparison_plans: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          career_ids: string[];
          created_at: string;
          options: Json;
          weights: Json;
          budget_per_year: number | null;
          learner_score: number | null;
          ranking: Json;
          preferred_option_id: string | null;
          preferred_reason: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          career_ids: string[];
          created_at?: string;
          options?: Json;
          weights?: Json;
          budget_per_year?: number | null;
          learner_score?: number | null;
          ranking?: Json;
          preferred_option_id?: string | null;
          preferred_reason?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          title?: string;
          career_ids?: string[];
          created_at?: string;
          options?: Json;
          weights?: Json;
          budget_per_year?: number | null;
          learner_score?: number | null;
          ranking?: Json;
          preferred_option_id?: string | null;
          preferred_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "comparison_plans_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      connection_requests: {
        Row: {
          id: string;
          requester_id: string;
          mentor_id: string;
          message: string | null;
          status: string;
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          requester_id: string;
          mentor_id: string;
          message?: string | null;
          status?: string;
          created_at?: string;
          responded_at?: string | null;
        };
        Update: {
          id?: string;
          requester_id?: string;
          mentor_id?: string;
          message?: string | null;
          status?: string;
          created_at?: string;
          responded_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "connection_requests_mentor_id_fkey";
            columns: ["mentor_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "connection_requests_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      consent_records: {
        Row: {
          id: string;
          user_id: string;
          consent_type: string;
          granted_to_user_id: string | null;
          displayed_content: string;
          granted_at: string;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          consent_type: string;
          granted_to_user_id?: string | null;
          displayed_content: string;
          granted_at?: string;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          consent_type?: string;
          granted_to_user_id?: string | null;
          displayed_content?: string;
          granted_at?: string;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consent_records_granted_to_user_id_fkey";
            columns: ["granted_to_user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consent_records_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      content_reports: {
        Row: {
          id: string;
          post_id: string;
          reporter_id: string;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          reporter_id: string;
          reason: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          reporter_id?: string;
          reason?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_reports_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "community_posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      core_values: {
        Row: {
          id: string;
          value_code: string;
          name: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          value_code: string;
          name: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          value_code?: string;
          name?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      course_project_suggestions: {
        Row: {
          id: string;
          criteria_id: string | null;
          kind: string;
          title: string;
          provider: string | null;
          url: string | null;
          is_partner: boolean;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          criteria_id?: string | null;
          kind: string;
          title: string;
          provider?: string | null;
          url?: string | null;
          is_partner?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          criteria_id?: string | null;
          kind?: string;
          title?: string;
          provider?: string | null;
          url?: string | null;
          is_partner?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "course_project_suggestions_criteria_id_fkey";
            columns: ["criteria_id"];
            isOneToOne: false;
            referencedRelation: "criteria";
            referencedColumns: ["id"];
          },
        ];
      };
      criteria: {
        Row: {
          id: string;
          group_id: string;
          dimension_code: string;
          name: string;
          definition: string | null;
          behavior_indicator: string | null;
          reference_source: string | null;
          holland_code: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          is_short_set: boolean;
        };
        Insert: {
          id?: string;
          group_id: string;
          dimension_code: string;
          name: string;
          definition?: string | null;
          behavior_indicator?: string | null;
          reference_source?: string | null;
          holland_code?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          is_short_set?: boolean;
        };
        Update: {
          id?: string;
          group_id?: string;
          dimension_code?: string;
          name?: string;
          definition?: string | null;
          behavior_indicator?: string | null;
          reference_source?: string | null;
          holland_code?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          is_short_set?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "criteria_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "criteria_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "criteria_holland_code_fkey";
            columns: ["holland_code"];
            isOneToOne: false;
            referencedRelation: "holland_codes";
            referencedColumns: ["holland_code"];
          },
        ];
      };
      criteria_groups: {
        Row: {
          id: string;
          group_code: string;
          name: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          group_code: string;
          name: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          group_code?: string;
          name?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      criteria_rater_visibility: {
        Row: {
          id: string;
          criteria_id: string;
          rater_group: Database["public"]["Enums"]["rater_group"];
          is_visible: boolean;
          scale_method: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          criteria_id: string;
          rater_group: Database["public"]["Enums"]["rater_group"];
          is_visible?: boolean;
          scale_method?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          criteria_id?: string;
          rater_group?: Database["public"]["Enums"]["rater_group"];
          is_visible?: boolean;
          scale_method?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "criteria_rater_visibility_criteria_id_fkey";
            columns: ["criteria_id"];
            isOneToOne: false;
            referencedRelation: "criteria";
            referencedColumns: ["id"];
          },
        ];
      };
      decision_history: {
        Row: {
          id: string;
          owner_id: string;
          plan_id: string | null;
          action: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          plan_id?: string | null;
          action: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          plan_id?: string | null;
          action?: string;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "decision_history_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "decision_history_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "comparison_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      decision_report_shares: {
        Row: {
          report_id: string;
          shared_with: string;
          consensus_at: string | null;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          report_id: string;
          shared_with: string;
          consensus_at?: string | null;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          report_id?: string;
          shared_with?: string;
          consensus_at?: string | null;
          comment?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "decision_report_shares_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "decision_reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "decision_report_shares_shared_with_fkey";
            columns: ["shared_with"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      decision_reports: {
        Row: {
          id: string;
          owner_id: string;
          plan_id: string;
          include_finance: boolean;
          owner_confirmed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          plan_id: string;
          include_finance?: boolean;
          owner_confirmed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          plan_id?: string;
          include_finance?: boolean;
          owner_confirmed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "decision_reports_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "decision_reports_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "comparison_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      event_registrations: {
        Row: {
          event_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          event_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          event_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "career_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_registrations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      family_budgets: {
        Row: {
          user_id: string;
          amount_per_year: number | null;
          note: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          amount_per_year?: number | null;
          note?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          amount_per_year?: number | null;
          note?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "family_budgets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      framework_versions: {
        Row: {
          id: string;
          version_code: string;
          is_current: boolean;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          version_code: string;
          is_current?: boolean;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          version_code?: string;
          is_current?: boolean;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      guardian_consent_tokens: {
        Row: {
          id: string;
          subject_user_id: string;
          token: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          subject_user_id: string;
          token: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          subject_user_id?: string;
          token?: string;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guardian_consent_tokens_subject_user_id_fkey";
            columns: ["subject_user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      holland_codes: {
        Row: {
          id: string;
          holland_code: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          holland_code: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          holland_code?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      institutions: {
        Row: {
          id: string;
          institution_name: string;
          normalized_name: string;
          parent_institution_id: string | null;
          institution_type: string;
          ownership: string | null;
          segment: string | null;
          segment_rank: number | null;
          main_field_id: string | null;
          city: string | null;
          city_before_merger: string | null;
          address: string | null;
          website_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_name: string;
          normalized_name: string;
          parent_institution_id?: string | null;
          institution_type: string;
          ownership?: string | null;
          segment?: string | null;
          segment_rank?: number | null;
          main_field_id?: string | null;
          city?: string | null;
          city_before_merger?: string | null;
          address?: string | null;
          website_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_name?: string;
          normalized_name?: string;
          parent_institution_id?: string | null;
          institution_type?: string;
          ownership?: string | null;
          segment?: string | null;
          segment_rank?: number | null;
          main_field_id?: string | null;
          city?: string | null;
          city_before_merger?: string | null;
          address?: string | null;
          website_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "institutions_main_field_id_fkey";
            columns: ["main_field_id"];
            isOneToOne: false;
            referencedRelation: "career_fields";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "institutions_parent_institution_id_fkey";
            columns: ["parent_institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
        ];
      };
      invitation_links: {
        Row: {
          id: string;
          user_id: string;
          rater_group: Database["public"]["Enums"]["rater_group"];
          link_token: string;
          expected_count: number;
          qr_image_path: string | null;
          expires_at: string;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          rater_group: Database["public"]["Enums"]["rater_group"];
          link_token?: string;
          expected_count: number;
          qr_image_path?: string | null;
          expires_at: string;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          rater_group?: Database["public"]["Enums"]["rater_group"];
          link_token?: string;
          expected_count?: number;
          qr_image_path?: string | null;
          expires_at?: string;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitation_links_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      majors: {
        Row: {
          id: string;
          major_name: string;
          normalized_name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          major_name: string;
          normalized_name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          major_name?: string;
          normalized_name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      mentor_profiles: {
        Row: {
          user_id: string;
          headline: string;
          verified: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          headline: string;
          verified?: boolean;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          headline?: string;
          verified?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mentor_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_settings: {
        Row: {
          id: string;
          user_id: string;
          notification_type: string;
          in_app_enabled: boolean;
          email_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          notification_type: string;
          in_app_enabled?: boolean;
          email_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          notification_type?: string;
          in_app_enabled?: boolean;
          email_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          notification_type: string;
          title: string;
          body: string | null;
          payload: Json;
          read_at: string | null;
          email_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          notification_type: string;
          title: string;
          body?: string | null;
          payload?: Json;
          read_at?: string | null;
          email_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          notification_type?: string;
          title?: string;
          body?: string | null;
          payload?: Json;
          read_at?: string | null;
          email_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      operation_parameters: {
        Row: {
          id: string;
          param_code: string;
          param_name: string;
          param_value: Json;
          is_current: boolean;
          effective_from: string;
          changed_by: string | null;
          created_at: string;
          updated_at: string;
          srs_code: string | null;
          verification_level: string;
        };
        Insert: {
          id?: string;
          param_code: string;
          param_name: string;
          param_value: Json;
          is_current?: boolean;
          effective_from?: string;
          changed_by?: string | null;
          created_at?: string;
          updated_at?: string;
          srs_code?: string | null;
          verification_level?: string;
        };
        Update: {
          id?: string;
          param_code?: string;
          param_name?: string;
          param_value?: Json;
          is_current?: boolean;
          effective_from?: string;
          changed_by?: string | null;
          created_at?: string;
          updated_at?: string;
          srs_code?: string | null;
          verification_level?: string;
        };
        Relationships: [
          {
            foreignKeyName: "operation_parameters_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      parent_link_codes: {
        Row: {
          id: string;
          student_id: string;
          code: string;
          expires_at: string;
          used_by: string | null;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          code: string;
          expires_at: string;
          used_by?: string | null;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          code?: string;
          expires_at?: string;
          used_by?: string | null;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "parent_link_codes_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "parent_link_codes_used_by_fkey";
            columns: ["used_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      qualitative_evaluations: {
        Row: {
          id: string;
          submission_id: string;
          reviewer_id: string;
          empathic_accuracy: number[];
          solo_scores: number[];
          carkhuff: number | null;
          supplemental_score: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          reviewer_id: string;
          empathic_accuracy: number[];
          solo_scores: number[];
          carkhuff?: number | null;
          supplemental_score: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          reviewer_id?: string;
          empathic_accuracy?: number[];
          solo_scores?: number[];
          carkhuff?: number | null;
          supplemental_score?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "qualitative_evaluations_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qualitative_evaluations_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: true;
            referencedRelation: "assessment_360_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      qualitative_open_answers: {
        Row: {
          id: string;
          submission_id: string;
          aspect: string;
          response_text: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          aspect: string;
          response_text: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          aspect?: string;
          response_text?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "qualitative_open_answers_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "assessment_360_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      question_package_assignments: {
        Row: {
          id: string;
          question_id: string;
          package_size: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          package_size: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          question_id?: string;
          package_size?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_package_assignments_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      questions: {
        Row: {
          id: string;
          question_code: string;
          criteria_id: string;
          rater_group: Database["public"]["Enums"]["rater_group"];
          respondent_segment: string;
          question_type: string | null;
          content: string;
          answer_options: Json | null;
          scale_scoring: string | null;
          behavior_indicator_mapping: string | null;
          assessment_part: number | null;
          detail_level: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question_code: string;
          criteria_id: string;
          rater_group: Database["public"]["Enums"]["rater_group"];
          respondent_segment?: string;
          question_type?: string | null;
          content: string;
          answer_options?: Json | null;
          scale_scoring?: string | null;
          behavior_indicator_mapping?: string | null;
          assessment_part?: number | null;
          detail_level?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          question_code?: string;
          criteria_id?: string;
          rater_group?: Database["public"]["Enums"]["rater_group"];
          respondent_segment?: string;
          question_type?: string | null;
          content?: string;
          answer_options?: Json | null;
          scale_scoring?: string | null;
          behavior_indicator_mapping?: string | null;
          assessment_part?: number | null;
          detail_level?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questions_criteria_id_fkey";
            columns: ["criteria_id"];
            isOneToOne: false;
            referencedRelation: "criteria";
            referencedColumns: ["id"];
          },
        ];
      };
      roadmap_alerts: {
        Row: {
          id: string;
          roadmap_id: string;
          user_id: string;
          reasons: Json;
          delay_percent: number;
          last_slot: string | null;
          created_at: string;
          cleared_at: string | null;
          clear_reason: string | null;
        };
        Insert: {
          id?: string;
          roadmap_id: string;
          user_id: string;
          reasons?: Json;
          delay_percent?: number;
          last_slot?: string | null;
          created_at?: string;
          cleared_at?: string | null;
          clear_reason?: string | null;
        };
        Update: {
          id?: string;
          roadmap_id?: string;
          user_id?: string;
          reasons?: Json;
          delay_percent?: number;
          last_slot?: string | null;
          created_at?: string;
          cleared_at?: string | null;
          clear_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "roadmap_alerts_roadmap_id_fkey";
            columns: ["roadmap_id"];
            isOneToOne: false;
            referencedRelation: "roadmaps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmap_alerts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      roadmap_milestones: {
        Row: {
          id: string;
          roadmap_id: string;
          pillar: string;
          title: string;
          done: boolean;
          created_at: string;
          due_date: string | null;
          weight: number;
          is_checkpoint: boolean;
          note: string | null;
          done_at: string | null;
          source: string;
          pass_criteria: string | null;
          fail_criteria: string | null;
          activity_type: string | null;
          is_partner: boolean;
          expected_result: string | null;
        };
        Insert: {
          id?: string;
          roadmap_id: string;
          pillar: string;
          title: string;
          done?: boolean;
          created_at?: string;
          due_date?: string | null;
          weight?: number;
          is_checkpoint?: boolean;
          note?: string | null;
          done_at?: string | null;
          source?: string;
          pass_criteria?: string | null;
          fail_criteria?: string | null;
          activity_type?: string | null;
          is_partner?: boolean;
          expected_result?: string | null;
        };
        Update: {
          id?: string;
          roadmap_id?: string;
          pillar?: string;
          title?: string;
          done?: boolean;
          created_at?: string;
          due_date?: string | null;
          weight?: number;
          is_checkpoint?: boolean;
          note?: string | null;
          done_at?: string | null;
          source?: string;
          pass_criteria?: string | null;
          fail_criteria?: string | null;
          activity_type?: string | null;
          is_partner?: boolean;
          expected_result?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "roadmap_milestones_roadmap_id_fkey";
            columns: ["roadmap_id"];
            isOneToOne: false;
            referencedRelation: "roadmaps";
            referencedColumns: ["id"];
          },
        ];
      };
      roadmap_target_careers: {
        Row: {
          roadmap_id: string;
          career_id: string;
          sort_order: number;
        };
        Insert: {
          roadmap_id: string;
          career_id: string;
          sort_order?: number;
        };
        Update: {
          roadmap_id?: string;
          career_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "roadmap_target_careers_career_id_fkey";
            columns: ["career_id"];
            isOneToOne: false;
            referencedRelation: "careers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmap_target_careers_roadmap_id_fkey";
            columns: ["roadmap_id"];
            isOneToOne: false;
            referencedRelation: "roadmaps";
            referencedColumns: ["id"];
          },
        ];
      };
      roadmaps: {
        Row: {
          id: string;
          owner_id: string;
          career_id: string | null;
          title: string;
          created_at: string;
          is_active: boolean;
          target_date: string | null;
          education_level: string | null;
          school_year: string | null;
          current_skills: string | null;
          certificates: string | null;
          extracurricular: string | null;
          hours_per_week: number | null;
          regenerate_reason: string | null;
          previous_roadmap_id: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          career_id?: string | null;
          title: string;
          created_at?: string;
          is_active?: boolean;
          target_date?: string | null;
          education_level?: string | null;
          school_year?: string | null;
          current_skills?: string | null;
          certificates?: string | null;
          extracurricular?: string | null;
          hours_per_week?: number | null;
          regenerate_reason?: string | null;
          previous_roadmap_id?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          career_id?: string | null;
          title?: string;
          created_at?: string;
          is_active?: boolean;
          target_date?: string | null;
          education_level?: string | null;
          school_year?: string | null;
          current_skills?: string | null;
          certificates?: string | null;
          extracurricular?: string | null;
          hours_per_week?: number | null;
          regenerate_reason?: string | null;
          previous_roadmap_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "roadmaps_career_id_fkey";
            columns: ["career_id"];
            isOneToOne: false;
            referencedRelation: "careers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmaps_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmaps_previous_roadmap_id_fkey";
            columns: ["previous_roadmap_id"];
            isOneToOne: false;
            referencedRelation: "roadmaps";
            referencedColumns: ["id"];
          },
        ];
      };
      school_staff: {
        Row: {
          id: string;
          school_id: string;
          user_id: string;
          staff_role: string;
          created_at: string;
          updated_at: string;
          status: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          user_id: string;
          staff_role: string;
          created_at?: string;
          updated_at?: string;
          status?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          user_id?: string;
          staff_role?: string;
          created_at?: string;
          updated_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "school_staff_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "school_staff_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      schools: {
        Row: {
          id: string;
          school_name: string;
          address: string | null;
          city: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_name: string;
          address?: string | null;
          city?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_name?: string;
          address?: string | null;
          city?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      skill_profile_items: {
        Row: {
          id: string;
          owner_id: string;
          kind: string;
          title: string;
          criteria_id: string | null;
          self_level: number | null;
          verified_360: boolean;
          verified_until: string | null;
          evidence: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          kind: string;
          title: string;
          criteria_id?: string | null;
          self_level?: number | null;
          verified_360?: boolean;
          verified_until?: string | null;
          evidence?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          kind?: string;
          title?: string;
          criteria_id?: string | null;
          self_level?: number | null;
          verified_360?: boolean;
          verified_until?: string | null;
          evidence?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "skill_profile_items_criteria_id_fkey";
            columns: ["criteria_id"];
            isOneToOne: false;
            referencedRelation: "criteria";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "skill_profile_items_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      target_career_history: {
        Row: {
          id: string;
          user_id: string;
          career_id: string;
          action: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          career_id: string;
          action: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          career_id?: string;
          action?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "target_career_history_career_id_fkey";
            columns: ["career_id"];
            isOneToOne: false;
            referencedRelation: "careers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "target_career_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      training_programs: {
        Row: {
          id: string;
          institution_id: string;
          major_id: string;
          source_key: string;
          faculty_name: string | null;
          specialization_name: string | null;
          program_type: string | null;
          degree_levels: string[] | null;
          program_qualifier: string | null;
          program_summary: string | null;
          study_years: number | null;
          tuition_text: string | null;
          tuition_per_semester_min: number | null;
          tuition_per_semester_max: number | null;
          program_url: string | null;
          source_reference: string | null;
          research_status: string;
          researcher_name: string | null;
          research_note: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          major_id: string;
          source_key: string;
          faculty_name?: string | null;
          specialization_name?: string | null;
          program_type?: string | null;
          degree_levels?: string[] | null;
          program_qualifier?: string | null;
          program_summary?: string | null;
          study_years?: number | null;
          tuition_text?: string | null;
          tuition_per_semester_min?: number | null;
          tuition_per_semester_max?: number | null;
          program_url?: string | null;
          source_reference?: string | null;
          research_status?: string;
          researcher_name?: string | null;
          research_note?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          major_id?: string;
          source_key?: string;
          faculty_name?: string | null;
          specialization_name?: string | null;
          program_type?: string | null;
          degree_levels?: string[] | null;
          program_qualifier?: string | null;
          program_summary?: string | null;
          study_years?: number | null;
          tuition_text?: string | null;
          tuition_per_semester_min?: number | null;
          tuition_per_semester_max?: number | null;
          program_url?: string | null;
          source_reference?: string | null;
          research_status?: string;
          researcher_name?: string | null;
          research_note?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_programs_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_programs_major_id_fkey";
            columns: ["major_id"];
            isOneToOne: false;
            referencedRelation: "majors";
            referencedColumns: ["id"];
          },
        ];
      };
      user_profiles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["user_role"];
          full_name: string | null;
          date_of_birth: string | null;
          school_name: string | null;
          grade_or_major: string | null;
          display_name: string | null;
          personal_link_code: string;
          guardian_consent_confirmed: boolean;
          failed_login_count: number;
          locked_until: string | null;
          deletion_requested_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role: Database["public"]["Enums"]["user_role"];
          full_name?: string | null;
          date_of_birth?: string | null;
          school_name?: string | null;
          grade_or_major?: string | null;
          display_name?: string | null;
          personal_link_code?: string;
          guardian_consent_confirmed?: boolean;
          failed_login_count?: number;
          locked_until?: string | null;
          deletion_requested_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["user_role"];
          full_name?: string | null;
          date_of_birth?: string | null;
          school_name?: string | null;
          grade_or_major?: string | null;
          display_name?: string | null;
          personal_link_code?: string;
          guardian_consent_confirmed?: boolean;
          failed_login_count?: number;
          locked_until?: string | null;
          deletion_requested_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_relationships: {
        Row: {
          id: string;
          requester_id: string;
          target_id: string;
          relationship_type: string;
          status: string;
          responded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          target_id: string;
          relationship_type: string;
          status?: string;
          responded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          requester_id?: string;
          target_id?: string;
          relationship_type?: string;
          status?: string;
          responded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_relationships_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_relationships_target_id_fkey";
            columns: ["target_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_saved_careers: {
        Row: {
          id: string;
          user_id: string;
          career_id: string;
          kind: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          career_id: string;
          kind: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          career_id?: string;
          kind?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_saved_careers_career_id_fkey";
            columns: ["career_id"];
            isOneToOne: false;
            referencedRelation: "careers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_saved_careers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_parent_link: {
        Args: { p_code: string };
        Returns: Json;
      };
      add_community_comment: {
        Args: { p_post_id: string; p_body: string };
        Returns: string;
      };
      add_community_topic: {
        Args: { p_community_id: string; p_title: string };
        Returns: string;
      };
      add_roadmap_milestone: {
        Args: { p_roadmap_id: string; p_pillar: string; p_title: string; p_due_date?: string; p_weight?: number; p_is_checkpoint?: boolean; p_pass_criteria?: string };
        Returns: string;
      };
      add_roadmap_milestones_bulk: {
        Args: { p_roadmap_id: string; p_items: Json };
        Returns: number;
      };
      add_school_staff: {
        Args: { p_school_id: string; p_email: string; p_staff_role: string };
        Returns: Json;
      };
      admin_inspect_result: {
        Args: { p_owner: string; p_reason: string };
        Returns: Json;
      };
      assign_class_teacher: {
        Args: { p_class_id: string; p_email: string; p_member_role: string };
        Returns: Json;
      };
      assign_short_set_questions: {
        Args: { p_grid_id: string };
        Returns: undefined;
      };
      auto_finalize_results: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      auto_publish_careers: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      build_group_report: {
        Args: { p_student_ids: string[] };
        Returns: Json;
      };
      can_manage_class: {
        Args: { p_class_id: string };
        Returns: boolean;
      };
      can_view_result_of: {
        Args: { p_owner: string };
        Returns: boolean;
      };
      career_fit_compute: {
        Args: { p_result_id: string; p_career_ids?: string[] };
        Returns: unknown[];
      };
      career_fit_criteria: {
        Args: { p_result_id: string; p_career_ids?: string[] };
        Returns: unknown[];
      };
      career_fit_ensure: {
        Args: { p_result_id: string };
        Returns: undefined;
      };
      career_fit_fingerprint: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      career_fit_learner_scores: {
        Args: { p_result_id: string };
        Returns: unknown[];
      };
      career_fit_policy: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      career_fit_ranked: {
        Args: { p_result_id: string };
        Returns: unknown[];
      };
      clear_roadmap_alert: {
        Args: { p_roadmap_id: string; p_reason: string };
        Returns: undefined;
      };
      complete_self_assessment: {
        Args: { p_session_id: string; p_invite_enabled?: boolean };
        Returns: string;
      };
      confirm_decision_consensus: {
        Args: { p_report_id: string; p_comment?: string };
        Returns: undefined;
      };
      confirm_guardian_consent: {
        Args: { p_token: string };
        Returns: Json;
      };
      confirm_school_admin: {
        Args: { p_school_id: string };
        Returns: undefined;
      };
      create_career_event: {
        Args: { p_school_id: string; p_title: string; p_description: string; p_location: string; p_starts_at: string; p_seat_limit?: number; p_registration_deadline?: string };
        Returns: string;
      };
      create_class: {
        Args: { p_school_id: string; p_class_name: string; p_grade: number; p_school_year: string };
        Returns: string;
      };
      create_community: {
        Args: { p_name: string; p_description: string };
        Returns: string;
      };
      create_community_post: {
        Args: { p_community_id: string; p_body: string };
        Returns: string;
      };
      create_decision_report: {
        Args: { p_plan_id: string; p_include_finance: boolean };
        Returns: string;
      };
      create_guardian_consent_token: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      create_parent_link_code: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      create_roadmap: {
        Args: { p_career_id: string; p_title: string; p_target_date?: string; p_hours_per_week?: number; p_reason?: string };
        Returns: string;
      };
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      decide_submission: {
        Args: { p_submission_id: string; p_decision: string };
        Returns: undefined;
      };
      erase_own_360_submission: {
        Args: { p_resume_token: string };
        Returns: Json;
      };
      export_my_data: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      finalize_my_result: {
        Args: { p_result_id: string };
        Returns: Json;
      };
      finalize_result_internal: {
        Args: { p_result_id: string; p_mode: string };
        Returns: undefined;
      };
      find_auth_user_id: {
        Args: { p_email: string };
        Returns: string;
      };
      get_360_questions: {
        Args: { p_resume_token: string };
        Returns: Json;
      };
      get_360_session: {
        Args: { p_resume_token: string };
        Returns: Json;
      };
      get_career_fit_detail: {
        Args: { p_career_id: string; p_user_id?: string };
        Returns: Json;
      };
      get_career_fit_many: {
        Args: { p_career_ids: string[] };
        Returns: Json;
      };
      get_career_recommendations: {
        Args: { p_user_id?: string };
        Returns: Json;
      };
      get_class_dominant_groups: {
        Args: { p_class_id: string };
        Returns: Json;
      };
      get_class_grid: {
        Args: { p_class_id: string };
        Returns: Json;
      };
      get_class_overview: {
        Args: { p_class_id: string };
        Returns: Json;
      };
      get_class_report: {
        Args: { p_class_id: string };
        Returns: Json;
      };
      get_decision_report: {
        Args: { p_report_id: string };
        Returns: Json;
      };
      get_invitation_public: {
        Args: { p_token: string };
        Returns: Json;
      };
      get_my_roadmap_status: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      get_my_school_invitations: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      get_my_study_finance: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      get_parameter: {
        Args: { p_code: string };
        Returns: Json;
      };
      get_qualitative_case: {
        Args: { p_submission_id: string };
        Returns: Json;
      };
      get_roadmap_soft_skills: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      get_school_report: {
        Args: { p_school_id: string };
        Returns: Json;
      };
      grid_student_block_reason: {
        Args: { p_grid_student_id: string };
        Returns: Json;
      };
      import_class_roster: {
        Args: { p_class_id: string; p_rows: Json; p_dry_run?: boolean };
        Returns: Json;
      };
      import_verified_soft_skills: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      is_career_published: {
        Args: { p_career_id: string };
        Returns: boolean;
      };
      is_class_member: {
        Args: { p_class_id: string };
        Returns: boolean;
      };
      is_class_teacher: {
        Args: { p_class_id: string };
        Returns: boolean;
      };
      is_school_admin: {
        Args: { p_school_id: string };
        Returns: boolean;
      };
      is_school_staff: {
        Args: { p_school_id: string };
        Returns: boolean;
      };
      is_system_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_under_guardian_age: {
        Args: { p_dob: string };
        Returns: boolean;
      };
      join_class_by_code: {
        Args: { p_class_code: string; p_student_code?: string };
        Returns: Json;
      };
      join_community: {
        Args: { p_community_id: string };
        Returns: undefined;
      };
      leave_community: {
        Args: { p_community_id: string };
        Returns: undefined;
      };
      link_roster_member: {
        Args: { p_member_id: string; p_user_id: string; p_is_new_user: boolean };
        Returns: Json;
      };
      list_career_events: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      list_communities: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      list_community_admin: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      list_mentor_profiles_admin: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      list_my_comparison_plans: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      list_my_connection_requests: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      list_my_connections: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      list_my_roadmaps: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      list_my_saved_careers: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      list_qualitative_queue: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      list_reported_posts: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      list_roster_pending: {
        Args: { p_class_id: string };
        Returns: Json;
      };
      list_shared_decision_reports: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      list_verified_mentors: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      moderate_post: {
        Args: { p_post_id: string; p_action: string };
        Returns: undefined;
      };
      param_num: {
        Args: { p_code: string; p_default: number };
        Returns: number;
      };
      push_notification: {
        Args: { p_user: string; p_type: string; p_title: string; p_body: string; p_payload?: Json };
        Returns: undefined;
      };
      recalculate_latest_result: {
        Args: { p_user: string };
        Returns: undefined;
      };
      recalculate_result: {
        Args: { p_result_id: string; p_finalizing?: boolean };
        Returns: undefined;
      };
      record_360_idle: {
        Args: { p_resume_token: string; p_periods: number[] };
        Returns: undefined;
      };
      record_grid_student: {
        Args: { p_grid_student_id: string };
        Returns: undefined;
      };
      record_qualitative_evaluation: {
        Args: { p_submission_id: string; p_ea: number[]; p_solo: number[]; p_carkhuff: number };
        Returns: number;
      };
      refresh_career_ranking: {
        Args: { p_result_id: string; p_reason?: string };
        Returns: undefined;
      };
      refresh_career_standard: {
        Args: { p_career_ids?: string[] };
        Returns: number;
      };
      register_career_event: {
        Args: { p_event_id: string; p_register?: boolean };
        Returns: undefined;
      };
      remove_career_bookmark: {
        Args: { p_career_id: string; p_kind: string };
        Returns: undefined;
      };
      remove_class_member: {
        Args: { p_member_id: string };
        Returns: undefined;
      };
      remove_community_member: {
        Args: { p_community_id: string; p_user_id: string };
        Returns: undefined;
      };
      remove_community_topic: {
        Args: { p_topic_id: string };
        Returns: undefined;
      };
      report_community_post: {
        Args: { p_post_id: string; p_reason: string };
        Returns: undefined;
      };
      request_account_deletion: {
        Args: { p_cancel?: boolean };
        Returns: string;
      };
      request_ip: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      request_mentor_connection: {
        Args: { p_mentor_id: string; p_message: string };
        Returns: undefined;
      };
      respond_connection_request: {
        Args: { p_id: string; p_accept: boolean };
        Returns: undefined;
      };
      revoke_result_share: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      roadmap_param: {
        Args: { p_code: string; p_default: number };
        Returns: number;
      };
      roadmap_status: {
        Args: { p_roadmap_id: string };
        Returns: Json;
      };
      save_360_answers: {
        Args: { p_resume_token: string; p_answers: Json };
        Returns: undefined;
      };
      save_career_bookmark: {
        Args: { p_career_id: string; p_kind: string };
        Returns: undefined;
      };
      save_career_match_snapshot: {
        Args: { p_result_id: string; p_payload: Json };
        Returns: string;
      };
      save_comparison_plan: {
        Args: { p_title: string; p_career_ids: string[] };
        Returns: string;
      };
      save_decision_plan: {
        Args: { p_title: string; p_career_ids: string[]; p_options: Json; p_weights: Json; p_budget: number; p_learner_score: number; p_ranking: Json };
        Returns: string;
      };
      save_grid_qualitative_note: {
        Args: { p_grid_student_id: string; p_note: string };
        Returns: undefined;
      };
      save_mentor_profile: {
        Args: { p_headline: string };
        Returns: undefined;
      };
      save_my_study_finance: {
        Args: { p_latest_score: number; p_subject_combination: string; p_admission_method: string; p_recorded_year: number; p_budget_per_year: number; p_budget_note: string };
        Returns: undefined;
      };
      save_qualitative_open_answers: {
        Args: { p_resume_token: string; p_answers: Json };
        Returns: undefined;
      };
      save_roadmap_origin: {
        Args: { p_roadmap_id: string; p_education_level: string; p_school_year: string; p_skills: string; p_certificates: string; p_extracurricular: string };
        Returns: undefined;
      };
      save_roadmap_progress: {
        Args: { p_items: Json };
        Returns: Json;
      };
      scan_roadmap_alerts: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      set_career_fit_weights: {
        Args: { p_competency: number; p_interest: number; p_motivation: number };
        Returns: undefined;
      };
      set_career_status: {
        Args: { p_career_id: string; p_status: string };
        Returns: undefined;
      };
      set_grid_package: {
        Args: { p_grid_id: string; p_package_size: number; p_question_ids: string[] };
        Returns: undefined;
      };
      set_my_learner_role: {
        Args: { p_role: Database["public"]["Enums"]["user_role"] };
        Returns: undefined;
      };
      set_package_assignments: {
        Args: { p_question_ids: string[]; p_package_size: number; p_assigned: boolean };
        Returns: number;
      };
      set_preferred_option: {
        Args: { p_plan_id: string; p_option_id: string; p_reason: string };
        Returns: undefined;
      };
      set_roadmap_careers: {
        Args: { p_roadmap_id: string; p_career_ids: string[] };
        Returns: undefined;
      };
      share_decision_report: {
        Args: { p_report_id: string; p_parent_id: string };
        Returns: undefined;
      };
      share_result_with: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      share_result_with_email: {
        Args: { p_email: string };
        Returns: Json;
      };
      start_360_submission: {
        Args: { p_token: string; p_nickname: string; p_relationship: string; p_acquaintance_duration: number; p_contact_frequency: number; p_observation_depth: number };
        Returns: string;
      };
      submit_360: {
        Args: { p_resume_token: string };
        Returns: Json;
      };
      submit_class_grid: {
        Args: { p_grid_id: string };
        Returns: Json;
      };
      submit_class_grid_student: {
        Args: { p_grid_student_id: string };
        Returns: Json;
      };
      supplemental_understanding_score: {
        Args: { p_group: Database["public"]["Enums"]["rater_group"]; p_ea: number[]; p_solo: number[]; p_carkhuff: number };
        Returns: number;
      };
      toggle_roadmap_milestone: {
        Args: { p_milestone_id: string; p_done: boolean };
        Returns: undefined;
      };
      update_roadmap_milestone_due: {
        Args: { p_milestone_id: string; p_due_date: string; p_apply?: boolean };
        Returns: Json;
      };
      verify_mentor: {
        Args: { p_user_id: string; p_verified: boolean };
        Returns: undefined;
      };
      write_audit_log: {
        Args: { p_actor: string; p_subject: string; p_action: string; p_target_type: string; p_target_id: string; p_details?: Json };
        Returns: undefined;
      };
    };
    Enums: {
      rater_group: "self" | "parent" | "friend" | "teacher" | "mentor";
      result_status_label: "self_assessment" | "temporary" | "final_360";
      user_role: "student" | "university_student" | "parent" | "teacher" | "mentor" | "school_admin" | "system_admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
