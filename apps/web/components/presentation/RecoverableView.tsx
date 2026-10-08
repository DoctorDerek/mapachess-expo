"use client"

import { Component, useEffect, useRef, type ReactNode } from "react"
import captureError, {
  type ErrorDiagnostic,
} from "@mapachess/diagnostics/error-diagnostic"
import MapachessButton from "./MapachessButton"

type RecoveryProps = Readonly<{
  title: string
  description: string
  actions?: ReactNode
}>

function Recovery({
  title,
  description,
  actions,
  onRetry,
}: RecoveryProps & Readonly<{ onRetry: () => void }>) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus({ preventScroll: true }), [])
  return (
    <section
      className="bg-mapachito-white text-mapachito-charcoal mx-auto my-6 grid max-w-2xl gap-4 rounded-xl p-6"
      role="alert"
    >
      <h2
        ref={heading}
        tabIndex={-1}
        className="text-2xl font-black outline-none"
      >
        {title}
      </h2>
      <p>{description}</p>
      <div className="flex flex-wrap gap-3">
        <MapachessButton onClick={onRetry}>Try again</MapachessButton>
        {actions}
      </div>
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
