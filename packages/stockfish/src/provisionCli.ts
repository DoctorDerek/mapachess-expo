import provisionStockfish18 from "./provision.js"

try {
  const provisioned = await provisionStockfish18(
    process.argv[2] ?? process.cwd(),
  )
  process.stdout.write(
    `Provisioned Stockfish ${provisioned.identity.version} (${provisioned.target}) at ${provisioned.executablePath}\n`,
  )
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Stockfish provisioning failed: ${message}\n`)
  process.exitCode = 1
}
