import cx from "classix"
import {
  useLayoutEffect,
  useRef,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react"
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

function isOutsideDialog({
  currentTarget,
  target,
  clientX,
  clientY,
}: MouseEvent<HTMLDialogElement>) {
  if (target !== currentTarget) return false
  const { left, right, top, bottom } = currentTarget.getBoundingClientRect()
  return (
    clientX < left || clientX >= right || clientY < top || clientY >= bottom
  )
}

export default function MapachessDialog({
  children,
  label,
  onClose,
  fixedContent = false,
  placement = "center",
  closeOnMenu = false,
  initialFocus,
  returnFocus,
}: Readonly<{
  children: ReactNode
  label: string
  onClose: () => void
  fixedContent?: boolean | "fit"
  placement?: "center" | "bottom" | "bottom-to-center"
  closeOnMenu?: boolean
  initialFocus?: RefObject<HTMLElement | null>
  returnFocus?: RefObject<HTMLElement | null> | undefined
}>) {
  const dialog = useRef<HTMLDialogElement>(null)
  const startedOnBackdrop = useRef(false)
  const centersAtXl = placement === "bottom-to-center"
  const fittingBottom = placement !== "center" && fixedContent === "fit"
  usePlayerInputScope({
    root: dialog,
    handle: (action) => {
      if (action !== "cancel" && !(closeOnMenu && action === "menu"))
        return false
      onClose()
      return true
    },
  })

  useLayoutEffect(() => {
    const element = dialog.current
    const trigger = returnFocus?.current ?? document.activeElement
    openModalAncestorsFirst(element)
    if (fittingBottom)
      initialFocus?.current?.scrollIntoView({ block: "nearest" })
    initialFocus?.current?.focus({ preventScroll: true })
    return () => {
      element?.close()
      if (
        trigger instanceof HTMLElement &&
        trigger.isConnected &&
        !element?.contains(trigger)
      )
        trigger.focus({ preventScroll: true })
    }
  }, [fittingBottom, initialFocus, returnFocus])

  return (
    <dialog
      aria-label={label}
      className={cx(
        "bg-mapachito-white text-mapachito-charcoal fixed inset-0 w-full overscroll-contain p-4 px-[min(--spacing(4),5vw)] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop:bg-black/60",
        placement !== "center"
          ? cx(
              "mx-auto mt-auto mb-0 max-h-[calc(100dvh-1rem)] max-w-md rounded-t-xl",
              fittingBottom
                ? cx(
                    "h-fit",
                    centersAtXl &&
                      "xl:m-auto xl:max-h-[90dvh] xl:max-w-lg xl:rounded-xl xl:p-6 xl:[--dialog-dismiss-on-backdrop:1]",
                  )
                : "h-112",
            )
          : "m-0 h-dvh max-h-dvh max-w-none xl:m-auto xl:max-h-[90dvh] xl:rounded-xl xl:p-6",
        placement === "center" &&
          (fixedContent === "fit" ? "xl:h-fit xl:max-w-2xl" : "xl:max-w-4xl"),
        placement === "center" &&
          fixedContent !== "fit" &&
          (fixedContent ? "xl:h-[90dvh]" : "xl:h-auto"),
        fixedContent && !fittingBottom ? "overflow-hidden" : "overflow-y-auto",
      )}
      onCancel={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }}
      onPointerDown={
        centersAtXl
          ? (event) => {
              startedOnBackdrop.current =
                event.isPrimary && event.button === 0 && isOutsideDialog(event)
            }
          : undefined
      }
      onClick={
        centersAtXl
          ? (event) => {
              const dismiss =
                startedOnBackdrop.current && isOutsideDialog(event)
              startedOnBackdrop.current = false
              if (
                dismiss &&
                getComputedStyle(event.currentTarget)
                  .getPropertyValue("--dialog-dismiss-on-backdrop")
                  .trim() === "1"
              )
                onClose()
            }
          : undefined
      }
      ref={dialog}
    >
      {children}
    </dialog>
  )
}
