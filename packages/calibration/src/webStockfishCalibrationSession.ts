import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import type {
  StockfishEngineConfiguration,
  StockfishEngineSession,
} from "@mapachess/stockfish/engine-session"
import { createNodeUciTransport } from "@mapachess/stockfish/uci-process-adapter"
import createStockfishUciSession from "@mapachess/stockfish/uci-session"
import {
  STOCKFISH_18_WEB_LOADER_ARTIFACT,
  STOCKFISH_18_WEB_UCI_EXPECTATION,
  STOCKFISH_18_WEB_WASM_ARTIFACT,
} from "@mapachess/stockfish/web-runtime-identity"
import {
  resolveStockfishWebRuntimeDirectory,
  validateWebRuntimeArtifactBytes,
} from "@mapachess/stockfish/web-runtime-provision"

const EXECUTION_DIRECTORY_PREFIX = "mapachess-web-calibration-"

export default async function openWebStockfishCalibrationSession(
  workspaceRoot: string,
  configuration: StockfishEngineConfiguration,
): Promise<StockfishEngineSession> {
  const runtimeDirectory = resolveStockfishWebRuntimeDirectory(workspaceRoot)
  const loader = await readFile(
    join(runtimeDirectory, STOCKFISH_18_WEB_LOADER_ARTIFACT.fileName),
  )
  const wasm = await readFile(
    join(runtimeDirectory, STOCKFISH_18_WEB_WASM_ARTIFACT.fileName),
  )
  validateWebRuntimeArtifactBytes(loader, STOCKFISH_18_WEB_LOADER_ARTIFACT)
  validateWebRuntimeArtifactBytes(wasm, STOCKFISH_18_WEB_WASM_ARTIFACT)

  const temporaryRoot = resolve(tmpdir())
  const executionDirectory = resolve(
    await mkdtemp(join(temporaryRoot, EXECUTION_DIRECTORY_PREFIX)),
  )
  if (
    dirname(executionDirectory) !== temporaryRoot ||
    !basename(executionDirectory).startsWith(EXECUTION_DIRECTORY_PREFIX)
  ) {
    throw new Error(
      "Web calibration execution directory must belong to its temporary root.",
    )
  }
  const removeExecutionDirectory = () =>
    rm(executionDirectory, { recursive: true, force: true })

  try {
    const loaderPath = join(
      executionDirectory,
      STOCKFISH_18_WEB_LOADER_ARTIFACT.fileName.replace(/\.js$/, ".cjs"),
    )
    await writeFile(loaderPath, loader)
    await writeFile(
      join(executionDirectory, STOCKFISH_18_WEB_WASM_ARTIFACT.fileName),
      wasm,
    )
    const session = createStockfishUciSession({
      configuration,
      expectedIdentity: STOCKFISH_18_WEB_UCI_EXPECTATION,
      transport: createNodeUciTransport(process.execPath, [loaderPath]),
    })

    return {
      ...session,
      close: async () => {
        try {
          await session.close()
        } finally {
          await removeExecutionDirectory()
        }
      },
    }
  } catch (error) {
    await removeExecutionDirectory()
    throw error
  }
}
