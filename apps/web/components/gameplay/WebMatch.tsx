"use client"

import { useSelector } from "@xstate/react"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { ActorRefFrom } from "xstate"
import decideChickenDrawOffer from "@mapachess/evaluation/chicken-draw-decision"
import positionEvaluationMachine from "@mapachess/evaluation/position-evaluation-machine"
import {
  selectMatchPresentationAnimalReaction,
  selectMatchPresentationVariationOrdinal,
} from "@mapachess/match-presentation/match-presentation-machine"
import type {
  DurableMatchRecord,
  MatchMode,
} from "@mapachess/match/durable-match-record"
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
import type {
  MatchNavigationCommands,
  MatchNavigationOverlay,
} from "@mapachess/match/match-navigation"
import { matchModeLabel } from "@mapachess/match/match-setup"
import type { MatchSetup } from "@mapachess/match/match-setup"
import type { MoveFeedbackRecord } from "@mapachess/match/move-feedback"
import stockfishOpponent from "@mapachess/match/stockfish-opponent"
import {
  acceptedRewardMatchesEnding,
  type AcceptedMatchReward,
} from "@mapachess/profile/player-data"
import type { StoryProgress } from "@mapachess/profile/story-progress"
import useMoveReactions from "../../lib/gameplay/useMoveReactions"
import type { WebMatchRuntime } from "../../lib/gameplay/webMatchRuntime"
import useAcceptedMatchPresentation from "../../lib/presentation/useAcceptedMatchPresentation"
import resolveWebOpponentPresentation from "../../lib/presentation/webOpponentPresentation"
import MapachessButton from "../presentation/MapachessButton"
import BattleStageSurface from "./BattleStageSurface"
import BetterHintsControl from "./BetterHintsControl"
import CanonicalChessboard from "./CanonicalChessboard"
import ClassifiedMoveHistory from "./ClassifiedMoveHistory"
import LevelAchievementToasts from "./LevelAchievementToasts"
import MapachitoCoachPortrait from "./MapachitoCoachPortrait"
import MatchCelebration from "./MatchCelebration"
import MatchCommands from "./MatchCommands"
import MatchIdentity from "./MatchIdentity"
import MatchOutcome from "./MatchOutcome"
import MatchRecovery from "./MatchRecovery"
import MoveReactionFeedback from "./MoveReactionFeedback"
import PositionEvaluationGutter from "./PositionEvaluationGutter"

export type WebMatchProps = Readonly<{
  actor: ActorRefFrom<typeof matchMachine>
  evaluationActor: ActorRefFrom<typeof positionEvaluationMachine>
  initiallyConcluded: boolean
  moveFeedback?: readonly MoveFeedbackRecord[]
  savedMatch: DurableMatchRecord | null
  acceptedReward: AcceptedMatchReward | null
  storyProgress: StoryProgress
  onSetupRequested: (setup: MatchSetup) => void
  onReplayRequested: () => void
  reactionsPaused?: boolean
  mode: MatchMode
  playerElo: number
  runtime: WebMatchRuntime
  menuActions?: ReactNode
  result?: (disabled: boolean) => ReactNode
  navigation: MatchNavigationCommands
  overlays: readonly MatchNavigationOverlay[]
  celebrationDismissed: boolean
  rewardsReplaySequence: number
  onRewardsReplayRequested: () => void
  visible: boolean
}>

