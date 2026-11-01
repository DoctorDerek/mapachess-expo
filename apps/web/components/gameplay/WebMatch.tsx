"use client"

import { useSelector } from "@xstate/react"
import cx from "classix"
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
import type { MatchSetup } from "@mapachess/match/match-setup"
import type { MoveFeedbackRecord } from "@mapachess/match/move-feedback"
import stockfishOpponent from "@mapachess/match/stockfish-opponent"
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import { timeControlLabel } from "@mapachess/match/time-control"
import { matchMedalEligibility } from "@mapachess/profile/match-medal"
import {
  acceptedRewardMatchesEnding,
  type AcceptedMatchReward,
} from "@mapachess/profile/player-data"
import type { MoveReactionPlacement } from "@mapachess/profile/presentation-preferences"
import type { StoryProgress } from "@mapachess/profile/story-progress"
import useMoveReactions from "../../lib/gameplay/useMoveReactions"
import type { WebMatchRuntime } from "../../lib/gameplay/webMatchRuntime"
import { focusInput } from "../../lib/input/webFocusNavigation"
import useAcceptedMatchPresentation from "../../lib/presentation/useAcceptedMatchPresentation"
import resolveWebOpponentPresentation from "../../lib/presentation/webOpponentPresentation"
import { usePlayerInputScope } from "../input/PlayerInputProvider"
import MapachessButton from "../presentation/MapachessButton"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"
import BattleStageSurface from "./BattleStageSurface"
import CanonicalChessboard from "./CanonicalChessboard"
import ClassifiedMoveHistory from "./ClassifiedMoveHistory"
import LevelAchievementToasts from "./LevelAchievementToasts"
import MapachitoCoachPortrait from "./MapachitoCoachPortrait"
import MatchCelebration from "./MatchCelebration"
import MatchCommands from "./MatchCommands"
import MatchHintControls from "./MatchHintControls"
import MatchIdentity from "./MatchIdentity"
import MatchOutcome from "./MatchOutcome"
import MatchRecovery from "./MatchRecovery"
import MoveReactionFeedback from "./MoveReactionFeedback"
import ParticipantClock from "./ParticipantClock"
import PositionEvaluationGutter from "./PositionEvaluationGutter"

