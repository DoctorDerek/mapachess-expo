import { describe, expect, it } from "vitest"
import reconstructDurableMatch from "@mapachess/match/durable-match-reconstruction"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import type { MoveFeedbackRecord } from "@mapachess/match/move-feedback"
import {
  canonicalActiveMatch,
  decodeDurableMatch,
} from "../src/durableMatchCodec"
import completedStoryMatch from "./storyProgressTestSupport"

const complete = completedStoryMatch()
const restored = reconstructDurableMatch(complete)
if (!restored.ok)
  throw new Error("The retained fixture must reconstruct legally.")
const feedback: readonly MoveFeedbackRecord[] =
  restored.timeline.transitions.map((transition, index) => ({
    ply: index + 1,
    moveId: transition.move.id,
    mover: transition.before.turn,
    beforeFen: transition.before.fen,
    afterFen: transition.after.fen,
    before: { kind: "centipawns", whiteCentipawns: 0, bound: "exact" },
    after:
      index === 3
        ? { kind: "mate", moves: 0, winner: "black", bound: "exact" }
        : { kind: "draw" },
    grade: "best",
    reason: null,
    policyId: "owned-feedback-fixture",
  }))
const last = feedback[3]
if (last === undefined)
  throw new Error("The legal checkmate must have its fourth-ply record.")
const untimed = { ...complete, moveFeedback: feedback }
const clock = {
  activeColor: "white" as const,
  paused: true,
  remainingMs: { white: 58000, black: 58000 },
  history: [
    { white: 60000, black: 60000 },
    { white: 59000, black: 60000 },
    { white: 59000, black: 59000 },
    { white: 58000, black: 59000 },
    { white: 58000, black: 58000 },
  ],
}
const timed: DurableMatchRecord = {
  ...untimed,
  timeControl: { type: "fischer", baseSeconds: 60, incrementSeconds: 0 },
  clock,
}

