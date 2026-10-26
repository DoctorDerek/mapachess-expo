"use client"

import cx from "classix"
import { Component, useEffect, useRef, type ReactNode } from "react"
import captureError, {
  type ErrorDiagnostic,
} from "@mapachess/diagnostics/error-diagnostic"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"
import MapachessButton from "./MapachessButton"
import ScrollActions from "./ScrollActions"

type RecoveryProps = Readonly<{
  title: string
  description: string
  actions?: ReactNode
  onRecovery?: () => void
  fillHeight?: boolean
}>

function Recovery({
  title,
  description,
  actions,
  onRetry,
  fillHeight = false,
}: RecoveryProps & Readonly<{ onRetry: () => void }>) {
  const messages = useMapachessCopy().interface.recoverableView

  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus({ preventScroll: true }), [])
  return (
    <section
      className={cx(
        "bg-mapachito-white text-mapachito-charcoal mx-auto min-h-0 max-w-2xl rounded-xl p-4",
        fillHeight ? "h-full" : "h-dvh",
      )}
      role="alert"
    >
      <ScrollActions
        actions={
          <div className="flex flex-wrap-reverse gap-3 [&>button]:min-w-0 [&>button]:flex-1 [&>button]:basis-32">
            {actions}
            <MapachessButton onClick={onRetry}>
              {messages.tryAgain}
            </MapachessButton>
          </div>
        }
      >
        <h2
          ref={heading}
          tabIndex={-1}
          className="text-2xl font-black outline-none"
        >
          {title}
        </h2>
        <p className="mt-4">{description}</p>
      </ScrollActions>
    </section>
  )
}

export default class RecoverableView extends Component<
  RecoveryProps & Readonly<{ children: ReactNode }>,
  Readonly<{ failure: ErrorDiagnostic | null }>
> {
  override state: Readonly<{ failure: ErrorDiagnostic | null }> = {
    failure: null,
  }

  static getDerivedStateFromError(
    error: unknown,
  ): Readonly<{ failure: ErrorDiagnostic }> {
    return { failure: captureError(error) }
  }

  override componentDidCatch(): void {
    this.props.onRecovery?.()
  }

  override render() {
    return this.state.failure !== null ? (
      <Recovery
        {...this.props}
        onRetry={() => this.setState({ failure: null })}
      />
    ) : (
      this.props.children
    )
  }
}
