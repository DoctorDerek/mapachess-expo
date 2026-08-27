import createStockfishUciSession, {
  type StockfishUciConfiguration,
  type StockfishUciSession,
} from "@mapachess/stockfish/uci-session"
import {
  STOCKFISH_18_WEB_LOADER_ARTIFACT,
  STOCKFISH_18_WEB_UCI_EXPECTATION,
} from "@mapachess/stockfish/web-runtime-identity"
import createWebWorkerUciTransport from "./webWorkerUciTransport"

export const STOCKFISH_WEB_WORKER_URL =
  `/stockfish-runtime/${STOCKFISH_18_WEB_LOADER_ARTIFACT.fileName}` as const

export default function createWebStockfishSession(
  configuration: StockfishUciConfiguration,
): StockfishUciSession {
  const worker = new Worker(STOCKFISH_WEB_WORKER_URL, {
    name: "mapachess-stockfish-18",
  })

  return createStockfishUciSession({
    configuration,
    expectedIdentity: STOCKFISH_18_WEB_UCI_EXPECTATION,
    transport: createWebWorkerUciTransport(worker),
  })
}
