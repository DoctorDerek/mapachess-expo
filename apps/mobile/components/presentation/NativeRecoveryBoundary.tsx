import { Component, type ReactNode } from "react"
import { View } from "react-native"
import captureError, {
  type ErrorDiagnostic,
} from "@mapachess/diagnostics/error-diagnostic"
import NativeButton from "./NativeButton"
import NativeText from "./NativeText"

export default class NativeRecoveryBoundary extends Component<
  Readonly<{
    children: ReactNode
    title: string
    description: string
    retryLabel: string
    recovery?: ReactNode
    onRecovery?: () => void
  }>,
  Readonly<{ failure: ErrorDiagnostic | null }>
> {
  public state: Readonly<{ failure: ErrorDiagnostic | null }> = {
    failure: null,
  }
  public static getDerivedStateFromError(
    error: unknown,
  ): Readonly<{ failure: ErrorDiagnostic }> {
    return { failure: captureError(error) }
  }
  public componentDidCatch(): void {
    this.props.onRecovery?.()
  }
  public render(): ReactNode {
    return this.state.failure !== null ? (
      <View className="bg-mapachito-charcoal flex-1 justify-center gap-4 p-4">
        <NativeText accessibilityRole="alert" className="font-native text-2xl">
          {this.props.title}
        </NativeText>
        <NativeText>{this.props.description}</NativeText>
        <NativeButton onPress={() => this.setState({ failure: null })}>
          {this.props.retryLabel}
        </NativeButton>
        {this.props.recovery}
      </View>
    ) : (
      this.props.children
    )
  }
}
