import cx from "classix"
import { useEffect, useRef } from "react"
import { ScrollView, View } from "react-native"
import {
  positionEvaluationLabel,
  whiteEvaluationSharePercent,
} from "@mapachess/evaluation/position-evaluation"
import {
  selectLivePositionEvaluation,
  selectPositionEvaluationStage,
} from "@mapachess/evaluation/position-evaluation-machine"
import type { MatchSession } from "@mapachess/gameplay/match-session"
import type { MatchSessionController } from "@mapachess/gameplay/session-controller"
import type { AcceptedMatchPresentationBinding } from "@mapachess/match-presentation/accepted-match-presentation"
import resolveCoachPortrait, {
  COACH_COLLECTIONS,
} from "@mapachess/match-presentation/coach-portrait"
import { selectMatchPresentationVariationOrdinal } from "@mapachess/match-presentation/match-presentation-machine"
import {
  selectAreMatchMutationsFrozen,
  selectHintStage,
  selectIsPlayerTurn,
  selectMatchConclusion,
  selectMatchHints,
  selectMatchPosition,
  selectMatchTimeline,
  selectOpponentFailure,
  selectPersistenceFailure,
} from "@mapachess/match/match-machine"
import { listLegalMatchMoves } from "@mapachess/match/match-move"
import type {
  MatchNavigationCommands,
  MatchNavigationOverlay,
} from "@mapachess/match/match-navigation"
import type { MatchSetup } from "@mapachess/match/match-setup"
import type { PlayerInputAction } from "@mapachess/match/player-input"
import { timeControlLabel } from "@mapachess/match/time-control"
import {
  acceptedRewardMatchesEnding,
  type MapachessPlayerData,
} from "@mapachess/profile/player-data"
import type { NativeMatchRuntime } from "@/lib/gameplay/openNativeMatchRuntime"
import useNativeMoveReactions from "@/lib/gameplay/useNativeMoveReactions"
import useNativeMatchPresentation from "@/lib/presentation/useNativeMatchPresentation"
import useNativePresentationActivity from "@/lib/presentation/useNativePresentationActivity"
import useActorSnapshot from "@/lib/useActorSnapshot"
import { NativeInputSurface } from "../input/NativeInputProvider"
import NativeButton from "../presentation/NativeButton"
import NativeText from "../presentation/NativeText"
import NativeCoachPortrait from "../profile/NativeCoachPortrait"
import { useNativeLocale } from "../profile/NativeLocaleProvider"
import NativeBattleStage from "./NativeBattleStage"
import NativeChessboard from "./NativeChessboard"
import NativeMatchClock from "./NativeMatchClock"
import NativeMatchControls from "./NativeMatchControls"
import NativeMatchOverlay from "./NativeMatchOverlay"
import NativeMatchRewards, {
  NativeCompletedMatchResult,
} from "./NativeMatchRewards"
import NativeMoveRatings from "./NativeMoveRatings"

const NO_FEEDBACK = Object.freeze([])

function MatchCoach({
  binding,
  data,
}: Readonly<{
  binding: AcceptedMatchPresentationBinding
  data: MapachessPlayerData
}>) {
  const snapshot = useActorSnapshot(binding.actor)
  const collection = data.settings.coachCollection
  const record = data.activeMatch?.moveFeedback?.at(-1)
  const reaction =
    snapshot.context.currentPhase?.player ??
    (record === undefined
      ? { family: "idle" as const }
      : {
          family: "move" as const,
          grade: record.grade,
          role:
            record.mover === data.activeMatch?.playerColor
              ? ("player" as const)
              : ("opponent" as const),
        })
  const portrait = resolveCoachPortrait(
    reaction,
    COACH_COLLECTIONS[collection].portraits,
    selectMatchPresentationVariationOrdinal(snapshot, "player"),
  )
  return <NativeCoachPortrait collection={collection} label={portrait.label} />
}

