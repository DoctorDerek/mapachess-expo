"use client"

import { useSelector } from "@xstate/react"
import type { ActorRefFrom } from "xstate"
import matchMachine, {
  selectCanRedo,
  selectCanUndo,
  selectHintStage,
  selectIsOpponentThinking,
  selectIsPlayerTurn,
  selectMatchHints,
  selectMatchPosition,
  selectMatchTimeline,
  selectOpponentFailure,
  type MatchMachineSnapshot,
} from "@mapachess/match/match-machine"
import { listLegalMatchMoves } from "@mapachess/match/match-move"
import type { StandardChickenRuntime } from "../../lib/chicken/openStandardChickenRuntime"
import BetterHintsControl from "./BetterHintsControl"
import CanonicalChessboard from "./CanonicalChessboard"

export type StandardChickenMatchProps = Readonly<{
  actor: ActorRefFrom<typeof matchMachine>
  runtime: StandardChickenRuntime
}>

const controlClasses =
  "min-h-12 rounded-xl border border-white/15 bg-slate-800 px-4 py-3 font-bold text-slate-100 transition-colors hover:bg-slate-700 focus-visible:ring-4 focus-visible:ring-cyan-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-800"

const matchStatusText = (
  snapshot: MatchMachineSnapshot,
  playerColor: StandardChickenRuntime["playerColor"],
): string => {
  const position = selectMatchPosition(snapshot)
  const failure = selectOpponentFailure(snapshot)

  if (failure?.type === "MATCH.OPPONENT_MOVE_ILLEGAL") {
    return "Chicken Stockfish returned an invalid move. Retry or undo."
  }
  if (failure?.type === "MATCH.OPPONENT_REQUEST_FAILED") {
    return "Chicken Stockfish could not finish its turn. Retry or undo."
  }
  if (snapshot.matches("complete")) {
    if (position.status.type === "checkmate") {
      return position.status.winner === playerColor
        ? "Checkmate — you won."
        : "Checkmate — Chicken Stockfish won."
    }
    if (position.status.type === "stalemate") return "Draw by stalemate."
    return "Draw by insufficient material."
  }
  if (selectIsOpponentThinking(snapshot)) {
    return "Chicken Stockfish is choosing a move…"
  }
  return "Your move."
}

export default function StandardChickenMatch({
  actor,
  runtime,
}: StandardChickenMatchProps) {
  const snapshot = useSelector(actor, (current) => current)
  const position = selectMatchPosition(snapshot)
  const timeline = selectMatchTimeline(snapshot)
  const playerTurn = selectIsPlayerTurn(snapshot)
  const opponentFailure = selectOpponentFailure(snapshot)
  const hintStage = selectHintStage(snapshot)
  const hints = selectMatchHints(snapshot)
  const visibleHints =
    hintStage === "piece-hints" || hintStage === "move-hints" ? hints : null
  if (
    (hintStage === "piece-hints" || hintStage === "move-hints") &&
    visibleHints === null
  ) {
    throw new Error("Visible Better Hints have no canonical analysis result.")
  }
  const matchComplete = snapshot.matches("complete")
  const activeTransitions = timeline.transitions.slice(0, timeline.cursor)
  const lastMove = activeTransitions.at(-1)?.move ?? null
  const legalMoves = playerTurn ? listLegalMatchMoves(position) : []

  return (
    <section
      aria-label="Standard Story Chicken playtest"
      className="grid min-w-0 items-start gap-[clamp(1.25rem,3vw,2.5rem)] xl:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]"
    >
      <div className="grid min-w-0 place-items-center">
        <CanonicalChessboard
          disabled={!playerTurn}
          hints={visibleHints}
          lastMove={lastMove}
          legalMoves={legalMoves}
          onMove={(moveId) =>
            actor.send({ moveId, type: "MATCH.MOVE_REQUESTED" })
          }
          orientation={runtime.playerColor}
          position={position}
          showMoveHints={hintStage === "move-hints"}
        />
      </div>

      <aside className="min-w-0 rounded-3xl border border-white/12 bg-slate-950/72 p-[clamp(1.25rem,3vw,2rem)] shadow-[0_1.5rem_5rem_rgba(2,6,23,0.4)] backdrop-blur-xl xl:sticky xl:top-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 font-mono text-xs font-bold tracking-[0.14em] text-amber-200 uppercase">
            Provisional · unrated
          </span>
          <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 font-mono text-xs font-bold tracking-[0.14em] text-cyan-100 uppercase">
            Local playtest
          </span>
        </div>

        <h1 className="mt-5 text-[clamp(2rem,5vw,3.5rem)] leading-none font-black tracking-[-0.045em] text-white">
          Chicken Stockfish
        </h1>
        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="font-bold text-slate-400">Mode</dt>
          <dd className="text-right text-slate-100">Standard Story</dd>
          <dt className="font-bold text-slate-400">You play</dt>
          <dd className="text-right text-slate-100">
            {runtime.playerColor === "white" ? "White" : "Black"}
          </dd>
          <dt className="font-bold text-slate-400">Engine</dt>
          <dd className="truncate text-right text-slate-100">
            {runtime.engineIdentity.name}
          </dd>
        </dl>

        <p
          aria-live="polite"
          className="mt-6 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-4 font-semibold text-slate-100"
        >
          {matchStatusText(snapshot, runtime.playerColor)}
        </p>

        <BetterHintsControl
          hints={hints}
          matchComplete={matchComplete}
          onMoveHintsRequested={() =>
            actor.send({ type: "MATCH.MOVE_HINTS_REQUESTED" })
          }
          onPieceHintsRequested={() =>
            actor.send({ type: "MATCH.PIECE_HINTS_REQUESTED" })
          }
          stage={hintStage}
        />

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            className={controlClasses}
            disabled={!selectCanUndo(snapshot)}
            onClick={() => actor.send({ type: "MATCH.UNDO_REQUESTED" })}
            type="button"
          >
            Undo
          </button>
          <button
            className={controlClasses}
            disabled={!selectCanRedo(snapshot)}
            onClick={() => actor.send({ type: "MATCH.REDO_REQUESTED" })}
            type="button"
          >
            Redo
          </button>
        </div>

        {opponentFailure === null ? null : (
          <button
            className={`${controlClasses} mt-3 w-full border-amber-300/35 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20`}
            onClick={() =>
              actor.send({ type: "MATCH.OPPONENT_RETRY_REQUESTED" })
            }
            type="button"
          >
            Retry Chicken turn
          </button>
        )}

        <section aria-labelledby="move-history-title" className="mt-7">
          <div className="flex items-baseline justify-between gap-4">
            <h2
              className="text-lg font-black text-white"
              id="move-history-title"
            >
              Move History
            </h2>
            <span className="font-mono text-xs text-slate-400">
              {activeTransitions.length === 1
                ? "1 ply"
                : `${String(activeTransitions.length)} plies`}
            </span>
          </div>
          {activeTransitions.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No moves yet.</p>
          ) : (
            <ol className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-white/8 bg-slate-900/55 p-3 font-mono text-sm text-slate-200">
              {activeTransitions.map((transition, index) => (
                <li
                  className="grid grid-cols-[3rem_1fr] gap-3 rounded-lg px-2 py-1.5 odd:bg-white/[0.035]"
                  key={`${String(index)}-${transition.move.beforeFen}`}
                >
                  <span className="text-slate-500">{String(index + 1)}.</span>
                  <span>{transition.move.san}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </aside>
    </section>
  )
}
