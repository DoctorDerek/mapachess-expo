import { useEffect, useState } from "react"
import { ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import runNativeStockfishProof, {
  ENGINE_PROOF_STEPS,
  type EngineProofProgress,
  type EngineProofResult,
  type EngineProofStep,
} from "@/lib/runNativeStockfishProof"

type EngineProofViewState =
  | Readonly<{
      completedSteps: readonly EngineProofStep[]
      currentStep: EngineProofStep
      status: "running"
    }>
  | EngineProofResult

const INITIAL_VIEW_STATE = {
  completedSteps: [],
  currentStep: "boot",
  status: "running",
} as const satisfies EngineProofViewState

function stepStatus(
  step: EngineProofStep,
  state: EngineProofViewState,
): "complete" | "failed" | "pending" | "running" {
  if (state.completedSteps.includes(step)) return "complete"
  if (state.status === "failed" && state.failedStep === step) return "failed"
  if (state.status === "running" && state.currentStep === step) return "running"
  return "pending"
}

function statusPresentation(status: ReturnType<typeof stepStatus>): Readonly<{
  classes: string
  label: string
  symbol: string
}> {
  if (status === "complete") {
    return { classes: "text-emerald-300", label: "Complete", symbol: "✓" }
  }
  if (status === "failed") {
    return { classes: "text-rose-300", label: "Failed", symbol: "×" }
  }
  if (status === "running") {
    return { classes: "text-amber-200", label: "Running", symbol: "→" }
  }
  return { classes: "text-slate-500", label: "Pending", symbol: "○" }
}

function ProofStep({
  id,
  label,
  state,
}: Readonly<{
  id: EngineProofStep
  label: string
  state: EngineProofViewState
}>) {
  const presentation = statusPresentation(stepStatus(id, state))

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${presentation.label}`}
      className="flex-row items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-4"
    >
      <Text className={`text-xl font-bold ${presentation.classes}`}>
        {presentation.symbol}
      </Text>
      <View className="flex-1">
        <Text className="text-base font-semibold text-slate-100">{label}</Text>
        <Text className={`mt-1 text-sm ${presentation.classes}`}>
          {presentation.label}
        </Text>
      </View>
    </View>
  )
}

function ProofResult({ state }: Readonly<{ state: EngineProofViewState }>) {
  if (state.status === "running") {
    return (
      <Text className="text-base leading-6 text-amber-100">
        Native engine verification is running…
      </Text>
    )
  }

  if (state.status === "failed") {
    return (
      <View className="gap-2">
        <Text className="text-lg font-bold text-rose-300">Proof failed</Text>
        <Text selectable className="text-base leading-6 text-rose-100">
          {state.message}
        </Text>
      </View>
    )
  }

  return (
    <View className="gap-2">
      <Text className="text-lg font-bold text-emerald-300">Proof passed</Text>
      <Text selectable className="text-base leading-6 text-emerald-100">
        {state.engineName} completed {state.nodeLimit.toLocaleString()} nodes
        and selected {state.bestMove}.
      </Text>
    </View>
  )
}

export default function HomeScreen() {
  const [state, setState] = useState<EngineProofViewState>(INITIAL_VIEW_STATE)

  useEffect(() => {
    const abortController = new AbortController()
    const updateProgress = (progress: EngineProofProgress): void => {
      if (abortController.signal.aborted) return
      setState({ ...progress, status: "running" })
    }

    void runNativeStockfishProof(abortController.signal, updateProgress).then(
      (result) => {
        if (!abortController.signal.aborted) setState(result)
      },
    )

    return () => abortController.abort()
  }, [])

  const overallStatus =
    state.status === "running"
      ? "Running"
      : state.status === "passed"
        ? "Passed"
        : "Failed"

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <ScrollView
        contentContainerClassName="flex-grow px-5 py-8"
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="mx-auto w-full max-w-xl gap-6">
          <View className="gap-2">
            <Text
              accessibilityRole="header"
              className="text-4xl font-bold text-slate-50"
            >
              Mapachess
            </Text>
            <Text className="text-xl font-semibold text-amber-200">
              Native Engine Proof
            </Text>
            <Text className="text-base leading-6 text-slate-300">
              Self-contained EAS build. No development server required.
            </Text>
          </View>

          <View
            accessibilityLiveRegion="polite"
            className="rounded-2xl border border-slate-700 bg-slate-900 p-4"
          >
            <Text className="text-sm font-semibold tracking-widest text-slate-400 uppercase">
              Overall status
            </Text>
            <Text className="mt-2 text-2xl font-bold text-slate-50">
              {overallStatus}
            </Text>
          </View>

          <View className="gap-3">
            {ENGINE_PROOF_STEPS.map((step) => (
              <ProofStep key={step.id} {...step} state={state} />
            ))}
          </View>

          <View
            accessibilityLiveRegion="polite"
            className="rounded-2xl border border-slate-700 bg-slate-900 p-4"
          >
            <ProofResult state={state} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
