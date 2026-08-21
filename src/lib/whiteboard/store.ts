import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseScanStorage } from "@/lib/scans/supabase-store";
import type { Json } from "@/lib/supabase/database.types";
import { createWhiteboardService, type WhiteboardDb } from "./service";
import type { Whiteboard } from "./types";

type AdminClient = ReturnType<typeof createAdminClient>;

const COLUMNS =
  "id, student_id, question_id, title, canvas_data, thumbnail_path, created_at, updated_at";

function asBoard(row: unknown): Whiteboard {
  return row as Whiteboard;
}

export function createWhiteboardDb(
  client: AdminClient = createAdminClient(),
): WhiteboardDb {
  return {
    async insert(row) {
      const { data, error } = await client
        .from("whiteboards")
        .insert(row)
        .select(COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return asBoard(data);
    },

    async findById(id) {
      const { data } = await client
        .from("whiteboards")
        .select(COLUMNS)
        .eq("id", id)
        .maybeSingle();
      return data ? asBoard(data) : null;
    },

    async update(id, patch) {
      const { data, error } = await client
        .from("whiteboards")
        .update({
          ...patch,
          // jsonb column; the board's shape is opaque to the database types.
          canvas_data: patch.canvas_data as unknown as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select(COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return asBoard(data);
    },

    async listFreeform(studentId, { limit, offset }) {
      const { data } = await client
        .from("whiteboards")
        .select(COLUMNS)
        .eq("student_id", studentId)
        .is("question_id", null)
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1);
      return (data ?? []).map(asBoard);
    },

    async listForQuestion(studentId, questionId) {
      const { data } = await client
        .from("whiteboards")
        .select(COLUMNS)
        .eq("student_id", studentId)
        .eq("question_id", questionId)
        .order("updated_at", { ascending: false });
      return (data ?? []).map(asBoard);
    },
  };
}

/** Thumbnails live in the existing private `scans` bucket. */
export function whiteboardService() {
  return createWhiteboardService(
    createWhiteboardDb(),
    createSupabaseScanStorage(),
  );
}
