import type { InputDirection } from "@mapachess/match/player-input"

const INPUT_CONTROL_SELECTOR =
  'button, a[href], input:not([type="hidden"]), select, textarea, summary, [tabindex="0"]'

export const isInputVisible = (element: HTMLElement): boolean =>
  element.isConnected &&
  element.closest('[inert], [hidden], [aria-hidden="true"]') === null &&
  element.checkVisibility({ visibilityProperty: true, opacityProperty: true })

export const inputFocusTarget = (element: HTMLElement): HTMLElement =>
  element instanceof HTMLInputElement && element.classList.contains("sr-only")
    ? (element.labels?.[0] ?? element)
    : element

export function foregroundInputRoot(): HTMLElement {
  const modal =
    [...document.querySelectorAll<HTMLDialogElement>("dialog[open]")]
      .filter(isInputVisible)
      .at(-1) ??
    [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')]
      .filter(isInputVisible)
      .at(-1) ??
    document.body
  return (
    [...modal.querySelectorAll<HTMLElement>("[data-player-input-layer]")]
      .filter(isInputVisible)
      .at(-1) ?? modal
  )
}

export const inputControls = (root: HTMLElement): readonly HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>(INPUT_CONTROL_SELECTOR)].filter(
    (element) =>
      !element.matches(':disabled, [aria-disabled="true"]') &&
      (element.tabIndex >= 0 || element instanceof HTMLInputElement) &&
      isInputVisible(inputFocusTarget(element)) &&
      element
        .closest("details:not([open])")
        ?.querySelector("summary")
        ?.contains(element) !== false,
  )

export function focusInput(element: HTMLElement): void {
  element.focus({ preventScroll: true })
  inputFocusTarget(element).scrollIntoView({
    block: "nearest",
    inline: "nearest",
  })
}

export function moveInputFocus(
  root: HTMLElement,
  direction: InputDirection,
  lastFocus: HTMLElement | null,
): void {
  const controls = inputControls(root)
  const current =
    controls.find((element) => element === document.activeElement) ??
    (lastFocus !== null &&
    lastFocus.matches(INPUT_CONTROL_SELECTOR) &&
    root.contains(lastFocus) &&
    isInputVisible(inputFocusTarget(lastFocus))
      ? lastFocus
      : undefined)
  if (current === undefined) {
    const initial =
      direction === "up" || direction === "left" ? controls.at(-1) : controls[0]
    if (initial !== undefined) focusInput(initial)
    return
  }
  const rect = inputFocusTarget(current).getBoundingClientRect()
  const horizontal = direction === "left" || direction === "right"
  const sign = direction === "left" || direction === "up" ? -1 : 1
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const candidates = controls
    .flatMap((element) => {
      if (element === current) return []
      const next = inputFocusTarget(element).getBoundingClientRect()
      const dx = next.left + next.width / 2 - cx
      const dy = next.top + next.height / 2 - cy
      const forward = (horizontal ? dx : dy) * sign
      if (forward <= 1) return []
      const perpendicular = Math.abs(horizontal ? dy : dx)
      return [{ element, distance: forward + perpendicular * 3 }]
    })
    .sort((left, right) => left.distance - right.distance)
  const next = candidates[0]?.element
  if (next !== undefined) focusInput(next)
}

export function activateInput(root: HTMLElement): boolean {
  const control = inputControls(root).find(
    (element) => element === document.activeElement,
  )
  if (control === undefined) {
    const first = inputControls(root)[0]
    if (first !== undefined) focusInput(first)
    return first !== undefined
  }
  control.click()
  return true
}

export const isTextInput = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLInputElement &&
      !["radio", "checkbox", "button", "submit", "reset"].includes(
        target.type,
      )))
