import provisionStockfishNativeInputs from "./provision.js"

const provisioned = await provisionStockfishNativeInputs()
process.stdout.write(
  `Verified Stockfish native inputs at ${provisioned.installDirectory}.\n`,
)
