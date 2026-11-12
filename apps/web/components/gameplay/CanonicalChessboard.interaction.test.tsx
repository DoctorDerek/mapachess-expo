// @vitest-environment happy-dom
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import { listLegalMatchMoves } from "@mapachess/match/match-move"
import {
  createInitialMatchPosition,
  reconstructMatchPosition,
} from "@mapachess/match/match-position"
import { installDomHarness } from "../../test/domHarness"
import gamepadHarness from "../../test/gamepadHarness"
import PlayerInputProvider from "../input/PlayerInputProvider"
import CanonicalChessboard from "./CanonicalChessboard"

installDomHarness()

function board(
  position = createInitialMatchPosition({
    variant: "standard",
    chess960PositionId: null,
  }),
) {
  const onMove = vi.fn()
  const props = {
    disabled: false,
    hints: null,
    legalMoves: listLegalMatchMoves(position),
    lastMove: null,
    onMove,
    orientation: "white" as const,
    position,
    showMoveHints: false,
  }
  const view = render(<CanonicalChessboard {...props} />)
  const square = (name: string) =>
    screen.getByRole("gridcell", { name: new RegExp("^" + name + ",") })
  return { ...view, props, onMove, square }
}

describe("interactive chessboard", () => {
  function position(fen: string, chess960 = false) {
    const id = parseChess960PositionId(0)
    if (!id.ok) throw new Error("The test Chess960 layout must exist.")
    const restored = reconstructMatchPosition(
      chess960
        ? { variant: "chess960", chess960PositionId: id.positionId }
        : { variant: "standard", chess960PositionId: null },
      fen,
    )
    if (!restored.ok) throw new Error(`The board fixture must be legal: ${fen}`)
    return restored.position
  }

  it.each(["queen", "rook", "bishop", "knight"] as const)(
    "requires an explicit %s promotion before committing",
    (role) => {
      const view = board(position("7k/P7/8/8/8/8/8/4K3 w - - 0 1"))
      fireEvent.click(view.square("a7"))
      fireEvent.click(view.square("a8"))
      const dialog = screen.getByRole("dialog", { name: "Promote on a8" })
      expect(view.onMove).not.toHaveBeenCalled()
      expect(document.activeElement).toBe(
        within(dialog).getByRole("button", { name: "Promote to queen" }),
      )
      fireEvent.click(
        within(dialog).getByRole("button", { name: `Promote to ${role}` }),
      )
      const choice = view.props.legalMoves.find(
        (move) => move.kind === "normal" && move.promotion === role,
      )
      expect(view.onMove).toHaveBeenCalledExactlyOnceWith(choice?.id)
      expect(screen.queryByRole("dialog")).toBeNull()
      expect(document.activeElement).toBe(view.square("a7"))
    },
  )

  it.each(["button", "Escape"])(
    "cancels promotion via %s without moving or losing board focus",
    (method) => {
      const view = board(position("7k/P7/8/8/8/8/8/4K3 w - - 0 1"))
      fireEvent.click(view.square("a7"))
      fireEvent.click(view.square("a8"))
      if (method === "button")
        fireEvent.click(
          screen.getByRole("button", { name: "Cancel promotion" }),
        )
      else
        fireEvent(
          screen.getByRole("dialog"),
          new Event("cancel", { cancelable: true }),
        )
      expect(screen.queryByRole("dialog")).toBeNull()
      expect(view.onMove).not.toHaveBeenCalled()
      expect(document.activeElement).toBe(view.square("a7"))
    },
  )

  it("keeps promotion choices inactive while a canonical write disables the board", () => {
    const view = board(position("7k/P7/8/8/8/8/8/4K3 w - - 0 1"))
    fireEvent.click(view.square("a7"))
    fireEvent.click(view.square("a8"))
    view.rerender(<CanonicalChessboard {...view.props} disabled />)
    const choice = screen.getByRole("button", { name: "Promote to queen" })
    expect(choice.hasAttribute("disabled")).toBe(true)
    fireEvent.click(choice)
    fireEvent.click(view.square("e1"))
    expect(view.onMove).not.toHaveBeenCalled()
  })

  it.each(["normal", "castle"] as const)(
    "disambiguates Chess960 king movement from castling: %s",
    (kind) => {
      const view = board(position("r4k1r/8/8/8/8/8/8/R4K1R w HAha - 0 1", true))
      fireEvent.click(view.square("f1"))
      fireEvent.click(view.square("g1"))
      const dialog = screen.getByRole("dialog", {
        name: "Choose your move to g1",
      })
      expect(view.onMove).not.toHaveBeenCalled()
      const move = view.props.legalMoves.find(
        (candidate) =>
          candidate.kind === kind &&
          candidate.from === "f1" &&
          candidate.to === "g1",
      )
      if (move === undefined)
        throw new Error("Both king movement and castling must be legal.")
      const copy = loadCatalog("en").board
      const label =
        move.kind === "castle"
          ? copy.castle(move.san, move.to, move.rookTo)
          : copy.moveKing(move.to)
      const choice = within(dialog).getByRole("button", { name: label })
      fireEvent.click(choice)
      expect(view.onMove).toHaveBeenCalledExactlyOnceWith(move?.id)
    },
  )

  it("permits Chess960 castling by selecting the participating rook", () => {
    const view = board(position("r5kr/8/8/8/8/8/8/R5KR w HAha - 0 1", true))
    fireEvent.click(view.square("g1"))
    fireEvent.click(view.square("h1"))
    expect(view.onMove).toHaveBeenCalledExactlyOnceWith("g1h1")
  })

  it("describes both sides' hints and castling without changing turn or legal moves", () => {
    const view = board(position("r5kr/8/8/8/8/8/8/R5KR w HAha - 0 1", true))
    const hints = {
      requestId: "board-hints",
      positionFen: view.props.position.fen,
      player: [
        {
          color: "white" as const,
          from: "g1" as const,
          to: "g1" as const,
          uci: "g1h1",
          castling: {
            rookFrom: "h1" as const,
            rookTo: "f1" as const,
            side: "king" as const,
          },
        },
      ],
      opponent: [
        {
          color: "black" as const,
          from: "a8" as const,
          to: "a7" as const,
          uci: "a8a7",
        },
      ],
    }
    view.rerender(
      <CanonicalChessboard {...view.props} hints={hints} showMoveHints />,
    )
    expect(view.square("g1").getAttribute("aria-label")).toMatch(
      /Player.*hint.*castl/i,
    )
    expect(view.square("a7").getAttribute("aria-label")).toMatch(
      /Opponent.*a8/i,
    )
    view.rerender(<CanonicalChessboard {...view.props} hints={hints} />)
    expect(view.square("a8").getAttribute("aria-label")).toMatch(
      /Opponent.*hint/i,
    )
    expect(view.square("a7").getAttribute("aria-label")).not.toMatch(/hint/i)
    expect(view.props.position.turn).toBe("white")
    expect(view.onMove).not.toHaveBeenCalled()
  })

  it("routes controller movement, piece cycling, confirmation, and cancellation through the board scope", () => {
    const pad = gamepadHarness()
    const view = board()
    view.rerender(
      <PlayerInputProvider profileActor={null}>
        <CanonicalChessboard {...view.props} />
      </PlayerInputProvider>,
    )
    act(() => view.square("e2").focus())
    pad.press(0)
    expect(view.square("e2").getAttribute("aria-selected")).toBe("true")
    pad.press(1)
    expect(view.square("e2").getAttribute("aria-selected")).toBe("false")
    pad.press(5)
    const next = document.activeElement
    expect(next).not.toBe(view.square("e2"))
    pad.press(4)
    expect(document.activeElement).toBe(view.square("e2"))
    pad.press(12)
    expect(document.activeElement).toBe(view.square("e3"))
    pad.press(13)
    pad.press(0)
    pad.press(12)
    pad.press(12)
    pad.press(0)
    expect(view.onMove).toHaveBeenCalledExactlyOnceWith("e2e4")
  })
  it.each(["e2", "d2", "g1", "b1"])(
    "selects a legal own piece at %s without committing a move",
    (from) => {
      const { onMove, square } = board()
      fireEvent.click(square(from))
      expect(square(from).getAttribute("aria-selected")).toBe("true")
      expect(onMove).not.toHaveBeenCalled()
    },
  )
  it.each([
    ["e2", "e4"],
    ["d2", "d4"],
    ["g1", "f3"],
    ["b1", "c3"],
  ] as const)(
    "commits %s to %s through the actual legal destination",
    (from, to) => {
      const { onMove, square } = board()
      fireEvent.click(square(from))
      fireEvent.click(square(to))
      expect(onMove).toHaveBeenCalledExactlyOnceWith(from + to)
      expect(square(from).getAttribute("aria-selected")).not.toBe("true")
    },
  )
  it("clears selection when clicking an empty non-destination", () => {
    const { onMove, square } = board()
    fireEvent.click(square("e2"))
    fireEvent.click(square("a5"))
    expect(onMove).not.toHaveBeenCalled()
    expect(square("e2").getAttribute("aria-selected")).not.toBe("true")
  })
  it("does not move an opponent piece", () => {
    const { onMove, square } = board()
    fireEvent.click(square("e7"))
    fireEvent.click(square("e5"))
    expect(onMove).not.toHaveBeenCalled()
  })
  it("changes the selected own piece", () => {
    const { square } = board()
    fireEvent.click(square("e2"))
    fireEvent.click(square("d2"))
    expect(square("d2").getAttribute("aria-selected")).toBe("true")
    expect(square("e2").getAttribute("aria-selected")).not.toBe("true")
  })
  it("rejects all input while disabled", () => {
    const view = board()
    view.rerender(<CanonicalChessboard {...view.props} disabled />)
    fireEvent.click(view.square("e2"))
    fireEvent.click(view.square("e4"))
    expect(view.onMove).not.toHaveBeenCalled()
  })
  it.each([
    ["ArrowRight", "f2"],
    ["ArrowLeft", "d2"],
    ["ArrowUp", "e3"],
    ["ArrowDown", "e1"],
  ] as const)("moves keyboard focus with %s", (key, destination) => {
    const { square } = board()
    square("e2").focus()
    fireEvent.keyDown(square("e2"), { key })
    expect(document.activeElement).toBe(square(destination))
  })
  it("reverses keyboard navigation for a black-oriented board", () => {
    const view = board()
    view.rerender(<CanonicalChessboard {...view.props} orientation="black" />)
    view.square("e2").focus()
    fireEvent.keyDown(view.square("e2"), { key: "ArrowRight" })
    expect(document.activeElement).toBe(view.square("d2"))
    expect(
      within(screen.getByRole("grid")).getAllByRole("gridcell"),
    ).toHaveLength(64)
  })
})
