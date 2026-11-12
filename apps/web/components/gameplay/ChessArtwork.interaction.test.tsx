// @vitest-environment happy-dom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import {
  CHESS_BOARDS,
  CHESS_PIECE_SETS,
} from "@mapachess/match-presentation/chess-appearance-catalog"
import { installDomHarness } from "../../test/domHarness"
import { controlledImages } from "../../test/presentationHarness"
import ChessAppearanceProvider, {
  ChessArtworkRecovery,
  ChessBoardArtwork,
  ChessPiece,
  useDisplayedChessAppearance,
} from "./ChessArtwork"
import PortraitViewport, { usePortraitViewport } from "./PortraitViewport"

installDomHarness()
const copy = loadCatalog("en")
const selectedPieces = CHESS_PIECE_SETS.find(
  (set) => set.kind === "artwork" && set.delivery === "public",
)
const selectedBoard = CHESS_BOARDS.find((board) => board.kind === "artwork")
if (selectedPieces === undefined || selectedBoard === undefined)
  throw new Error(
    "Artwork fixtures require one public piece set and one image board.",
  )
const appearance = { pieceSetId: selectedPieces.id, boardId: selectedBoard.id }
function Preview() {
  const displayed = useDisplayedChessAppearance()
  return (
    <>
      <output>{JSON.stringify(displayed)}</output>
      <ChessBoardArtwork />
      <ChessPiece color="white" role="queen" />
      <ChessArtworkRecovery />
    </>
  )
}

describe("chess artwork preparation and recovery", () => {
  it("keeps usable defaults until all selected assets decode, then recovers a board display error independently of its pieces", async () => {
    const images = controlledImages()
    const view = render(
      <ChessAppearanceProvider appearance={appearance}>
        <Preview />
      </ChessAppearanceProvider>,
    )
    expect(screen.getByRole("status").textContent).toBe(
      JSON.stringify({ pieceSetId: "current", boardId: "current" }),
    )
    await images.complete()
    expect(screen.getByRole("status").textContent).toBe(
      JSON.stringify(appearance),
    )
    const boardImage = view.container.querySelector("img")
    if (boardImage === null)
      throw new Error("The selected board image must be mounted.")
    fireEvent.error(boardImage)
    expect(screen.getByRole("alert").textContent).toContain(
      copy.interface.chessArtwork.selectedChessArtworkCouldNotLoadDefaults,
    )
    expect(screen.getByRole("status").textContent).toBe(
      JSON.stringify({ ...appearance, boardId: "current" }),
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.chessArtwork.retryChessArtwork,
      }),
    )
    await images.complete()
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByRole("status").textContent).toBe(
      JSON.stringify(appearance),
    )
  })

  it("allows a failed decode to retry without persisting a different player selection", async () => {
    const images = controlledImages()
    render(
      <ChessAppearanceProvider appearance={appearance}>
        <Preview />
      </ChessAppearanceProvider>,
    )
    await images.complete(false)
    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.getByRole("status").textContent).toBe(
      JSON.stringify({ pieceSetId: "current", boardId: "current" }),
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.chessArtwork.retryChessArtwork,
      }),
    )
    await images.complete()
    expect(screen.getByRole("status").textContent).toBe(
      JSON.stringify(appearance),
    )
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("does not let stale asset completion replace a newly selected default appearance", async () => {
    const images = controlledImages()
    const view = render(
      <ChessAppearanceProvider appearance={appearance}>
        <Preview />
      </ChessAppearanceProvider>,
    )
    view.rerender(
      <ChessAppearanceProvider
        appearance={{ pieceSetId: "current", boardId: "current" }}
      >
        <Preview />
      </ChessAppearanceProvider>,
    )
    await images.complete()
    expect(screen.getByRole("status").textContent).toBe(
      JSON.stringify({ pieceSetId: "current", boardId: "current" }),
    )
    expect(screen.queryByRole("alert")).toBeNull()
    view.unmount()
  })

  it("handles independent decorative preview load and error events without replacing the chosen live board", () => {
    const view = render(
      <>
        <ChessPiece
          color="black"
          role="knight"
          pieceSetId={appearance.pieceSetId}
          fitToSquare
        />
        <ChessBoardArtwork boardId={appearance.boardId} orientation="black" />
      </>,
    )
    const images = view.container.querySelectorAll("img")
    expect(images).toHaveLength(2)
    for (const image of images) {
      fireEvent.load(image)
      fireEvent.error(image)
    }
    expect(screen.queryByRole("alert")).toBeNull()
    expect(view.container.textContent).toContain("♞")
  })
})

describe("shared portrait viewport ownership", () => {
  it("shares one observer, notifies only observed portraits, and disconnects after its last owner leaves", async () => {
    let observation: IntersectionObserverCallback | undefined
    const observe = vi.fn()
    const unobserve = vi.fn()
    const disconnect = vi.fn()
    class Observer implements IntersectionObserver {
      root = null
      rootMargin = "10% 0%"
      scrollMargin = "10% 0%"
      thresholds = [0]
      constructor(callback: IntersectionObserverCallback) {
        observation = callback
      }
      observe = observe
      unobserve = unobserve
      disconnect = disconnect
      takeRecords = () => []
    }
    vi.stubGlobal("IntersectionObserver", Observer)
    function Portrait({ name }: { name: string }) {
      const { ref, near } = usePortraitViewport()
      return (
        <span ref={ref}>
          {name}: {near ? "near" : "away"}
        </span>
      )
    }
    const view = render(
      <PortraitViewport>
        <Portrait name="Hero" />
        <Portrait name="Opponent" />
      </PortraitViewport>,
    )
    expect(observe).toHaveBeenCalledTimes(2)
    const hero = screen.getByText("Hero: away")
    const callback = observation
    const instance = new Observer(() => undefined)
    if (callback === undefined)
      throw new Error("The viewport callback must be registered.")
    const rect = new DOMRect()
    const entry: IntersectionObserverEntry = {
      target: hero,
      time: 0,
      rootBounds: null,
      boundingClientRect: rect,
      intersectionRect: rect,
      intersectionRatio: 1,
      isIntersecting: true,
    }
    await act(async () => callback([entry], instance))
    await waitFor(() => expect(screen.getByText("Hero: near")).toBeTruthy())
    view.unmount()
    expect(unobserve).toHaveBeenCalledTimes(2)
    expect(disconnect).toHaveBeenCalledOnce()
  })
})
