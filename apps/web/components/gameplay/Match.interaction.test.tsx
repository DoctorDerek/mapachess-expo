// @vitest-environment happy-dom
import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import { selectMatchPosition } from "@mapachess/match/match-machine"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import { installDomHarness } from "../../test/domHarness"
import gamepadHarness from "../../test/gamepadHarness"
import { playableMatch } from "../../test/matchHarness"

installDomHarness()
const copy = loadCatalog("en")

describe("playable match composition and durable player actions", () => {
  it("routes real controller shortcuts between the board, controls, menu, and hint recovery", async ({
    onTestFinished,
  }) => {
    const pad = gamepadHarness()
    const { actor } = await playableMatch(onTestFinished)
    pad.press(3)
    expect(screen.getByRole("grid").contains(document.activeElement)).toBe(true)
    pad.press(3)
    expect(document.activeElement).toBe(
      screen.getByLabelText(copy.interface.matchCommands.matchMenu),
    )
    pad.press(9)
    expect(actor.getSnapshot().context.overlays).toEqual(["match-menu"])
    pad.press(1)
    await waitFor(() =>
      expect(actor.getSnapshot().context.overlays).toEqual([]),
    )
    pad.press(2)
    await screen.findByRole("button", {
      name: new RegExp(copy.gameplay.hints.controls.failure),
    })
    expect(screen.getByRole("grid")).toBeTruthy()
  })

  it("offers a draw using the accepted evaluation and persists its truthful result", async ({
    onTestFinished,
  }) => {
    const { profile } = await playableMatch(onTestFinished)
    fireEvent.click(
      screen.getByText(copy.interface.matchCommands.menu, { exact: true }),
    )
    const draw = screen.getByRole("button", {
      name: new RegExp(copy.interface.matchCommands.offerDraw),
    })
    await waitFor(() => expect(draw).toHaveProperty("disabled", false))
    fireEvent.click(draw)
    await screen.findByRole("button", {
      name: copy.interface.matchCelebration.reviewBoard,
    })
    expect(
      selectCurrentPlayerData(profile.actor.getSnapshot())?.activeMatch
        ?.conclusion,
    ).toEqual({ type: "draw-agreement" })
  })
  it("plays a legal exchange, then Undo/Redo restore exactly accepted board truth", async ({
    onTestFinished,
  }) => {
    const { session, profile } = await playableMatch(onTestFinished)
    const initial = selectMatchPosition(session.actor.getSnapshot())
    fireEvent.click(screen.getByRole("gridcell", { name: /^e2,/ }))
    fireEvent.click(screen.getByRole("gridcell", { name: /^e4,/ }))
    await waitFor(() =>
      expect(
        selectCurrentPlayerData(profile.actor.getSnapshot())?.activeMatch
          ?.cursor,
      ).toBe(2),
    )
    const after = selectMatchPosition(session.actor.getSnapshot())
    expect(after.fen).not.toBe(initial.fen)
    fireEvent.click(
      screen.getByRole("button", { name: copy.interface.matchCommands.undo }),
    )
    await waitFor(() =>
      expect(
        selectCurrentPlayerData(profile.actor.getSnapshot())?.activeMatch
          ?.cursor,
      ).toBeLessThan(2),
    )
    fireEvent.click(
      screen.getByRole("button", { name: copy.interface.matchCommands.redo }),
    )
    await waitFor(() =>
      expect(
        selectCurrentPlayerData(profile.actor.getSnapshot())?.activeMatch
          ?.cursor,
      ).toBe(2),
    )
    expect(selectMatchPosition(session.actor.getSnapshot())).toEqual(after)
  })
  it("dismisses the entire match menu in one Close despite expanded Move History", async ({
    onTestFinished,
  }) => {
    const { actor } = await playableMatch(onTestFinished)
    fireEvent.click(
      screen.getByText(copy.interface.matchCommands.menu, { exact: true }),
    )
    fireEvent.click(
      screen.getByText(copy.interface.webMatch.matchDetailsMoveHistory, {
        exact: true,
      }),
    )
    expect(actor.getSnapshot().context.overlays).toEqual([
      "match-menu",
      "match-details",
    ])
    fireEvent.click(
      screen.getByRole("button", { name: copy.shared.settingsControls.close }),
    )
    await waitFor(() =>
      expect(actor.getSnapshot().context.overlays).toEqual([]),
    )
    expect(screen.getByRole("grid")).toBeTruthy()
  })
  it("shows truthful accepted resignation rewards, dismisses them, and replays without another award", async ({
    onTestFinished,
  }) => {
    const { profile, actor } = await playableMatch(onTestFinished)
    fireEvent.click(
      screen.getByText(copy.interface.matchCommands.menu, { exact: true }),
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(copy.interface.matchCommands.resign),
      }),
    )
    const review = await screen.findByRole("button", {
      name: copy.interface.matchCelebration.reviewBoard,
    })
    const accepted = selectCurrentPlayerData(profile.actor.getSnapshot())
    expect(accepted?.totalXp).toBe(4)
    expect(accepted?.activeMatch?.conclusion).toEqual({
      type: "resignation",
      winner: "black",
    })
    fireEvent.click(review)
    await waitFor(() =>
      expect(actor.getSnapshot().context.overlays).toEqual([]),
    )
    fireEvent.click(
      screen.getByRole("button", { name: copy.interface.webMatch.viewRewards }),
    )
    await screen.findByRole("button", {
      name: copy.interface.matchCelebration.reviewBoard,
    })
    expect(selectCurrentPlayerData(profile.actor.getSnapshot())).toEqual(
      accepted,
    )
  })
  it("retracts only the current result after Undo and reapplies it once after Redo", async ({
    onTestFinished,
  }) => {
    const { session, profile, actor } = await playableMatch(onTestFinished)
    act(() => session.actor.send({ type: "MATCH.RESIGN_REQUESTED" }))
    await screen.findByRole("button", {
      name: copy.interface.matchCelebration.reviewBoard,
    })
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.matchCelebration.reviewBoard,
      }),
    )
    await waitFor(() =>
      expect(actor.getSnapshot().context.overlays).toEqual([]),
    )
    fireEvent.click(
      screen.getByRole("button", { name: copy.interface.matchCommands.undo }),
    )
    await waitFor(() =>
      expect(
        selectCurrentPlayerData(profile.actor.getSnapshot())?.totalXp,
      ).toBe(0),
    )
    expect(
      screen.queryByRole("button", {
        name: copy.interface.webMatch.viewRewards,
      }),
    ).toBeNull()
    fireEvent.click(
      screen.getByRole("button", { name: copy.interface.matchCommands.redo }),
    )
    await waitFor(() =>
      expect(
        selectCurrentPlayerData(profile.actor.getSnapshot())?.totalXp,
      ).toBe(4),
    )
  })
})
