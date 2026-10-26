"use client"

import { useSelector } from "@xstate/react"
import cx from "classix"
import { useEffect, useRef, type ReactNode, type Ref } from "react"
import { type ActorRefFrom } from "xstate"
import type { MapachessCatalog } from "@mapachess/localization/catalog"
import {
  selectIsPersistingMutation,
  selectMatchConclusion,
  selectPersistenceFailure,
} from "@mapachess/match/match-machine"
import type { MatchNavigationCommands } from "@mapachess/match/match-navigation"
import createMatchSetupForMode from "@mapachess/match/match-setup"
import type { MatchSetup } from "@mapachess/match/match-setup"
import {
  timeControlLabel,
  timeControlNotation,
  UNTIMED,
} from "@mapachess/match/time-control"
import { samePlayerAppearance } from "@mapachess/profile/player-appearance"
import { acceptedRewardMatchesEnding } from "@mapachess/profile/player-data"
import profileMachine, {
  selectCanChangeAutoHintMode,
  selectCurrentPlayerData,
  selectPendingPlayerData,
} from "@mapachess/profile/profile-machine"
import { matchPlayerRatingId } from "@mapachess/profile/rating-context"
import { selectDefaultStoryOpponent } from "@mapachess/profile/story-progress"
import {
  selectWebMatchSession,
  selectWebMatchSessionFailure,
  type WebMatchSessionActor,
  type WebMatchSessionFailureOperation,
} from "../../lib/gameplay/webMatchSessionMachine"
import { generateWebChess960Position } from "../../lib/gameplay/webOpponent"
import MapachessButton from "../presentation/MapachessButton"
import MapachessLoadingSurface from "../presentation/MapachessLoadingSurface"
import MapachessShell from "../presentation/MapachessShell"
import MapachessWordmark from "../presentation/MapachessWordmark"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"
import MatchModeMenu from "./MatchModeMenu"
import MatchResultFacts from "./MatchResultFacts"
import StoryMatchResult from "./StoryMatchResult"
import WebMatch from "./WebMatch"
import WebMatchSetup from "./WebMatchSetup"

export type WebGameProps = Readonly<{
  actor: WebMatchSessionActor
  navigation: MatchNavigationCommands
  onSettingsRequested: () => void
  profileActor: ActorRefFrom<typeof profileMachine>
  settingsButtonRef: Ref<HTMLButtonElement>
  settingsOpen: boolean
}>

const profileAllowsMatchOpening = (
  snapshot: ReturnType<ActorRefFrom<typeof profileMachine>["getSnapshot"]>,
): boolean => {
  const current = selectCurrentPlayerData(snapshot)
  const pending = selectPendingPlayerData(snapshot)
  return (
    (snapshot.matches("ready") || selectCanChangeAutoHintMode(snapshot)) &&
    current !== null &&
    (pending === null ||
      samePlayerAppearance(current.appearance, pending.appearance))
  )
}

type GameHeaderProps = Pick<
  WebGameProps,
  "onSettingsRequested" | "settingsButtonRef" | "settingsOpen"
> &
  Readonly<{ home?: boolean }>

type GameFrameProps = GameHeaderProps &
  Readonly<{
    children: ReactNode
    activityMessage?: string | null
    matchSessionActive: boolean
  }>

function GameHeader({
  home = false,
  onSettingsRequested,
  settingsButtonRef,
  settingsOpen,
}: GameHeaderProps) {
  const messages = useMapachessCopy().interface.webGame

  const homeTitle = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (home) homeTitle.current?.focus({ preventScroll: true })
  }, [home])
  const settingsButton = (
    <MapachessButton
      variant="secondary"
      aria-controls="profile-settings-panel"
      aria-expanded={settingsOpen}
      onClick={onSettingsRequested}
      ref={settingsButtonRef}
      type="button"
      className={cx("max-w-full min-w-0 wrap-break-word", !home && "px-2!")}
    >
      {messages.settings}
    </MapachessButton>
  )
  return (
    <header className="max-w-mapachess mx-auto mb-4 flex w-full flex-wrap items-center justify-between gap-3">
      {home ? (
        <h1
          id="game-modes-title"
          ref={homeTitle}
          tabIndex={-1}
          className="min-w-0 outline-none"
        >
          <MapachessWordmark />
        </h1>
      ) : (
        <MapachessWordmark />
      )}
      {settingsButton}
    </header>
  )
}

