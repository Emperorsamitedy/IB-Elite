/**
 * Externalized UI strings for the competitive surfaces. New code must pull
 * copy from here (or a sibling locale module) rather than hardcoding it, so
 * translation later is a data change, not a refactor. Existing screens are
 * migrated as they're touched.
 */
export const messages = {
  duel: {
    title: "Ranked Duels",
    subtitle: "Same five questions, head to head, server-timed",
    findRanked: "Find ranked match",
    findFriendly: "Play a friendly",
    searching: "Searching for an opponent at your level…",
    searchingHint:
      "The rating window widens the longer you wait. Leave any time.",
    cancelSearch: "Cancel search",
    matchLive: "Match live",
    waitingOpponent: "Waiting for your opponent…",
    question: "Question",
    submit: "Submit answer",
    answerPlaceholder: "Your answer",
    correct: "Correct",
    incorrect: "Not quite",
    youWon: "You won!",
    youLost: "Your opponent took this one.",
    youDrew: "It's a draw.",
    ratingChange: "Rating",
    rematch: "Rematch",
    challengeFriend: "Challenge a friend",
    linkCopied: "Challenge link copied — send it to anyone.",
    playAgain: "Play again",
    friendlyNote: "Friendly match — no rating change.",
    timeLeft: "Time left",
    you: "You",
    opponent: "Opponent",
    finished: "Finished",
    league: "League",
    seasonEnds: "Season ends",
    leaderboardTitle: "Season standings",
    leaderboardEmpty: "No ranked matches this season yet — be the first.",
    yourRatings: "Your ratings",
    unranked: "Unranked",
    accept: "Accept challenge",
    acceptSignedOut: "Sign up to accept",
    challengeHeading: "challenges you to a duel",
    challengeBody:
      "Five questions, same paper, head to head. Sign in or create a free account to take it on.",
    challengeExpired: "This challenge has expired or was already taken.",
    wins: "Wins",
    losses: "Losses",
    draws: "Draws",
  },
  notifications: {
    title: "Notifications",
    empty: "Nothing yet — duels, seasons and results will land here.",
    markAllRead: "Mark all read",
  },
} as const;
