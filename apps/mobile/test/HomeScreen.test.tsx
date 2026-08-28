import { describe, expect, it, jest } from "@jest/globals"
import { act, render, screen } from "@testing-library/react-native"
import HomeScreen from "@/app/index"
import runNativeStockfishProof, {
  type EngineProofProgress,
  type EngineProofResult,
} from "@/lib/runNativeStockfishProof"

jest.mock("@/lib/runNativeStockfishProof", () => ({
  __esModule: true,
  default: jest.fn(),
  ENGINE_PROOF_STEPS: [
    { id: "boot", label: "Boot embedded Stockfish" },
    { id: "cancel", label: "Cancel and drain an active search" },
    { id: "search", label: "Complete a deterministic search" },
    { id: "close", label: "Close the native engine session" },
  ],
}))

const mockedRunNativeStockfishProof = jest.mocked(runNativeStockfishProof)

function deferred<Result>(): Readonly<{
  promise: Promise<Result>
  resolve: (result: Result) => void
}> {
  let resolvePromise: ((result: Result) => void) | undefined
  const promise = new Promise<Result>((resolve) => {
    resolvePromise = resolve
  })

  if (resolvePromise === undefined) {
    throw new Error("Deferred promise did not initialize its resolver.")
  }

  return { promise, resolve: resolvePromise }
}

function proofInvocation(): readonly [
  AbortSignal,
  (progress: EngineProofProgress) => void,
] {
  const invocation = mockedRunNativeStockfishProof.mock.calls[0]
  if (invocation === undefined) {
    throw new Error("The native engine proof was not invoked.")
  }
  return invocation
}

describe("HomeScreen", () => {
  it("presents running progress through native accessibility semantics", async () => {
    const proof = deferred<EngineProofResult>()
    mockedRunNativeStockfishProof.mockReturnValue(proof.promise)
    const rendered = await render(<HomeScreen />)

    expect(screen.getByRole("header", { name: "Mapachess" })).toBeOnTheScreen()
    expect(
      screen.getByLabelText("Boot embedded Stockfish: Running"),
    ).toBeOnTheScreen()
    expect(
      screen.getByLabelText("Cancel and drain an active search: Pending"),
    ).toBeOnTheScreen()

    const [, reportProgress] = proofInvocation()
    await act(async () => {
      reportProgress({ completedSteps: ["boot"], currentStep: "cancel" })
      await Promise.resolve()
    })

    expect(
      screen.getByLabelText("Boot embedded Stockfish: Complete"),
    ).toBeOnTheScreen()
    expect(
      screen.getByLabelText("Cancel and drain an active search: Running"),
    ).toBeOnTheScreen()
    expect(
      screen.getByLabelText("Complete a deterministic search: Pending"),
    ).toBeOnTheScreen()

    await rendered.unmount()
  })

  it("presents a successful native proof and completed steps", async () => {
    const proof = deferred<EngineProofResult>()
    mockedRunNativeStockfishProof.mockReturnValue(proof.promise)
    await render(<HomeScreen />)

    await act(async () => {
      proof.resolve({
        bestMove: "e2e4",
        completedSteps: ["boot", "cancel", "search", "close"],
        engineName: "Stockfish 18",
        nodeLimit: 10_000,
        status: "passed",
      })
      await proof.promise
    })

    expect(screen.getByText("Passed")).toBeOnTheScreen()
    expect(screen.getByText("Proof passed")).toBeOnTheScreen()
    expect(
      screen.getByText(
        "Stockfish 18 completed 10,000 nodes and selected e2e4.",
      ),
    ).toBeOnTheScreen()
    expect(screen.getAllByText("Complete")).toHaveLength(4)
  })

  it("presents the failed step and engine error without hiding progress", async () => {
    const proof = deferred<EngineProofResult>()
    mockedRunNativeStockfishProof.mockReturnValue(proof.promise)
    await render(<HomeScreen />)

    await act(async () => {
      proof.resolve({
        completedSteps: ["boot"],
        failedStep: "cancel",
        message: "Cancellation proof did not drain the active search.",
        status: "failed",
      })
      await proof.promise
    })

    expect(screen.getAllByText("Failed")).toHaveLength(2)
    expect(screen.getByText("Proof failed")).toBeOnTheScreen()
    expect(
      screen.getByText("Cancellation proof did not drain the active search."),
    ).toBeOnTheScreen()
    expect(
      screen.getByLabelText("Boot embedded Stockfish: Complete"),
    ).toBeOnTheScreen()
    expect(
      screen.getByLabelText("Cancel and drain an active search: Failed"),
    ).toBeOnTheScreen()
  })

  it("aborts the native proof when the screen unmounts", async () => {
    const proof = deferred<EngineProofResult>()
    mockedRunNativeStockfishProof.mockReturnValue(proof.promise)
    const rendered = await render(<HomeScreen />)
    const [signal] = proofInvocation()

    expect(signal.aborted).toBe(false)
    await rendered.unmount()
    expect(signal.aborted).toBe(true)
  })
})
