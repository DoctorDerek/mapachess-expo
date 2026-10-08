import { runInNewContext } from "node:vm"
import { describe, expect, it } from "vitest"
import captureError, {
  getErrorMessage,
  MAX_DIAGNOSTIC_CHARACTERS,
} from "../src/errorDiagnostic.js"

describe("local error diagnostics", () => {
  it.each([
    { error: new Error("Engine stopped"), message: "Engine stopped" },
    {
      error: { message: "Storage unavailable", code: "IO" },
      message: "Storage unavailable",
    },
    { error: " Export failed ", message: "Export failed" },
    { error: "  ", message: "Unknown error." },
    { error: undefined, message: "undefined" },
    { error: null, message: "null" },
    { error: false, message: "false" },
    { error: 42, message: "42" },
    { error: 42n, message: "42" },
    { error: Symbol("failure"), message: "Symbol(failure)" },
    { error: { code: "IO" }, message: '{"code":"IO"}' },
    { error: { message: 503 }, message: '{"message":503}' },
    { error: { message: "" }, message: '{"message":""}' },
  ])(
    "normalizes $message without losing the original cause",
    ({ error, message }) => {
      expect(getErrorMessage(error)).toBe(message)
      const diagnostic = captureError(error)
      expect(diagnostic.message).toBe(message)
      expect(diagnostic.cause).toBe(error)
      expect(Object.isFrozen(diagnostic)).toBe(true)
    },
  )

  it("recognizes an Error from another realm without relying on instanceof", () => {
    const error: unknown = runInNewContext('new Error("Worker realm failure")')
    expect(error).not.toBeInstanceOf(Error)
    expect(captureError(error)).toEqual({
      message: "Worker realm failure",
      cause: error,
    })
  })

  it("reads a structural message getter only once", () => {
    let reads = 0
    const error = {
      get message() {
        reads += 1
        return reads === 1 ? "Original failure" : undefined
      },
    }
    expect(getErrorMessage(error)).toBe("Original failure")
    expect(reads).toBe(1)
  })

  it("falls back safely for circular and null-prototype values", () => {
    const circular: { self?: unknown } = {}
    circular.self = circular
    const noPrototype: unknown = Object.create(null)
    expect(getErrorMessage(circular)).toBe("[object Object]")
    expect(getErrorMessage(noPrototype)).toBe("{}")
  })

  it("does not let broken inspection replace the actual failure", () => {
    const error = {
      get message(): never {
        throw new Error("Message getter failed")
      },
      [Symbol.toPrimitive](): never {
        throw new Error("Coercion failed")
      },
    }
    expect(captureError(error)).toEqual({
      message: "Unknown error.",
      cause: error,
    })
    const { proxy, revoke } = Proxy.revocable({}, {})
    revoke()
    expect(getErrorMessage(proxy)).toBe("Unknown error.")
  })

  it("handles unsuccessful JSON conversion and empty string coercion", () => {
    const error = { toJSON: () => undefined, toString: () => "" }
    expect(getErrorMessage(error)).toBe("Unknown error.")
    const throwingJson = {
      toJSON(): never {
        throw new Error("JSON failed")
      },
    }
    expect(getErrorMessage(throwingJson)).toBe("[object Object]")
  })

  it("bounds the captured message while retaining the complete Error and stack", () => {
    const source = new Error("Root cause")
    const error = new Error("x".repeat(MAX_DIAGNOSTIC_CHARACTERS + 100), {
      cause: source,
    })
    const diagnostic = captureError(error)
    expect(diagnostic.message).toHaveLength(MAX_DIAGNOSTIC_CHARACTERS)
    expect(diagnostic.cause).toBe(error)
    expect(error.cause).toBe(source)
    expect(error.stack).toContain(error.message)
    expect(error.message.length).toBe(MAX_DIAGNOSTIC_CHARACTERS + 100)
    expect(Object.isFrozen(error)).toBe(false)
  })
})
