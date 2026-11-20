import cx from "classix"
import {
  useLayoutEffect,
  useRef,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react"
import { inputControls } from "../../lib/input/webFocusNavigation"
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
  onBackdrop,
  fixedContent = false,
  placement = "center",
  closeOnMenu = false,
  initialFocus,
  returnFocus,
  descriptionId,
  alert = false,
  suspended = false,
  animateSheet = false,
  leaving = false,
  onExitComplete,
}: Readonly<{
  children: ReactNode
  descriptionId?: string
  alert?: boolean
  suspended?: boolean
  animateSheet?: boolean
  leaving?: boolean
  onExitComplete?: () => void
  label: string
  onClose: () => void
  onBackdrop?: () => void
  fixedContent?: boolean | "fit"
  placement?: "center" | "bottom" | "bottom-to-center"
  closeOnMenu?: boolean
  initialFocus?: RefObject<HTMLElement | null>
  returnFocus?: RefObject<HTMLElement | null> | undefined
}>) {
  const dialog = useRef<HTMLDialogElement>(null)
  const startedOnBackdrop = useRef(false)
  const movingPress = useRef(false)
  const slide = () =>
    dialog.current
      ?.getAnimations?.()
      .find(
        (animation) =>
          "transitionProperty" in animation &&
          animation.transitionProperty === "transform",
      )
  useLayoutEffect(() => {
    if (!leaving) return
    let current = true
    const transition = slide()
    if (!transition) onExitComplete?.()
    else {
      const finish = () => {
        if (current) onExitComplete?.()
      }
      void transition.finished.then(finish, finish)
    }
    return () => {
      current = false
    }
  }, [leaving, onExitComplete])
  const centersAtXl = placement === "bottom-to-center"
  const fittingBottom = placement !== "center" && fixedContent === "fit"
  usePlayerInputScope({
    root: dialog,
    handle: (action) => {
      if (leaving || suspended) return true
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
      aria-describedby={descriptionId}
      role={alert ? "alertdialog" : undefined}
      data-leaving={leaving || undefined}
      data-suspended={suspended || undefined}
      className={cx(
        "bg-mapachito-white text-mapachito-charcoal fixed inset-0 w-full overscroll-contain p-4 px-[min(--spacing(4),5vw)] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop:bg-black/60",
        centersAtXl && "mapachess-action-dialog",
        animateSheet && "mapachess-menu-sheet",
        placement !== "center"
          ? cx(
              "mx-auto mt-auto mb-0 max-h-[calc(100dvh-1rem)] max-w-md rounded-t-xl",
              fittingBottom
                ? cx(
                    "h-fit",
                    centersAtXl &&
                      "xl:m-auto xl:max-h-[90dvh] xl:max-w-lg xl:rounded-xl xl:p-6",
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
      onKeyDown={(event) => {
        if (!centersAtXl || event.key !== "Tab") return
        const stops = inputControls(event.currentTarget)
        const edge = event.shiftKey ? stops[0] : stops.at(-1)
        if (edge && document.activeElement === edge) {
          event.preventDefault()
          const destination = event.shiftKey ? stops.at(-1) : stops[0]
          destination?.focus()
        }
      }}
      onCancel={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (!leaving && !suspended) onClose()
      }}
      onPointerCancelCapture={() => {
        movingPress.current = false
        startedOnBackdrop.current = false
      }}
      onPointerDownCapture={
        animateSheet
          ? (event) => {
              const button =
                event.target instanceof Element
                  ? event.target.closest("button")
                  : null
              movingPress.current =
                button !== null &&
                !button.hasAttribute("data-back-to-board") &&
                slide()?.playState === "running"
            }
          : undefined
      }
      onClickCapture={
        animateSheet
          ? (event) => {
              if (
                leaving ||
                (event.detail > 0 &&
                  (movingPress.current ||
                    (event.target instanceof Element &&
                      event.target.closest(
                        "button:not([data-back-to-board])",
                      ) &&
                      slide()?.playState === "running")))
              ) {
                event.stopPropagation()
                event.preventDefault()
              }
              movingPress.current = false
            }
          : undefined
      }
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
              if (dismiss && !leaving && !suspended) (onBackdrop ?? onClose)()
            }
          : undefined
      }
      ref={dialog}
    >
      {children}
    </dialog>
  )
}
