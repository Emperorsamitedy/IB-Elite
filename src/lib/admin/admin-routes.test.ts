import { describe, expect, it, vi, beforeEach } from "vitest";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const TOPIC = "22222222-2222-4222-8222-222222222222";
const QUESTION = "55555555-5555-4555-8555-555555555555";

const insert = vi.fn();
const update = vi.fn();
let role: string | null = "admin";

function mockSupabase() {
  vi.doMock("@/lib/supabase/server", () => ({
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: role ? { id: "u1" } : null } }) },
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: role ? { role } : null }) }) }),
      }),
    }),
  }));
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({
      from: () => ({
        insert: (row: unknown) => {
          insert(row);
          return {
            select: () => ({ single: async () => ({ data: { id: QUESTION } }) }),
          };
        },
        update: (patch: unknown) => {
          update(patch);
          return {
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({
                  data: { id: QUESTION, status: "archived" },
                }),
              }),
            }),
          };
        },
      }),
    }),
  }));
}

function req(body: unknown) {
  return new Request("http://localhost/api/admin/questions", {
    method: "POST",
    body: JSON.stringify(body),
  }) as never;
}

describe("admin question endpoints", () => {
  beforeEach(() => {
    vi.resetModules();
    insert.mockReset();
    update.mockReset();
    role = "admin";
    mockSupabase();
  });

  it("creates a question", async () => {
    const { POST } = await import("@/app/api/admin/questions/route");
    const res = await POST(req({ subject_id: SUBJECT, topic_id: TOPIC, prompt: "Explain drift velocity." }));
    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "Explain drift velocity." }),
    );
  });

  it("edits a question", async () => {
    const { PATCH } = await import("@/app/api/admin/questions/[id]/route");
    const res = await PATCH(req({ marks: 5 }), {
      params: Promise.resolve({ id: QUESTION }),
    });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ marks: 5 }));
  });

  it("soft-deletes a question by archiving it", async () => {
    const { DELETE } = await import("@/app/api/admin/questions/[id]/route");
    const res = await DELETE(req(null), {
      params: Promise.resolve({ id: QUESTION }),
    });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "archived" }),
    );
  });

  it("403s a non-admin on every route", async () => {
    role = "student";
    const { POST } = await import("@/app/api/admin/questions/route");
    const { PATCH, DELETE } = await import("@/app/api/admin/questions/[id]/route");
    const { POST: BULK } = await import(
      "@/app/api/admin/questions/bulk-import/route"
    );
    const params = { params: Promise.resolve({ id: QUESTION }) };

    for (const status of [
      (await POST(req({}))).status,
      (await PATCH(req({}), params)).status,
      (await DELETE(req(null), params)).status,
      (await BULK(req([]))).status,
    ]) {
      expect(status).toBe(403);
    }
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