export default function NativeMatch({
  session,
  appActor,
  data,
  navigation,
  overlays,
  visible,
  resultNavigationReady,
  initiallyConcluded,
  celebrationDismissed,
  replaySequence,
  onSetup,
  onReplay,
  onAction,
}: Readonly<{
  session: MatchSession<NativeMatchRuntime>
  appActor: MatchSessionController<NativeMatchRuntime>["actor"]
  data: MapachessPlayerData
  navigation: MatchNavigationCommands
  overlays: readonly MatchNavigationOverlay[]
  visible: boolean
  resultNavigationReady: boolean
  initiallyConcluded: boolean
  celebrationDismissed: boolean
  replaySequence: number
  onSetup: (setup: MatchSetup) => void
  onReplay: () => void
  onAction: (action: PlayerInputAction) => boolean
}>) {
  const { copy } = useNativeLocale()
  const snapshot = useActorSnapshot(session.actor)
  const evaluationSnapshot = useActorSnapshot(session.evaluationActor)
  const position = selectMatchPosition(snapshot)
  const timeline = selectMatchTimeline(snapshot)
  const conclusion = selectMatchConclusion(snapshot)
  const previousConclusion = useRef(conclusion)
  const binding = useNativeMatchPresentation(session, replaySequence)
  const activity = useNativePresentationActivity()
  const saved =
    data.activeMatch?.matchId === session.match.matchId
      ? data.activeMatch
      : null
  const completed =
    conclusion !== null &&
    saved !== null &&
    saved.conclusion?.type === conclusion.type &&
    (!("winner" in conclusion) ||
      ("winner" in saved.conclusion &&
        saved.conclusion.winner === conclusion.winner)) &&
    saved.cursor === timeline.cursor &&
    saved.currentFen === position.fen &&
    timeline.transitions
      .slice(0, timeline.cursor)
      .every(({ move }, index) => move.id === saved.moveIds[index])
      ? saved
      : null
  const reward =
    completed !== null &&
    acceptedRewardMatchesEnding(data.lastAcceptedResultReward, completed)
      ? data.lastAcceptedResultReward
      : null
  const rewardOpen = visible && reward !== null && overlays.at(-1) === "rewards"
  const resultActionsEnabled =
    visible && resultNavigationReady && !selectAreMatchMutationsFrozen(snapshot)
  const reactions = useNativeMoveReactions(
    timeline,
    saved?.moveFeedback ?? NO_FEEDBACK,
    !visible || !activity.active || overlays.length > 0 || conclusion !== null,
  )
  useEffect(() => {
    if (previousConclusion.current !== null && conclusion === null)
      appActor.send({
        type: "MATCH_SESSION.RESULT_REOPENED",
        matchId: session.match.matchId,
      })
    previousConclusion.current = conclusion
  }, [conclusion, appActor, session])
  useEffect(() => {
    if (
      resultActionsEnabled &&
      !initiallyConcluded &&
      reward !== null &&
      !celebrationDismissed &&
      overlays.length === 0
    )
      navigation.open("rewards")
  }, [
    resultActionsEnabled,
    initiallyConcluded,
    reward,
    celebrationDismissed,
    overlays,
    navigation,
  ])
  const stage = selectHintStage(snapshot)
  const hints =
    stage === "piece-hints" || stage === "move-hints"
      ? selectMatchHints(snapshot)
      : null
  const evaluation = selectLivePositionEvaluation(evaluationSnapshot)
  const evaluationStage = selectPositionEvaluationStage(evaluationSnapshot)
  const opponentFailure = selectOpponentFailure(snapshot)
  const persistenceFailure = selectPersistenceFailure(snapshot)
  const matchName =
    copy.setup.presentations[position.variant][session.match.mode].title
  const ratings =
    reactions === null ? null : <NativeMoveRatings controller={reactions} />
  return (
    <NativeInputSurface
      enabled={visible && !rewardOpen}
      onAction={onAction}
      className="relative min-h-0 flex-1"
    >
      <ScrollView
        className="min-h-0 flex-1"
        contentContainerClassName="gap-2 p-2"
        accessibilityElementsHidden={rewardOpen}
        importantForAccessibility={rewardOpen ? "no-hide-descendants" : "auto"}
        pointerEvents={rewardOpen ? "none" : "auto"}
      >
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <NativeText className="font-native text-lg">{matchName}</NativeText>
          <NativeText className="text-sm">
            {timeControlLabel(session.match.timeControl, copy.gameplay.clock)}
          </NativeText>
        </View>
        <NativeText className="text-sm">
          {copy.gameplay.opponentAndElo(
            copy.animals.opponent(session.match.opponentId),
            session.runtime.opponentTargetElo,
          )}
        </NativeText>
        {snapshot.context.clock === null ? null : (
          <NativeMatchClock
            clock={snapshot.context.clock}
            monotonicClock={snapshot.context.monotonicClock}
            canResume={snapshot.matches("paused")}
            onResume={() =>
              session.actor.send({ type: "MATCH.CLOCK_RESUME_REQUESTED" })
            }
          />
        )}
        <View
          className="bg-mapachito-charcoal relative h-8 items-center justify-center overflow-hidden rounded"
          accessibilityRole="progressbar"
          accessibilityLabel={
            copy.interface.positionEvaluationGutter.stockfishEvaluation
          }
          accessibilityValue={{
            min: 0,
            max: 100,
            now: whiteEvaluationSharePercent(evaluation),
            text:
              evaluation === null
                ? evaluationStage === "failure"
                  ? copy.evaluation.unavailable
                  : copy.evaluation.waiting
                : positionEvaluationLabel(evaluation, copy.evaluation),
          }}
        >
          <View
            className="bg-mapachito-white absolute inset-y-0 left-0"
            style={{
              width: `${whiteEvaluationSharePercent(evaluation)}%`,
            }}
          />
          <NativeText className="bg-mapachito-charcoal rounded px-2 text-center">
            {evaluation === null
              ? "…"
              : positionEvaluationLabel(evaluation, copy.evaluation)}
          </NativeText>
        </View>
        <View className="relative flex-col gap-2 xl:flex-row">
          <View className="relative min-w-0 flex-1">
            <NativeChessboard
              position={position}
              orientation={session.match.playerColor}
              legalMoves={
                conclusion === null ? listLegalMatchMoves(position) : []
              }
              disabled={
                !visible ||
                !selectIsPlayerTurn(snapshot) ||
                overlays.length > 0 ||
                conclusion !== null
              }
              appearance={data.settings.chessAppearance}
              hints={hints}
              showMoveHints={stage === "move-hints"}
              lastMove={timeline.transitions[timeline.cursor - 1]?.move ?? null}
              onMove={(moveId) =>
                session.actor.send({ type: "MATCH.MOVE_REQUESTED", moveId })
              }
            />
          </View>
          <View
            pointerEvents="box-none"
            className={cx(
              "absolute inset-0 xl:relative xl:inset-auto xl:w-64 xl:self-stretch",
              data.settings.moveReactionPlacement === "top"
                ? "justify-start"
                : data.settings.moveReactionPlacement === "middle"
                  ? "justify-center"
                  : "justify-end",
            )}
          >
            {ratings}
          </View>
        </View>
        <NativeMatchControls
          session={session}
          snapshot={snapshot}
          navigation={navigation}
          coach={
            binding === null ? (
              <NativeCoachPortrait
                collection={data.settings.coachCollection}
                label="neutral"
              />
            ) : (
              <MatchCoach binding={binding} data={data} />
            )
          }
        />
        {opponentFailure === null ? null : (
          <>
            <NativeText accessibilityRole="alert">
              {copy.gameplay.opponentTurnFailed(
                copy.animals.opponent(session.match.opponentId),
              )}
            </NativeText>
            <NativeButton
              onPress={() =>
                session.actor.send({ type: "MATCH.OPPONENT_RETRY_REQUESTED" })
              }
            >
              {copy.gameplay.retryTurn(
                copy.animals.opponent(session.match.opponentId),
              )}
            </NativeButton>
          </>
        )}
        {persistenceFailure === null ? null : (
          <>
            <NativeText accessibilityRole="alert">
              {copy.interface.matchRecovery.yourPendingChangeIsRetainedButNot}
            </NativeText>
            <NativeButton
              onPress={() =>
                session.actor.send({
                  type: "MATCH.PERSISTENCE_RETRY_REQUESTED",
                })
              }
            >
              {copy.interface.matchRecovery.retrySave}
            </NativeButton>
          </>
        )}
        {evaluationStage !== "failure" ? null : (
          <NativeButton
            variant="secondary"
            onPress={() =>
              session.evaluationActor.send({
                type: "EVALUATION.RETRY_REQUESTED",
              })
            }
          >
            {copy.interface.matchRecovery.retryEvaluation}
          </NativeButton>
        )}
      </ScrollView>
      <NativeBattleStage
        binding={binding}
        visible={visible && !overlays.some((overlay) => overlay !== "rewards")}
        playerAnimal={
          session.match.mode === "story"
            ? data.appearance.animal
            : "raccoon-stockfish"
        }
        opponentAnimal={session.match.opponentId}
        renderHost={(stage, stageHeightClassName) => (
          <NativeMatchRewards
            stage={stage}
            stageHeightClassName={stageHeightClassName}
            celebration={
              rewardOpen && completed !== null && reward !== null
                ? {
                    match: completed,
                    reward,
                    storyProgress: data.storyProgress,
                    disabled: !resultActionsEnabled,
                    showSaveConfirmation: replaySequence === 0,
                    onDismiss: () => navigation.close("rewards"),
                    onSetup,
                    onReplay,
                  }
                : null
            }
          />
        )}
      />
      {completed === null ? null : (
        <NativeCompletedMatchResult
          match={completed}
          storyProgress={data.storyProgress}
          reward={reward}
          hidden={rewardOpen}
          replaySequence={replaySequence}
          disabled={!resultActionsEnabled || overlays.length > 0}
          onSetup={onSetup}
          onReplay={onReplay}
          onViewRewards={() =>
            appActor.send({
              type: "MATCH_SESSION.REWARDS_REPLAY_REQUESTED",
              matchId: completed.matchId,
            })
          }
        />
      )}
      {visible ? (
        <NativeMatchOverlay
          session={session}
          appActor={appActor}
          data={data}
          navigation={navigation}
          overlays={overlays}
        />
      ) : null}
    </NativeInputSurface>
  )
}
