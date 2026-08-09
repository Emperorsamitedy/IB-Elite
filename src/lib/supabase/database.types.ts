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
          paper_ref: string | null
          paper_year: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["ladder_status"]
          student_a_id: string
          student_b_id: string | null
          subject_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          level_code?: string
          paper_ref?: string | null
          paper_year?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ladder_status"]
          student_a_id: string
          student_b_id?: string | null
          subject_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          level_code?: string
          paper_ref?: string | null
          paper_year?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ladder_status"]
          student_a_id?: string
          student_b_id?: string | null
          subject_id?: string
        }
        Relationships: [
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
          created_at: string
          full_name: string | null
          id: string
          onboarded: boolean
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          onboarded?: boolean
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
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
          alt: string | null
          id: string
          kind: string
          question_id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          alt?: string | null
          id?: string
          kind?: string
          question_id: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          alt?: string | null
          id?: string
          kind?: string
          question_id?: string
          sort_order?: number
          storage_path?: string
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
          calculator: boolean | null
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
          calculator?: boolean | null
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
          calculator?: boolean | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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

