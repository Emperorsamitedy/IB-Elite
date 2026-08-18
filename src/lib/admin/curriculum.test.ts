import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { deleteCurriculumNode, persistOrder } from "./curriculum";

const ID = "11111111-1111-4111-8111-111111111111";

describe("curriculum deletion", () => {
  it("blocks a subject delete that would destroy questions, reporting the count", async () => {
    const remove = vi.fn(async () => ({}));
    const outcome = await deleteCurriculumNode("subjects", ID, false, {
      countQuestions: async () => 12,
      remove,
    });

    expect(outcome).toEqual({ status: "blocked", affected: 12 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("blocks a topic delete the same way", async () => {
    const outcome = await deleteCurriculumNode("topics", ID, false, {
      countQuestions: async () => 3,
      remove: async () => ({}),
    });
    expect(outcome).toEqual({ status: "blocked", affected: 3 });
  });

  it("deletes a subject with no attached questions", async () => {
    const remove = vi.fn(async () => ({}));
    const outcome = await deleteCurriculumNode("subjects", ID, false, {
      countQuestions: async () => 0,
      remove,
    });
    expect(outcome).toEqual({ status: "deleted" });
    expect(remove).toHaveBeenCalledWith("subjects", ID);
  });

  it("deletes once the admin forces it", async () => {
    const countQuestions = vi.fn(async () => 12);
    const outcome = await deleteCurriculumNode("subjects", ID, true, {
      countQuestions,
      remove: async () => ({}),
    });
    expect(outcome).toEqual({ status: "deleted" });
    expect(countQuestions).not.toHaveBeenCalled();
  });

  it("never blocks subtopics or themes — they cannot destroy a question", async () => {
    for (const level of ["subtopics", "themes"] as const) {
      const outcome = await deleteCurriculumNode(level, ID, false, {
        countQuestions: async () => 9,
        remove: async () => ({}),
      });
      expect(outcome).toEqual({ status: "deleted" });
    }
  });
});

describe("reordering", () => {
  it("persists sort_order by index and survives a re-fetch", async () => {
    const store = new Map([
      ["a", 0],
      ["b", 1],
      ["c", 2],
    ]);

    const { error } = await persistOrder(
      "topics",
      ["c", "a", "b"],
      async (_level, id, sortOrder) => {
        store.set(id, sortOrder);
        return {};
      },
    );
    expect(error).toBeUndefined();

    const refetched = [...store.entries()]
      .sort((x, y) => x[1] - y[1])
      .map(([id]) => id);
    expect(refetched).toEqual(["c", "a", "b"]);
  });

  it("stops and reports when a write fails", async () => {
    const { error } = await persistOrder("topics", ["a", "b"], async (_l, id) =>
      id === "b" ? { error: "denied" } : {},
    );
    expect(error).toBe("denied");
  });
});

describe("users routes stay read-only", () => {
  it("exposes no PATCH or DELETE handler under api/admin/users", () => {
    const dir = path.join(process.cwd(), "src/app/api/admin/users");
    if (!fs.existsSync(dir)) return;

    const files: string[] = [];
    const walk = (p: string) => {
      for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
        const full = path.join(p, entry.name);
        if (entry.isDirectory()) walk(full);
        else files.push(full);
      }
    };
    walk(dir);

    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      expect(source).not.toMatch(/export\s+(async\s+)?function\s+(PATCH|DELETE|PUT)/);
    }
  });
});
