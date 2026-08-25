import { describe, expect, it } from "vitest";
import { createFakeDuelStore } from "./fake-store";
import {
  acceptDuelChallenge,
  createDuelChallenge,
  getMatchState,
  getOrCreateRating,
  getOrCreateSeason,
  queueForDuel,
  submitAnswer,
} from "./service";
import { ELO_INITIAL } from "./elo";

const SUBJECT = "subject-1";
const ALICE = "alice";
const BOB = "bob";

/** Controllable clock: tests advance time explicitly. */
function makeClock(startIso = "2026-09-10T10:00:00Z") {
  let current = new Date(startIso);
  return {
    now: () => current,
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}

async function startMatch(clock = makeClock()) {
  const store = createFakeDuelStore({ clock: clock.now });
  const first = await queueForDuel(
    store,
    { userId: ALICE, subjectId: SUBJECT, mode: "ranked" },
    clock.now(),
  );
  expect(first.status).toBe("queued");
  const second = await queueForDuel(
    store,
    { userId: BOB, subjectId: SUBJECT, mode: "ranked" },
    clock.now(),
  );
  if (second.status !== "matched") throw new Error("expected a match");
  return { store, clock, match: second.match };
}

/** Plays one side straight through; `right` marks how many to answer correctly. */
async function playSide(
  store: ReturnType<typeof createFakeDuelStore>,
  clock: ReturnType<typeof makeClock>,
  matchId: string,
  userId: string,
  right: number,
  msPerAnswer = 10_000,
) {
  for (let i = 0; i < 5; i++) {
    await getMatchState(store, matchId, userId, clock.now());
    clock.advance(msPerAnswer);
    await submitAnswer(
      store,
      {
        matchId,
        userId,
        questionIndex: i,
        answer: i < right ? `a${i + 1}` : "wrong",
      },
      clock.now(),
    );
  }
}

describe("matchmaking + seasons", () => {
  it("pairs two ranked players and removes both from the queue", async () => {
    const { store, match } = await startMatch();
    expect(match.status).toBe("ACTIVE");
    expect(match.mode).toBe("ranked");
    expect(match.season_id).not.toBeNull();
    expect(match.question_ids).toHaveLength(5);
    expect(store.queue).toHaveLength(0);
    // The waiting player is notified; the seeker sees the match directly.
    expect(store.notifications.some((n) => n.userId === ALICE)).toBe(true);
  });

  it("keeps ranked and friendly queues separate", async () => {
    const clock = makeClock();
    const store = createFakeDuelStore({ clock: clock.now });
    await queueForDuel(
      store,
      { userId: ALICE, subjectId: SUBJECT, mode: "ranked" },
      clock.now(),
    );
    const result = await queueForDuel(
      store,
      { userId: BOB, subjectId: SUBJECT, mode: "friendly" },
      clock.now(),
    );
    expect(result.status).toBe("queued");
    expect(store.queue).toHaveLength(2);
  });

  it("soft-resets ratings into a new season", async () => {
    const clock = makeClock("2026-09-10T10:00:00Z");
    const store = createFakeDuelStore({ clock: clock.now });
    const september = await getOrCreateSeason(store, clock.now());
    await store.saveRating({
      user_id: ALICE,
      subject_id: SUBJECT,
      season_id: september.id,
      elo: 1800,
      matches_played: 20,
      wins: 15,
      losses: 5,
      draws: 0,
    });

    const october = await getOrCreateSeason(store, new Date("2026-10-02T10:00:00Z"));
    const carried = await getOrCreateRating(store, ALICE, SUBJECT, october);
    expect(carried.elo).toBe(1500);
    expect(carried.matches_played).toBe(0);
  });
});

describe("server-authoritative answering", () => {
  it("never sends the answer key with a served question", async () => {
    const { store, clock, match } = await startMatch();
    const state = await getMatchState(store, match.id, ALICE, clock.now());
    expect(state.currentQuestion).not.toBeNull();
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain("answer_key");
    expect(serialized).not.toContain("accept");
  });

  it("grades on the server and rejects out-of-order answers", async () => {
    const { store, clock, match } = await startMatch();
    await getMatchState(store, match.id, ALICE, clock.now());
    clock.advance(5000);

    const graded = await submitAnswer(
      store,
      { matchId: match.id, userId: ALICE, questionIndex: 0, answer: "A1" },
      clock.now(),
    );
    expect(graded.isCorrect).toBe(true);

    await expect(
      submitAnswer(
        store,
        { matchId: match.id, userId: ALICE, questionIndex: 3, answer: "x" },
        clock.now(),
      ),
    ).rejects.toThrow(/out of order/i);
  });

  it("marks answers past the per-question budget wrong even when correct", async () => {
    const { store, clock, match } = await startMatch();
    await getMatchState(store, match.id, ALICE, clock.now());
    clock.advance(91_000); // budget is 450s/5 = 90s
    const graded = await submitAnswer(
      store,
      { matchId: match.id, userId: ALICE, questionIndex: 0, answer: "a1" },
      clock.now(),
    );
    expect(graded.isCorrect).toBe(false);
  });
});

describe("finalization", () => {
  it("higher accuracy wins; Elo moves; diagnostics and mistakes are written", async () => {
    const { store, clock, match } = await startMatch();
    await playSide(store, clock, match.id, ALICE, 4);
    await playSide(store, clock, match.id, BOB, 2);

    const state = await getMatchState(store, match.id, ALICE, clock.now());
    expect(state.match.status).toBe("COMPLETE");
    expect(state.verdict?.result).toBe("won");

    const alice = store.ratings.find((r) => r.user_id === ALICE)!;
    const bob = store.ratings.find((r) => r.user_id === BOB)!;
    expect(alice.elo).toBeGreaterThan(ELO_INITIAL);
    expect(bob.elo).toBeLessThan(ELO_INITIAL);
    expect(alice.wins).toBe(1);
    expect(bob.losses).toBe(1);

    // Loss diagnostics: every wrong ranked answer lands in mistakes + ledger.
    expect(store.mistakes.filter((m) => m.userId === BOB)).toHaveLength(3);
    const bobAnswers = store.events.filter(
      (e) => e.userId === BOB && e.kind === "duel_answer",
    );
    expect(bobAnswers).toHaveLength(5);
    expect(
      bobAnswers.filter((e) => e.payload.errorPattern === "incorrect"),
    ).toHaveLength(3);
    const results = store.events.filter((e) => e.kind === "duel_result");
    expect(results).toHaveLength(2);
  });

  it("breaks accuracy ties on total answer time", async () => {
    const { store, clock, match } = await startMatch();
    await playSide(store, clock, match.id, ALICE, 3, 20_000);
    await playSide(store, clock, match.id, BOB, 3, 10_000);
    const state = await getMatchState(store, match.id, BOB, clock.now());
    expect(state.verdict?.result).toBe("won");
  });

  it("friendly matches never move ratings", async () => {
    const clock = makeClock();
    const store = createFakeDuelStore({ clock: clock.now });
    await queueForDuel(
      store,
      { userId: ALICE, subjectId: SUBJECT, mode: "friendly" },
      clock.now(),
    );
    const second = await queueForDuel(
      store,
      { userId: BOB, subjectId: SUBJECT, mode: "friendly" },
      clock.now(),
    );
    if (second.status !== "matched") throw new Error("expected a match");
    await playSide(store, clock, second.match.id, ALICE, 5);
    await playSide(store, clock, second.match.id, BOB, 1);

    for (const rating of store.ratings) {
      expect(rating.matches_played).toBe(0);
      expect(rating.elo).toBe(ELO_INITIAL);
    }
    // And friendly losses don't pollute the mistake notebook.
    expect(store.mistakes).toHaveLength(0);
  });

  it("withholds ratings and quarantines on impossible speed", async () => {
    const { store, clock, match } = await startMatch();
    await playSide(store, clock, match.id, ALICE, 5, 500); // superhuman
    await playSide(store, clock, match.id, BOB, 2);

    expect(store.reviews.some((r) => r.userId === ALICE)).toBe(true);
    const alice = store.ratings.find((r) => r.user_id === ALICE)!;
    const bob = store.ratings.find((r) => r.user_id === BOB)!;
    expect(alice.elo).toBe(ELO_INITIAL);
    expect(bob.elo).toBe(ELO_INITIAL);
    expect(alice.matches_played).toBe(0);
    // The flagged side's ledger events are quarantined.
    expect(
      store.events
        .filter((e) => e.userId === ALICE)
        .every((e) => e.quarantined === true),
    ).toBe(true);
  });

  it("forfeits an absent opponent after the time limit and grace", async () => {
    const { store, clock, match } = await startMatch();
    await playSide(store, clock, match.id, ALICE, 3);
    // Bob served his first question but never answers.
    await getMatchState(store, match.id, BOB, clock.now());
    clock.advance(600_000); // past 450s limit + grace

    const state = await getMatchState(store, match.id, ALICE, clock.now());
    expect(state.match.status).toBe("COMPLETE");
    expect(state.verdict?.result).toBe("won");
  });
});

describe("challenges", () => {
  it("direct challenge notifies the opponent and starts on accept", async () => {
    const clock = makeClock();
    const store = createFakeDuelStore({ clock: clock.now });
    const { token } = await createDuelChallenge(store, {
      creatorId: ALICE,
      subjectId: SUBJECT,
      mode: "friendly",
      opponentId: BOB,
      token: "tok-1",
    });
    expect(store.notifications.some((n) => n.userId === BOB)).toBe(true);

    const match = await acceptDuelChallenge(
      store,
      { token, userId: BOB },
      clock.now(),
    );
    expect(match.status).toBe("ACTIVE");
    expect(match.mode).toBe("friendly");
    expect(match.student_a_id).toBe(ALICE);
    expect(match.student_b_id).toBe(BOB);
  });

  it("open links reject the creator, double claims, and expiry", async () => {
    const clock = makeClock();
    const store = createFakeDuelStore({ clock: clock.now });
    const { token } = await createDuelChallenge(store, {
      creatorId: ALICE,
      subjectId: SUBJECT,
      mode: "friendly",
      token: "tok-2",
    });

    await expect(
      acceptDuelChallenge(store, { token, userId: ALICE }, clock.now()),
    ).rejects.toThrow(/own challenge/i);

    await acceptDuelChallenge(store, { token, userId: BOB }, clock.now());
    await expect(
      acceptDuelChallenge(store, { token, userId: "carol" }, clock.now()),
    ).rejects.toThrow(/already accepted/i);

    const { token: stale } = await createDuelChallenge(store, {
      creatorId: ALICE,
      subjectId: SUBJECT,
      mode: "friendly",
      token: "tok-3",
    });
    clock.advance(8 * 864e5);
    await expect(
      acceptDuelChallenge(store, { token: stale, userId: BOB }, clock.now()),
    ).rejects.toThrow(/expired/i);
  });

  it("ranked challenge matches settle ratings", async () => {
    const clock = makeClock();
    const store = createFakeDuelStore({ clock: clock.now });
    const { token } = await createDuelChallenge(store, {
      creatorId: ALICE,
      subjectId: SUBJECT,
      mode: "ranked",
      opponentId: BOB,
      token: "tok-4",
    });
    const match = await acceptDuelChallenge(
      store,
      { token, userId: BOB },
      clock.now(),
    );
    await playSide(store, clock, match.id, ALICE, 5);
    await playSide(store, clock, match.id, BOB, 1, 20_000);
    await getMatchState(store, match.id, ALICE, clock.now());

    const alice = store.ratings.find((r) => r.user_id === ALICE)!;
    expect(alice.elo).toBeGreaterThan(ELO_INITIAL);
    expect(alice.wins).toBe(1);
  });
});

describe("collusion defenses", () => {
  it("blocks ranked challenge acceptance from the creator's own network", async () => {
    const clock = makeClock();
    const store = createFakeDuelStore({ clock: clock.now });
    const { token } = await createDuelChallenge(store, {
      creatorId: ALICE,
      subjectId: SUBJECT,
      mode: "ranked",
      opponentId: BOB,
      token: "tok-net",
      ipHash: "net-1",
    });
    await expect(
      acceptDuelChallenge(
        store,
        { token, userId: BOB, ipHash: "net-1" },
        clock.now(),
      ),
    ).rejects.toThrow(/different networks/i);
    // A different network accepts fine.
    const match = await acceptDuelChallenge(
      store,
      { token, userId: BOB, ipHash: "net-2" },
      clock.now(),
    );
    expect(match.status).toBe("ACTIVE");
  });

  it("friendly challenges are fine on one network", async () => {
    const clock = makeClock();
    const store = createFakeDuelStore({ clock: clock.now });
    const { token } = await createDuelChallenge(store, {
      creatorId: ALICE,
      subjectId: SUBJECT,
      mode: "friendly",
      token: "tok-friendly",
      ipHash: "net-1",
    });
    const match = await acceptDuelChallenge(
      store,
      { token, userId: BOB, ipHash: "net-1" },
      clock.now(),
    );
    expect(match.mode).toBe("friendly");
  });

  it("flags the same pair trading many ranked matches in a day", async () => {
    const clock = makeClock();
    const store = createFakeDuelStore({ clock: clock.now });
    for (let i = 0; i < 5; i++) {
      const second = await (async () => {
        await queueForDuel(
          store,
          { userId: ALICE, subjectId: SUBJECT, mode: "ranked" },
          clock.now(),
        );
        return queueForDuel(
          store,
          { userId: BOB, subjectId: SUBJECT, mode: "ranked" },
          clock.now(),
        );
      })();
      if (second.status !== "matched") throw new Error("expected match");
      // Draws keep ratings level, so matchmaking keeps pairing them —
      // exactly how a cautious farmer would fly under the Elo radar.
      await playSide(store, clock, second.match.id, ALICE, 3);
      await playSide(store, clock, second.match.id, BOB, 3);
      await getMatchState(store, second.match.id, ALICE, clock.now());
    }
    const flags = store.reviews.filter((r) => r.reason === "excessive_rematch");
    expect(flags.length).toBeGreaterThan(0);
    // Review only — matches still count; farming is investigated, not assumed.
    const alice = store.ratings.find((r) => r.user_id === ALICE)!;
    expect(alice.matches_played).toBe(5);
  });
});

describe("post-match review", () => {
  it("reveals your answers and the model answer only after COMPLETE", async () => {
    const { store, clock, match } = await startMatch();
    // Mid-match: no review, no answers in the payload.
    let state = await getMatchState(store, match.id, ALICE, clock.now());
    expect(state.review).toBeNull();

    await playSide(store, clock, match.id, ALICE, 4);
    await playSide(store, clock, match.id, BOB, 2);

    state = await getMatchState(store, match.id, ALICE, clock.now());
    expect(state.review).toHaveLength(5);
    const wrong = state.review!.find((r) => !r.isCorrect)!;
    expect(wrong.yourAnswer).toBe("wrong");
    expect(wrong.modelAnswer).toBe("a5");
    // Only your own side — Bob's answers never appear in Alice's payload.
    expect(JSON.stringify(state.review)).not.toContain('"studentId"');
  });
});

describe("pairing race and mid-match guard", () => {
  it("a lost pair claim leaves the seeker queued instead of double-matching", async () => {
    const clock = makeClock();
    const store = createFakeDuelStore({ clock: clock.now });
    await queueForDuel(
      store,
      { userId: ALICE, subjectId: SUBJECT, mode: "ranked" },
      clock.now(),
    );
    // A concurrent pairing snatches Alice's queue row first.
    const stolen = await store.claimPair(ALICE, "someone-else", SUBJECT);
    expect(stolen).toBe(false); // partner row absent → claim refuses cleanly
    await store.dequeue(ALICE, SUBJECT);

    const second = await queueForDuel(
      store,
      { userId: BOB, subjectId: SUBJECT, mode: "ranked" },
      clock.now(),
    );
    expect(second.status).toBe("queued");
    expect(store.matches).toHaveLength(0);
  });

  it("blocks queueing mid-match, then frees the player after the window", async () => {
    const { store, clock, match } = await startMatch();
    expect(match.status).toBe("ACTIVE");

    await expect(
      queueForDuel(
        store,
        { userId: ALICE, subjectId: SUBJECT, mode: "ranked" },
        clock.now(),
      ),
    ).rejects.toThrow(/current duel first/i);

    // Past limit + grace the abandoned match no longer wedges the player.
    clock.advance(600_000);
    const outcome = await queueForDuel(
      store,
      { userId: ALICE, subjectId: SUBJECT, mode: "ranked" },
      clock.now(),
    );
    expect(outcome.status).toBe("queued");
  });

  it("blocks accepting a challenge while a live match is running", async () => {
    const { store, clock } = await startMatch();
    const { token } = await createDuelChallenge(store, {
      creatorId: "carol",
      subjectId: SUBJECT,
      mode: "friendly",
      token: "tok-mid",
    });
    await expect(
      acceptDuelChallenge(store, { token, userId: ALICE }, clock.now()),
    ).rejects.toThrow(/current duel first/i);
  });
});
