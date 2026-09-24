"use client"

import { useSelector } from "@xstate/react"
import { useEffect, useMemo, useRef, type ReactNode } from "react"
import type { ActorRefFrom } from "xstate"
import decideChickenDrawOffer from "@mapachess/evaluation/chicken-draw-decision"
import positionEvaluationMachine, {
  selectPositionEvaluationStage,
} from "@mapachess/evaluation/position-evaluation-machine"
import { selectMatchPresentationVariationOrdinal } from "@mapachess/match-presentation/match-presentation-machine"
import type { MatchMode } from "@mapachess/match/durable-match-record"
import matchMachine, {
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
import { matchModeLabel } from "@mapachess/match/match-setup"
import {
  MOVE_GRADE_LABELS,
  type MoveFeedbackRecord,
} from "@mapachess/match/move-feedback"
import stockfishOpponent, {
  type StockfishOpponentDefinition,
} from "@mapachess/match/stockfish-opponent"
import useMoveReactions from "../../lib/gameplay/useMoveReactions"
import type { WebMatchRuntime } from "../../lib/gameplay/webMatchRuntime"
import useAcceptedMatchPresentation from "../../lib/presentation/useAcceptedMatchPresentation"
import resolveWebOpponentPresentation from "../../lib/presentation/webOpponentPresentation"
import MapachessButton from "../presentation/MapachessButton"
import BetterHintsControl from "./BetterHintsControl"
import CanonicalChessboard from "./CanonicalChessboard"
import MapachitoCoachPortrait from "./MapachitoCoachPortrait"
import MatchCommands from "./MatchCommands"
import PositionEvaluationGutter from "./PositionEvaluationGutter"
import ReactiveBattleStage from "./ReactiveBattleStage"

export type WebMatchProps = Readonly<{
  actor: ActorRefFrom<typeof matchMachine>
  evaluationActor: ActorRefFrom<typeof positionEvaluationMachine>
  moveFeedback?: readonly MoveFeedbackRecord[]
  reactionsPaused?: boolean
  mode: MatchMode
  playerEloAtStart: number
  runtime: WebMatchRuntime
  menuActions?: ReactNode
  result?: (disabled: boolean) => ReactNode
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
  moveFeedback = [],
  reactionsPaused = false,
  mode,
  playerEloAtStart,
  runtime,
  result,
  menuActions,
}: WebMatchProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: "instant" })
  }, [actor])
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
  const opponentVariationOrdinal = selectMatchPresentationVariationOrdinal(
    presentation.snapshot,
    "opponent",
  )
  const opponentPresentation = useMemo(
    () =>
      resolveWebOpponentPresentation(
        runtime.opponentId,
        opponentReaction,
        opponentVariationOrdinal,
      ),
    [opponentReaction, runtime.opponentId, opponentVariationOrdinal],
  )
  const position = selectMatchPosition(snapshot)
  const modeLabel = matchModeLabel({ mode, variant: position.variant })
  const timeline = selectMatchTimeline(snapshot)
  const reactionActor = useMoveReactions(
    timeline,
    moveFeedback,
    reactionsPaused,
  )
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
      className="grid min-w-0 items-start gap-2 [--playing-width:100%] [grid-template-areas:'opponent'_'board'_'command'_'battle'] xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] xl:gap-x-6 xl:[--playing-width:min(100%,52rem,max(20rem,calc(100svh-18rem)))] xl:[grid-template-areas:'opponent_command'_'board_command'_'battle_command']"
    >
      <section
        aria-labelledby="opponent-band-title"
        className="text-mapachito-white flex w-full max-w-(--playing-width) flex-wrap items-center justify-between gap-x-3 gap-y-1 justify-self-center px-3 [grid-area:opponent] xl:px-0"
      >
        <h1
          id="opponent-band-title"
          ref={heading}
          tabIndex={-1}
          className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 text-base leading-tight"
        >
          <span>
            <strong className="block">Mapachito</strong> {playerEloAtStart} ·{" "}
            {runtime.playerColor === "white" ? "White" : "Black"}
          </span>
          <span>vs.</span>
          <span>
            <strong className="block">{opponent.displayName}</strong>{" "}
            {runtime.opponentTargetElo} ·{" "}
            {runtime.playerColor === "white" ? "Black" : "White"}
          </span>
        </h1>
      </section>

      <div className="grid w-full max-w-(--playing-width) min-w-0 justify-self-center [grid-area:board]">
        <div className="grid min-w-0 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-stretch">
          <PositionEvaluationGutter
            reactionActor={reactionActor}
            actor={evaluationActor}
            orientation={runtime.playerColor}
          />
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
      </div>

      <aside className="text-mapachito-charcoal w-full max-w-(--playing-width) min-w-0 justify-self-center px-3 [grid-area:command] xl:max-w-none xl:px-0">
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

          {matchComplete
            ? result?.(persisting || persistenceFailure !== null)
            : null}

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

          <MatchCommands
            coach={
              <MapachitoCoachPortrait
                presentationSnapshot={presentation.snapshot}
              />
            }
            hints={
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
            }
            menuActions={
              <>
                {menuActions}{" "}
                <details className="text-mapachito-white [grid-area:data]">
                  <summary className="min-h-12 cursor-pointer content-center rounded-lg font-bold focus-visible:outline-2">
                    Match details &amp; Move History
                  </summary>
                  <div className="text-mapachito-charcoal grid gap-3">
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
                      <dd className="truncate">
                        {runtime.engineIdentity.name}
                      </dd>
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
                              <span>
                                {transition.move.san}
                                {moveFeedback
                                  .filter(
                                    (entry) =>
                                      entry.ply === index + 1 &&
                                      entry.beforeFen ===
                                        transition.before.fen &&
                                      entry.afterFen === transition.after.fen,
                                  )
                                  .map((entry) => (
                                    <span className="ml-2" key={entry.ply}>
                                      {MOVE_GRADE_LABELS[entry.grade]}
                                      {entry.reason === null
                                        ? ""
                                        : ` · ${entry.reason}`}
                                    </span>
                                  ))}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </section>
                  </div>
                </details>
              </>
            }
            actor={actor}
            drawAvailable={
              drawOfferDecision !== null &&
              !matchComplete &&
              position.turn === runtime.playerColor
            }
            onOfferDraw={offerDraw}
            snapshot={snapshot}
          />

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
      </aside>
      <div className="w-full max-w-(--playing-width) justify-self-center [grid-area:battle]">
        <ReactiveBattleStage
          onParticipantAnimationCompleted={
            presentation.notifyParticipantAnimationCompleted
          }
          opponentName={opponent.displayName}
          opponentPresentation={opponentPresentation}
          presentationSnapshot={presentation.snapshot}
        />
      </div>
    </section>
  )
}
