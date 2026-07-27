import type { Difficulty } from "./types";

export const APP_NAME = "Atlas";

export const NAV_ITEMS = [
  { href: "/app", label: "Home", icon: "Home" },
  { href: "/practice", label: "Practice", icon: "Dumbbell" },
  { href: "/subjects", label: "Subjects", icon: "Library" },
  { href: "/mistakes", label: "Mistakes", icon: "AlertCircle" },
  { href: "/bookmarks", label: "Bookmarks", icon: "Bookmark" },
  { href: "/tutor", label: "AI Tutor", icon: "MessageSquareText" },
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

export const PRICING = {
  monthly: { amount: 9, label: "month", interval: "monthly" as const },
  annual: { amount: 72, label: "year", interval: "annual" as const },
};
