import type { LadderStore, LeaderboardFilter } from "./store";
import type {
  LadderLeaderboardRow,
  LadderMatch,
  LadderProgress,
  LevelCode,
} from "./types";

/** In-memory ladder store used by the unit tests. */
export function createFakeLadderStore(
  levels: Record<string, LevelCode> = {},
): LadderStore & {
  matches: LadderMatch[];
  progress: LadderProgress[];
  leaderboard_rows: LadderLeaderboardRow[];
} {
  const matches: LadderMatch[] = [];
  const progress: LadderProgress[] = [];
  const leaderboardRows: LadderLeaderboardRow[] = [];
  let counter = 0;
  const nextId = () => `id-${++counter}`;
  const now = () => new Date().toISOString();

  const store: LadderStore = {
    async getStudentLevel(studentId) {
      return levels[studentId] ?? "SL";
    },
    async findWaitingMatch(subjectId, level, studentId) {
      return (
        matches.find(
          (m) =>
            m.subject_id === subjectId &&
            m.level_code === level &&
            m.status === "WAITING" &&
            m.student_b_id === null &&
            m.student_a_id !== studentId,
        ) ?? null
      );
    },
    async createWaitingMatch(input) {
      const match: LadderMatch = {
        id: nextId(),
        subject_id: input.subjectId,
        paper_ref: input.paperRef,
        paper_year: input.paperYear,
        level_code: input.level,
        student_a_id: input.studentId,
        student_b_id: null,
        status: "WAITING",
        started_at: null,
        ended_at: null,
      };
      matches.push(match);
      progress.push(blankProgress(match.id, input.studentId));
      return match;
    },
    async joinMatch(matchId, studentId) {
      const match = matches.find((m) => m.id === matchId);
      if (!match) throw new Error("Match not found");
      match.student_b_id = studentId;
      match.status = "ACTIVE";
      match.started_at = now();
      progress.push(blankProgress(matchId, studentId));
      return match;
    },
    async getMatch(matchId) {
      return matches.find((m) => m.id === matchId) ?? null;
    },
    async upsertProgress(input) {
      const row = findProgress(input.matchId, input.studentId);
      row.current_question_index = input.questionIndex;
      row.correct_count = input.correctCount;
      row.last_updated_at = now();
      return row;
    },
    async completeSide(input) {
      const row = findProgress(input.matchId, input.studentId);
      row.final_score = input.finalScore;
      row.is_complete = true;
      row.last_updated_at = now();
      return row;
    },
    async listProgress(matchId) {
      return progress.filter((p) => p.match_id === matchId);
    },
    async finishMatch(matchId) {
      const match = matches.find((m) => m.id === matchId);
      if (!match) throw new Error("Match not found");
      match.status = "COMPLETE";
      match.ended_at = now();
      return match;
    },
    async saveIdentity(studentId, identity) {
      const row = findLeaderboardRow(studentId);
      if (identity.country) row.country = identity.country;
      if (identity.school) row.school = identity.school;
      row.updated_at = now();
      return row;
    },
    async recordResult({ studentId, won, drew }) {
      const row = findLeaderboardRow(studentId);
      if (won) row.wins += 1;
      else if (!drew) row.losses += 1;
      row.updated_at = now();
      return row;
    },
    async leaderboard(filter: LeaderboardFilter) {
      return leaderboardRows
        .filter((r) => !filter.country || r.country === filter.country)
        .filter((r) => !filter.school || r.school === filter.school)
        .slice()
        .sort((a, b) => b.wins - a.wins)
        .slice(0, filter.limit ?? 50);
    },
  };

  function blankProgress(matchId: string, studentId: string): LadderProgress {
    return {
      id: nextId(),
      match_id: matchId,
      student_id: studentId,
      current_question_index: 0,
      correct_count: 0,
      final_score: null,
      is_complete: false,
      last_updated_at: now(),
    };
  }

  function findLeaderboardRow(studentId: string): LadderLeaderboardRow {
    const existing = leaderboardRows.find((r) => r.student_id === studentId);
    if (existing) return existing;
    const row: LadderLeaderboardRow = {
      id: nextId(),
      student_id: studentId,
      country: null,
      school: null,
      wins: 0,
      losses: 0,
      updated_at: now(),
    };
    leaderboardRows.push(row);
    return row;
  }

  function findProgress(matchId: string, studentId: string): LadderProgress {
    const existing = progress.find(
      (p) => p.match_id === matchId && p.student_id === studentId,
    );
    if (existing) return existing;
    const row = blankProgress(matchId, studentId);
    progress.push(row);
    return row;
  }

  return Object.assign(store, {
    matches,
    progress,
    leaderboard_rows: leaderboardRows,
  });
}
