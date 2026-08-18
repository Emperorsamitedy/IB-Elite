import { describe, expect, it, vi, beforeEach } from "vitest";
import { importQuestionRows, parseCsv } from "./questions";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const TOPIC = "22222222-2222-4222-8222-222222222222";

function validRow(prompt: string) {
  return { subject_id: SUBJECT, topic_id: TOPIC, prompt };
}

function deps(insert = vi.fn(async () => ({}) as { error?: string })) {
  return {
    subjectExists: async (id: string) => id === SUBJECT,
    topicExists: async (id: string) => id === TOPIC,
    insert,
  };
}

describe("bulk import", () => {
  it("inserts the valid rows and reports each failure individually", async () => {
    const insert = vi.fn(async () => ({}) as { error?: string });
    const result = await importQuestionRows(
      [
        validRow("What is 2 + 2?"),
        validRow("Define momentum."),
        { subject_id: SUBJECT, topic_id: TOPIC }, // missing prompt
        validRow("State Hooke's law."),
      ],
      deps(insert),
    );

    expect(result.inserted).toBe(3);
    expect(insert).toHaveBeenCalledTimes(3);
    expect(result.failed).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].row).toBe(3);
    expect(result.failures[0].reason).toContain("prompt");
  });

  it("rejects rows whose subject or topic does not exist", async () => {
    const result = await importQuestionRows(
      [
        { ...validRow("Fine."), subject_id: "33333333-3333-4333-8333-333333333333" },
        { ...validRow("Also fine."), topic_id: "44444444-4444-4444-8444-444444444444" },
      ],
      deps(),
    );

    expect(result.inserted).toBe(0);
    expect(result.failures.map((f) => f.reason)).toEqual([
      expect.stringContaining("Subject"),
      expect.stringContaining("Topic"),
    ]);
  });

  it("keeps going when a single insert fails at the database", async () => {
    let call = 0;
    const insert = vi.fn(async () => {
      call++;
      return call === 1 ? { error: "duplicate key" } : {};
    });
    const result = await importQuestionRows(
      [validRow("One."), validRow("Two.")],
      deps(insert),
    );

    expect(result.inserted).toBe(1);
    expect(result.failures).toEqual([{ row: 1, reason: "duplicate key" }]);
  });
});

describe("parseCsv", () => {
  it("handles quoted cells containing commas", () => {
    const rows = parseCsv('prompt,marks\n"Explain, briefly, why.",3\n');
    expect(rows).toEqual([{ prompt: "Explain, briefly, why.", marks: "3" }]);
  });
});

describe("admin API guard", () => {
  const getUser = vi.fn();
  const maybeSingle = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    getUser.mockReset();
    maybeSingle.mockReset();
  });

  async function callGuard() {
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: async () => ({
        auth: { getUser },
        from: () => ({
          select: () => ({ eq: () => ({ single: maybeSingle }) }),
        }),
      }),
    }));
    const { requireAdminApi } = await import("@/app/api/admin/auth");
    return requireAdminApi();
  }

  it("403s an anonymous caller", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const gate = await callGuard();
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.response.status).toBe(403);
  });

  it("403s a signed-in non-admin", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    maybeSingle.mockResolvedValue({ data: { role: "student" } });
    const gate = await callGuard();
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.response.status).toBe(403);
  });

  it("lets an admin through", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    maybeSingle.mockResolvedValue({ data: { role: "admin" } });
    const gate = await callGuard();
    expect(gate.ok).toBe(true);
  });
});
