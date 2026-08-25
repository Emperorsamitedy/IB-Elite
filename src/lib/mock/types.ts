/** One row of a paper's markscheme. `topicId` links weak criteria to practice. */
export type Criterion = {
  id: string;
  title: string;
  description: string;
  maxMarks: number;
  topicId?: string | null;
};

import type { BoundingBox } from "@/lib/scans/types";

export type CriterionAward = {
  criterionId: string;
  title: string;
  maxMarks: number;
  awarded: number;
  comment: string | null;
  /** Verbatim phrase the marks hang on; anchors the overlay. */
  evidence?: string | null;
  /** Which script page the evidence sits on, and where. */
  pageIndex?: number | null;
  box?: BoundingBox | null;
};

export type GradeOutcome = {
  criteria: CriterionAward[];
  totalAwarded: number;
  totalMax: number;
  grader: "ai" | "keywords";
};

export type MockBand = "americas" | "emea" | "apac";

export const BAND_LABELS: Record<MockBand, string> = {
  americas: "Americas",
  emea: "Europe & Africa",
  apac: "Asia-Pacific",
};

export type EntryStatus =
  | "entered"
  | "started"
  | "submitted"
  | "late"
  | "grading"
  | "graded"
  | "quarantined";
