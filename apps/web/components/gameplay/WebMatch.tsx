"use client"

import { useSelector } from "@xstate/react"
import { useMemo } from "react"
import type { ActorRefFrom } from "xstate"
import decideChickenDrawOffer from "@mapachess/evaluation/chicken-draw-decision"
import positionEvaluationMachine, {
  selectPositionEvaluationStage,
} from "@mapachess/evaluation/position-evaluation-machine"
import type { MatchMode } from "@mapachess/match/durable-match-record"
import matchMachine, {
  selectCanOfferDraw,
  selectCanRedo,
  selectCanResign,
  selectCanUndo,
  selectDrawOfferResponse,
  selectHasRedoHistory,
  selectHasUndoHistory,
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
import { MATCH_SETUP_COPY, matchModeLabel } from "@mapachess/match/match-setup"
import stockfishOpponent, {
  STOCKFISH_OPPONENTS,
  type StockfishOpponentDefinition,
} from "@mapachess/match/stockfish-opponent"
import type { WebMatchRuntime } from "../../lib/gameplay/webMatchRuntime"
import useAcceptedMatchPresentation from "../../lib/presentation/useAcceptedMatchPresentation"
import resolveWebOpponentPresentation from "../../lib/presentation/webOpponentPresentation"
import MapachessButton from "../presentation/MapachessButton"
import BetterHintsControl from "./BetterHintsControl"
import CanonicalChessboard from "./CanonicalChessboard"
import MapachitoCoachPortrait from "./MapachitoCoachPortrait"
import PositionEvaluationGutter from "./PositionEvaluationGutter"
import ReactiveBattleStage from "./ReactiveBattleStage"

export type WebMatchProps = Readonly<{
  actor: ActorRefFrom<typeof matchMachine>
  evaluationActor: ActorRefFrom<typeof positionEvaluationMachine>
  mode: MatchMode
  playerEloAtStart: number
  runtime: WebMatchRuntime
}>

const matchStatusText = (
  snapshot: MatchMachineSnapshot,
  playerColor: WebMatchRuntime["playerColor"],
  opponentName: StockfishOpponentDefinition["displayName"],
): string => {
  const conclusion = selectMatchConclusion(snapshot)
  const drawOfferResponse = selectDrawOfferResponse(snapshot)
  const failure = selectOpponentFailure(snapshot)
  const persistenceFailure = selectPersistenceFailure(snapshot)

  if (persistenceFailure !== null) {
    return "Your last action is paused because its local save was not verified."
  }

  if (failure?.type === "MATCH.OPPONENT_MOVE_ILLEGAL") {
    return `${opponentName} returned an invalid move. Retry or undo.`
  }
  if (failure?.type === "MATCH.OPPONENT_REQUEST_FAILED") {
    return `${opponentName} could not finish its turn. Retry or undo.`
  }
  if (conclusion !== null) {
    if (conclusion.type === "checkmate") {
      return conclusion.winner === playerColor
        ? "Checkmate — you won."
        : `Checkmate — ${opponentName} won.`
    }
    if (conclusion.type === "resignation") {
      return conclusion.winner === playerColor
        ? `${opponentName} resigned — you won.`
        : `You resigned — ${opponentName} won.`
    }
    if (conclusion.type === "draw-agreement") {
      return "Draw by agreement."
    }
    return conclusion.type === "stalemate"
      ? "Draw by stalemate."
      : "Draw by insufficient material."
  }
  if (
    selectIsOpponentThinking(snapshot) ||
    selectMatchPosition(snapshot).turn !== playerColor
  ) {
    return `${opponentName} is choosing a move…`
  }
  if (drawOfferResponse === "rejected") {
    return `${opponentName} declines the draw.`
  }
  return "Your move."
}

export default function WebMatch({
  actor,
  evaluationActor,
  mode,
  playerEloAtStart,
  runtime,
}: WebMatchProps) {
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
  const opponent = stockfishOpponent(runtime.opponentId)
  const opponentReaction = presentation.snapshot.context.currentPhase?.opponent
  const opponentPresentation = useMemo(
    () => resolveWebOpponentPresentation(runtime.opponentId, opponentReaction),
    [opponentReaction, runtime.opponentId],
  )
  const position = selectMatchPosition(snapshot)
  const modeLabel = matchModeLabel({ mode, variant: position.variant })
  const timeline = selectMatchTimeline(snapshot)
  const playerTurn = selectIsPlayerTurn(snapshot)
  const persisting = selectIsPersistingMutation(snapshot)
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
  const legalMoves =
    position.turn === runtime.playerColor && !matchComplete
      ? listLegalMatchMoves(position)
      : []
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
      aria-label={`${modeLabel} match against ${opponent.displayName}`}
      className="grid min-w-0 items-start gap-2 [--playing-width:min(100%,max(16rem,calc(100svh-30rem)))] [grid-template-areas:'opponent'_'board'_'player'_'command'] xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] xl:gap-x-6 xl:[--playing-width:min(100%,52rem,max(20rem,calc(100svh-18rem)))] xl:[grid-template-areas:'opponent_command'_'board_command'_'player_command']"
    >
      <section
        aria-labelledby="opponent-band-title"
        className="text-mapachito-white flex w-full max-w-(--playing-width) flex-wrap items-center justify-between gap-x-3 gap-y-1 justify-self-center [grid-area:opponent]"
      >
        <div>
          <p className="sr-only">
            {mode === "story"
              ? `Story opponent ${String(opponent.storyPosition).padStart(2, "0")} / ${String(STOCKFISH_OPPONENTS.length)}`
              : "Challenge opponent"}
          </p>
          <h1
            className="font-display text-lg leading-tight font-black"
            id="opponent-band-title"
          >
            {opponent.displayName}
          </h1>
        </div>
        <dl className="text-xs [&_dd]:font-bold [&_dt]:sr-only">
          <div>
            <dt>Elo target</dt>
            <dd>
              {runtime.opponentTargetElo} · {MATCH_SETUP_COPY.estimated}
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid w-full max-w-(--playing-width) min-w-0 justify-self-center [grid-area:board]">
        <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-stretch">
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
        <ReactiveBattleStage
          onParticipantAnimationCompleted={
            presentation.notifyParticipantAnimationCompleted
          }
          opponentName={opponent.displayName}
          opponentPresentation={opponentPresentation}
          presentationSnapshot={presentation.snapshot}
        />
      </div>

      <section
        aria-labelledby="player-band-title"
        className="text-mapachito-white flex w-full max-w-(--playing-width) flex-wrap items-center justify-between gap-x-3 gap-y-1 justify-self-center [grid-area:player]"
      >
        <div className="flex items-center gap-2">
          <MapachitoCoachPortrait
            presentationSnapshot={presentation.snapshot}
          />
          <h2
            className="font-display text-lg font-black"
            id="player-band-title"
          >
            Mapachito
          </h2>
        </div>
        <dl className="flex flex-wrap gap-3 text-xs [&_dd]:font-bold [&_dt]:sr-only">
          <div>
            <dt>{modeLabel} Elo</dt>
            <dd>{playerEloAtStart}</dd>
          </div>
          <div>
            <dt>Playing</dt>
            <dd>{runtime.playerColor === "white" ? "White" : "Black"}</dd>
          </div>
        </dl>
      </section>

      <aside className="text-mapachito-charcoal grid w-full max-w-(--playing-width) min-w-0 gap-4 justify-self-center [grid-area:command] [grid-template-areas:'actions'_'data'_'history'] xl:max-w-none">
        <section
          aria-label="Core match actions"
          className="grid min-w-0 gap-2 [grid-area:actions]"
        >
          <p
            aria-live="polite"
            className="text-mapachito-white text-sm font-bold"
          >
            {matchStatusText(
              snapshot,
              runtime.playerColor,
              opponent.displayName,
            )}
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
            busy={persisting}
            disabled={persistenceFailure !== null}
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

          <div className="grid grid-cols-4 gap-2">
            <MapachessButton
              className="px-1! text-sm"
              variant="secondary"
              aria-busy={
                persisting &&
                position.turn === runtime.playerColor &&
                !matchComplete &&
                drawOfferDecision !== null
              }
              disabled={
                !selectCanOfferDraw(snapshot) || drawOfferDecision === null
              }
              onClick={offerDraw}
              type="button"
            >
              Offer Draw
            </MapachessButton>
            <MapachessButton
              className="px-1! text-sm"
              variant="secondary"
              aria-busy={
                persisting &&
                !matchComplete &&
                position.status.type === "playing"
              }
              disabled={!selectCanResign(snapshot)}
              onClick={() => actor.send({ type: "MATCH.RESIGN_REQUESTED" })}
              type="button"
            >
              Resign
            </MapachessButton>
            <MapachessButton
              className="px-1! text-sm"
              variant="secondary"
              aria-busy={persisting && selectHasUndoHistory(snapshot)}
              disabled={!selectCanUndo(snapshot)}
              onClick={() => actor.send({ type: "MATCH.UNDO_REQUESTED" })}
              type="button"
            >
              Undo
            </MapachessButton>
            <MapachessButton
              className="px-1! text-sm"
              variant="secondary"
              aria-busy={persisting && selectHasRedoHistory(snapshot)}
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
              Retry {opponent.displayName} turn
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
        <dl
          aria-label="Current match data"
          className="bg-mapachito-white grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-lg p-3 text-sm [grid-area:data] [&_dd]:text-right [&_dd]:font-bold [&_dt]:font-bold"
        >
          <dt>Mode</dt>
          <dd>{modeLabel}</dd>
          <dt>Clock</dt>
          <dd>Untimed</dd>
          <dt>Privacy</dt>
          <dd>Local · Accountless</dd>
          <dt>Engine</dt>
          <dd className="truncate">{runtime.engineIdentity.name}</dd>
        </dl>

        <section
          aria-labelledby="move-history-title"
          className="bg-mapachito-white rounded-lg p-3 [grid-area:history]"
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
      </aside>
    </section>
  )
}
