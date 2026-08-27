import provisionStockfishWebRuntime from "./webRuntimeProvision.js"

try {
  const provisioned = await provisionStockfishWebRuntime(
    process.argv[2] ?? process.cwd(),
  )
  process.stdout.write(
    `Provisioned the pinned Stockfish web runtime at ${provisioned.runtimeDirectory}\n`,
  )
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Stockfish web provisioning failed: ${message}\n`)
  process.exitCode = 1
}
