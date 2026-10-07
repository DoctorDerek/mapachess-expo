import {
  StockfishOperationAbortedError,
  type StockfishEngineIdentity,
  type StockfishEngineSearchResult,
  type StockfishEngineSession,
} from "./engineSession.js"
import {
  assertStockfishOperationNotAborted,
  validateStockfishSearchRequest,
} from "./engineValidation.js"

export default function createRecoverableStockfishSession<
  Identity extends StockfishEngineIdentity,
  SearchResult extends StockfishEngineSearchResult,
>(
  open: () => StockfishEngineSession<Identity, SearchResult>,
): StockfishEngineSession<Identity, SearchResult> {
  let session = open()
  let busy = false
  let closed = false
  let replacementNeeded = false
  let closing: Promise<void> | undefined

  const assertOpen = (signal?: AbortSignal): void => {
    assertStockfishOperationNotAborted(signal, "session operation")
    if (closed) throw new StockfishOperationAbortedError("closed session")
  }

  const replaceFailedSession = async (
    signal?: AbortSignal,
  ): Promise<boolean> => {
    if (session.state() !== "failed" && !replacementNeeded) return false
    replacementNeeded = true
    await session.close()
    assertOpen(signal)
    session = open()
    replacementNeeded = false
    return true
  }

  const operate = async <Result>(
    operation: () => Promise<Result>,
    signal?: AbortSignal,
  ): Promise<Result> => {
    assertOpen(signal)
    if (busy) throw new Error("Stockfish already has an active operation.")
    busy = true
    try {
      const result = await operation()
      assertOpen(signal)
      return result
    } finally {
      busy = false
    }
  }

  return {
    boot: (signal) =>
      operate(async () => {
        await replaceFailedSession(signal)
        return session.boot(signal)
      }, signal),
    search: (request, signal) =>
      operate(async () => {
        validateStockfishSearchRequest(request)
        if (await replaceFailedSession(signal)) {
          await session.boot(signal)
          assertOpen(signal)
        }
        return session.search(request, signal)
      }, signal),
    close: () => {
      closed = true
      closing ??= session.close()
      return closing
    },
    state: () =>
      closed ? "closed" : replacementNeeded ? "failed" : session.state(),
  }
}
