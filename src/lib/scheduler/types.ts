export type LevelCode = "SL" | "HL";

export type DeadlineType = "IA" | "EE" | "TOK" | "MOCK" | "EXAM";

export type StudentSubject = {
  subjectId: string;
  level: LevelCode;
};

export type TopicMastery = {
  topicId: string;
  subjectId: string;
  /** 0–1; correct attempts over attempted questions. */
  mastery: number;
};

export type Deadline = {
  id: string;
  type: DeadlineType;
  subjectId: string | null;
  dueDate: string;
  title: string;
};

export type StudyBlockDraft = {
  date: string;
  subjectId: string | null;
  topicId: string | null;
  deadlineId: string | null;
  allocatedMinutes: number;
};

export type PlanInput = {
  subjects: StudentSubject[];
  topics: TopicMastery[];
  deadlines: Deadline[];
  startDate: string;
  examDate: string;
  /** Total minutes schedulable per day. */
  dailyCapMinutes?: number;
  /** Dates that already hold locked blocks, with the minutes they consume. */
  reservedMinutesByDate?: Record<string, number>;
};

export const WEAK_MASTERY_THRESHOLD = 0.6;
export const DEFAULT_DAILY_CAP_MINUTES = 180;
export const HL_WEIGHT = 1.5;
export const SL_WEIGHT = 1;
/** Blocks shorter than this are not worth scheduling. */
export const MIN_BLOCK_MINUTES = 15;
/** Deadline-driven work (IA/EE/TOK) reserves this share of the daily cap. */
export const DEADLINE_SHARE = 0.25;
