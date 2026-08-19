import { describe, expect, it } from "vitest";
import {
  createWhiteboardService,
  decodePngDataUrl,
  type ThumbnailStorage,
  type WhiteboardDb,
} from "./service";
import {
  canRedo,
  canUndo,
  createHistory,
  current,
  HISTORY_LIMIT,
  push,
  redo,
  undo,
} from "./history";
import type { CanvasData, Whiteboard } from "./types";

const PNG = "data:image/png;base64,aGVsbG8=";

function memoryDb(): WhiteboardDb {
  const rows: Whiteboard[] = [];
  let seq = 0;

  return {
    async insert(row) {
      const now = new Date(Date.now() + rows.length).toISOString();
      const board: Whiteboard = {
        id: `wb-${++seq}`,
        student_id: row.student_id,
        question_id: row.question_id,
        title: row.title,
        canvas_data: {},
        thumbnail_path: null,
        created_at: now,
        updated_at: now,
      };
      rows.push(board);
      return board;
    },
    async findById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async update(id, patch) {
      const board = rows.find((r) => r.id === id);
      if (!board) throw new Error("missing");
      Object.assign(board, patch, { updated_at: new Date().toISOString() });
      return board;
    },
    async listFreeform(studentId, { limit, offset }) {
      return rows
        .filter((r) => r.student_id === studentId && r.question_id === null)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(offset, offset + limit);
    },
    async listForQuestion(studentId, questionId) {
      return rows
        .filter(
          (r) => r.student_id === studentId && r.question_id === questionId,
        )
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },
  };
}

function memoryStorage(): ThumbnailStorage {
  let n = 0;
  return {
    async upload({ studentId, fileName }) {
      return `${studentId}/${++n}-${fileName}`;
    },
    async signedUrl(path) {
      return `https://signed.example/${path}?token=abc`;
    },
  };
}

function service() {
  const db = memoryDb();
  return { db, svc: createWhiteboardService(db, memoryStorage()) };
}

describe("whiteboard service", () => {
  it("returns a question-scoped board from listForQuestion", async () => {
    const { svc } = service();
    const created = await svc.create({
      studentId: "stu-1",
      questionId: "q-1",
    });

    const found = await svc.listForQuestion("stu-1", "q-1");
    expect(found.map((b) => b.id)).toEqual([created.id]);
  });

  it("lists freeform boards only, excluding question-scoped ones", async () => {
    const { svc } = service();
    const freeform = await svc.create({
      studentId: "stu-1",
      title: "Scratch",
    });
    const scoped = await svc.create({ studentId: "stu-1", questionId: "q-1" });

    const list = await svc.listFreeform("stu-1");
    const ids = list.map((b) => b.id);
    expect(ids).toContain(freeform.id);
    expect(ids).not.toContain(scoped.id);
  });

  it("round-trips canvas_data through save and get", async () => {
    const { svc } = service();
    const board = await svc.create({ studentId: "stu-1" });
    const canvasData: CanvasData = {
      version: "7.4.0",
      objects: [{ type: "Path", stroke: "#DC2626", path: [["M", 1, 2]] }],
    };

    await svc.save(board.id, "stu-1", { canvasData });
    const reopened = await svc.get(board.id, "stu-1");

    expect(reopened?.canvas_data).toEqual(canvasData);
  });

  it("writes a fresh thumbnail path on every save", async () => {
    const { svc } = service();
    const board = await svc.create({ studentId: "stu-1" });

    await svc.save(board.id, "stu-1", { canvasData: {}, thumbnail: PNG });
    const first = (await svc.get(board.id, "stu-1"))?.thumbnail_path;
    await svc.save(board.id, "stu-1", { canvasData: {}, thumbnail: PNG });
    const second = (await svc.get(board.id, "stu-1"))?.thumbnail_path;

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(second).not.toEqual(first);
  });

  it("signs thumbnails when listing", async () => {
    const { svc } = service();
    const board = await svc.create({ studentId: "stu-1" });
    await svc.save(board.id, "stu-1", { canvasData: {}, thumbnail: PNG });

    const [summary] = await svc.listFreeform("stu-1");
    expect(summary.thumbnailUrl).toMatch(/^https:\/\/signed\.example\//);
  });

  it("refuses to read or write another student's board", async () => {
    const { svc } = service();
    const board = await svc.create({ studentId: "stu-1" });

    expect(await svc.get(board.id, "stu-2")).toBeNull();
    expect(await svc.save(board.id, "stu-2", { canvasData: {} })).toBeNull();
  });

  it("decodes a PNG data URL to bytes", () => {
    expect(Buffer.from(decodePngDataUrl(PNG)).toString()).toBe("hello");
  });
});

describe("undo history", () => {
  it("moves back and forward through snapshots", () => {
    let history = createHistory({ step: 0 });
    history = push(history, { step: 1 });
    history = push(history, { step: 2 });

    expect(current(history)).toEqual({ step: 2 });
    history = undo(history);
    expect(current(history)).toEqual({ step: 1 });
    history = redo(history);
    expect(current(history)).toEqual({ step: 2 });
  });

  it("drops the redo branch once a new action is recorded", () => {
    let history = createHistory({ step: 0 });
    history = push(history, { step: 1 });
    history = undo(history);
    history = push(history, { step: 9 });

    expect(canRedo(history)).toBe(false);
    expect(current(history)).toEqual({ step: 9 });
  });

  it("keeps at most the last 20 actions", () => {
    let history = createHistory({ step: 0 });
    for (let i = 1; i <= 40; i++) history = push(history, { step: i });

    expect(history.entries).toHaveLength(HISTORY_LIMIT);
    expect(current(history)).toEqual({ step: 40 });
    expect(history.entries[0]).toEqual({ step: 40 - HISTORY_LIMIT + 1 });
  });

  it("cannot undo past the first snapshot", () => {
    const history = createHistory({ step: 0 });
    expect(canUndo(history)).toBe(false);
    expect(undo(history)).toBe(history);
  });
});
