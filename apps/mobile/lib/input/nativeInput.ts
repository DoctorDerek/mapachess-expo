import {
  controllerFamily,
  type PlayerInputDevice,
} from "@mapachess/match-presentation/input-prompts"
import {
  actionForKeyboardCode,
  CONTROLLER_BUTTONS,
  isBindableKeyboardCode,
  isInputDirection,
  type PlayerInputAction,
  type PlayerInputBindings,
} from "@mapachess/match/player-input"
import advanceControllerFrame, {
  initialControllerFrame,
  type ControllerFrameState,
  type ControllerSample,
} from "@mapachess/match/player-input-frame"

export type NativeInputEvent =
  | Readonly<{
      kind: "keyboard"
      code: string
      pressed: boolean
      repeat: boolean
    }>
  | Readonly<{
      kind: "controller"
      id: string
      name: string
      buttons: readonly number[]
      axes: readonly number[]
    }>
  | Readonly<{ kind: "disconnect"; id: string }>
  | Readonly<{ kind: "reset" }>

export function decodeNativeInputEvent(
  value: unknown,
): NativeInputEvent | null {
  if (typeof value !== "object" || value === null || !("kind" in value))
    return null
  if (value.kind === "reset") return { kind: "reset" }
  if (
    value.kind === "disconnect" &&
    "id" in value &&
    typeof value.id === "string"
  )
    return { kind: "disconnect", id: value.id }
  if (
    value.kind === "keyboard" &&
    "code" in value &&
    isBindableKeyboardCode(value.code) &&
    "pressed" in value &&
    typeof value.pressed === "boolean" &&
    "repeat" in value &&
    typeof value.repeat === "boolean"
  )
    return {
      kind: "keyboard",
      code: value.code,
      pressed: value.pressed,
      repeat: value.repeat,
    }
  if (
    value.kind !== "controller" ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !("name" in value) ||
    typeof value.name !== "string" ||
    !("buttons" in value) ||
    !Array.isArray(value.buttons) ||
    value.buttons.length !== CONTROLLER_BUTTONS.length ||
    !value.buttons.every(
      (button: unknown) =>
        typeof button === "number" &&
        Number.isFinite(button) &&
        button >= 0 &&
        button <= 1,
    ) ||
    !("axes" in value) ||
    !Array.isArray(value.axes) ||
    value.axes.length !== 2 ||
    !value.axes.every(
      (axis: unknown) =>
        typeof axis === "number" &&
        Number.isFinite(axis) &&
        Math.abs(axis) <= 1,
    )
  )
    return null
  return {
    kind: "controller",
    id: value.id,
    name: value.name,
    buttons: value.buttons,
    axes: value.axes,
  }
}

export type NativeInputDispatcher = Readonly<{
  receive: (event: NativeInputEvent) => void
  tick: (now: number) => void
  reset: () => void
  needsFrame: () => boolean
}>
export default function createNativeInputDispatcher(
  readBindings: () => PlayerInputBindings,
  dispatch: (action: PlayerInputAction, device: PlayerInputDevice) => void,
  capture?: (event: NativeInputEvent) => boolean,
): NativeInputDispatcher {
  const controllers = new Map<
    string,
    { name: string; sample: ControllerSample; state: ControllerFrameState }
  >()
  let owner: string | null = null
  let bindings = readBindings()
  return {
    receive: (event) => {
      if (event.kind === "reset") {
        controllers.clear()
        owner = null
        return
      }
      if (event.kind === "disconnect") {
        controllers.delete(event.id)
        if (event.id === owner) owner = null
        return
      }
      if (capture?.(event)) return
      if (event.kind === "keyboard") {
        if (!event.pressed) return
        const action = actionForKeyboardCode(readBindings(), event.code)
        if (action !== undefined && (!event.repeat || isInputDirection(action)))
          dispatch(action, { method: "keyboard" })
        controllers.clear()
        owner = null
        return
      }
      const previous = controllers.get(event.id)
      controllers.set(event.id, {
        name: event.name,
        sample: event,
        state: previous?.state ?? initialControllerFrame(),
      })
    },
    tick: (now) => {
      const effective = readBindings()
      if (effective !== bindings) {
        bindings = effective
        for (const value of controllers.values())
          value.state = initialControllerFrame()
      }
      for (const [id, value] of controllers) {
        const next = advanceControllerFrame(
          value.state,
          value.sample,
          bindings,
          now,
        )
        value.state = next.state
        if (next.intentional) owner = id
        if (owner !== id) continue
        for (const action of next.actions)
          dispatch(action, {
            method: "controller",
            family: controllerFamily(value.name),
          })
      }
    },
    reset: () => {
      controllers.clear()
      owner = null
    },
    needsFrame: () =>
      [...controllers.values()].some((value) => value.state.held.size > 0),
  }
}
