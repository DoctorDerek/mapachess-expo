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

const controlClasses =
  "mapachess-button mapachess-button--secondary min-h-12 px-4 py-3"

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
      className="mapachess-active-match"
    >
      <section
        aria-labelledby="opponent-band-title"
        className="mapachess-participant-band mapachess-participant-band--opponent"
      >
        <div>
          <p className="mapachess-eyebrow">Story opponent 01 / 23</p>
          <h1
            className="mapachess-participant-band__name"
            id="opponent-band-title"
          >
            Chicken Stockfish
          </h1>
        </div>
        <dl className="mapachess-participant-band__facts">
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

      <div className="mapachess-active-match__board grid min-w-0 place-items-center">
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
        className="mapachess-participant-band mapachess-participant-band--player"
      >
        <div>
          <p className="mapachess-eyebrow">Player</p>
          <h2
            className="mapachess-participant-band__name"
            id="player-band-title"
          >
            Mapachito
          </h2>
        </div>
        <dl className="mapachess-participant-band__facts">
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

      <aside className="mapachess-command-deck">
        <div className="mapachess-command-deck__reactions mapachess-reaction-deck">
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
          className="mapachess-command-deck__data mapachess-data-grid grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-3 p-5 text-sm"
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
          className="mapachess-command-deck__history"
        >
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="mapachess-subheading" id="move-history-title">
              Move History
            </h2>
            <span className="mapachess-muted font-mono text-xs font-bold">
              {activeTransitions.length === 1
                ? "1 ply"
                : `${String(activeTransitions.length)} plies`}
            </span>
          </div>
          {activeTransitions.length === 0 ? (
            <p className="mapachess-muted mt-3 text-sm">No moves yet.</p>
          ) : (
            <ol className="mapachess-inset mt-3 max-h-64 space-y-1 overflow-y-auto p-3 font-mono text-sm">
              {activeTransitions.map((transition, index) => (
                <li
                  className="grid grid-cols-[3rem_1fr] gap-3 rounded-lg px-2 py-1.5 odd:bg-[rgb(30_30_30/0.06)]"
                  key={`${String(index)}-${transition.move.beforeFen}`}
                >
                  <span className="mapachess-muted">{String(index + 1)}.</span>
                  <span>{transition.move.san}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section
          aria-label="Core match actions"
          className="mapachess-command-deck__actions"
        >
          <p aria-live="polite" className="mapachess-turn-banner px-4 py-4">
            {matchStatusText(snapshot, runtime.playerColor)}
          </p>

          {evaluationStage === "failure" ? (
            <button
              className="mapachess-button mapachess-button--primary mt-3 w-full"
              onClick={() =>
                evaluationActor.send({ type: "EVALUATION.RETRY_REQUESTED" })
              }
              type="button"
            >
              Retry Evaluation
            </button>
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
            <button
              className={controlClasses}
              disabled={
                !selectCanOfferDraw(snapshot) || drawOfferDecision === null
              }
              onClick={offerDraw}
              type="button"
            >
              Offer Draw
            </button>
            <button
              className={controlClasses}
              disabled={!selectCanResign(snapshot)}
              onClick={() => actor.send({ type: "MATCH.RESIGN_REQUESTED" })}
              type="button"
            >
              Resign
            </button>
          </div>

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
              className="mapachess-button mapachess-button--primary mt-3 w-full"
              onClick={() =>
                actor.send({ type: "MATCH.OPPONENT_RETRY_REQUESTED" })
              }
              type="button"
            >
              Retry Chicken turn
            </button>
          )}

          {persistenceFailure === null ? null : (
            <button
              className="mapachess-button mapachess-button--primary mt-3 w-full"
              onClick={() =>
                actor.send({ type: "MATCH.PERSISTENCE_RETRY_REQUESTED" })
              }
              type="button"
            >
              Retry local save
            </button>
          )}
        </section>
      </aside>
    </section>
  )
}
