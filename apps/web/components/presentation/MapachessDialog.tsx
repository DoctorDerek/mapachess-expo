import cx from "classix"
import { useLayoutEffect, useRef, type ReactNode } from "react"
import { usePlayerInputScope } from "../input/PlayerInputProvider"

export default function MapachessDialog({
  children,
  label,
  onClose,
  contentSized = false,
  fixedContent = false,
}: Readonly<{
  children: ReactNode
  label: string
  onClose: () => void
  contentSized?: boolean
  fixedContent?: boolean
}>) {
  const dialog = useRef<HTMLDialogElement>(null)
  usePlayerInputScope({
    root: dialog,
    handle: (action) => {
      if (action !== "cancel") return false
      onClose()
      return true
    },
  })

  useLayoutEffect(() => {
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
      aria-label={label}
      className={cx(
        "bg-mapachito-white text-mapachito-charcoal fixed inset-0 m-0 h-dvh max-h-dvh w-full max-w-none overflow-y-auto overscroll-contain p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop:bg-black/60 xl:m-auto xl:max-h-[90dvh] xl:max-w-4xl xl:rounded-xl xl:p-6",
        fixedContent ? "xl:h-[90dvh]" : contentSized ? "xl:h-fit" : "xl:h-auto",
      )}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      ref={dialog}
    >
      {children}
    </dialog>
  )
}