export type WebMatchProps = Readonly<{
  playerAnimal?: StockfishOpponentId
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
  moveReactionPlacement: MoveReactionPlacement
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
  moveReactionPlacement,
  runtime,
  result,
  menuActions,
  navigation,
  overlays,
  celebrationDismissed,
  rewardsReplaySequence,
  onRewardsReplayRequested,
  visible,
  playerAnimal = "raccoon-stockfish",
}: WebMatchProps) {
  const copy = useMapachessCopy()
  const animalCopy = copy.animals
  const messages = copy.interface.webMatch

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
  const evaluationSnapshot = useSelector(
    evaluationActor,
    (current) => current,
    (previous, current) =>
      previous.value === current.value &&
      previous.context.result === current.context.result &&
      previous.context.failure === current.context.failure,
  )
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
  const modeLabel = copy.setup.presentations[position.variant][mode].title
  const timeline = selectMatchTimeline(snapshot)
  const reactions = useMoveReactions(
    timeline,
    moveFeedback,
    reactionsPaused ||
      overlays.length > 0 ||
      celebrationPending ||
      celebrationOpen,
  )
  const coachMove = useSelector(
    reactions.actor,
    (current) => current.context.cards[0]?.reaction ?? null,
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

  const matchSurface = useRef<HTMLElement>(null)
  const toggleBoardFocus = (): void => {
    const root = matchSurface.current
    if (root === null) return
    const board = root.querySelector<HTMLElement>('[role="grid"]')
    const destination = board?.contains(document.activeElement)
      ? menuSummary.current
      : board?.querySelector<HTMLElement>('[tabindex="0"]')
    if (destination != null) focusInput(destination)
  }
  usePlayerInputScope({
    root: matchSurface,
    enabled: visible,
    handle: (action) => {
      const root = matchSurface.current
      if (root === null) return false
      if (action === "controls") {
        toggleBoardFocus()
        return true
      }
      if (!["hints", "menu", "undo", "redo"].includes(action)) return false
      const control = root.querySelector<HTMLElement>(
        `[data-player-action="${action}"]`,
      )
      if (
        control !== null &&
        !control.matches(':disabled, [aria-disabled="true"]')
      )
        control.click()
      return true
    },
  })

  return (
    <>
      <section
        ref={matchSurface}
        aria-label={copy.board.matchAgainst(
          modeLabel,
          animalCopy.opponent(opponent.id),
        )}
        className="relative mx-auto grid min-w-0 items-start [--playing-width:100%] [grid-template-areas:'clocks'_'identity'_'evaluation'_'board'_'command'_'battle'_'result'] xl:max-w-[calc(var(--playing-width)+var(--command-width)+var(--command-gap))] xl:grid-cols-[minmax(0,1fr)_var(--command-width)] xl:gap-x-(--command-gap) xl:[--command-gap:--spacing(6)] xl:[--command-width:--spacing(96)] xl:[--playing-width:min(--spacing(208),max(--spacing(80),calc(100svh---spacing(52))))] xl:[grid-template-areas:'clocks_.'_'identity_.'_'evaluation_.'_'board_command'_'battle_command']"
      >
        <MatchIdentity
          timeControl={snapshot.context.timeControl}
          playerClock={
            snapshot.context.clock === null ? null : (
              <ParticipantClock
                clock={snapshot.context.clock}
                color={runtime.playerColor}
                monotonicClock={snapshot.context.monotonicClock}
              />
            )
          }
          opponentClock={
            snapshot.context.clock === null ? null : (
              <ParticipantClock
                clock={snapshot.context.clock}
                color={runtime.playerColor === "white" ? "black" : "white"}
                monotonicClock={snapshot.context.monotonicClock}
              />
            )
          }
          headingRef={heading}
          playerColor={runtime.playerColor}
          playerElo={playerElo}
          assistance={matchMedalEligibility(
            savedMatch ?? { pieceHintsUsed: false, moveHintsUsed: false },
          )}
          opponentName={animalCopy.opponent(opponent.id)}
          opponentElo={runtime.opponentTargetElo}
        />
        <div className="w-full max-w-(--playing-width) min-w-0 justify-self-center [grid-area:evaluation]">
          <PositionEvaluationGutter actor={evaluationActor} />
        </div>
        <div className="w-full max-w-(--playing-width) min-w-0 justify-self-center [grid-area:board]">
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
        <div className="mt-2 w-full max-w-(--playing-width) min-w-0 justify-self-center [grid-area:battle]">
          <BattleStageSurface
            playerAnimal={playerAnimal}
            celebrationSlot={celebrationStageSlot}
            onParticipantAnimationCompleted={
              presentation.notifyParticipantAnimationCompleted
            }
            opponentName={animalCopy.opponent(opponent.id)}
            opponentPresentation={opponentPresentation}
            presentationSnapshot={presentation.snapshot}
          />
        </div>

        <div className="contents xl:grid xl:min-h-0 xl:min-w-0 xl:grid-rows-[auto_minmax(0,1fr)] xl:gap-3 xl:self-stretch xl:[grid-area:command]">
          <div className="contents xl:grid xl:gap-2">
            <section
              aria-label={messages.coreMatchActions}
              className="text-mapachito-charcoal mt-1.5 grid min-w-0 gap-1.5 px-2.5 [grid-area:command] xl:mt-0 xl:px-0 xl:[grid-area:auto]"
            >
              <MatchCommands
                opponentName={animalCopy.opponent(opponent.id)}
                menuOpen={overlays.includes("match-menu")}
                onMenuOpened={() => {
                  reactions.clear()
                  navigation.open("match-menu")
                }}
                onMenuClosed={() => {
                  menuSummary.current?.focus({ preventScroll: true })
                  navigation.close("match-menu")
                }}
                onBack={navigation.back}
                coach={
                  <MapachitoCoachPortrait
                    presentationSnapshot={presentation.snapshot}
                    moveReaction={
                      coachMove === null
                        ? null
                        : {
                            family: "move",
                            grade: coachMove.classification.grade,
                            role:
                              coachMove.mover === runtime.playerColor
                                ? "player"
                                : "opponent",
                          }
                    }
                  />
                }
                hints={
                  <MatchHintControls
                    actor={actor}
                    snapshot={snapshot}
                    navigation={navigation}
                    overlays={overlays}
                  />
                }
                menuActions={
                  <>
                    {menuActions}{" "}
                    <details
                      open={overlays.includes("match-details")}
                      className="text-mapachito-white min-w-0"
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
                        {messages.matchDetailsMoveHistory}
                      </summary>
                      <div className="text-mapachito-charcoal grid gap-3">
                        <dl
                          aria-label={messages.currentMatchData}
                          className="bg-mapachito-white grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-lg p-3 text-sm [&_dd]:text-right [&_dd]:font-bold [&_dt]:font-bold"
                        >
                          <dt>{messages.mode}</dt>
                          <dd>{modeLabel}</dd>
                          <dt>{messages.clock}</dt>
                          <dd>
                            {timeControlLabel(
                              snapshot.context.timeControl,
                              copy.gameplay.clock,
                            )}
                          </dd>
                          <dt>{messages.privacy}</dt>
                          <dd>{messages.localAccountless}</dd>
                          <dt>{messages.engine}</dt>
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

              {snapshot.matches("paused") ? (
                <MapachessButton
                  className="px-2! py-1! text-base leading-tight"
                  onClick={() =>
                    actor.send({ type: "MATCH.CLOCK_RESUME_REQUESTED" })
                  }
                >
                  <span aria-hidden="true">▶ </span>
                  {copy.gameplay.clock.resume}
                </MapachessButton>
              ) : null}
              <MatchRecovery
                actor={actor}
                snapshot={snapshot}
                evaluationActor={evaluationActor}
                evaluationSnapshot={evaluationSnapshot}
                opponentName={animalCopy.opponent(opponent.id)}
              />
            </section>
            {conclusion === null || celebrationPending ? null : (
              <div
                className={cx(
                  "mt-2 px-3 [grid-area:result] xl:mt-0 xl:px-0 xl:[grid-area:auto]",
                  celebrationOpen && "invisible",
                )}
                inert={celebrationOpen}
              >
                <MatchOutcome
                  conclusion={conclusion}
                  playerColor={runtime.playerColor}
                  opponentName={animalCopy.opponent(opponent.id)}
                >
                  {result?.(persisting || persistenceFailure !== null)}
                  {!completedSavedMatch ? null : (
                    <MapachessButton
                      disabled={persisting || persistenceFailure !== null}
                      onClick={onRewardsReplayRequested}
                      variant="secondary"
                      ref={rewardsButton}
                    >
                      {messages.viewRewards}
                    </MapachessButton>
                  )}
                </MatchOutcome>
              </div>
            )}
          </div>
          <MoveReactionFeedback
            actor={reactions.actor}
            playerColor={runtime.playerColor}
            placement={moveReactionPlacement}
          />
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
