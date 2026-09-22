import { useEffect, useId, useRef, type ReactNode } from "react"
import MapachessButton from "../presentation/MapachessButton"

export default function MatchSetupPicker({
  children,
  onDone,
  title,
}: Readonly<{
  children: ReactNode
  onDone: () => void
  title: string
}>) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const element = dialog.current
    const trigger = document.activeElement
    element?.showModal()
    return () => {
      element?.close()
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus({ preventScroll: true })
    }
  }, [])

  return (
    <dialog
      aria-labelledby={titleId}
      className="bg-mapachito-white text-mapachito-charcoal fixed inset-0 m-0 h-dvh max-h-dvh w-full max-w-none overflow-y-auto p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop:bg-black/60 xl:m-auto xl:h-auto xl:max-h-[90dvh] xl:max-w-4xl xl:rounded-xl xl:p-6"
      onCancel={(event) => {
        event.preventDefault()
        onDone()
      }}
      ref={dialog}
    >
      <header className="bg-mapachito-white sticky top-0 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 py-2">
        <h2 className="font-display text-2xl font-black" id={titleId}>
          {title}
        </h2>
        <MapachessButton onClick={onDone} type="button">
          <span aria-hidden="true">✓ </span>Done
        </MapachessButton>
      </header>
      {children}
    </dialog>
  )
}
