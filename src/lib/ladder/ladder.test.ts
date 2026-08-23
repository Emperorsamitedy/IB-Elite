import { describe, expect, it, vi } from "vitest";
import { completeSide } from "./complete";
import { createFakeLadderStore } from "./fake-store";
import { recordProgress } from "./progress";
import { queueForMatch } from "./queue";
import { PROGRESS_EVENT, matchChannel, type LadderPublisher } from "./types";

const SUBJECT = "subject-physics";
const ALICE = "student-alice";
const BOB = "student-bob";

function fakePublisher() {
  const publish = vi.fn<LadderPublisher["publish"]>(async () => {});
  return { publisher: { publish } satisfies LadderPublisher, publish };
}

describe("ladder queue", () => {
  it("matches two students of the same subject and level into one ACTIVE match", async () => {
    const store = createFakeLadderStore({ [ALICE]: "HL", [BOB]: "HL" });

    const first = await queueForMatch(store, { studentId: ALICE, subjectId: SUBJECT });
    const second = await queueForMatch(store, { studentId: BOB, subjectId: SUBJECT });

    expect(store.matches).toHaveLength(1);
    expect(second.matchId).toBe(first.matchId);
    expect(second.status).toBe("ACTIVE");
    expect(second.match.student_a_id).toBe(ALICE);
    expect(second.match.student_b_id).toBe(BOB);
  });

  it("does not match students on different levels", async () => {
    const store = createFakeLadderStore({ [ALICE]: "HL", [BOB]: "SL" });

    await queueForMatch(store, { studentId: ALICE, subjectId: SUBJECT });
    const second = await queueForMatch(store, { studentId: BOB, subjectId: SUBJECT });

    expect(store.matches).toHaveLength(2);
    expect(second.status).toBe("WAITING");
  });

  it("fixes the same question list on the match for both players", async () => {
    const store = createFakeLadderStore({ [ALICE]: "HL", [BOB]: "HL" });

    const first = await queueForMatch(store, { studentId: ALICE, subjectId: SUBJECT });
    const second = await queueForMatch(store, { studentId: BOB, subjectId: SUBJECT });

    expect(first.match.question_ids.length).toBeGreaterThan(0);
    // Joining must not reshuffle: a race is only fair on identical papers.
    expect(second.match.question_ids).toEqual(first.match.question_ids);
  });

  it("refuses to open a match when the subject has no questions", async () => {
    const store = createFakeLadderStore({ [ALICE]: "SL" });
    store.pickQuestionIds = async () => [];

    await expect(
      queueForMatch(store, { studentId: ALICE, subjectId: SUBJECT }),
    ).rejects.toThrow(/no published questions/i);
  });

  it("creates a WAITING row for a lone student without erroring", async () => {
    const store = createFakeLadderStore({ [ALICE]: "SL" });

    const result = await queueForMatch(store, { studentId: ALICE, subjectId: SUBJECT });

    expect(result.status).toBe("WAITING");
    expect(store.matches).toHaveLength(1);
    expect(store.matches[0].student_b_id).toBeNull();
  });
});

describe("ladder progress", () => {
  it("publishes position and score only, never question content", async () => {
    const store = createFakeLadderStore({ [ALICE]: "HL", [BOB]: "HL" });
    const { publisher, publish } = fakePublisher();
    await queueForMatch(store, { studentId: ALICE, subjectId: SUBJECT });
    const { matchId } = await queueForMatch(store, { studentId: BOB, subjectId: SUBJECT });

    await recordProgress(store, publisher, {
      matchId,
      studentId: ALICE,
      questionIndex: 2,
      isCorrect: true,
    });
    await recordProgress(store, publisher, {
      matchId,
      studentId: ALICE,
      questionIndex: 3,
      isCorrect: true,
    });

    expect(publish).toHaveBeenCalledTimes(2);
    const [channel, event, payload] = publish.mock.calls[1];
    expect(channel).toBe(matchChannel(matchId));
    expect(event).toBe(PROGRESS_EVENT);
    expect(payload).toEqual({
      matchId,
      studentId: ALICE,
      questionIndex: 3,
      correctCount: 2,
      isComplete: false,
    });
    expect(Object.keys(payload).sort()).toEqual([
      "correctCount",
      "isComplete",
      "matchId",
      "questionIndex",
      "studentId",
    ]);
    const serialized = JSON.stringify(payload);
    for (const leak of ["prompt", "answer", "solution", "question_id"]) {
      expect(serialized).not.toContain(leak);
    }
  });
});

describe("ladder completion", () => {
  it("closes the match and records wins and losses for both students", async () => {
    const store = createFakeLadderStore({ [ALICE]: "HL", [BOB]: "HL" });
    const { publisher } = fakePublisher();
    await queueForMatch(store, { studentId: ALICE, subjectId: SUBJECT });
    const { matchId } = await queueForMatch(store, { studentId: BOB, subjectId: SUBJECT });

    const first = await completeSide(store, publisher, {
      matchId,
      studentId: ALICE,
      finalScore: 8,
      identity: { country: "ET", school: "ICS" },
    });
    expect(first.matchComplete).toBe(false);
    expect(store.leaderboard_rows).toMatchObject([
      { student_id: ALICE, wins: 0, losses: 0 },
    ]);

    const second = await completeSide(store, publisher, {
      matchId,
      studentId: BOB,
      finalScore: 5,
      identity: { country: "ET", school: "Sandford" },
    });

    expect(second.matchComplete).toBe(true);
    expect(second.match.status).toBe("COMPLETE");
    const alice = store.leaderboard_rows.find((r) => r.student_id === ALICE);
    const bob = store.leaderboard_rows.find((r) => r.student_id === BOB);
    expect(alice).toMatchObject({ wins: 1, losses: 0, country: "ET" });
    expect(bob).toMatchObject({ wins: 0, losses: 1, school: "Sandford" });

    const board = await store.leaderboard({ country: "ET" });
    expect(board.map((r) => r.student_id)).toEqual([ALICE, BOB]);
  });

  it("counts a tie as neither a win nor a loss", async () => {
    const store = createFakeLadderStore({ [ALICE]: "SL", [BOB]: "SL" });
    const { publisher } = fakePublisher();
    await queueForMatch(store, { studentId: ALICE, subjectId: SUBJECT });
    const { matchId } = await queueForMatch(store, { studentId: BOB, subjectId: SUBJECT });

    await completeSide(store, publisher, { matchId, studentId: ALICE, finalScore: 7 });
    await completeSide(store, publisher, { matchId, studentId: BOB, finalScore: 7 });

    for (const row of store.leaderboard_rows) {
      expect(row).toMatchObject({ wins: 0, losses: 0 });
    }
  });
});