export default function WebMatch({
  actor,
  evaluationActor,
  initiallyConcluded,
  moveFeedback = [],
  savedMatch,
  acceptedReward,
  storyProgress,
  onSetupRequested,
  onReplayRequested,
  reactionsPaused = false,
  mode,
  playerElo,
  runtime,
  result,
  menuActions,
  navigation,
  overlays,
  celebrationDismissed,
  rewardsReplaySequence,
  onRewardsReplayRequested,
  visible,
}: WebMatchProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  const menuSummary = useRef<HTMLElement>(null)
  const rewardsButton = useRef<HTMLButtonElement>(null)
  const [celebrationStageSlot, setCelebrationStageSlot] =
    useState<HTMLDivElement | null>(null)
  const matchingReward =
    savedMatch?.matchId === runtime.matchId &&
    savedMatch.conclusion !== null &&
    acceptedRewardMatchesEnding(acceptedReward, savedMatch)
      ? acceptedReward
      : null
  const completedSavedMatch =
    savedMatch?.matchId === runtime.matchId && savedMatch.conclusion !== null
  const newlyAccepted = !initiallyConcluded && completedSavedMatch
  const celebrationPending = newlyAccepted && !celebrationDismissed
  const celebrationOpen =
    completedSavedMatch &&
    visible &&
    overlays.includes("rewards") &&
    !overlays.includes("settings")
  useEffect(() => {
    if (
      celebrationPending &&
      visible &&
      !overlays.includes("settings") &&
      !overlays.includes("rewards")
    )
      navigation.open("rewards")
  }, [celebrationPending, visible, overlays, navigation.open])
  useEffect(() => {
    if (!visible) return
    heading.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: "instant" })
  }, [actor, visible])
  const snapshot = useSelector(actor, (current) => current)
  const evaluationSnapshot = useSelector(evaluationActor, (current) => current)
  const presentation = useAcceptedMatchPresentation(
    snapshot,
    runtime.playerColor,
    rewardsReplaySequence,
  )
  const opponent = stockfishOpponent(runtime.opponentId)
  const opponentReaction = selectMatchPresentationAnimalReaction(
    presentation.snapshot,
    "opponent",
  )
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
  const reactions = useMoveReactions(
    timeline,
    moveFeedback,
    reactionsPaused || celebrationPending || celebrationOpen,
  )
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
    <>
      <section
        aria-label={`${modeLabel} match against ${opponent.displayName}`}
        className="grid min-w-0 items-start gap-2 [--playing-width:100%] [grid-template-areas:'playing'_'command'_'battle'_'result'] xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] xl:gap-x-6 xl:[--playing-width:min(100%,52rem,max(20rem,calc(100svh-13rem)))] xl:[grid-template-areas:none]"
      >
        <div className="contents xl:grid xl:w-full xl:max-w-(--playing-width) xl:min-w-0 xl:gap-2 xl:justify-self-center">
          <div className="grid min-w-0 gap-2 [grid-area:playing] xl:[grid-area:auto]">
            <MatchIdentity
              headingRef={heading}
              playerColor={runtime.playerColor}
              playerElo={playerElo}
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
          <BattleStageSurface
            celebrationSlot={celebrationStageSlot}
            onParticipantAnimationCompleted={
              presentation.notifyParticipantAnimationCompleted
            }
            opponentName={opponent.displayName}
            opponentPresentation={opponentPresentation}
            presentationSnapshot={presentation.snapshot}
          />
        </div>

        <div className="contents xl:grid xl:min-w-0 xl:gap-2">
          <section
            aria-label="Core match actions"
            className="text-mapachito-charcoal grid min-w-0 gap-2 px-3 [grid-area:command] xl:px-0 xl:[grid-area:auto]"
          >
            <MatchCommands
              opponentName={opponent.displayName}
              menuOpen={overlays.includes("match-menu")}
              onMenuOpened={() => {
                reactions.clear()
                navigation.open("match-menu")
              }}
              onMenuClosed={navigation.back}
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
                  <details
                    open={overlays.includes("match-details")}
                    className="text-mapachito-white [grid-area:data]"
                  >
                    <summary
                      onClick={(event) => {
                        event.preventDefault()
                        if (overlays.includes("match-details"))
                          navigation.back()
                        else navigation.open("match-details")
                      }}
                      className="min-h-12 cursor-pointer content-center rounded-lg font-bold focus-visible:outline-2"
                    >
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
              menuSummaryRef={menuSummary}
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
          {conclusion === null || celebrationPending ? null : (
            <div
              className={`px-3 [grid-area:result] xl:px-0 xl:[grid-area:auto] ${celebrationOpen ? "invisible" : ""}`}
              inert={celebrationOpen}
            >
              <MatchOutcome
                conclusion={conclusion}
                playerColor={runtime.playerColor}
                opponentName={opponent.displayName}
              >
                {result?.(persisting || persistenceFailure !== null)}
                {!completedSavedMatch ? null : (
                  <MapachessButton
                    disabled={persisting || persistenceFailure !== null}
                    onClick={onRewardsReplayRequested}
                    variant="secondary"
                    ref={rewardsButton}
                  >
                    View rewards
                  </MapachessButton>
                )}
              </MatchOutcome>
            </div>
          )}
        </div>
      </section>
      {celebrationOpen && savedMatch !== null ? (
        <MatchCelebration
          battleStageRef={setCelebrationStageSlot}
          disabled={persisting || persistenceFailure !== null}
          match={savedMatch}
          onDismiss={navigation.back}
          onReplayRequested={onReplayRequested}
          onSetupRequested={onSetupRequested}
          restoreFocusRef={
            rewardsReplaySequence > 0 ? rewardsButton : menuSummary
          }
          reward={matchingReward}
          storyProgress={storyProgress}
          showSaveConfirmation={newlyAccepted && rewardsReplaySequence === 0}
        />
      ) : null}
      {newlyAccepted && celebrationDismissed && matchingReward !== null ? (
        <LevelAchievementToasts
          ids={matchingReward.unlockedAchievementIds}
          paused={reactionsPaused || celebrationOpen}
        />
      ) : null}
    </>
  )
}
