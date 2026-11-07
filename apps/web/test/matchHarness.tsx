import { cleanup, render } from "@testing-library/react"
import type { TestContext } from "vitest"
import { createActor, waitFor } from "xstate"
import { DEFAULT_CHALLENGE_SETUP } from "@mapachess/match/challenge-setup"
import createInitialPlayerData from "@mapachess/profile/player-data"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import WebGame from "../components/gameplay/WebGame"
import PlayerInputProvider from "../components/input/PlayerInputProvider"
import MapachessLocaleProvider from "../components/profile/MapachessLocaleProvider"
import useWebNavigationHistory from "../lib/gameplay/useWebNavigationHistory"
import type { WebMatchRuntime } from "../lib/gameplay/webMatchRuntime"
import { openFreshWebMatchSession } from "../lib/gameplay/webMatchSession"
import webMatchSessionMachine, {
  type WebMatchSessionActor,
} from "../lib/gameplay/webMatchSessionMachine"
import { webMatchId } from "../lib/gameplay/webOpponent"
import { readyProfile } from "./domHarness"

export async function playableMatch(
  onTestFinished: TestContext["onTestFinished"],
) {
  const initial = createInitialPlayerData()
  const profile = await readyProfile(onTestFinished, {
    ...initial,
    introductionCompleted: true,
    settings: { ...initial.settings, autoHintMode: "no-auto-hints" },
  })
  const matchSeed = parseDeterministicRandomSeed(
    "0123456789abcdef0123456789abcdef",
    "DOM match fixture",
  )
  const startingPosition = {
    variant: "standard",
    chess960PositionId: null,
  } as const
  const runtime: WebMatchRuntime = {
    matchSeed,
    startingPosition,
    matchId: webMatchId(matchSeed, startingPosition, {
      mode: "challenge",
      playerColor: "white",
    }),
    playerColor: "white",
    opponentId: "chicken-stockfish",
    opponentPolicyFingerprint: "dom-integration-fixture",
    opponentTargetElo: 100,
    ratedOpponentElo: 100,
    engineIdentity: {
      author: "Test fixture",
      name: "Deterministic legal-move fixture",
      optionNames: [],
    },
    close: async () => undefined,
    opponent: {
      selectMove: async ({ legalMoves }) => {
        const first = legalMoves[0]
        if (first === undefined)
          throw new Error("The fixture requires a legal reply.")
        return first.id
      },
    },
    hintAnalyst: {
      analyze: async () => {
        throw new Error("The fixture analysis is unavailable.")
      },
    },
    positionEvaluator: async ({ position, requestId }) => ({
      evaluation: { kind: "draw" },
      positionFen: position.fen,
      requestId,
    }),
  }
  const session = await openFreshWebMatchSession({
    mode: "challenge",
    challengeSetup: DEFAULT_CHALLENGE_SETUP,
    previousSession: null,
    profileActor: profile.actor,
    signal: new AbortController().signal,
    openRuntime: async () => runtime,
  })
  const actor = createActor(webMatchSessionMachine, {
    input: {
      activeMatchExists: true,
      operations: {
        canNavigate: () => profile.actor.getSnapshot().matches("ready"),
        openCurrentMatch: async () => session,
        openFreshMatch: async () => {
          throw new Error("This fixture does not restart an engine.")
        },
        returnToMenu: async () => undefined,
      },
    },
  }).start()
  onTestFinished(async () => {
    cleanup()
    actor.stop()
    await session.close()
  })
  await waitFor(actor, (snapshot) => snapshot.matches("active"))
  function Game({
    sessionActor,
  }: Readonly<{ sessionActor: WebMatchSessionActor }>) {
    const navigation = useWebNavigationHistory(sessionActor)
    return (
      <PlayerInputProvider profileActor={profile.actor}>
        <MapachessLocaleProvider actor={profile.actor}>
          <WebGame
            actor={sessionActor}
            profileActor={profile.actor}
            navigation={navigation}
            onSettingsRequested={() => navigation.open("settings")}
            settingsButtonRef={null}
            settingsOpen={false}
          />
        </MapachessLocaleProvider>
      </PlayerInputProvider>
    )
  }
  return { ...render(<Game sessionActor={actor} />), profile, actor, session }
}
