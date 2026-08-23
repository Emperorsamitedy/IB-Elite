/** A serialised board — opaque to the server, replayed verbatim by the canvas. */
export type CanvasData = Record<string, unknown>;

export type Whiteboard = {
  id: string;
  student_id: string;
  question_id: string | null;
  title: string | null;
  canvas_data: CanvasData;
  thumbnail_path: string | null;
  created_at: string;
  updated_at: string;
};

/** A list row: the canvas itself is too heavy for a grid of thumbnails. */
export type WhiteboardSummary = {
  id: string;
  title: string | null;
  questionId: string | null;
  thumbnailUrl: string | null;
  updatedAt: string;
};

export const WHITEBOARD_THUMBNAIL_PREFIX = "whiteboards";
export const DEFAULT_PAGE_SIZE = 24;
