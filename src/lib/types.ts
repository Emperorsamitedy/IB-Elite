import type { Database } from "./supabase/database.types";

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Subject = Tables<"subjects">;
export type Level = Tables<"levels">;
export type Topic = Tables<"topics">;
export type Subtopic = Tables<"subtopics">;
export type Question = Tables<"questions">;
export type Profile = Tables<"profiles">;
export type UserPreferences = Tables<"user_preferences">;
export type ExamDate = Tables<"exam_dates">;
export type PracticeSession = Tables<"practice_sessions">;
export type QuestionAttempt = Tables<"question_attempts">;
export type Bookmark = Tables<"bookmarks">;
export type Mistake = Tables<"mistakes">;
export type Note = Tables<"notes">;
export type StudyPlan = Tables<"study_plans">;
export type StudyPlanItem = Tables<"study_plan_items">;
export type Subscription = Tables<"subscriptions">;

export type Difficulty = Database["public"]["Enums"]["difficulty"];
export type ContentStatus = Database["public"]["Enums"]["content_status"];
export type ConfidenceRating =
  Database["public"]["Enums"]["confidence_rating"];
export type SessionMode = Database["public"]["Enums"]["session_mode"];
export type PlanIntensity = Database["public"]["Enums"]["plan_intensity"];

export type SubjectWithCounts = Subject & {
  question_count: number;
  topic_count: number;
};

export type TopicWithStats = Topic & {
  question_count: number;
  attempted: number;
  correct: number;
};
