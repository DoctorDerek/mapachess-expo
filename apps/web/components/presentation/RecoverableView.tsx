"use client"

import { Component, useEffect, useRef, type ReactNode } from "react"
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
  Readonly<{ failed: boolean }>
> {
  override state = { failed: false }

  static getDerivedStateFromError(): Readonly<{ failed: boolean }> {
    return { failed: true }
  }

  override render() {
    return this.state.failed ? (
      <Recovery
        {...this.props}
        onRetry={() => this.setState({ failed: false })}
      />
    ) : (
      this.props.children
    )
  }
}
