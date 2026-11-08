import { assertStableText } from "@mapachess/stockfish/engine-validation"
import type { Spec } from "./NativeMapachessStockfish.js"
import type {
  NativeEvent,
  NativeStockfishModuleBoundary,
} from "./nativeStockfishBoundary.js"

type NativeEventName =
  "onBestMove" | "onClosed" | "onFailure" | "onReady" | "onSearchInformation"

export type NativeStockfishBridge = Readonly<
  Pick<Spec, "boot" | "close" | "createSession" | "startSearch" | "stop"> & {
    [Event in NativeEventName]: NativeEvent<
      Parameters<Parameters<Spec[Event]>[0]>[0]
    >
  }
>

function bindEvent<Payload>(
  event: NativeEvent<Readonly<{ sessionId: string; payload: Payload }>>,
  sessionId: string,
): NativeEvent<Payload> {
  return (listener) =>
    event((message) => {
      if (message.sessionId === sessionId) return listener(message.payload)
    })
}

export default function bindNativeStockfishSession(
  bridge: NativeStockfishBridge,
): NativeStockfishModuleBoundary {
  const sessionId = bridge.createSession()
  assertStableText(sessionId, "native session identity")

  return Object.freeze<NativeStockfishModuleBoundary>({
    boot: (configuration) => bridge.boot(sessionId, configuration),
    close: () => bridge.close(sessionId),
    onBestMove: bindEvent(bridge.onBestMove, sessionId),
    onClosed: (listener) =>
      bridge.onClosed((message) => {
        if (message.sessionId === sessionId) return listener(undefined)
      }),
    onFailure: bindEvent(bridge.onFailure, sessionId),
    onReady: bindEvent(bridge.onReady, sessionId),
    onSearchInformation: bindEvent(bridge.onSearchInformation, sessionId),
    startSearch: (request) => bridge.startSearch(sessionId, request),
    stop: (requestId) => bridge.stop(sessionId, requestId),
  })
}
