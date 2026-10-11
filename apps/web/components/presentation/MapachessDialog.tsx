import { useEffect, useRef, type ReactNode } from "react"

export default function MapachessDialog({
  children,
  label,
  onClose,
}: Readonly<{
  children: ReactNode
  label: string
  onClose: () => void
}>) {
  const dialog = useRef<HTMLDialogElement>(null)

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
      aria-label={label}
      className="bg-mapachito-white text-mapachito-charcoal fixed inset-0 m-0 h-dvh max-h-dvh w-full max-w-none overflow-y-auto overscroll-contain p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop:bg-black/60 xl:m-auto xl:h-auto xl:max-h-[90dvh] xl:max-w-4xl xl:rounded-xl xl:p-6"
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
