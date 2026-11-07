// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react"
import { createRef } from "react"
import { describe, expect, it, onTestFinished, vi } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import createInitialPlayerData from "@mapachess/profile/player-data"
import applyStoryMatchResult, {
  selectStoryLadder,
} from "@mapachess/profile/story-progress"
import completedStoryMatch from "../../../../packages/profile/test/storyProgressTestSupport"
import { installDomHarness } from "../../test/domHarness"
import MatchCelebration from "./MatchCelebration"
import StoryLadderProgress from "./StoryLadderProgress"

installDomHarness()
const copy = loadCatalog("en")
const completed = completedStoryMatch()

function celebrate(match: DurableMatchRecord = completed, finished = false) {
  let storyProgress = applyStoryMatchResult(
    createInitialPlayerData().storyProgress,
    completed,
  )
  if (finished)
    for (const step of selectStoryLadder(storyProgress, "standard"))
      storyProgress = applyStoryMatchResult(storyProgress, {
        ...completed,
        opponentId: step.opponent.id,
      })
  const dismiss = vi.fn()
  const setup = vi.fn()
  const replay = vi.fn()
  const restore = document.createElement("button")
  restore.textContent = "Return to the existing board"
  document.body.append(restore)
  onTestFinished(() => restore.remove())
  const restoreFocusRef = createRef<HTMLElement>()
  restoreFocusRef.current = restore
  const props = {
    disabled: false,
    battleStageRef: vi.fn(),
    match,
    onDismiss: dismiss,
    onSetupRequested: setup,
    onReplayRequested: replay,
    restoreFocusRef,
    reward: null,
    storyProgress,
    showSaveConfirmation: false,
  }
  const view = render(<MatchCelebration {...props} />)
  return { ...view, dismiss, setup, replay, restore, props }
}

describe("accepted-results choices and focus recovery", () => {
  it("shows completed and next-unlocked Story choices without offering locked opponents as playable controls", () => {
    const progress = applyStoryMatchResult(
      createInitialPlayerData().storyProgress,
      completed,
    )
    const selected = vi.fn()
    const props = {
      progress,
      variant: "standard" as const,
      selection: {
        disabled: false,
        opponentId: "chicken-stockfish" as const,
        onSelected: selected,
      },
    }
    const view = render(<StoryLadderProgress {...props} />)
    const bunny = screen.getByRole("radio", { name: /Bunny Stockfish/ })
    fireEvent.click(bunny)
    expect(selected).toHaveBeenCalledExactlyOnceWith("bunny-stockfish")
    expect(screen.getAllByRole("radio")).toHaveLength(2)
    expect(
      screen.getByText(
        copy.gameplay.nextUnlocked(copy.animals.opponent("bunny-stockfish")),
      ),
    ).toBeTruthy()
    view.rerender(
      <StoryLadderProgress
        {...props}
        selection={{ ...props.selection, disabled: true }}
      />,
    )
    fireEvent.click(screen.getByRole("radio", { name: /Bunny Stockfish/ }))
    expect(selected).toHaveBeenCalledOnce()
  })

  it("shows complete progress without selection controls and explains all Story opponents are defeated", () => {
    let progress = createInitialPlayerData().storyProgress
    for (const variant of ["standard", "chess960"] as const)
      for (const step of selectStoryLadder(progress, variant))
        progress = applyStoryMatchResult(progress, {
          ...completedStoryMatch(variant),
          opponentId: step.opponent.id,
        })
    render(<StoryLadderProgress progress={progress} variant="chess960" />)
    expect(screen.getByText(copy.shared.story.allDefeated)).toBeTruthy()
    expect(screen.queryByRole("radio")).toBeNull()
    expect(
      screen.getAllByText(copy.gameplay.storyCompletion(100)),
    ).toHaveLength(3)
    expect(
      screen.getByRole("list", { name: copy.shared.story.opponents }).tabIndex,
    ).toBe(0)
  })
  it("offers the actual next unlocked Story opponent and restores board focus after dismissal", () => {
    const view = celebrate()
    expect(document.activeElement).toBe(
      screen.getByRole("button", {
        name: copy.interface.matchCelebration.reviewBoard,
      }),
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(copy.gameplay.resultActions.next),
      }),
    )
    expect(view.setup).toHaveBeenCalledExactlyOnceWith({
      mode: "story",
      variant: "standard",
      opponentId: "bunny-stockfish",
    })
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { cancelable: true }),
    )
    expect(view.dismiss).toHaveBeenCalledOnce()
    view.unmount()
    expect(document.activeElement).toBe(view.restore)
  })

  it("replays a lost Story opponent instead of advancing the ladder", () => {
    const view = celebrate({
      ...completed,
      conclusion: { type: "checkmate", winner: "white" },
    })
    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(copy.gameplay.resultActions.replay),
      }),
    )
    expect(view.setup).toHaveBeenCalledExactlyOnceWith({
      mode: "story",
      variant: "standard",
      opponentId: "chicken-stockfish",
    })
    expect(view.replay).not.toHaveBeenCalled()
  })

  it("replays the chosen Challenge opponent without substituting Story setup", () => {
    const view = celebrate({
      ...completed,
      mode: "challenge",
      opponentTargetElo: 500,
    })
    const replay = screen.getByRole("button", {
      name: new RegExp(copy.gameplay.resultActions.replay),
    })
    expect(replay.textContent).toContain("500")
    fireEvent.click(replay)
    expect(view.replay).toHaveBeenCalledOnce()
    expect(view.setup).not.toHaveBeenCalled()
  })

  it("returns to the ladder after all Story opponents are completed", () => {
    const view = celebrate(completed, true)
    expect(
      screen.getByText(copy.interface.matchCelebration.storyComplete),
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", { name: copy.gameplay.resultActions.ladder }),
    )
    expect(view.setup).toHaveBeenCalledExactlyOnceWith({
      mode: "story",
      variant: "standard",
    })
  })

  it.each(["resignation", "timeout"] as const)(
    "explains a victory by %s without changing the next-opponent action",
    (type) => {
      const view = celebrate({
        ...completed,
        conclusion: { type, winner: completed.playerColor },
      })
      expect(
        screen.getByRole("heading", {
          name: copy.gameplay.defeatedOpponent(
            copy.animals.opponent(completed.opponentId),
          ),
        }),
      ).toBeTruthy()
      expect(
        screen.getByText(
          type === "resignation"
            ? copy.interface.matchCelebration.opponentResigned
            : copy.gameplay.conclusion.opponentTimedOut(
                copy.animals.opponent(completed.opponentId),
              ),
        ),
      ).toBeTruthy()
      fireEvent.click(
        screen.getByRole("button", {
          name: new RegExp(copy.gameplay.resultActions.next),
        }),
      )
      expect(view.setup).toHaveBeenCalledOnce()
    },
  )

  it("keeps Review Board available while result-changing actions are disabled", () => {
    const view = celebrate()
    view.rerender(<MatchCelebration {...view.props} disabled />)
    const dialog = within(screen.getByRole("dialog"))
    const next = dialog.getByRole("button", {
      name: new RegExp(copy.gameplay.resultActions.next),
    })
    expect(next.hasAttribute("disabled")).toBe(true)
    fireEvent.click(next)
    expect(view.setup).not.toHaveBeenCalled()
    fireEvent.click(
      dialog.getByRole("button", {
        name: copy.interface.matchCelebration.reviewBoard,
      }),
    )
    expect(view.dismiss).toHaveBeenCalledOnce()
  })
})
