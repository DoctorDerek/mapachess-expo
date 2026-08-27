import { spawn } from "node:child_process"
import { createInterface } from "node:readline"
import type {
  StockfishUciTransport,
  StockfishUciTransportExit,
} from "./uciTypes.js"

const MAX_STDERR_CHARACTERS = 4_096

export default function createNodeUciTransport(
  executablePath: string,
): StockfishUciTransport {
  const child = spawn(executablePath, [], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  })
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })
  let diagnosticText = ""

  child.stderr.setEncoding("utf8")
  child.stderr.on("data", (chunk: string) => {
    diagnosticText = `${diagnosticText}${chunk}`.slice(-MAX_STDERR_CHARACTERS)
  })

  const exit = new Promise<StockfishUciTransportExit>(
    (resolveExit, rejectExit) => {
      child.once("error", rejectExit)
      child.once("exit", (code, signal) => resolveExit({ code, signal }))
    },
  )

  return {
    lines,
    diagnosticText: () => diagnosticText,
    waitForExit: () => exit,
    writeLine: (line) =>
      new Promise<void>((resolveWrite, rejectWrite) => {
        child.stdin.write(`${line}\n`, (error) => {
          if (error === null || error === undefined) resolveWrite()
          else rejectWrite(error)
        })
      }),
    terminate: async () => {
      if (child.exitCode === null && child.signalCode === null) child.kill()

      try {
        await exit
      } catch {
        return
      }
    },
  }
}
