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
      class_assessment_grid_details: {
        Row: {
          id: string;
          grid_student_id: string;
          question_id: string | null;
          criteria_id: string;
          score: number | null;
          is_insufficient_basis: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          grid_student_id: string;
          question_id?: string | null;
          criteria_id?: string;
          score?: number | null;
          is_insufficient_basis?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          grid_student_id?: string;
          question_id?: string | null;
          criteria_id?: string;
          score?: number | null;
          is_insufficient_basis?: boolean;
          created_at?: string;
          updated_at?: string;
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
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          grid_id: string;
          student_id: string;
          acquaintance_duration?: number | null;
          contact_frequency?: number | null;
          observation_depth?: number | null;
          understanding_score?: number | null;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          grid_id?: string;
          student_id?: string;
          acquaintance_duration?: number | null;
          contact_frequency?: number | null;
          observation_depth?: number | null;
          understanding_score?: number | null;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
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
          package_size: number | null;
          default_acquaintance_duration: number | null;
          default_contact_frequency: number | null;
          default_observation_depth: number | null;
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          teacher_id: string;
          status?: string;
          package_size?: number | null;
          default_acquaintance_duration?: number | null;
          default_contact_frequency?: number | null;
          default_observation_depth?: number | null;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          class_id?: string;
          teacher_id?: string;
          status?: string;
          package_size?: number | null;
          default_acquaintance_duration?: number | null;
          default_contact_frequency?: number | null;
          default_observation_depth?: number | null;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
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
          roster_date_of_birth: string | null;
          joined_at: string | null;
          created_at: string;
          updated_at: string;
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
          roster_date_of_birth?: string | null;
          joined_at?: string | null;
          created_at?: string;
          updated_at?: string;
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
          roster_date_of_birth?: string | null;
          joined_at?: string | null;
          created_at?: string;
          updated_at?: string;
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_school_staff: {
        Args: { p_school_id: string; p_email: string; p_staff_role: string };
        Returns: Json;
      };
      assign_class_teacher: {
        Args: { p_class_id: string; p_email: string; p_member_role: string };
        Returns: Json;
      };
      auto_finalize_results: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      build_group_report: {
        Args: { p_student_ids: string[] };
        Returns: Json;
      };
      can_view_result_of: {
        Args: { p_owner: string };
        Returns: boolean;
      };
      complete_self_assessment: {
        Args: { p_session_id: string; p_invite_enabled?: boolean };
        Returns: string;
      };
      confirm_school_admin: {
        Args: { p_school_id: string };
        Returns: undefined;
      };
      create_class: {
        Args: { p_school_id: string; p_class_name: string; p_grade: number; p_school_year: string };
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
      finalize_my_result: {
        Args: { p_result_id: string };
        Returns: Json;
      };
      finalize_result_internal: {
        Args: { p_result_id: string; p_mode: string };
        Returns: undefined;
      };
      get_360_questions: {
        Args: { p_resume_token: string };
        Returns: Json;
      };
      get_360_session: {
        Args: { p_resume_token: string };
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
      get_invitation_public: {
        Args: { p_token: string };
        Returns: Json;
      };
      get_my_school_invitations: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      get_parameter: {
        Args: { p_code: string };
        Returns: Json;
      };
      get_school_report: {
        Args: { p_school_id: string };
        Returns: Json;
      };
      import_class_roster: {
        Args: { p_class_id: string; p_rows: Json; p_dry_run?: boolean };
        Returns: Json;
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
      remove_class_member: {
        Args: { p_member_id: string };
        Returns: undefined;
      };
      request_ip: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      save_360_answers: {
        Args: { p_resume_token: string; p_answers: Json };
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
      set_grid_package: {
        Args: { p_grid_id: string; p_package_size: number; p_question_ids: string[] };
        Returns: undefined;
      };
      get_class_dominant_groups: {
        Args: { p_class_id: string };
        Returns: Json;
      };
      list_roster_pending: {
        Args: { p_class_id: string };
        Returns: Json;
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
