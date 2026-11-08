import type {
  StockfishEngineConfiguration,
  StockfishEngineSession,
} from "@mapachess/stockfish/engine-session"
import createRecoverableStockfishSession from "@mapachess/stockfish/recoverable-session"
import bindNativeStockfishSession, {
  type NativeStockfishBridge,
} from "./bindNativeStockfishSession.js"
import NativeStockfishSession, {
  StockfishNativeSessionError,
} from "./nativeStockfishSession.js"

export async function loadNativeStockfishBridge(): Promise<NativeStockfishBridge> {
  const { default: bridge } = await import("./NativeMapachessStockfish.js")
  if (bridge === null) {
    throw new StockfishNativeSessionError(
      "unavailable",
      "The native Stockfish module is not available in this application.",
    )
  }
  return bridge
}

export default function createNativeStockfishSession(
  configuration: StockfishEngineConfiguration,
  bridge: NativeStockfishBridge,
): StockfishEngineSession {
  return createRecoverableStockfishSession(
    () =>
      new NativeStockfishSession(
        configuration,
        bindNativeStockfishSession(bridge),
      ),
  )
}
