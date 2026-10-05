"use client"

import { useSelector } from "@xstate/react"
import { useEffect, useRef, type ReactNode, type Ref } from "react"
import { type ActorRefFrom } from "xstate"
import {
  selectIsPersistingMutation,
  selectMatchConclusion,
  selectPersistenceFailure,
} from "@mapachess/match/match-machine"
import type { MatchNavigationCommands } from "@mapachess/match/match-navigation"
import createMatchSetupForMode, {
  MATCH_SETUP_COPY,
} from "@mapachess/match/match-setup"
import type { MatchSetup } from "@mapachess/match/match-setup"
import stockfishOpponent from "@mapachess/match/stockfish-opponent"
import { samePlayerAppearance } from "@mapachess/profile/player-appearance"
import { acceptedRewardMatchesEnding } from "@mapachess/profile/player-data"
import profileMachine, {
  selectCanChangeAutoHintMode,
  selectCurrentPlayerData,
  selectPendingPlayerData,
} from "@mapachess/profile/profile-machine"
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

type GameFrameProps = Omit<
  WebGameProps,
  "actor" | "navigation" | "profileActor"
> &
  Readonly<{
    children: ReactNode
    activityMessage?: string | null
    matchSessionActive: boolean
    home?: boolean
  }>

function GameFrame({
  children,
  activityMessage = null,
  matchSessionActive,
  home = false,
  onSettingsRequested,
  settingsButtonRef,
  settingsOpen,
}: GameFrameProps) {
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
    >
      Settings
    </MapachessButton>
  )
  return (
    <MapachessShell spacing={matchSessionActive ? "match" : "page"}>
      {matchSessionActive ? null : (
        <header
          inert={activityMessage !== null}
          className={`mx-auto flex w-full max-w-[96rem] flex-wrap items-center justify-between ${matchSessionActive ? "mb-2 gap-2 px-3 xl:px-0" : "mb-4 gap-3"}`}
        >
          {home ? (
            <h1
              id="game-modes-title"
              ref={homeTitle}
              tabIndex={-1}
              className="text-mapachito-white text-2xl leading-tight font-black outline-none"
            >
              Mapachess
            </h1>
          ) : (
            <MapachessWordmark />
          )}
          {settingsButton}
        </header>
      )}

      <p className="sr-only" role="status">
        {activityMessage}
      </p>
      <div
        aria-busy={activityMessage !== null}
        inert={activityMessage !== null}
        className="mx-auto w-full max-w-[96rem]"
      >
        {children}
      </div>
    </MapachessShell>
  )
}

const openingTitle = (actor: WebMatchSessionActor): string | null => {
  const snapshot = actor.getSnapshot()
  if (snapshot.matches("openingCurrentMatch")) return "Resuming saved match…"
  if (snapshot.matches("restartingMatch"))
    return MATCH_SETUP_COPY.restartingMatch
  if (snapshot.matches("returningToMenu"))
    return MATCH_SETUP_COPY.returningToMenu
  if (snapshot.matches("openingFreshMatch"))
    return MATCH_SETUP_COPY.openingMatch
  return null
}

const failureTitle = (operation: WebMatchSessionFailureOperation): string => {
  if (operation === "open-current-match") {
    return "Your saved match could not open."
  }
  if (operation === "restart-match") return "Your match could not restart."
  if (operation === "return-to-menu") {
    return "Mapachess could not return to the menu."
  }
  return "Your match could not start."
}

export default function WebGame({
  actor,
  navigation,
  onSettingsRequested,
  settingsButtonRef,
  settingsOpen,
  profileActor,
}: WebGameProps) {
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
      : createMatchSetupForMode(
          { mode: requestedSetup.mode, variant },
          playerData.settings.challengeSetup,
          selectDefaultStoryOpponent(playerData.storyProgress, variant),
        )
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
    actor.send({ type: "MATCH_SESSION.SETUP_REQUESTED", setup })
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
      activityMessage={openingTitle(actor)}
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
                Resume match
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
        hidden={!snapshot.matches({ menu: "setup" }) && !openingFreshMatch}
        inert={!snapshot.matches({ menu: "setup" }) && !openingFreshMatch}
      >
        <WebMatchSetup
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
                  : null
          }
          onEditorOpened={(editor) => navigation.open(`setup-${editor}`)}
          onEditorClosed={navigation.back}
          opening={openingFreshMatch}
          challengeHistory={playerData.challengeHistory}
          autoHintMode={playerData.settings.autoHintMode}
          disabled={!profileReady && !openingFreshMatch}
          key={`${requestedSetup.mode}:${variant}:${requestedSetup.mode === "story" ? (requestedSetup.opponentId ?? "default") : "challenge"}`}
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
                  busyLabel={MATCH_SETUP_COPY.restartingMatch}
                  variant="secondary"
                  onClick={() =>
                    actor.send({ type: "MATCH_SESSION.RESTART_REQUESTED" })
                  }
                >
                  Restart Match
                </MapachessButton>
                <MapachessButton
                  aria-busy={snapshot.matches("returningToMenu")}
                  busyLabel={MATCH_SETUP_COPY.returningToMenu}
                  variant="secondary"
                  onClick={() =>
                    actor.send({
                      type: "MATCH_SESSION.RETURN_TO_MENU_REQUESTED",
                    })
                  }
                >
                  Return to Menu
                </MapachessButton>
                <MapachessButton
                  variant="secondary"
                  aria-controls="profile-settings-panel"
                  aria-expanded={settingsOpen}
                  onClick={onSettingsRequested}
                  ref={settingsButtonRef}
                >
                  Settings
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
            playerElo={
              savedPlayerData?.ratings[
                session.match.startingPosition.variant
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
                      Replay opponent
                      <span className="mt-1 block text-base font-normal">
                        {stockfishOpponent(savedMatch.opponentId).displayName}
                        {savedMatch.opponentTargetElo === undefined
                          ? null
                          : ` · ${String(savedMatch.opponentTargetElo)} Elo`}
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
              {failureTitle(failure.operation)}
            </h1>
            <p className="text-mapachito-charcoal mt-4 max-w-lg leading-[1.55] font-semibold opacity-76">
              Your last verified local profile remains available. Retry the
              interrupted session operation.
            </p>
            <MapachessButton
              className="mt-6"
              onClick={() =>
                actor.send({ type: "MATCH_SESSION.RETRY_REQUESTED" })
              }
              type="button"
            >
              Retry
            </MapachessButton>
          </div>
        </section>
      ) : null}
    </GameFrame>
  )
}
