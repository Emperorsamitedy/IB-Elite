import type { Difficulty } from "./types";

export const APP_NAME = "Atlas";

export const NAV_ITEMS = [
  { href: "/app", label: "Home", icon: "Home" },
  { href: "/practice", label: "Practice", icon: "Dumbbell" },
  { href: "/subjects", label: "Subjects", icon: "Library" },
  { href: "/mistakes", label: "Mistakes", icon: "AlertCircle" },
  { href: "/bookmarks", label: "Bookmarks", icon: "Bookmark" },
  { href: "/tutor", label: "AI Tutor", icon: "MessageSquareText" },
  { href: "/solve", label: "Solve & Grade", icon: "Camera" },
  { href: "/whiteboard", label: "Whiteboard", icon: "PencilRuler" },
  { href: "/scans/upload", label: "Scan work", icon: "ScanLine" },
  { href: "/ladder", label: "World Ladder", icon: "Swords" },
  { href: "/plan", label: "Study Plan", icon: "CalendarRange" },
] as const;

export const MOBILE_NAV_ITEMS = [
  { href: "/app", label: "Home", icon: "Home" },
  { href: "/practice", label: "Practice", icon: "Dumbbell" },
  { href: "/subjects", label: "Subjects", icon: "Library" },
  { href: "/mistakes", label: "Mistakes", icon: "AlertCircle" },
  { href: "/tutor", label: "Tutor", icon: "MessageSquareText" },
] as const;

export const DIFFICULTIES: {
  value: Difficulty;
  label: string;
}[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export const QUESTION_COUNT_PRESETS = [5, 10, 15, 20];

export const GOALS = [
  { id: "find_questions", label: "Finding practice questions" },
  { id: "weak_topics", label: "Revising weak topics" },
  { id: "study_plan", label: "Building a study plan" },
  { id: "understand", label: "Understanding difficult questions" },
] as const;

export const CONFIDENCE_OPTIONS = [
  { value: "easy", label: "Easy", tone: "success" },
  { value: "okay", label: "Okay", tone: "accent" },
  { value: "difficult", label: "Difficult", tone: "warning" },
  { value: "wrong", label: "I got it wrong", tone: "danger" },
] as const;

export const CURRENCY_SYMBOL = "$";

/**
 * Display prices. Amounts are strings because they are only ever rendered —
 * Stripe is the source of truth for what is actually charged.
 */
export const PRICING = {
  pro: {
    monthly: { amount: "16.99", label: "month", interval: "monthly" as const },
    annual: { amount: "169", label: "year", interval: "annual" as const },
  },
  max: {
    monthly: { amount: "25", label: "month", interval: "monthly" as const },
  },
};

export const PRO_FEATURES = [
  "Unlimited practice sessions",
  "AI tutor with progressive hints",
  "Personalised study plans",
  "Full mistake analytics",
  "Unlimited exam countdowns",
];

/** What Max adds on top of Pro. None of this library exists yet. */
export const MAX_FEATURES = [
  "Every year's topical past papers",
  "Full past papers by subject and session",
  "Video solutions",
  "Downloadable PDFs per topic",
];
