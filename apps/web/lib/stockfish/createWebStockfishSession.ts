import type { StockfishEngineConfiguration } from "@mapachess/stockfish/engine-session"
import createStockfishUciSession, {
  type StockfishUciSession,
} from "@mapachess/stockfish/uci-session"
import {
  STOCKFISH_18_WEB_LOADER_ARTIFACT,
  STOCKFISH_18_WEB_UCI_EXPECTATION,
} from "@mapachess/stockfish/web-runtime-identity"
import createWebWorkerUciTransport from "./webWorkerUciTransport"

export const STOCKFISH_WEB_WORKER_URL =
  `/stockfish-runtime/${STOCKFISH_18_WEB_LOADER_ARTIFACT.fileName}` as const
export const STOCKFISH_WEB_WORKER_NAME = "mapachess-stockfish-18" as const

export type CreateWebStockfishSessionOptions = Readonly<{
  workerName?: string
}>

export default function createWebStockfishSession(
  configuration: StockfishEngineConfiguration,
  options: CreateWebStockfishSessionOptions = {},
): StockfishUciSession {
  const worker = new Worker(STOCKFISH_WEB_WORKER_URL, {
    name: options.workerName ?? STOCKFISH_WEB_WORKER_NAME,
  })

  return createStockfishUciSession({
    configuration,
    expectedIdentity: STOCKFISH_18_WEB_UCI_EXPECTATION,
    transport: createWebWorkerUciTransport(worker),
  })
}