function GameFrame({
  children,
  activityMessage = null,
  matchSessionActive,
  home = false,
  onSettingsRequested,
  settingsButtonRef,
  settingsOpen,
}: GameFrameProps) {
  return (
    <MapachessShell
      spacing={matchSessionActive ? "match" : home ? "home" : "setup"}
      className={cx(
        home && "font-home",
        !home && !matchSessionActive && "h-dvh",
      )}
    >
      {home && !matchSessionActive ? (
        <div inert={activityMessage !== null}>
          <GameHeader
            home
            onSettingsRequested={onSettingsRequested}
            settingsButtonRef={settingsButtonRef}
            settingsOpen={settingsOpen}
          />
        </div>
      ) : null}

      <p className="sr-only" role="status">
        {activityMessage}
      </p>
      <div
        aria-busy={activityMessage !== null}
        inert={activityMessage !== null}
        className={cx(
          "max-w-mapachess mx-auto w-full",
          !home && !matchSessionActive && "h-full min-h-0 min-w-0",
        )}
      >
        {children}
      </div>
    </MapachessShell>
  )
}

const openingTitle = (
  actor: WebMatchSessionActor,
  copy: MapachessCatalog,
): string | null => {
  const snapshot = actor.getSnapshot()
  if (snapshot.matches("openingCurrentMatch"))
    return copy.presentation.resumingMatch
  if (snapshot.matches("restartingMatch")) return copy.setup.restartingMatch
  if (snapshot.matches("returningToMenu")) return copy.setup.returningToMenu
  if (snapshot.matches("openingFreshMatch")) return copy.setup.openingMatch
  return null
}

const failureTitle = (
  operation: WebMatchSessionFailureOperation,
  copy: MapachessCatalog,
): string => {
  if (operation === "open-current-match") {
    return copy.presentation.sessionFailure[operation]
  }
  if (operation === "restart-match")
    return copy.presentation.sessionFailure[operation]
  if (operation === "return-to-menu") {
    return copy.presentation.sessionFailure[operation]
  }
  return copy.presentation.sessionFailure.start
}

