import { describe, expect, it, vi, beforeEach } from "vitest";

const ID = "11111111-1111-4111-8111-111111111111";
let role: string | null = "student";
const mutate = vi.fn();

function mockSupabase() {
  vi.doMock("@/lib/supabase/server", () => ({
    createClient: async () => ({
      auth: {
        getUser: async () => ({ data: { user: role ? { id: "u1" } : null } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({ single: async () => ({ data: role ? { role } : null }) }),
        }),
      }),
    }),
  }));
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({
      from: () => ({
        insert: () => {
          mutate();
          return { select: () => ({ single: async () => ({ data: { id: ID } }) }) };
        },
        update: () => {
          mutate();
          return {
            eq: () => ({
              select: () => ({ maybeSingle: async () => ({ data: { id: ID } }) }),
            }),
          };
        },
        delete: () => {
          mutate();
          return { eq: async () => ({}) };
        },
        select: () => ({ eq: async () => ({ count: 0 }) }),
      }),
    }),
  }));
}

function req(body: unknown, url = "http://localhost/api/admin/curriculum/topics") {
  return new Request(url, { method: "POST", body: JSON.stringify(body) }) as never;
}

describe("curriculum routes reuse the admin guard", () => {
  beforeEach(() => {
    vi.resetModules();
    mutate.mockReset();
    role = "student";
    mockSupabase();
  });

  it("403s a non-admin on create, update, delete and reorder", async () => {
    const { POST } = await import("@/app/api/admin/curriculum/[level]/route");
    const { PATCH, DELETE, GET } = await import(
      "@/app/api/admin/curriculum/[level]/[id]/route"
    );
    const { PATCH: REORDER } = await import(
      "@/app/api/admin/curriculum/reorder/route"
    );
    const params = { params: Promise.resolve({ level: "topics", id: ID }) };

    const statuses = [
      (await POST(req({}), { params: Promise.resolve({ level: "topics" }) })).status,
      (await PATCH(req({}), params)).status,
      (await DELETE(req(null), params)).status,
      (await GET(req(null), params)).status,
      (await REORDER(req({ level: "topics", ids: [ID] }))).status,
    ];

    expect(statuses).toEqual([403, 403, 403, 403, 403]);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("404s an unknown level for an admin", async () => {
    role = "admin";
    const { POST } = await import("@/app/api/admin/curriculum/[level]/route");
    const res = await POST(req({}), {
      params: Promise.resolve({ level: "chapters" }),
    });
    expect(res.status).toBe(404);
  });
});
