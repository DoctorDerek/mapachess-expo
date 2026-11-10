import { expect, it, vi } from "vitest"
import type { StockfishEngineSession } from "@mapachess/stockfish/engine-session"
import closeAfterFailedRuntimeOpen, {
  closeOwnedEngineSessions,
} from "../src/runtimeLifetime.js"

function engineFixture(error?: Error) {
  return {
    boot: async () => ({ author: "Test", name: "Stockfish" }),
    close: vi.fn(async () => {
      if (error !== undefined) throw error
    }),
    search: vi.fn<StockfishEngineSession["search"]>(),
    state: () => "ready",
  } satisfies StockfishEngineSession
}

const messages = {
  close: "Engine cleanup failed",
  openAndClose: "Startup and cleanup failed",
}

it("closes every acquired engine before preserving the original startup failure", async () => {
  const opening = new Error("Second engine did not open")
  const engines = [engineFixture(), engineFixture()]
  await expect(
    closeAfterFailedRuntimeOpen(engines, opening, messages),
  ).rejects.toBe(opening)
  for (const engine of engines) expect(engine.close).toHaveBeenCalledOnce()
})

it("keeps a single cleanup failure unchanged and still closes the other engine", async () => {
  const failure = new Error("Engine close failed")
  const survivor = engineFixture()
  await expect(
    closeOwnedEngineSessions(
      [engineFixture(failure), survivor],
      messages.close,
    ),
  ).rejects.toBe(failure)
  expect(survivor.close).toHaveBeenCalledOnce()
  await expect(
    closeAfterFailedRuntimeOpen([engineFixture(failure)], failure, messages),
  ).rejects.toMatchObject({
    message: messages.openAndClose,
    errors: [failure, failure],
  })
})

it("reports the startup failure and each failed cleanup in order", async () => {
  const opening = new Error("Startup failed")
  const first = new Error("Analysis close failed")
  const second = new Error("Opponent close failed")
  await expect(
    closeAfterFailedRuntimeOpen(
      [engineFixture(first), engineFixture(second)],
      opening,
      messages,
    ),
  ).rejects.toMatchObject({
    message: messages.openAndClose,
    errors: [opening, first, second],
  })
})
