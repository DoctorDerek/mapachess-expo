import {
  formatInteger,
  formatStoryPercentage,
  formatUngroupedInteger,
} from "./enNumbers.js"

const gameplay = {
  clock: {
    timeControl: "Time control",
    change: "Change time control",
    category: {
      untimed: "Untimed",
      bullet: "Bullet",
      blitz: "Blitz",
      rapid: "Rapid",
    },
    preset: (category: string, notation: string): string =>
      `${category} · ${notation}`,
    explanation: (minutes: number, increment: number): string =>
      `${formatInteger(minutes)} min per side, plus ${formatInteger(increment)} sec after each move. Hints do not pause the clock.`,
    untimedExplanation: "No clock. Take your time and explore.",
    paused: "Clocks paused",
    resume: "Resume clocks",
    running: "Clock running",
    low: "Low time",
    label: (color: string): string => `${color} clock`,
    rating: (variant: string, category: string): string =>
      `${variant} · ${category}`,
    display: (minutes: number, seconds: number): string =>
      `${String(minutes)}:${String(seconds).padStart(2, "0")}`,
  },
  integer: formatInteger,
  elo: formatUngroupedInteger,
  storyCompletion: formatStoryPercentage,
  defeatedCount: (count: number, total: number): string =>
    `Opponents defeated: ${formatInteger(count)} / ${formatInteger(total)}`,
  nextUnlocked: (opponent: string): string =>
    `Next unlocked opponent: ${opponent}`,
  lockedOpponent: (position: number): string =>
    `Locked opponent ${formatInteger(position)}`,
  targetElo: (elo: number): string =>
    `Target Elo: ${formatUngroupedInteger(elo)}`,
  defeatedMedal: (medal: string): string => `Defeated · ${medal}`,
  challengeList: (opponents: readonly string[]): string =>
    `Unlocked for both Challenge modes: ${opponents.join(", ")}`,
  conclusion: {
    playerTimedOut: "Your time ran out — you lost.",
    opponentTimedOut: (opponent: string): string =>
      `${opponent} ran out of time — you won.`,
    "timeout-insufficient-material":
      "Time ran out. Draw: the other side has insufficient mating material.",
    playerWon: "You won!",
    opponentWon: (opponent: string): string => `${opponent} won.`,
    opponentResigned: (opponent: string): string =>
      `${opponent} resigned — you won.`,
    playerResigned: (opponent: string): string =>
      `You resigned — ${opponent} won.`,
    "draw-agreement": "Draw by agreement.",
    stalemate: "Draw by stalemate.",
    "insufficient-material": "Draw by insufficient material.",
  },
  defeatedOpponent: (opponent: string): string => `You defeated ${opponent}!`,
  resultActions: {
    replay: "Replay opponent",
    ladder: "Story ladder",
    next: "Next opponent",
  },
  opponentAndElo: (opponent: string, elo: number): string =>
    `${opponent} · ${formatUngroupedInteger(elo)} Elo`,
  awardedXp: (amount: number): string => `+${formatInteger(amount)} XP`,
  level: (level: number): string => `Level ${formatInteger(level)}`,
  xpProgress: (current: number, required: number): string =>
    `${formatInteger(current)} / ${formatInteger(required)} XP`,
  levelProgress: (level: number, current: number, required: number): string =>
    `Level ${formatInteger(level)}. ${formatInteger(current)} of ${formatInteger(required)} XP toward the next Level.`,
  levelAchievement: (level: number): string =>
    `Reach Level ${formatInteger(level)}`,
  achievementUnlocked: (title: string): string =>
    `Achievement unlocked · ${title}`,
  noNewMedal: "No new medal",
  bestMedal: (medal: string): string => `Your best: ${medal}.`,
  challengeUnlocked: (opponent: string): string =>
    `${opponent} is available in both Challenge modes.`,
  storyDefeated: (count: number): string =>
    `All ${formatInteger(count)} opponents in this Story defeated.`,
  opponentMoveInvalid: (opponent: string): string =>
    `${opponent} returned an invalid move. Retry or undo.`,
  opponentTurnFailed: (opponent: string): string =>
    `${opponent} could not finish its turn. Retry or undo.`,
  retryTurn: (opponent: string): string => `Retry ${opponent}’s turn`,
  drawDeclined: (opponent: string): string => `${opponent} declines the draw.`,
  hints: {
    controls: {
      failure: "Retry Piece Hints",
      hidden: "Hints available on your turn",
      loading: "Finding Piece Hints…",
      "move-hints": "Move Hints Shown",
      "piece-hints": "Show Move Hints",
      ready: "Show Piece Hints",
      unavailable: "Hints unavailable",
      complete: "Hints unavailable after the match",
    },
    guidance: {
      failure:
        "Piece Hints could not be calculated. Your position is unchanged.",
      hidden: "Piece Hints return when it is your turn.",
      loading: "Finding Piece Hints for both sides without changing the board.",
      "move-hints":
        "Solid green arrows show Player moves. Dashed red arrows show Opponent moves.",
      "piece-hints":
        "Solid green borders mark Player pieces. Dashed red borders mark Opponent pieces.",
      ready: "Start by finding the most important Player and Opponent pieces.",
      unavailable: "Better Hints are unavailable in this version of Mapachess.",
      complete:
        "Better Hints are available only while the match is in progress.",
    },
    loading: "Finding Piece Hints for Player and Opponent.",
    failed: "Piece Hints could not be calculated. The board is unchanged.",
    piecesShown: (
      player: readonly string[],
      opponent: readonly string[],
    ): string =>
      `Piece Hints shown. Player Piece Hints: ${player.length === 0 ? "none" : player.join(", ")}. Opponent Piece Hints: ${opponent.length === 0 ? "none" : opponent.join(", ")}.`,
    movesShown: (
      player: readonly string[],
      opponent: readonly string[],
    ): string =>
      `Move Hints shown. Player Move Hints: ${player.length === 0 ? "none" : player.join("; ")}. Opponent Move Hints: ${opponent.length === 0 ? "none" : opponent.join("; ")}.`,
    move: (from: string, to: string): string => `${from} to ${to}`,
    castle: (
      side: "king" | "queen",
      to: string,
      rookFrom: string,
      rookTo: string,
    ): string =>
      `castle ${side}side, king to ${to}, rook from ${rookFrom} to ${rookTo}`,
  },
} as const

export default gameplay
