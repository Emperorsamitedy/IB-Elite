import {
  DEFAULT_PAGE_SIZE,
  WHITEBOARD_THUMBNAIL_PREFIX,
  type CanvasData,
  type Whiteboard,
  type WhiteboardSummary,
} from "./types";

export type WhiteboardDb = {
  insert(row: {
    student_id: string;
    question_id: string | null;
    title: string | null;
  }): Promise<Whiteboard>;
  findById(id: string): Promise<Whiteboard | null>;
  update(
    id: string,
    patch: { canvas_data?: CanvasData; thumbnail_path?: string },
  ): Promise<Whiteboard>;
  listFreeform(
    studentId: string,
    page: { limit: number; offset: number },
  ): Promise<Whiteboard[]>;
  listForQuestion(studentId: string, questionId: string): Promise<Whiteboard[]>;
};

/**
 * Structurally the subset of `ScanStorage` we need, so the existing
 * `createSupabaseScanStorage()` satisfies it without modification.
 */
export type ThumbnailStorage = {
  upload(input: {
    studentId: string;
    fileName: string;
    contentType: string;
    body: ArrayBuffer;
  }): Promise<string>;
  signedUrl(path: string): Promise<string>;
};

export function decodePngDataUrl(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = Buffer.from(base64, "base64");
  return binary.buffer.slice(
    binary.byteOffset,
    binary.byteOffset + binary.byteLength,
  ) as ArrayBuffer;
}

export function createWhiteboardService(
  db: WhiteboardDb,
  storage: ThumbnailStorage,
) {
  async function summarise(board: Whiteboard): Promise<WhiteboardSummary> {
    return {
      id: board.id,
      title: board.title,
      questionId: board.question_id,
      // Signed on read: the bucket is private and links expire.
      thumbnailUrl: board.thumbnail_path
        ? await storage.signedUrl(board.thumbnail_path)
        : null,
      updatedAt: board.updated_at,
    };
  }

  return {
    create(input: {
      studentId: string;
      questionId?: string | null;
      title?: string | null;
    }) {
      return db.insert({
        student_id: input.studentId,
        question_id: input.questionId ?? null,
        title: input.title ?? null,
      });
    },

    async get(id: string, studentId: string): Promise<Whiteboard | null> {
      const board = await db.findById(id);
      return board && board.student_id === studentId ? board : null;
    },

    async save(
      id: string,
      studentId: string,
      input: { canvasData: CanvasData; thumbnail?: string | null },
    ): Promise<Whiteboard | null> {
      const board = await db.findById(id);
      if (!board || board.student_id !== studentId) return null;

      const patch: { canvas_data: CanvasData; thumbnail_path?: string } = {
        canvas_data: input.canvasData,
      };

      if (input.thumbnail) {
        // A fresh object per save, so the signed URL of a stale render is
        // never served for updated work.
        patch.thumbnail_path = await storage.upload({
          studentId,
          fileName: `${WHITEBOARD_THUMBNAIL_PREFIX}-${id}-${Date.now()}.png`,
          contentType: "image/png",
          body: decodePngDataUrl(input.thumbnail),
        });
      }

      return db.update(id, patch);
    },

    async listFreeform(
      studentId: string,
      page: { limit?: number; offset?: number } = {},
    ): Promise<WhiteboardSummary[]> {
      const boards = await db.listFreeform(studentId, {
        limit: page.limit ?? DEFAULT_PAGE_SIZE,
        offset: page.offset ?? 0,
      });
      return Promise.all(boards.map(summarise));
    },

    async listForQuestion(
      studentId: string,
      questionId: string,
    ): Promise<WhiteboardSummary[]> {
      const boards = await db.listForQuestion(studentId, questionId);
      return Promise.all(boards.map(summarise));
    },
  };
}

export type WhiteboardService = ReturnType<typeof createWhiteboardService>;
