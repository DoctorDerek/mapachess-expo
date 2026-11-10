// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import createInitialPlayerData from "@mapachess/profile/player-data"
import applyStoryMatchResult from "@mapachess/profile/story-progress"
import completedStoryMatch from "../../../../packages/profile/test/storyProgressTestSupport"
import { installDomHarness } from "../../test/domHarness"
import MatchSetupEditor, {
  type SetupEditor,
  type SetupEditorValues,
} from "./MatchSetupEditor"

installDomHarness()
const copy = loadCatalog("en")
const player = createInitialPlayerData()
const progress = applyStoryMatchResult(
  applyStoryMatchResult(player.storyProgress, completedStoryMatch()),
  { ...completedStoryMatch(), opponentId: "bunny-stockfish" },
)
const values: SetupEditorValues = {
  player: "raccoon-stockfish",
  opponent: "chicken-stockfish",
  hints: "no-auto-hints",
  "time-control": { type: "untimed" },
}

function edit(
  editor: SetupEditor,
  mode: "story" | "challenge" = "story",
  initialValues = values,
) {
  const done = vi.fn()
  const cancel = vi.fn()
  const view = render(
    <MatchSetupEditor
      editor={editor}
      mode={mode}
      variant="standard"
      initialValues={initialValues}
      onDone={done}
      onCancel={cancel}
      disabled={false}
      active={false}
      storyProgress={progress}
    />,
  )
  return { ...view, done, cancel, dialog: within(screen.getByRole("dialog")) }
}

describe("private player and opponent setup drafts", () => {
  it("previews an unlocked player animal without accepting it until Done, and never enables locked animals", () => {
    const view = edit("player")
    const chicken = view.dialog.getByRole("radio", { name: /Chicken/ })
    fireEvent.click(chicken)
    expect(chicken).toHaveProperty("checked", true)
    expect(view.done).not.toHaveBeenCalled()
    expect(values.player).toBe("raccoon-stockfish")
    expect(view.dialog.getByRole("radio", { name: /Dog/ })).toHaveProperty(
      "disabled",
      true,
    )
    fireEvent.click(view.dialog.getByRole("button", { name: copy.setup.done }))
    expect(view.done).toHaveBeenCalledExactlyOnceWith({
      ...values,
      player: "chicken-stockfish",
    })
  })

  it.each(["story", "challenge"] as const)(
    "selects an unlocked %s opponent independently from the player animal",
    (mode) => {
      const view = edit("opponent", mode)
      const bunny = view.dialog.getByRole("radio", { name: /Bunny Stockfish/ })
      const label = bunny.closest("label")
      if (label === null)
        throw new Error("Animal selection must have a visible label.")
      fireEvent.pointerEnter(label, { pointerType: "mouse" })
      fireEvent.focus(bunny)
      fireEvent.blur(bunny)
      fireEvent.pointerLeave(label)
      fireEvent.click(bunny)
      expect(view.done).not.toHaveBeenCalled()
      fireEvent.click(
        view.dialog.getByRole("button", { name: copy.setup.done }),
      )
      expect(view.done).toHaveBeenCalledExactlyOnceWith({
        ...values,
        opponent: "bunny-stockfish",
      })
    },
  )

  it("keeps an incomplete player draft uncommittable while Cancel remains available", () => {
    const missingPlayer = edit("player", "story", {
      ...values,
      player: undefined,
    })
    expect(
      missingPlayer.dialog.getByRole("button", { name: copy.setup.done }),
    ).toHaveProperty("disabled", true)
    fireEvent.click(
      missingPlayer.dialog.getByRole("button", { name: copy.setup.cancel }),
    )
    expect(missingPlayer.cancel).toHaveBeenCalledOnce()
    expect(missingPlayer.done).not.toHaveBeenCalled()
  })
})