export default function WebGame({
  actor,
  navigation,
  onSettingsRequested,
  settingsButtonRef,
  settingsOpen,
  profileActor,
}: WebGameProps) {
  const copy = useMapachessCopy()
  const animalCopy = copy.animals

  const messages = copy.interface.webGame

  const snapshot = useSelector(actor, (current) => current)
  const profileSnapshot = useSelector(profileActor, (current) => current)
  const savedPlayerData = selectCurrentPlayerData(profileSnapshot)
  const savedMatch = savedPlayerData?.activeMatch ?? null
  const playerData =
    selectPendingPlayerData(profileSnapshot) ??
    selectCurrentPlayerData(profileSnapshot)
  if (playerData === null)
    throw new Error("Match setup requires a valid player profile.")
  const profileReady =
    profileAllowsMatchOpening(profileSnapshot) && !settingsOpen
  const requestedSetup = snapshot.context.requestedSetup
  const variant =
    requestedSetup.mode === "story"
      ? requestedSetup.variant
      : requestedSetup.challengeSetup.variant
  const initialSetup =
    requestedSetup.mode === "challenge" ||
    requestedSetup.opponentId !== undefined
      ? requestedSetup
      : {
          ...createMatchSetupForMode(
            { mode: requestedSetup.mode, variant },
            playerData.settings.challengeSetup,
            selectDefaultStoryOpponent(playerData.storyProgress, variant),
          ),
          ...(requestedSetup.timeControl === undefined
            ? {}
            : { timeControl: requestedSetup.timeControl }),
        }
  const session = selectWebMatchSession(snapshot)
  useEffect(() => {
    if (
      session !== null &&
      savedMatch?.matchId === session.match.matchId &&
      savedMatch.conclusion === null &&
      (snapshot.context.presentedRewardMatchId === session.match.matchId ||
        snapshot.context.dismissedRewardMatchId === session.match.matchId ||
        (session.match.conclusion !== null && !snapshot.context.resultReopened))
    )
      actor.send({
        type: "MATCH_SESSION.RESULT_REOPENED",
        matchId: session.match.matchId,
      })
  }, [
    actor,
    session,
    savedMatch?.matchId,
    savedMatch?.conclusion,
    snapshot.context.presentedRewardMatchId,
    snapshot.context.dismissedRewardMatchId,
    snapshot.context.resultReopened,
  ])
  const failure = selectWebMatchSessionFailure(snapshot)
  if (snapshot.matches("active") && session === null) {
    throw new Error("Active web match state has no owned session.")
  }

  const resultActionAvailable = (): boolean => {
    if (!actor.getSnapshot().matches("active") || session === null) {
      return false
    }
    const matchSnapshot = session.actor.getSnapshot()
    return (
      profileActor.getSnapshot().matches("ready") &&
      !selectIsPersistingMutation(matchSnapshot) &&
      selectPersistenceFailure(matchSnapshot) === null &&
      selectMatchConclusion(matchSnapshot) !== null &&
      !settingsOpen
    )
  }
  const requestSetupAfterResult = (setup: MatchSetup): void => {
    if (!resultActionAvailable()) return
    actor.send({
      type: "MATCH_SESSION.SETUP_REQUESTED",
      setup: {
        ...setup,
        ...(session === null ? {} : { timeControl: session.match.timeControl }),
      },
    })
  }
  const requestReplayAfterResult = (): void => {
    if (!resultActionAvailable()) return
    actor.send({ type: "MATCH_SESSION.RESTART_REQUESTED" })
  }

  if (snapshot.matches("openingCurrentMatch")) {
    return <MapachessLoadingSurface />
  }

  const openingFreshMatch = snapshot.matches("openingFreshMatch")
  const retainingMatch =
    snapshot.matches("active") ||
    snapshot.matches("restartingMatch") ||
    snapshot.matches("returningToMenu")

  return (
    <GameFrame
      activityMessage={openingTitle(actor, copy)}
      matchSessionActive={retainingMatch}
      home={snapshot.matches({ menu: "choosingMode" })}
      onSettingsRequested={onSettingsRequested}
      settingsButtonRef={settingsButtonRef}
      settingsOpen={settingsOpen}
    >
      {snapshot.matches({ menu: "choosingMode" }) ? (
        <>
          {session === null ? null : (
            <div className="mx-auto mb-4 max-w-6xl">
              <MapachessButton
                onClick={() =>
                  actor.send({ type: "MATCH_SESSION.RESUME_REQUESTED" })
                }
                disabled={settingsOpen}
              >
                {messages.resumeMatch}
                <span className="block text-base font-semibold">
                  {timeControlLabel(
                    session.match.timeControl,
                    copy.gameplay.clock,
                  )}
                </span>
              </MapachessButton>
            </div>
          )}
          <MatchModeMenu
            playerData={playerData}
            onCustomize={() => navigation.open("dressing-room")}
            onShare={() => navigation.open("profile-card")}
            disabled={!profileReady}
            onModeSelected={(selection) => {
              if (
                !profileAllowsMatchOpening(profileActor.getSnapshot()) ||
                settingsOpen
              )
                return
              const setup = createMatchSetupForMode(
                selection,
                playerData.settings.challengeSetup,
                selectDefaultStoryOpponent(
                  playerData.storyProgress,
                  selection.variant,
                ),
              )
              actor.send({
                type: "MATCH_SESSION.SETUP_REQUESTED",
                setup:
                  setup.mode === "challenge" &&
                  setup.challengeSetup.variant === "chess960"
                    ? {
                        ...setup,
                        displayedChess960PositionId:
                          setup.challengeSetup.chess960PositionId ??
                          generateWebChess960Position(globalThis.crypto),
                      }
                    : setup,
              })
            }}
          />
        </>
      ) : null}
      <div
        className="h-full min-h-0"
        hidden={!snapshot.matches({ menu: "setup" }) && !openingFreshMatch}
        inert={!snapshot.matches({ menu: "setup" }) && !openingFreshMatch}
      >
        <WebMatchSetup
          header={
            snapshot.matches({ menu: "setup" }) || openingFreshMatch ? (
              <GameHeader
                onSettingsRequested={onSettingsRequested}
                settingsButtonRef={settingsButtonRef}
                settingsOpen={settingsOpen}
              />
            ) : null
          }
          ratings={playerData.ratings}
          playerAppearance={playerData.appearance}
          onPlayerAnimalChanged={(animal) => {
            if (profileActor.getSnapshot().matches("ready"))
              profileActor.send({
                type: "PROFILE.APPEARANCE_SAVE_REQUESTED",
                appearance: { ...playerData.appearance, animal },
              })
          }}
          visible={snapshot.matches({ menu: "setup" }) || openingFreshMatch}
          editing={
            snapshot.context.overlays.includes("setup-opponent")
              ? "opponent"
              : snapshot.context.overlays.includes("setup-difficulty")
                ? "difficulty"
                : snapshot.context.overlays.includes("setup-hints")
                  ? "hints"
                  : snapshot.context.overlays.includes("setup-time-control")
                    ? "time-control"
                    : snapshot.context.overlays.includes("setup-player")
                      ? "player"
                      : null
          }
          onEditorOpened={(editor) => navigation.open(`setup-${editor}`)}
          onEditorClosed={navigation.back}
          opening={openingFreshMatch}
          challengeHistory={playerData.challengeHistory}
          autoHintMode={playerData.settings.autoHintMode}
          disabled={!profileReady && !openingFreshMatch}
          key={`${requestedSetup.mode}:${variant}:${requestedSetup.mode === "story" ? (requestedSetup.opponentId ?? "default") : "challenge"}:${timeControlNotation(requestedSetup.timeControl ?? UNTIMED)}`}
          onAutoHintModeChanged={(autoHintMode) => {
            if (session !== null)
              session.actor.send({
                type: "MATCH.AUTO_HINT_MODE_CHANGED",
                autoHintMode,
              })
            else
              profileActor.send({
                type: "PROFILE.AUTO_HINT_MODE_CHANGED",
                autoHintMode,
              })
          }}
          onBack={navigation.back}
          onStart={(setup) => {
            if (
              !profileAllowsMatchOpening(profileActor.getSnapshot()) ||
              settingsOpen
            )
              return
            actor.send({ type: "MATCH_SESSION.MATCH_REQUESTED", setup })
          }}
          setup={initialSetup}
          storyProgress={playerData.storyProgress}
        />
      </div>
      {session !== null ? (
        <div hidden={!retainingMatch} inert={!retainingMatch}>
          <WebMatch
            playerAnimal={
              session.match.mode === "story"
                ? playerData.appearance.animal
                : "raccoon-stockfish"
            }
            visible={retainingMatch}
            overlays={snapshot.context.overlays}
            navigation={navigation}
            celebrationDismissed={
              snapshot.context.dismissedRewardMatchId === session.match.matchId
            }
            rewardsReplaySequence={snapshot.context.rewardsReplaySequence}
            onRewardsReplayRequested={() =>
              actor.send({
                type: "MATCH_SESSION.REWARDS_REPLAY_REQUESTED",
                matchId: session.match.matchId,
              })
            }
            menuActions={
              <>
                <MapachessButton
                  aria-busy={snapshot.matches("restartingMatch")}
                  busyLabel={copy.setup.restartingMatch}
                  variant="secondary"
                  onClick={() =>
                    actor.send({ type: "MATCH_SESSION.RESTART_REQUESTED" })
                  }
                >
                  {messages.restartMatch}
                </MapachessButton>
                <MapachessButton
                  aria-busy={snapshot.matches("returningToMenu")}
                  busyLabel={copy.setup.returningToMenu}
                  variant="secondary"
                  onClick={() =>
                    actor.send({
                      type: "MATCH_SESSION.RETURN_TO_MENU_REQUESTED",
                    })
                  }
                >
                  {messages.returnToMenu}
                </MapachessButton>
                <MapachessButton
                  variant="secondary"
                  aria-controls="profile-settings-panel"
                  aria-expanded={settingsOpen}
                  onClick={onSettingsRequested}
                  ref={settingsButtonRef}
                >
                  {messages.settings}
                </MapachessButton>
              </>
            }
            actor={session.actor}
            evaluationActor={session.evaluationActor}
            initiallyConcluded={
              session.match.conclusion !== null &&
              !snapshot.context.resultReopened
            }
            savedMatch={savedMatch}
            acceptedReward={savedPlayerData?.lastAcceptedResultReward ?? null}
            storyProgress={
              savedPlayerData?.storyProgress ?? playerData.storyProgress
            }
            onSetupRequested={requestSetupAfterResult}
            onReplayRequested={requestReplayAfterResult}
            moveFeedback={
              savedMatch?.matchId === session.match.matchId
                ? (savedMatch.moveFeedback ?? [])
                : []
            }
            reactionsPaused={
              settingsOpen ||
              snapshot.context.overlays.includes("match-menu") ||
              !retainingMatch
            }
            key={session.match.matchId}
            mode={session.match.mode}
            moveReactionPlacement={playerData.settings.moveReactionPlacement}
            playerElo={
              savedPlayerData?.ratings[
                matchPlayerRatingId(
                  savedMatch?.matchId === session.match.matchId
                    ? savedMatch
                    : session.match,
                )
              ] ?? session.match.playerEloAtStart
            }
            runtime={session.runtime}
            result={(matchBusy) =>
              savedPlayerData !== null &&
              savedMatch !== null &&
              savedMatch.matchId === session.match.matchId ? (
                <>
                  <MatchResultFacts
                    match={savedMatch}
                    reward={
                      acceptedRewardMatchesEnding(
                        savedPlayerData.lastAcceptedResultReward,
                        savedMatch,
                      )
                        ? savedPlayerData.lastAcceptedResultReward
                        : null
                    }
                  />
                  {savedMatch.mode === "story" ? (
                    <StoryMatchResult
                      match={savedMatch}
                      progress={savedPlayerData.storyProgress}
                      disabled={
                        matchBusy ||
                        !profileSnapshot.matches("ready") ||
                        settingsOpen
                      }
                      opening={snapshot.matches("returningToMenu")}
                      onSetupRequested={requestSetupAfterResult}
                    />
                  ) : (
                    <MapachessButton
                      disabled={
                        matchBusy ||
                        !profileSnapshot.matches("ready") ||
                        settingsOpen
                      }
                      onClick={requestReplayAfterResult}
                    >
                      {messages.replayOpponent}
                      <span className="mt-1 block text-base font-normal">
                        {savedMatch.opponentTargetElo === undefined
                          ? animalCopy.opponent(savedMatch.opponentId)
                          : copy.gameplay.opponentAndElo(
                              animalCopy.opponent(savedMatch.opponentId),
                              savedMatch.opponentTargetElo,
                            )}
                      </span>
                    </MapachessButton>
                  )}
                </>
              ) : null
            }
          />
        </div>
      ) : null}
      {snapshot.matches("failed") && failure !== null ? (
        <section
          aria-live="assertive"
          className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal shadow-mapachito-charcoal grid min-h-[min(74dvh,50rem)] place-items-center rounded-[1.5rem_0.5rem_1.5rem_0.5rem] border-3 p-8 text-center shadow-[0.625rem_0.625rem_0] forced-colors:border-[CanvasText] forced-colors:shadow-none"
        >
          <div role="alert">
            <h1 className="font-display text-mapachito-charcoal text-[clamp(1.75rem,5vw,3rem)] leading-[0.95] font-black tracking-[-0.025em] text-balance uppercase">
              {failureTitle(failure.operation, copy)}
            </h1>
            <p className="text-mapachito-charcoal mt-4 max-w-lg leading-[1.55] font-semibold opacity-76">
              {messages.yourLastVerifiedLocalProfileRemainsAvailable}
            </p>
            <MapachessButton
              className="mt-6"
              onClick={() =>
                actor.send({ type: "MATCH_SESSION.RETRY_REQUESTED" })
              }
              type="button"
            >
              {messages.retry}
            </MapachessButton>
          </div>
        </section>
      ) : null}
    </GameFrame>
  )
}
