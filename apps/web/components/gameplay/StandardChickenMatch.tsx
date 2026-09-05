"use client"

import { useSelector } from "@xstate/react"
import type { ActorRefFrom } from "xstate"
import decideChickenDrawOffer from "@mapachess/evaluation/chicken-draw-decision"
import positionEvaluationMachine, {
  selectPositionEvaluationStage,
} from "@mapachess/evaluation/position-evaluation-machine"
import matchMachine, {
  selectCanOfferDraw,
  selectCanRedo,
  selectCanResign,
  selectCanUndo,
  selectDrawOfferResponse,
  selectHintStage,
  selectIsOpponentThinking,
  selectIsPersistingMutation,
  selectIsPlayerTurn,
  selectMatchConclusion,
  selectMatchHints,
  selectMatchPosition,
  selectMatchTimeline,
  selectOpponentFailure,
  selectPersistenceFailure,
  type MatchMachineSnapshot,
} from "@mapachess/match/match-machine"
import { listLegalMatchMoves } from "@mapachess/match/match-move"
import { STANDARD_CHICKEN_PROVISIONAL_TARGET_ELO } from "../../lib/chicken/standardChickenOpponent"
import type { WebMatchRuntime } from "../../lib/gameplay/webMatchRuntime"
import useAcceptedMatchPresentation from "../../lib/presentation/useAcceptedMatchPresentation"
import MapachessButton from "../presentation/MapachessButton"
import BetterHintsControl from "./BetterHintsControl"
import CanonicalChessboard from "./CanonicalChessboard"
import MapachitoCoachPortrait from "./MapachitoCoachPortrait"
import PositionEvaluationGutter from "./PositionEvaluationGutter"
import ReactiveBattleStage from "./ReactiveBattleStage"

export type StandardChickenMatchProps = Readonly<{
  actor: ActorRefFrom<typeof matchMachine>
  evaluationActor: ActorRefFrom<typeof positionEvaluationMachine>
  playerEloAtStart: number
  runtime: WebMatchRuntime
}>

const matchStatusText = (
  snapshot: MatchMachineSnapshot,
  playerColor: WebMatchRuntime["playerColor"],
): string => {
  const conclusion = selectMatchConclusion(snapshot)
  const drawOfferResponse = selectDrawOfferResponse(snapshot)
  const failure = selectOpponentFailure(snapshot)
  const persistenceFailure = selectPersistenceFailure(snapshot)

  if (persistenceFailure !== null) {
    return "Your last action is paused because its local save was not verified."
  }
  if (selectIsPersistingMutation(snapshot)) {
    return "Saving and verifying your last action…"
  }

  if (failure?.type === "MATCH.OPPONENT_MOVE_ILLEGAL") {
    return "Chicken Stockfish returned an invalid move. Retry or undo."
  }
  if (failure?.type === "MATCH.OPPONENT_REQUEST_FAILED") {
    return "Chicken Stockfish could not finish its turn. Retry or undo."
  }
  if (conclusion !== null) {
    if (conclusion.type === "checkmate") {
      return conclusion.winner === playerColor
        ? "Checkmate — you won."
        : "Checkmate — Chicken Stockfish won."
    }
    if (conclusion.type === "resignation") {
      return conclusion.winner === playerColor
        ? "Chicken Stockfish resigned — you won."
        : "You resigned — Chicken Stockfish won."
    }
    if (conclusion.type === "draw-agreement") {
      return "Draw by agreement."
    }
    return conclusion.type === "stalemate"
      ? "Draw by stalemate."
      : "Draw by insufficient material."
  }
  if (selectIsOpponentThinking(snapshot)) {
    return "Chicken Stockfish is choosing a move…"
  }
  if (drawOfferResponse === "rejected") {
    return "Chicken Stockfish declines the draw."
  }
  return "Your move."
}

