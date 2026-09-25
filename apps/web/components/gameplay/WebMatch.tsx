"use client"

import { useSelector } from "@xstate/react"
import { useEffect, useMemo, useRef, type ReactNode } from "react"
import type { ActorRefFrom } from "xstate"
import decideChickenDrawOffer from "@mapachess/evaluation/chicken-draw-decision"
import positionEvaluationMachine from "@mapachess/evaluation/position-evaluation-machine"
import { selectMatchPresentationVariationOrdinal } from "@mapachess/match-presentation/match-presentation-machine"
import type { MatchMode } from "@mapachess/match/durable-match-record"
import matchMachine, {
  selectHintStage,
  selectIsPersistingMutation,
  selectIsPlayerTurn,
  selectMatchConclusion,
  selectMatchHints,
  selectMatchPosition,
  selectMatchTimeline,
  selectPersistenceFailure,
} from "@mapachess/match/match-machine"
import { listLegalMatchMoves } from "@mapachess/match/match-move"
import { matchModeLabel } from "@mapachess/match/match-setup"
import type { MoveFeedbackRecord } from "@mapachess/match/move-feedback"
import stockfishOpponent from "@mapachess/match/stockfish-opponent"
import useMoveReactions from "../../lib/gameplay/useMoveReactions"
import type { WebMatchRuntime } from "../../lib/gameplay/webMatchRuntime"
import useAcceptedMatchPresentation from "../../lib/presentation/useAcceptedMatchPresentation"
import resolveWebOpponentPresentation from "../../lib/presentation/webOpponentPresentation"
import BetterHintsControl from "./BetterHintsControl"
import CanonicalChessboard from "./CanonicalChessboard"
import ClassifiedMoveHistory from "./ClassifiedMoveHistory"
import MapachitoCoachPortrait from "./MapachitoCoachPortrait"
import MatchCommands from "./MatchCommands"
import MatchIdentity from "./MatchIdentity"
import MatchOutcome from "./MatchOutcome"
import MatchRecovery from "./MatchRecovery"
import MoveReactionFeedback from "./MoveReactionFeedback"
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
  const evaluationSnapshot = useSelector(evaluationActor, (current) => current)
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
  const reactions = useMoveReactions(timeline, moveFeedback, reactionsPaused)
  const playerTurn = selectIsPlayerTurn(snapshot)
  const persisting = selectIsPersistingMutation(snapshot)
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
  const conclusion = selectMatchConclusion(snapshot)
  const matchComplete = conclusion !== null
  const drawOfferDecision = decideChickenDrawOffer({
    evaluationResult: evaluationSnapshot.context.result,
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
      className="grid min-w-0 items-start gap-2 [--playing-width:100%] [grid-template-areas:'playing'_'command'_'battle'_'result'] xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] xl:gap-x-6 xl:[--playing-width:min(100%,52rem,max(20rem,calc(100svh-13rem)))] xl:[grid-template-areas:none]"
    >
      <div className="contents xl:grid xl:w-full xl:max-w-(--playing-width) xl:min-w-0 xl:gap-2 xl:justify-self-center">
        <div className="grid min-w-0 gap-2 [grid-area:playing] xl:[grid-area:auto]">
          <MatchIdentity
            headingRef={heading}
            playerColor={runtime.playerColor}
            playerElo={playerEloAtStart}
            opponentName={opponent.displayName}
            opponentElo={runtime.opponentTargetElo}
            reactions={
              <MoveReactionFeedback
                actor={reactions.actor}
                playerColor={runtime.playerColor}
              />
            }
          />

          <div className="grid min-w-0">
            <PositionEvaluationGutter actor={evaluationActor} />
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
        <div className="w-full [grid-area:battle] xl:[grid-area:auto]">
          <ReactiveBattleStage
            onParticipantAnimationCompleted={
              presentation.notifyParticipantAnimationCompleted
            }
            opponentName={opponent.displayName}
            opponentPresentation={opponentPresentation}
            presentationSnapshot={presentation.snapshot}
          />
        </div>
      </div>

      <div className="contents xl:grid xl:min-w-0 xl:gap-2">
        <section
          aria-label="Core match actions"
          className="text-mapachito-charcoal grid min-w-0 gap-2 px-3 [grid-area:command] xl:px-0 xl:[grid-area:auto]"
        >
          <MatchCommands
            opponentName={opponent.displayName}
            onMenuOpened={reactions.clear}
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

                    <ClassifiedMoveHistory
                      transitions={activeTransitions}
                      records={moveFeedback}
                    />
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

          <MatchRecovery
            actor={actor}
            snapshot={snapshot}
            evaluationActor={evaluationActor}
            evaluationSnapshot={evaluationSnapshot}
            opponentName={opponent.displayName}
          />
        </section>
        {conclusion === null ? null : (
          <div className="px-3 [grid-area:result] xl:px-0 xl:[grid-area:auto]">
            <MatchOutcome
              conclusion={conclusion}
              playerColor={runtime.playerColor}
              opponentName={opponent.displayName}
            >
              {result?.(persisting || persistenceFailure !== null)}
            </MatchOutcome>
          </div>
        )}
      </div>
    </section>
  )
}
