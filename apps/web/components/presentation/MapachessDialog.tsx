import cx from "classix"
import { useLayoutEffect, useRef, type ReactNode } from "react"
import { usePlayerInputScope } from "../input/PlayerInputProvider"

function openModalAncestorsFirst(dialog: HTMLDialogElement | null): void {
  const ancestors: HTMLDialogElement[] = []
  for (
    let current = dialog;
    current !== null;
    current = current.parentElement?.closest("dialog") ?? null
  ) {
    ancestors.push(current)
  }
  for (const ancestor of ancestors.reverse()) {
    if (!ancestor.open) ancestor.showModal()
  }
}

export default function MapachessDialog({
  children,
  label,
  onClose,
  fixedContent = false,
  placement = "center",
}: Readonly<{
  children: ReactNode
  label: string
  onClose: () => void
  fixedContent?: boolean | "fit"
  placement?: "center" | "bottom"
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
    openModalAncestorsFirst(element)
    return () => {
      element?.close()
      if (
        trigger instanceof HTMLElement &&
        trigger.isConnected &&
        !element?.contains(trigger)
      )
        trigger.focus({ preventScroll: true })
    }
  }, [])

  return (
    <dialog
      aria-label={label}
      className={cx(
        "bg-mapachito-white text-mapachito-charcoal fixed inset-0 w-full overscroll-contain p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop:bg-black/60",
        placement === "bottom"
          ? "mx-auto mt-auto mb-0 h-112 max-h-[calc(100dvh-1rem)] max-w-md rounded-t-xl"
          : "m-0 h-dvh max-h-dvh max-w-none xl:m-auto xl:max-h-[90dvh] xl:rounded-xl xl:p-6",
        placement === "center" &&
          (fixedContent === "fit" ? "xl:h-fit xl:max-w-2xl" : "xl:max-w-4xl"),
        placement === "center" &&
          fixedContent !== "fit" &&
          (fixedContent ? "xl:h-[90dvh]" : "xl:h-auto"),
        fixedContent ? "overflow-hidden" : "overflow-y-auto",
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