export default function StandardChickenMatch({
  actor,
  evaluationActor,
  playerEloAtStart,
  runtime,
}: StandardChickenMatchProps) {
  const snapshot = useSelector(actor, (current) => current)
  const evaluationResult = useSelector(
    evaluationActor,
    (current) => current.context.result,
  )
  const evaluationStage = useSelector(
    evaluationActor,
    selectPositionEvaluationStage,
  )
  const presentation = useAcceptedMatchPresentation(
    snapshot,
    runtime.playerColor,
  )
  const position = selectMatchPosition(snapshot)
  const timeline = selectMatchTimeline(snapshot)
  const playerTurn = selectIsPlayerTurn(snapshot)
  const opponentFailure = selectOpponentFailure(snapshot)
  const persistenceFailure = selectPersistenceFailure(snapshot)
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
  const matchComplete = selectMatchConclusion(snapshot) !== null
  const drawOfferDecision = decideChickenDrawOffer({
    evaluationResult,
    playerColor: runtime.playerColor,
    positionFen: position.fen,
  })
  const activeTransitions = timeline.transitions.slice(0, timeline.cursor)
  const lastMove = activeTransitions.at(-1)?.move ?? null
  const legalMoves = playerTurn ? listLegalMatchMoves(position) : []
  const offerDraw = (): void => {
    if (drawOfferDecision === null) {
      throw new Error("Offer Draw requires the accepted current evaluation.")
    }
    actor.send({
      decision: drawOfferDecision,
      type: "MATCH.DRAW_OFFER_REQUESTED",
    })
  }

  return (
    <section
      aria-label="Standard Story match against Chicken Stockfish"
      className="grid min-w-0 items-start gap-[clamp(1rem,3vw,2rem)] [grid-template-areas:'opponent'_'board'_'player'_'command'] xl:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)] xl:grid-rows-[auto_auto_auto] xl:gap-[clamp(1rem,2vw,2rem)] xl:[grid-template-areas:'opponent_command'_'board_command'_'player_command']"
    >
      <section
        aria-labelledby="opponent-band-title"
        className="border-mapachito-charcoal text-mapachito-charcoal bg-mapachito-white shadow-mapachito-red flex w-full max-w-208 flex-wrap items-center justify-between gap-x-6 gap-y-[0.8rem] justify-self-center rounded-[0.75rem_0.2rem_0.75rem_0.2rem] border-3 px-4 py-[0.85rem] shadow-[0.3rem_0.3rem_0] [grid-area:opponent]"
      >
        <div>
          <p className="text-mapachito-violet font-mono text-xs leading-[1.3] font-black tracking-[0.18em] uppercase">
            Story opponent 01 / 23
          </p>
          <h1
            className="font-display mt-[0.2rem] text-[clamp(1.5rem,5vw,2.25rem)] leading-[0.95] font-black tracking-[-0.02em] uppercase"
            id="opponent-band-title"
          >
            Chicken Stockfish
          </h1>
        </div>
        <dl className="flex flex-wrap gap-x-5 gap-y-[0.65rem] [&_dd]:font-black [&_div]:grid [&_div]:gap-[0.1rem] [&_dt]:font-mono [&_dt]:text-[0.65rem] [&_dt]:font-black [&_dt]:tracking-[0.1em] [&_dt]:uppercase [&_dt]:opacity-72">
          <div>
            <dt>Elo target</dt>
            <dd>{STANDARD_CHICKEN_PROVISIONAL_TARGET_ELO} · Provisional</dd>
          </div>
          <div>
            <dt>Clock</dt>
            <dd>Untimed</dd>
          </div>
        </dl>
      </section>

      <div className="grid min-w-0 place-items-center [grid-area:board]">
        <div className="grid w-full max-w-[min(100%,52rem)] min-w-0 gap-3 xl:max-w-[min(100%,calc(100dvh-2rem))] xl:grid-cols-[minmax(0,1fr)_auto] xl:items-stretch">
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
          <PositionEvaluationGutter
            actor={evaluationActor}
            orientation={runtime.playerColor}
          />
        </div>
      </div>

      <section
        aria-labelledby="player-band-title"
        className="border-mapachito-charcoal text-mapachito-charcoal bg-mapachito-orange shadow-mapachito-charcoal flex w-full max-w-208 flex-wrap items-center justify-between gap-x-6 gap-y-[0.8rem] justify-self-center rounded-[0.75rem_0.2rem_0.75rem_0.2rem] border-3 px-4 py-[0.85rem] shadow-[0.3rem_0.3rem_0] [grid-area:player]"
      >
        <div>
          <p className="text-mapachito-violet font-mono text-xs leading-[1.3] font-black tracking-[0.18em] uppercase">
            Player
          </p>
          <h2
            className="font-display mt-[0.2rem] text-[clamp(1.5rem,5vw,2.25rem)] leading-[0.95] font-black tracking-[-0.02em] uppercase"
            id="player-band-title"
          >
            Mapachito
          </h2>
        </div>
        <dl className="flex flex-wrap gap-x-5 gap-y-[0.65rem] [&_dd]:font-black [&_div]:grid [&_div]:gap-[0.1rem] [&_dt]:font-mono [&_dt]:text-[0.65rem] [&_dt]:font-black [&_dt]:tracking-[0.1em] [&_dt]:uppercase [&_dt]:opacity-72">
          <div>
            <dt>Standard Story Elo</dt>
            <dd>{playerEloAtStart}</dd>
          </div>
          <div>
            <dt>Playing</dt>
            <dd>{runtime.playerColor === "white" ? "White" : "Black"}</dd>
          </div>
        </dl>
      </section>

      <aside className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal shadow-mapachito-charcoal grid min-w-0 gap-6 rounded-[1.5rem_0.5rem_1.5rem_0.5rem] border-3 p-[clamp(1rem,3vw,2rem)] shadow-[0.625rem_0.625rem_0] [grid-area:command] [grid-template-areas:'actions'_'reactions'_'data'_'history'] xl:sticky xl:top-6 xl:[grid-template-areas:'reactions'_'data'_'history'_'actions']">
        <div className="grid gap-4 [grid-area:reactions]">
          <ReactiveBattleStage
            onParticipantAnimationCompleted={
              presentation.notifyParticipantAnimationCompleted
            }
            presentationSnapshot={presentation.snapshot}
          />
          <MapachitoCoachPortrait
            presentationSnapshot={presentation.snapshot}
          />
        </div>

        <dl
          aria-label="Current match data"
          className="border-mapachito-charcoal bg-mapachito-white shadow-mapachito-blue [&_dt]:text-mapachito-charcoal [&_dd]:text-mapachito-charcoal grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-3 rounded-[1rem_0.25rem_1rem_0.25rem] border-3 p-5 text-sm shadow-[0.25rem_0.25rem_0] [grid-area:data] [&_dd]:font-extrabold [&_dt]:font-black [&_dt]:opacity-72"
        >
          <dt>Mode</dt>
          <dd>Standard Story</dd>
          <dt>Privacy</dt>
          <dd>Local · Accountless</dd>
          <dt>Engine</dt>
          <dd className="truncate">{runtime.engineIdentity.name}</dd>
        </dl>

        <section
          aria-labelledby="move-history-title"
          className="[grid-area:history]"
        >
          <div className="flex items-baseline justify-between gap-4">
            <h2
              className="font-display text-mapachito-charcoal text-[1.35rem] leading-none font-black tracking-[0.015em] uppercase"
              id="move-history-title"
            >
              Move History
            </h2>
            <span className="text-mapachito-charcoal font-mono text-xs leading-[1.55] font-semibold opacity-76">
              {activeTransitions.length === 1
                ? "1 ply"
                : `${String(activeTransitions.length)} plies`}
            </span>
          </div>
          {activeTransitions.length === 0 ? (
            <p className="text-mapachito-charcoal mt-3 text-sm leading-[1.55] font-semibold opacity-76">
              No moves yet.
            </p>
          ) : (
            <ol className="border-mapachito-charcoal bg-mapachito-white inset-shadow-mapachito-deep-cyan mt-3 max-h-64 space-y-1 overflow-y-auto rounded-[1rem_0.25rem_1rem_0.25rem] border-3 p-3 font-mono text-sm inset-shadow-[0.5rem_0_0]">
              {activeTransitions.map((transition, index) => (
                <li
                  className="odd:bg-mapachito-charcoal/6 grid grid-cols-[3rem_1fr] gap-3 rounded-lg px-2 py-1.5"
                  key={`${String(index)}-${transition.move.beforeFen}`}
                >
                  <span className="text-mapachito-charcoal leading-[1.55] font-semibold opacity-76">
                    {String(index + 1)}.
                  </span>
                  <span>{transition.move.san}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section
          aria-label="Core match actions"
          className="border-mapachito-charcoal bg-mapachito-white shadow-mapachito-violet sticky bottom-3 z-5 rounded-[0.75rem_0.2rem_0.75rem_0.2rem] border-3 p-[0.8rem] shadow-[0.35rem_0.35rem_0] [grid-area:actions] xl:static"
        >
          <p
            aria-live="polite"
            className="border-mapachito-charcoal bg-mapachito-orange text-mapachito-charcoal shadow-mapachito-charcoal/20 rounded-[0.75rem_0.2rem_0.75rem_0.2rem] border-3 px-4 py-4 font-black shadow-[0.25rem_0.25rem_0]"
          >
            {matchStatusText(snapshot, runtime.playerColor)}
          </p>

          {evaluationStage === "failure" ? (
            <MapachessButton
              className="mt-3 w-full"
              onClick={() =>
                evaluationActor.send({ type: "EVALUATION.RETRY_REQUESTED" })
              }
              type="button"
            >
              Retry Evaluation
            </MapachessButton>
          ) : null}

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
            <MapachessButton
              variant="secondary"
              disabled={
                !selectCanOfferDraw(snapshot) || drawOfferDecision === null
              }
              onClick={offerDraw}
              type="button"
            >
              Offer Draw
            </MapachessButton>
            <MapachessButton
              variant="secondary"
              disabled={!selectCanResign(snapshot)}
              onClick={() => actor.send({ type: "MATCH.RESIGN_REQUESTED" })}
              type="button"
            >
              Resign
            </MapachessButton>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <MapachessButton
              variant="secondary"
              disabled={!selectCanUndo(snapshot)}
              onClick={() => actor.send({ type: "MATCH.UNDO_REQUESTED" })}
              type="button"
            >
              Undo
            </MapachessButton>
            <MapachessButton
              variant="secondary"
              disabled={!selectCanRedo(snapshot)}
              onClick={() => actor.send({ type: "MATCH.REDO_REQUESTED" })}
              type="button"
            >
              Redo
            </MapachessButton>
          </div>

          {opponentFailure === null ? null : (
            <MapachessButton
              className="mt-3 w-full"
              onClick={() =>
                actor.send({ type: "MATCH.OPPONENT_RETRY_REQUESTED" })
              }
              type="button"
            >
              Retry Chicken turn
            </MapachessButton>
          )}

          {persistenceFailure === null ? null : (
            <MapachessButton
              className="mt-3 w-full"
              onClick={() =>
                actor.send({ type: "MATCH.PERSISTENCE_RETRY_REQUESTED" })
              }
              type="button"
            >
              Retry local save
            </MapachessButton>
          )}
        </section>
      </aside>
    </section>
  )
}
