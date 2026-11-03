import { webcrypto } from "node:crypto"
import { IDBFactory } from "fake-indexeddb"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
import { createActor, waitFor } from "xstate"
import loadCatalog from "@mapachess/localization/catalog"
import webMatchSessionMachine from "../../lib/gameplay/webMatchSessionMachine"
import * as matchImages from "../../lib/presentation/usePreparedMatchImages"
import openWebProfileRuntime from "../../lib/profile/openWebProfileRuntime"
import WebGame from "./WebGame"

it("shows all four modes on Home and only prepares match artwork after a mode is selected", async () => {
  const prepared = vi.spyOn(matchImages, "default")
  const profile = openWebProfileRuntime({
    indexedDb: new IDBFactory(),
    subtleCrypto: webcrypto.subtle,
  })
  const noGame = vi.fn(async () => {
    throw Error("Browsing must not start a match")
  })
  const actor = createActor(webMatchSessionMachine, {
    input: {
      activeMatchExists: false,
      operations: {
        canNavigate: () => true,
        openCurrentMatch: noGame,
        openFreshMatch: noGame,
        returnToMenu: async () => undefined,
      },
    },
  }).start()
  const render = () =>
    renderToStaticMarkup(
      <WebGame
        actor={actor}
        profileActor={profile.actor}
        navigation={{ back: vi.fn(), open: vi.fn(), close: vi.fn() }}
        onSettingsRequested={vi.fn()}
        settingsButtonRef={null}
        settingsOpen={false}
      />,
    )
  try {
    await waitFor(profile.actor, (snapshot) => snapshot.matches("ready"))
    const home = render()
    const copy = loadCatalog("en")
    for (const variant of ["standard", "chess960"] as const) {
      for (const mode of ["challenge", "story"] as const) {
        expect(home).toContain(copy.setup.presentations[variant][mode].title)
      }
    }
    expect(prepared).toHaveBeenLastCalledWith(null, expect.any(String))
    expect(home).not.toContain("/stockfish-runtime/")
    actor.send({
      type: "MATCH_SESSION.SETUP_REQUESTED",
      setup: {
        mode: "story",
        variant: "standard",
        opponentId: "chicken-stockfish",
      },
    })
    const setup = render()
    expect(setup).toContain(copy.setup.startMatch)
    expect(prepared).toHaveBeenLastCalledWith(
      "chicken-stockfish",
      expect.any(String),
    )
    expect(noGame).not.toHaveBeenCalled()
  } finally {
    prepared.mockRestore()
    actor.stop()
    await profile.close()
  }
})
