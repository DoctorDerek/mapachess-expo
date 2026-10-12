import { useEffect, useEffectEvent, useRef } from "react"
import {
  controllerFamily,
  type PlayerInputDevice,
} from "@mapachess/match-presentation/input-prompts"
import {
  actionForKeyboardCode,
  isInputDirection,
  samePlayerInputBindings,
  type PlayerInputAction,
  type PlayerInputBindings,
} from "@mapachess/match/player-input"
import advanceControllerFrame, {
  initialControllerFrame,
  type ControllerFrameState,
} from "@mapachess/match/player-input-frame"
import { foregroundInputRoot, isTextInput } from "./webFocusNavigation"

export default function useWebPlayerInput({
  bindings,
  onAction,
  onDevice,
}: Readonly<{
  bindings: PlayerInputBindings
  onAction: (action: PlayerInputAction, device: PlayerInputDevice) => boolean
  onDevice: (device: PlayerInputDevice) => void
}>): void {
  const dispatch = useEffectEvent(onAction)
  const reportDevice = useEffectEvent(onDevice)
  const readBindings = useEffectEvent(() => bindings)
  const owner = useRef<Readonly<{ index: number; id: string }> | null>(null)
  useEffect(() => {
    const frames = new Map<
      number,
      { id: string; state: ControllerFrameState }
    >()
    let frame = 0
    let scope: HTMLElement | null = null
    let focused = document.hasFocus()
    let accessBlocked = false
    let effectiveBindings = readBindings()
    const reset = (): void => {
      frames.clear()
    }
    const keyboard = (event: KeyboardEvent): void => {
      if (
        !event.isTrusted ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.isComposing
      )
        return
      owner.current = null
      reset()
      reportDevice({ method: "keyboard" })
      if (
        event.defaultPrevented ||
        (isTextInput(event.target) && event.code !== "Escape") ||
        (event.target instanceof HTMLInputElement &&
          event.target.type === "radio" &&
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
            event.code,
          ))
      )
        return
      const action = actionForKeyboardCode(readBindings(), event.code)
      if (action === undefined) return
      if (event.repeat && !isInputDirection(action)) {
        event.preventDefault()
        return
      }
      if (dispatch(action, { method: "keyboard" })) event.preventDefault()
    }
    const pointer = (event: PointerEvent): void => {
      if (event.isTrusted) {
        owner.current = null
        reset()
        reportDevice({
          method: event.pointerType === "touch" ? "touch" : "pointer",
        })
      }
    }
    const blur = (): void => {
      focused = false
      reset()
    }
    const focus = (): void => {
      focused = true
      accessBlocked = false
      reset()
    }
    const visibility = (): void => {
      reset()
    }
    const disconnected = (event: GamepadEvent): void => {
      frames.delete(event.gamepad.index)
      if (owner.current?.index === event.gamepad.index) {
        owner.current = null
        reportDevice({ method: "keyboard" })
      }
    }
    const poll = (now: number): void => {
      frame = requestAnimationFrame(poll)
      if (
        !focused ||
        document.hidden ||
        accessBlocked ||
        typeof navigator.getGamepads !== "function"
      )
        return
      const nextScope = foregroundInputRoot()
      const nextBindings = readBindings()
      if (effectiveBindings !== nextBindings) {
        if (!samePlayerInputBindings(effectiveBindings, nextBindings)) reset()
        effectiveBindings = nextBindings
      }
      if (scope !== nextScope) {
        reset()
        scope = nextScope
      }
      let pads: readonly (Gamepad | null)[]
      try {
        pads = navigator.getGamepads()
      } catch {
        accessBlocked = true
        reset()
        if (owner.current !== null) {
          owner.current = null
          reportDevice({ method: "keyboard" })
        }
        return
      }
      const connected = new Map<number, string>()
      const candidates: {
        pad: Gamepad
        action: PlayerInputAction
        fresh: boolean
      }[] = []
      for (const pad of pads) {
        if (pad === null || !pad.connected || pad.mapping !== "standard")
          continue
        connected.set(pad.index, pad.id)
        const previous = frames.get(pad.index)
        const result = advanceControllerFrame(
          previous?.id === pad.id ? previous.state : initialControllerFrame(),
          {
            buttons: pad.buttons.map((button) => button.value),
            axes: pad.axes,
          },
          effectiveBindings,
          now,
        )
        frames.set(pad.index, { id: pad.id, state: result.state })
        const action = result.actions[0]
        if (
          action !== undefined &&
          (result.intentional || owner.current?.index === pad.index)
        )
          candidates.push({ pad, action, fresh: result.intentional })
      }
      for (const index of frames.keys())
        if (!connected.has(index)) frames.delete(index)
      if (
        owner.current !== null &&
        connected.get(owner.current.index) !== owner.current.id
      ) {
        owner.current = null
        reportDevice({ method: "keyboard" })
      }
      const candidate = candidates.find((value) => value.fresh) ?? candidates[0]
      if (candidate !== undefined) {
        const { pad, action } = candidate
        if (owner.current?.index !== pad.index || owner.current.id !== pad.id) {
          for (const index of frames.keys())
            if (index !== pad.index) frames.delete(index)
        }
        owner.current = { index: pad.index, id: pad.id }
        const device: PlayerInputDevice = {
          method: "controller",
          family: controllerFamily(pad.id),
        }
        reportDevice(device)
        dispatch(action, device)
        if (!isInputDirection(action)) reset()
      }
    }
    window.addEventListener("keydown", keyboard)
    window.addEventListener("pointerdown", pointer)
    window.addEventListener("blur", blur)
    window.addEventListener("focus", focus)
    window.addEventListener("gamepaddisconnected", disconnected)
    document.addEventListener("visibilitychange", visibility)
    frame = requestAnimationFrame(poll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", keyboard)
      window.removeEventListener("pointerdown", pointer)
      window.removeEventListener("blur", blur)
      window.removeEventListener("focus", focus)
      window.removeEventListener("gamepaddisconnected", disconnected)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [])
}
