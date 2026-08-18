import { createAdminClient } from "@/lib/supabase/admin";
import type { CurriculumLevel } from "@/lib/admin/curriculum";

type Row = { id: string; name: string; sort_order: number };
type Result<T> = { data: T | null; error: { message: string } | null };

/**
 * The level is only known at runtime, so the generated per-table types cannot
 * narrow the payload. This is the one place that widens them, for the four
 * curriculum tables which share the same id/name/sort_order shape.
 */
type CurriculumTable = {
  insert(row: Record<string, unknown>): {
    select(columns: string): { single(): Promise<Result<Row>> };
  };
  update(patch: Record<string, unknown>): {
    eq(
      column: string,
      value: string,
    ): {
      select(columns: string): { maybeSingle(): Promise<Result<Row>> };
    } & Promise<Result<null>>;
  };
  delete(): {
    eq(column: string, value: string): Promise<Result<null>>;
  };
};

export function curriculumTable(level: CurriculumLevel): CurriculumTable {
  return createAdminClient().from(level) as unknown as CurriculumTable;
}
