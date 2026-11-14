// @vitest-environment happy-dom
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import MatchSetupEditor from "@mapachess/application-ui/match-setup-editor"
import type {
  SetupEditor,
  SetupEditorValues,
} from "@mapachess/gameplay/match-setup"
import loadCatalog from "@mapachess/localization/catalog"
import createInitialPlayerData from "@mapachess/profile/player-data"
import applyStoryMatchResult from "@mapachess/profile/story-progress"
import webSetupElements from "@/components/gameplay/WebSetupElements"
import { installDomHarness } from "@/test/domHarness"
import completedStoryMatch from "../../../../packages/profile/test/storyProgressTestSupport"

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
      copy={copy}
      elements={webSetupElements}
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
  it("preserves a staged candidate through occlusion, then discards it on Cancel", () => {
    const done = vi.fn()
    const cancel = vi.fn()
    const renderEditor = (visible: boolean) => (
      <MatchSetupEditor
        copy={copy}
        elements={webSetupElements}
        editor="hints"
        mode="story"
        variant="standard"
        initialValues={values}
        onDone={done}
        onCancel={cancel}
        disabled={false}
        active={false}
        visible={visible}
        storyProgress={progress}
      />
    )
    const view = render(renderEditor(true))
    fireEvent.click(
      screen.getByRole("radio", {
        name: copy.setup.autoHints["auto-move-hints"].label,
      }),
    )
    view.rerender(renderEditor(false))
    expect(screen.queryByRole("dialog")).toBeNull()
    view.rerender(renderEditor(true))
    expect(
      screen.getByRole("radio", {
        name: copy.setup.autoHints["auto-move-hints"].label,
      }),
    ).toHaveProperty("checked", true)
    fireEvent.click(screen.getByRole("button", { name: copy.setup.cancel }))
    expect(cancel).toHaveBeenCalledOnce()
    expect(done).not.toHaveBeenCalled()
    view.unmount()
    render(renderEditor(true))
    expect(
      screen.getByRole("radio", {
        name: copy.setup.autoHints[values.hints].label,
      }),
    ).toHaveProperty("checked", true)
  })
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
