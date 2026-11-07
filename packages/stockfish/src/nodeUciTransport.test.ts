import { describe, expect, it, onTestFinished } from "vitest"
import createNodeUciTransport from "./nodeUciTransport"

describe("owned Node UCI process transport", () => {
  it("exchanges newline-delimited commands, bounds diagnostics, and observes a real process exit", async () => {
    const transport = createNodeUciTransport(process.execPath, [
      "-e",
      'process.stdin.setEncoding("utf8"); process.stdin.on("data", value => { if(value.trim() === "quit") process.exit(0); process.stderr.write("x".repeat(5000)); process.stdout.write("echo:"+value); });',
    ])
    onTestFinished(() => transport.terminate())
    const lines = transport.lines[Symbol.asyncIterator]()
    await transport.writeLine("uci")
    expect(await lines.next()).toEqual({ done: false, value: "echo:uci" })
    await expect.poll(() => transport.diagnosticText().length).toBe(4096)
    await transport.writeLine("quit")
    expect(await transport.waitForExit()).toEqual({ code: 0, signal: null })
    await transport.terminate()
  })

  it("terminates its own running process and returns the observed exit", async () => {
    const transport = createNodeUciTransport(process.execPath, [
      "-e",
      'process.stdout.write("ready\\n"); setInterval(()=>{},1000)',
    ])
    onTestFinished(() => transport.terminate())
    expect(await transport.lines[Symbol.asyncIterator]().next()).toEqual({
      done: false,
      value: "ready",
    })
    await transport.terminate()
    const exit = await transport.waitForExit()
    expect(exit.code !== 0 || exit.signal !== null).toBe(true)
  })

  it("preserves spawn failure and allows cleanup without masking the error", async () => {
    const transport = createNodeUciTransport(
      "mapachess-nonexistent-test-executable",
    )
    const failed = expect(transport.waitForExit()).rejects.toMatchObject({
      code: "ENOENT",
    })
    await failed
    await expect(transport.terminate()).resolves.toBeUndefined()
  })
})
