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
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          question_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_id?: string | null
          title?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          hint_level: number | null
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          hint_level?: number | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          hint_level?: number | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          id: string
          name: string
          props: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          props?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          props?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      app_flags: {
        Row: {
          config: Json
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          config?: Json
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          config?: Json
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string
          question_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          question_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      calibration_reports: {
        Row: {
          created_at: string
          exam_session: string
          id: string
          official_grade: number
          predicted_confidence: number
          predicted_rating: number
          subject_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exam_session: string
          id?: string
          official_grade: number
          predicted_confidence: number
          predicted_rating: number
          subject_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          exam_session?: string
          id?: string
          official_grade?: number
          predicted_confidence?: number
          predicted_rating?: number
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calibration_reports_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_requests: {
        Row: {
          created_at: string
          id: string
          institution_id: string
          message: string | null
          responded_at: string | null
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id: string
          message?: string | null
          responded_at?: string | null
          status?: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_requests_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      deadlines: {
        Row: {
          created_at: string
          due_date: string
          id: string
          student_id: string
          subject_id: string | null
          title: string
          type: Database["public"]["Enums"]["deadline_type"]
        }
        Insert: {
          created_at?: string
          due_date: string
          id?: string
          student_id: string
          subject_id?: string | null
          title: string
          type: Database["public"]["Enums"]["deadline_type"]
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          student_id?: string
          subject_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["deadline_type"]
        }
        Relationships: [
          {
            foreignKeyName: "deadlines_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_challenges: {
        Row: {
          claimed_by: string | null
          created_at: string
          creator_id: string
          creator_ip_hash: string | null
          expires_at: string
          id: string
          level_code: string
          match_id: string | null
          mode: string
          opponent_id: string | null
          subject_id: string
          token: string
        }
        Insert: {
          claimed_by?: string | null
          created_at?: string
          creator_id: string
          creator_ip_hash?: string | null
          expires_at?: string
          id?: string
          level_code?: string
          match_id?: string | null
          mode?: string
          opponent_id?: string | null
          subject_id: string
          token: string
        }
        Update: {
          claimed_by?: string | null
          created_at?: string
          creator_id?: string
          creator_ip_hash?: string | null
          expires_at?: string
          id?: string
          level_code?: string
          match_id?: string | null
          mode?: string
          opponent_id?: string | null
          subject_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "duel_challenges_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "ladder_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duel_challenges_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_queue: {
        Row: {
          elo: number
          enqueued_at: string
          ip_hash: string | null
          level_code: string
          mode: string
          subject_id: string
          user_id: string
        }
        Insert: {
          elo?: number
          enqueued_at?: string
          ip_hash?: string | null
          level_code?: string
          mode?: string
          subject_id: string
          user_id: string
        }
        Update: {
          elo?: number
          enqueued_at?: string
          ip_hash?: string | null
          level_code?: string
          mode?: string
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duel_queue_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_dates: {
        Row: {
          created_at: string
          exam_date: string
          id: string
          label: string | null
          level_id: string | null
          subject_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exam_date: string
          id?: string
          label?: string | null
          level_id?: string | null
          subject_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          exam_date?: string
          id?: string
          label?: string | null
          level_id?: string | null
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_dates_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_dates_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          institution_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          institution_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          institution_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_audit_log_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_members: {
        Row: {
          created_at: string
          institution_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          institution_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          institution_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_members_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          kind: string
          name: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id?: string
          kind?: string
          name: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          id?: string
          kind?: string
          name?: string
        }
        Relationships: []
      }
      integrity_reviews: {
        Row: {
          created_at: string
          details: Json
          id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: string
          source_kind: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id: string
          source_kind: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string
          source_kind?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      ladder_leaderboard: {
        Row: {
          country: string | null
          id: string
          losses: number
          school: string | null
          student_id: string
          updated_at: string
          wins: number
        }
        Insert: {
          country?: string | null
          id?: string
          losses?: number
          school?: string | null
          student_id: string
          updated_at?: string
          wins?: number
        }
        Update: {
          country?: string | null
          id?: string
          losses?: number
          school?: string | null
          student_id?: string
          updated_at?: string
          wins?: number
        }
        Relationships: []
      }
      ladder_matches: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          level_code: string
          mode: string
          paper_ref: string | null
          paper_year: number | null
          question_ids: string[]
          season_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["ladder_status"]
          student_a_id: string
          student_b_id: string | null
          subject_id: string
          time_limit_seconds: number
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          level_code?: string
          mode?: string
          paper_ref?: string | null
          paper_year?: number | null
          question_ids?: string[]
          season_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ladder_status"]
          student_a_id: string
          student_b_id?: string | null
          subject_id: string
          time_limit_seconds?: number
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          level_code?: string
          mode?: string
          paper_ref?: string | null
          paper_year?: number | null
          question_ids?: string[]
          season_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ladder_status"]
          student_a_id?: string
          student_b_id?: string | null
          subject_id?: string
          time_limit_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "ladder_matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_matches_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      ladder_progress: {
        Row: {
          correct_count: number
          current_question_index: number
          final_score: number | null
          id: string
          is_complete: boolean
          last_updated_at: string
          match_id: string
          student_id: string
        }
        Insert: {
          correct_count?: number
          current_question_index?: number
          final_score?: number | null
          id?: string
          is_complete?: boolean
          last_updated_at?: string
          match_id: string
          student_id: string
        }
        Update: {
          correct_count?: number
          current_question_index?: number
          final_score?: number | null
          id?: string
          is_complete?: boolean
          last_updated_at?: string
          match_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ladder_progress_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "ladder_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          code: string
          id: string
          name: string
          sort_order: number
          subject_id: string
        }
        Insert: {
          code: string
          id?: string
          name: string
          sort_order?: number
          subject_id: string
        }
        Update: {
          code?: string
          id?: string
          name?: string
          sort_order?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "levels_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      match_answers: {
        Row: {
          answer: string | null
          answered_at: string | null
          id: string
          is_correct: boolean | null
          match_id: string
          question_id: string
          question_index: number
          served_at: string
          student_id: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          id?: string
          is_correct?: boolean | null
          match_id: string
          question_id: string
          question_index: number
          served_at?: string
          student_id: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          id?: string
          is_correct?: boolean | null
          match_id?: string
          question_id?: string
          question_index?: number
          served_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_answers_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "ladder_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      mistakes: {
        Row: {
          created_at: string
          id: string
          question_id: string
          resolved: boolean
          resolved_at: string | null
          topic_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          resolved?: boolean
          resolved_at?: string | null
          topic_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          resolved?: boolean
          resolved_at?: string | null
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mistakes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mistakes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_entries: {
        Row: {
          created_at: string
          grading_started_at: string | null
          id: string
          sitting_id: string
          started_at: string | null
          status: string
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          grading_started_at?: string | null
          id?: string
          sitting_id: string
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          grading_started_at?: string | null
          id?: string
          sitting_id?: string
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_entries_sitting_id_fkey"
            columns: ["sitting_id"]
            isOneToOne: false
            referencedRelation: "mock_sittings"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_papers: {
        Row: {
          body: string
          created_at: string
          duration_minutes: number
          id: string
          language: string
          level_code: string
          markscheme: Json
          status: string
          subject_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          language?: string
          level_code?: string
          markscheme?: Json
          status?: string
          subject_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          language?: string
          level_code?: string
          markscheme?: Json
          status?: string
          subject_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_papers_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_results: {
        Row: {
          country_percentile: number | null
          country_rank: number | null
          created_at: string
          criteria: Json
          entry_id: string
          global_percentile: number | null
          grader: string
          released: boolean
          total_awarded: number
          total_max: number
          updated_at: string
        }
        Insert: {
          country_percentile?: number | null
          country_rank?: number | null
          created_at?: string
          criteria?: Json
          entry_id: string
          global_percentile?: number | null
          grader?: string
          released?: boolean
          total_awarded?: number
          total_max?: number
          updated_at?: string
        }
        Update: {
          country_percentile?: number | null
          country_rank?: number | null
          created_at?: string
          criteria?: Json
          entry_id?: string
          global_percentile?: number | null
          grader?: string
          released?: boolean
          total_awarded?: number
          total_max?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_results_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: true
            referencedRelation: "mock_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_scripts: {
        Row: {
          created_at: string
          entry_id: string
          id: string
          image_path: string
          ocr_boxes: Json | null
          ocr_text: string | null
          page_index: number
        }
        Insert: {
          created_at?: string
          entry_id: string
          id?: string
          image_path: string
          ocr_boxes?: Json | null
          ocr_text?: string | null
          page_index?: number
        }
        Update: {
          created_at?: string
          entry_id?: string
          id?: string
          image_path?: string
          ocr_boxes?: Json | null
          ocr_text?: string | null
          page_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "mock_scripts_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "mock_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_sittings: {
        Row: {
          band: string
          closes_at: string
          created_at: string
          id: string
          opens_at: string
          paper_id: string
          results_at: string
          status: string
        }
        Insert: {
          band: string
          closes_at: string
          created_at?: string
          id?: string
          opens_at: string
          paper_id: string
          results_at: string
          status?: string
        }
        Update: {
          band?: string
          closes_at?: string
          created_at?: string
          id?: string
          opens_at?: string
          paper_id?: string
          results_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_sittings_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "mock_papers"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          body: string
          created_at: string
          id: string
          question_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          question_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          question_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_optouts: {
        Row: {
          category: string
          user_id: string
        }
        Insert: {
          category: string
          user_id: string
        }
        Update: {
          category?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          href: string | null
          id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category: string
          created_at?: string
          href?: string | null
          id?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          href?: string | null
          id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      performance_events: {
        Row: {
          created_at: string
          id: string
          integrity_flags: Json
          kind: string
          payload: Json
          quarantined: boolean
          subject_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          integrity_flags?: Json
          kind: string
          payload?: Json
          quarantined?: boolean
          subject_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          integrity_flags?: Json
          kind?: string
          payload?: Json
          quarantined?: boolean
          subject_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_events_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_session_questions: {
        Row: {
          answered_at: string | null
          confidence: Database["public"]["Enums"]["confidence_rating"] | null
          id: string
          is_correct: boolean | null
          position: number
          question_id: string
          session_id: string
          viewed_at: string | null
        }
        Insert: {
          answered_at?: string | null
          confidence?: Database["public"]["Enums"]["confidence_rating"] | null
          id?: string
          is_correct?: boolean | null
          position?: number
          question_id: string
          session_id: string
          viewed_at?: string | null
        }
        Update: {
          answered_at?: string | null
          confidence?: Database["public"]["Enums"]["confidence_rating"] | null
          id?: string
          is_correct?: boolean | null
          position?: number
          question_id?: string
          session_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_session_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_session_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          current_index: number
          difficulty: Database["public"]["Enums"]["difficulty"] | null
          id: string
          mode: Database["public"]["Enums"]["session_mode"]
          status: Database["public"]["Enums"]["session_status"]
          subject_id: string | null
          time_limit_seconds: number | null
          topic_ids: string[]
          total_questions: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_index?: number
          difficulty?: Database["public"]["Enums"]["difficulty"] | null
          id?: string
          mode?: Database["public"]["Enums"]["session_mode"]
          status?: Database["public"]["Enums"]["session_status"]
          subject_id?: string | null
          time_limit_seconds?: number | null
          topic_ids?: string[]
          total_questions?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_index?: number
          difficulty?: Database["public"]["Enums"]["difficulty"] | null
          id?: string
          mode?: Database["public"]["Enums"]["session_mode"]
          status?: Database["public"]["Enums"]["session_status"]
          subject_id?: string | null
          time_limit_seconds?: number | null
          topic_ids?: string[]
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          display_name: string
          full_name: string | null
          id: string
          onboarded: boolean
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          display_name: string
          full_name?: string | null
          id: string
          onboarded?: boolean
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          display_name?: string
          full_name?: string | null
          id?: string
          onboarded?: boolean
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_assets: {
        Row: {
          alt_text: string | null
          canvas_data: Json | null
          caption: string | null
          created_at: string
          graph_spec: Json | null
          id: string
          kind: string
          question_id: string
          sort_order: number
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          canvas_data?: Json | null
          caption?: string | null
          created_at?: string
          graph_spec?: Json | null
          id?: string
          kind?: string
          question_id: string
          sort_order?: number
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          canvas_data?: Json | null
          caption?: string | null
          created_at?: string
          graph_spec?: Json | null
          id?: string
          kind?: string
          question_id?: string
          sort_order?: number
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_assets_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_attempts: {
        Row: {
          confidence: Database["public"]["Enums"]["confidence_rating"] | null
          created_at: string
          id: string
          is_correct: boolean | null
          question_id: string
          session_id: string | null
          time_spent_seconds: number
          user_id: string
        }
        Insert: {
          confidence?: Database["public"]["Enums"]["confidence_rating"] | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_id: string
          session_id?: string | null
          time_spent_seconds?: number
          user_id: string
        }
        Update: {
          confidence?: Database["public"]["Enums"]["confidence_rating"] | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_id?: string
          session_id?: string | null
          time_spent_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          answer: string | null
          answer_key: Json | null
          answer_type: string
          calculator: boolean | null
          command_term: string | null
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty"]
          estimated_minutes: number | null
          id: string
          is_ai_generated: boolean
          level_id: string | null
          license: string | null
          marks: number
          paper: string | null
          prompt: string
          question_number: string | null
          question_type: string
          reviewed_at: string | null
          reviewer_credential: string | null
          reviewer_name: string | null
          solution: string | null
          source: string | null
          status: Database["public"]["Enums"]["content_status"]
          subject_id: string
          subtopic_id: string | null
          tags: string[]
          title: string | null
          topic_id: string
          updated_at: string
          year: number | null
        }
        Insert: {
          answer?: string | null
          answer_key?: Json | null
          answer_type?: string
          calculator?: boolean | null
          command_term?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty"]
          estimated_minutes?: number | null
          id?: string
          is_ai_generated?: boolean
          level_id?: string | null
          license?: string | null
          marks?: number
          paper?: string | null
          prompt: string
          question_number?: string | null
          question_type?: string
          reviewed_at?: string | null
          reviewer_credential?: string | null
          reviewer_name?: string | null
          solution?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          subject_id: string
          subtopic_id?: string | null
          tags?: string[]
          title?: string | null
          topic_id: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          answer?: string | null
          answer_key?: Json | null
          answer_type?: string
          calculator?: boolean | null
          command_term?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty"]
          estimated_minutes?: number | null
          id?: string
          is_ai_generated?: boolean
          level_id?: string | null
          license?: string | null
          marks?: number
          paper?: string | null
          prompt?: string
          question_number?: string | null
          question_type?: string
          reviewed_at?: string | null
          reviewer_credential?: string | null
          reviewer_name?: string | null
          solution?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          subject_id?: string
          subtopic_id?: string | null
          tags?: string[]
          title?: string | null
          topic_id?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      rating_algorithm_versions: {
        Row: {
          config: Json
          created_at: string
          id: string
          name: string
          version: number
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          name: string
          version: number
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          name?: string
          version?: number
        }
        Relationships: []
      }
      rivalries: {
        Row: {
          a_score: number
          b_score: number
          created_at: string
          ends_at: string
          id: string
          last_leader: string | null
          school_a: string
          school_b: string
          season_id: string
          starts_at: string
          status: string
        }
        Insert: {
          a_score?: number
          b_score?: number
          created_at?: string
          ends_at: string
          id?: string
          last_leader?: string | null
          school_a: string
          school_b: string
          season_id: string
          starts_at: string
          status?: string
        }
        Update: {
          a_score?: number
          b_score?: number
          created_at?: string
          ends_at?: string
          id?: string
          last_leader?: string | null
          school_a?: string
          school_b?: string
          season_id?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rivalries_school_a_fkey"
            columns: ["school_a"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rivalries_school_b_fkey"
            columns: ["school_b"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rivalries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      rivalry_banners: {
        Row: {
          created_at: string
          id: string
          preset_key: string
          rivalry_id: string
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preset_key: string
          rivalry_id: string
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          preset_key?: string
          rivalry_id?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rivalry_banners_rivalry_id_fkey"
            columns: ["rivalry_id"]
            isOneToOne: false
            referencedRelation: "rivalries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rivalry_banners_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          annotation_result: Json | null
          created_at: string
          error_message: string | null
          id: string
          image_url: string
          ocr_bounding_boxes: Json | null
          ocr_text: string | null
          question_id: string
          status: Database["public"]["Enums"]["scan_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          annotation_result?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          image_url: string
          ocr_bounding_boxes?: Json | null
          ocr_text?: string | null
          question_id: string
          status?: Database["public"]["Enums"]["scan_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          annotation_result?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          image_url?: string
          ocr_bounding_boxes?: Json | null
          ocr_text?: string | null
          question_id?: string
          status?: Database["public"]["Enums"]["scan_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scans_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      school_members: {
        Row: {
          joined_at: string
          school_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          school_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_requests: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          id: string
          name: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string | null
          status: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string | null
          status?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_scores: {
        Row: {
          active_members: number
          member_count: number
          school_id: string
          score: number
          season_id: string
          updated_at: string
        }
        Insert: {
          active_members?: number
          member_count?: number
          school_id: string
          score?: number
          season_id: string
          updated_at?: string
        }
        Update: {
          active_members?: number
          member_count?: number
          school_id?: string
          score?: number
          season_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_scores_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_scores_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          city: string | null
          color: string
          country: string | null
          created_at: string
          created_by: string | null
          crest_emoji: string
          id: string
          kind: string
          name: string
          slug: string
          verified: boolean
        }
        Insert: {
          city?: string | null
          color?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          crest_emoji?: string
          id?: string
          kind?: string
          name: string
          slug: string
          verified?: boolean
        }
        Update: {
          city?: string | null
          color?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          crest_emoji?: string
          id?: string
          kind?: string
          name?: string
          slug?: string
          verified?: boolean
        }
        Relationships: []
      }
      season_placements: {
        Row: {
          created_at: string
          elo: number
          league: string
          rank: number
          season_id: string
          subject_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          elo: number
          league: string
          rank: number
          season_id: string
          subject_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          elo?: number
          league?: string
          rank?: number
          season_id?: string
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_placements_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_placements_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      season_school_snapshots: {
        Row: {
          active_members: number
          created_at: string
          rank: number
          school_id: string
          score: number
          season_id: string
        }
        Insert: {
          active_members: number
          created_at?: string
          rank: number
          school_id: string
          score: number
          season_id: string
        }
        Update: {
          active_members?: number
          created_at?: string
          rank?: number
          school_id?: string
          score?: number
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_school_snapshots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_school_snapshots_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          slug: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          slug: string
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          slug?: string
          starts_at?: string
        }
        Relationships: []
      }
      signal_profiles: {
        Row: {
          created_at: string
          public: boolean
          show_country: boolean
          show_history: boolean
          show_trajectory: boolean
          subject_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          public?: boolean
          show_country?: boolean
          show_history?: boolean
          show_trajectory?: boolean
          subject_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          public?: boolean
          show_country?: boolean
          show_history?: boolean
          show_trajectory?: boolean
          subject_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signal_ratings: {
        Row: {
          algorithm_version: number
          computed_at: string
          confidence: number
          rating: number
          sample_size: number
          subject_id: string
          trajectory: string
          user_id: string
          verification_tier: string
        }
        Insert: {
          algorithm_version?: number
          computed_at?: string
          confidence: number
          rating: number
          sample_size: number
          subject_id: string
          trajectory: string
          user_id: string
          verification_tier?: string
        }
        Update: {
          algorithm_version?: number
          computed_at?: string
          confidence?: number
          rating?: number
          sample_size?: number
          subject_id?: string
          trajectory?: string
          user_id?: string
          verification_tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_ratings_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      study_blocks: {
        Row: {
          allocated_minutes: number
          created_at: string
          date: string
          deadline_id: string | null
          id: string
          is_locked: boolean
          student_id: string
          subject_id: string | null
          topic_id: string | null
        }
        Insert: {
          allocated_minutes: number
          created_at?: string
          date: string
          deadline_id?: string | null
          id?: string
          is_locked?: boolean
          student_id: string
          subject_id?: string | null
          topic_id?: string | null
        }
        Update: {
          allocated_minutes?: number
          created_at?: string
          date?: string
          deadline_id?: string | null
          id?: string
          is_locked?: boolean
          student_id?: string
          subject_id?: string | null
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_blocks_deadline_id_fkey"
            columns: ["deadline_id"]
            isOneToOne: false
            referencedRelation: "deadlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_blocks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_blocks_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plan_items: {
        Row: {
          completed: boolean
          day: string
          description: string | null
          estimated_minutes: number
          id: string
          plan_id: string
          question_count: number
          sort_order: number
          subject_id: string | null
          title: string
          topic_id: string | null
        }
        Insert: {
          completed?: boolean
          day: string
          description?: string | null
          estimated_minutes?: number
          id?: string
          plan_id: string
          question_count?: number
          sort_order?: number
          subject_id?: string | null
          title: string
          topic_id?: string | null
        }
        Update: {
          completed?: boolean
          day?: string
          description?: string | null
          estimated_minutes?: number
          id?: string
          plan_id?: string
          question_count?: number
          sort_order?: number
          subject_id?: string | null
          title?: string
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "study_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_plan_items_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_plan_items_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plans: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          intensity: Database["public"]["Enums"]["plan_intensity"]
          start_date: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          intensity?: Database["public"]["Enums"]["plan_intensity"]
          start_date?: string
          status?: string
          title?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          intensity?: Database["public"]["Enums"]["plan_intensity"]
          start_date?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      subject_ratings: {
        Row: {
          draws: number
          elo: number
          losses: number
          matches_played: number
          season_id: string
          subject_id: string
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          draws?: number
          elo?: number
          losses?: number
          matches_played?: number
          season_id: string
          subject_id: string
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          draws?: number
          elo?: number
          losses?: number
          matches_played?: number
          season_id?: string
          subject_id?: string
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "subject_ratings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_ratings_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          color: string
          created_at: string
          description: string | null
          group_name: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          group_name?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          group_name?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          current_period_end: string | null
          plan: string
          price_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          current_period_end?: string | null
          plan?: string
          price_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          current_period_end?: string | null
          plan?: string
          price_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subtopics: {
        Row: {
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
          topic_id: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          topic_id: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtopics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      themes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          level_code: string | null
          name: string
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
          subject_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          level_code?: string | null
          name: string
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          subject_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          level_code?: string | null
          name?: string
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "themes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          created_at: string
          description: string | null
          estimated_minutes: number | null
          id: string
          level_code: string | null
          name: string
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
          subject_id: string
          theme_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          level_code?: string | null
          name: string
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          subject_id: string
          theme_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          level_code?: string | null
          name?: string
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          subject_id?: string
          theme_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          daily_target: number
          goals: string[]
          intensity: Database["public"]["Enums"]["plan_intensity"]
          reduce_motion: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          daily_target?: number
          goals?: string[]
          intensity?: Database["public"]["Enums"]["plan_intensity"]
          reduce_motion?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          daily_target?: number
          goals?: string[]
          intensity?: Database["public"]["Enums"]["plan_intensity"]
          reduce_motion?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subjects: {
        Row: {
          created_at: string
          level_id: string | null
          subject_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          level_id?: string | null
          subject_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          level_id?: string | null
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subjects_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      whiteboards: {
        Row: {
          canvas_data: Json
          created_at: string
          id: string
          question_id: string | null
          student_id: string
          thumbnail_path: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          canvas_data?: Json
          created_at?: string
          id?: string
          question_id?: string | null
          student_id: string
          thumbnail_path?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          canvas_data?: Json
          created_at?: string
          id?: string
          question_id?: string | null
          student_id?: string
          thumbnail_path?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whiteboards_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      claim_mock_entries: {
        Args: { batch: number }
        Returns: {
          created_at: string
          grading_started_at: string | null
          id: string
          sitting_id: string
          started_at: string | null
          status: string
          submitted_at: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "mock_entries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      confidence_rating: "easy" | "okay" | "difficult" | "wrong"
      content_status: "draft" | "published" | "archived"
      deadline_type: "IA" | "EE" | "TOK" | "MOCK" | "EXAM"
      difficulty: "easy" | "medium" | "hard"
      ladder_status: "WAITING" | "ACTIVE" | "COMPLETE"
      plan_intensity: "light" | "balanced" | "intense"
      scan_status: "UPLOADED" | "PROCESSING" | "ANNOTATED" | "FAILED"
      session_mode: "practice" | "exam" | "mistakes" | "daily"
      session_status: "active" | "completed" | "abandoned"
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
    Enums: {
      confidence_rating: ["easy", "okay", "difficult", "wrong"],
      content_status: ["draft", "published", "archived"],
      deadline_type: ["IA", "EE", "TOK", "MOCK", "EXAM"],
      difficulty: ["easy", "medium", "hard"],
      ladder_status: ["WAITING", "ACTIVE", "COMPLETE"],
      plan_intensity: ["light", "balanced", "intense"],
      scan_status: ["UPLOADED", "PROCESSING", "ANNOTATED", "FAILED"],
      session_mode: ["practice", "exam", "mistakes", "daily"],
      session_status: ["active", "completed", "abandoned"],
    },
  },
} as const