type Damage = Readonly<{
  problem: string
  corrupt: (match: DurableMatchRecord) => unknown
}>
const clocks: readonly Damage[] = [
  {
    problem: "missing timed clocks",
    corrupt: (match) => ({ ...match, clock: null }),
  },
  {
    problem: "non-list history",
    corrupt: (match) => ({ ...match, clock: { ...clock, history: "missing" } }),
  },
  {
    problem: "wrong history length",
    corrupt: (match) => ({
      ...match,
      clock: { ...clock, history: clock.history.slice(1) },
    }),
  },
  {
    problem: "false opening white duration",
    corrupt: (match) => ({
      ...match,
      clock: {
        ...clock,
        history: [{ white: 59000, black: 60000 }, ...clock.history.slice(1)],
      },
    }),
  },
  {
    problem: "false opening black duration",
    corrupt: (match) => ({
      ...match,
      clock: {
        ...clock,
        history: [{ white: 60000, black: 59000 }, ...clock.history.slice(1)],
      },
    }),
  },
  {
    problem: "negative duration",
    corrupt: (match) => ({
      ...match,
      clock: { ...clock, remainingMs: { white: -1, black: 58000 } },
    }),
  },
  {
    problem: "nonfinite duration",
    corrupt: (match) => ({
      ...match,
      clock: { ...clock, remainingMs: { white: Infinity, black: 58000 } },
    }),
  },
  {
    problem: "unearned time during a completed move",
    corrupt: (match) => ({
      ...match,
      clock: {
        ...clock,
        history: [
          clock.history[0],
          { white: 61000, black: 60000 },
          ...clock.history.slice(2),
        ],
      },
    }),
  },
  {
    problem: "nonmover losing time",
    corrupt: (match) => ({
      ...match,
      clock: {
        ...clock,
        history: [
          clock.history[0],
          { white: 59000, black: 59000 },
          ...clock.history.slice(2),
        ],
      },
    }),
  },
  {
    problem: "wrong active color",
    corrupt: (match) => ({
      ...match,
      clock: { ...clock, activeColor: "black" },
    }),
  },
  {
    problem: "changed inactive clock",
    corrupt: (match) => ({
      ...match,
      clock: { ...clock, remainingMs: { white: 58000, black: 57000 } },
    }),
  },
  {
    problem: "remaining time above recorded decision",
    corrupt: (match) => ({
      ...match,
      clock: { ...clock, remainingMs: { white: 59000, black: 58000 } },
    }),
  },
  {
    problem: "zero clock without a timeout",
    corrupt: (match) => ({
      ...match,
      clock: { ...clock, remainingMs: { white: 0, black: 58000 } },
    }),
  },
  {
    problem: "nonboolean paused state",
    corrupt: (match) => ({ ...match, clock: { ...clock, paused: "yes" } }),
  },
  {
    problem: "unsupported time-control preset",
    corrupt: (match) => ({
      ...match,
      timeControl: { type: "fischer", baseSeconds: 61, incrementSeconds: 0 },
    }),
  },
  {
    problem: "clocks on an untimed match",
    corrupt: (match) => ({ ...match, timeControl: { type: "untimed" } }),
  },
]
const grades: readonly Readonly<{
  problem: string
  corrupt: (record: MoveFeedbackRecord) => unknown
}>[] = [
  { problem: "wrong ply", corrupt: (record) => ({ ...record, ply: 1 }) },
  { problem: "out-of-range ply", corrupt: (record) => ({ ...record, ply: 5 }) },
  {
    problem: "wrong move",
    corrupt: (record) => ({ ...record, moveId: "e2e4" }),
  },
  {
    problem: "wrong mover",
    corrupt: (record) => ({ ...record, mover: "white" }),
  },
  {
    problem: "false pre-move FEN",
    corrupt: (record) => ({ ...record, beforeFen: complete.currentFen }),
  },
  {
    problem: "false post-move FEN",
    corrupt: (record) => ({ ...record, afterFen: record.beforeFen }),
  },
  {
    problem: "unknown reason",
    corrupt: (record) => ({ ...record, reason: "Invented explanation" }),
  },
  {
    problem: "unknown score kind",
    corrupt: (record) => ({
      ...record,
      after: { kind: "unknown", bound: "exact" },
    }),
  },
  {
    problem: "invalid mate winner",
    corrupt: (record) => ({
      ...record,
      after: { kind: "mate", winner: "neither", moves: 0, bound: "exact" },
    }),
  },
  {
    problem: "negative mate distance",
    corrupt: (record) => ({
      ...record,
      after: { kind: "mate", winner: "black", moves: -1, bound: "exact" },
    }),
  },
  {
    problem: "extra draw fields",
    corrupt: (record) => ({
      ...record,
      after: { kind: "draw", winner: "black" },
    }),
  },
  {
    problem: "fractional centipawns",
    corrupt: (record) => ({
      ...record,
      before: { kind: "centipawns", whiteCentipawns: 0.5, bound: "exact" },
    }),
  },
  {
    problem: "unknown grade",
    corrupt: (record) => ({ ...record, grade: "amazing" }),
  },
  {
    problem: "blank policy identity",
    corrupt: (record) => ({ ...record, policyId: "" }),
  },
]

describe("retained timeline, clock, and grading corruption", () => {
  it.each(clocks)(
    "rejects $problem while retaining a reconstructable timed source",
    ({ corrupt }) => {
      const before = canonicalActiveMatch(timed)
      expect(decodeDurableMatch(timed, "match")).toEqual(timed)
      expect(() => decodeDurableMatch(corrupt(timed), "match")).toThrow()
      expect(canonicalActiveMatch(timed)).toEqual(before)
    },
  )
  it.each(grades)(
    "rejects grading with $problem without modifying the accepted timeline",
    ({ corrupt }) => {
      expect(decodeDurableMatch(untimed, "match")).toEqual(untimed)
      expect(() =>
        decodeDurableMatch(
          {
            ...untimed,
            moveFeedback: [...feedback.slice(0, 3), corrupt(last)],
          },
          "match",
        ),
      ).toThrow()
      expect(reconstructDurableMatch(untimed)).toEqual(restored)
    },
  )
})
