import { describe, expect, it, vi } from "vitest"
import {
  StockfishOperationAbortedError,
  type StockfishEngineSession,
  type StockfishEngineSessionState,
  type StockfishSearchRequest,
} from "./engineSession.js"
import createRecoverableStockfishSession from "./recoverableSession.js"

const identity = { name: "Verified test engine", author: "Test" }
const request: StockfishSearchRequest = {
  requestId: "recovery/1",
  nodeLimit: 100,
  position: { fen: "8/8/8/8/8/4k3/8/4K3 w - - 0 1", moves: [] },
}

const engine = () => {
  let state: StockfishEngineSessionState = "created"
  const boot = vi.fn(async () => {
    state = "ready"
    return identity
  })
  const search = vi.fn(async (input: StockfishSearchRequest) => ({
    bestMove: "e1d1",
    requestId: input.requestId,
  }))
  const close = vi.fn(async () => {
    state = "closed"
  })
  return {
    session: {
      boot,
      search,
      close,
      state: () => state,
    } satisfies StockfishEngineSession,
    boot,
    search,
    close,
    fail: () => {
      state = "failed"
    },
  }
}

describe("recoverable engine session", () => {
  it("surfaces the original failure, then boots a fresh session for the next request only", async () => {
    const first = engine()
    const second = engine()
    const open = vi
      .fn()
      .mockReturnValueOnce(first.session)
      .mockReturnValueOnce(second.session)
    const session = createRecoverableStockfishSession(open)
    await expect(session.boot()).resolves.toEqual(identity)
    const failure = new Error("Worker failed")
    first.search.mockImplementationOnce(async () => {
      first.fail()
      throw failure
    })
    await expect(session.search(request)).rejects.toBe(failure)
    expect(open).toHaveBeenCalledOnce()
    expect(first.search).toHaveBeenCalledOnce()
    const retried = { ...request, requestId: "recovery/2" }
    const controller = new AbortController()
    await expect(session.search(retried, controller.signal)).resolves.toEqual({
      bestMove: "e1d1",
      requestId: retried.requestId,
    })
    expect(first.close).toHaveBeenCalledOnce()
    expect(second.boot).toHaveBeenCalledWith(controller.signal)
    expect(second.search).toHaveBeenCalledWith(retried, controller.signal)
    expect(session.state()).toBe("ready")
    await session.close()
    expect(second.close).toHaveBeenCalledOnce()
  })

  it("does not replace a ready session after normal cancellation", async () => {
    const current = engine()
    const open = vi.fn(() => current.session)
    const session = createRecoverableStockfishSession(open)
    await session.boot()
    current.search.mockRejectedValueOnce(
      new StockfishOperationAbortedError("search"),
    )
    await expect(session.search(request)).rejects.toBeInstanceOf(
      StockfishOperationAbortedError,
    )
    await session.search(request)
    expect(open).toHaveBeenCalledOnce()
    expect(current.close).not.toHaveBeenCalled()
  })

  it("retries a factory failure on a later request without reviving a closed wrapper", async () => {
    const first = engine()
    const second = engine()
    const open = vi.fn(() => first.session)
    const session = createRecoverableStockfishSession(open)
    await session.boot()
    first.fail()
    open.mockImplementationOnce(() => {
      throw new Error("Worker denied")
    })
    await expect(session.search(request)).rejects.toThrow("Worker denied")
    expect(session.state()).toBe("failed")
    open.mockReturnValueOnce(second.session)
    await session.search(request)
    await session.close()
    await session.close()
    await expect(session.search(request)).rejects.toBeInstanceOf(
      StockfishOperationAbortedError,
    )
    expect(open).toHaveBeenCalledTimes(3)
    expect(second.close).toHaveBeenCalledOnce()
  })

  it("does not spawn a replacement after disposal during recovery", async () => {
    const first = engine()
    const gate = Promise.withResolvers<void>()
    const open = vi.fn(() => first.session)
    const session = createRecoverableStockfishSession(open)
    await session.boot()
    first.fail()
    first.close.mockImplementation(() => gate.promise)
    const searching = session.search(request)
    const rejected = expect(searching).rejects.toBeInstanceOf(
      StockfishOperationAbortedError,
    )
    const closing = session.close()
    gate.resolve()
    await Promise.all([rejected, closing])
    expect(open).toHaveBeenCalledOnce()
  })

  it("rejects overlapping operations and aborted recovery without extra workers", async () => {
    const first = engine()
    const gate = Promise.withResolvers<void>()
    const open = vi.fn(() => first.session)
    const session = createRecoverableStockfishSession(open)
    await session.boot()
    first.fail()
    first.close.mockImplementation(() => gate.promise)
    const controller = new AbortController()
    const searching = session.search(request, controller.signal)
    const rejected = expect(searching).rejects.toBeInstanceOf(
      StockfishOperationAbortedError,
    )
    await expect(session.search(request)).rejects.toThrow("active operation")
    controller.abort()
    gate.resolve()
    await rejected
    expect(open).toHaveBeenCalledOnce()
  })

  it("keeps replacement boot failure observable and allows a later fresh attempt", async () => {
    const first = engine()
    const second = engine()
    const third = engine()
    second.boot.mockImplementationOnce(async () => {
      second.fail()
      throw new Error("Identity mismatch")
    })
    const open = vi
      .fn()
      .mockReturnValueOnce(first.session)
      .mockReturnValueOnce(second.session)
      .mockReturnValueOnce(third.session)
    const session = createRecoverableStockfishSession(open)
    await session.boot()
    first.fail()
    await expect(session.search(request)).rejects.toThrow("Identity mismatch")
    expect(second.search).not.toHaveBeenCalled()
    await expect(session.search(request)).resolves.toMatchObject({
      requestId: request.requestId,
    })
    expect(open).toHaveBeenCalledTimes(3)
  })
})
