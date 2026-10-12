import {
  actionForControllerControl,
  CONTROLLER_BUTTONS,
  isInputDirection,
  type ControllerControl,
  type PlayerInputAction,
  type PlayerInputBindings,
} from "./playerInput.js"

export const CONTROLLER_PRESS_THRESHOLD = 0.55
export const CONTROLLER_RELEASE_THRESHOLD = 0.35
export const CONTROLLER_REPEAT_DELAY_MS = 450
export const CONTROLLER_REPEAT_INTERVAL_MS = 140

export type ControllerSample = Readonly<{
  buttons: readonly number[]
  axes: readonly number[]
}>
export type ControllerFrameState = Readonly<{
  held: ReadonlySet<ControllerControl>
  nextRepeat: ReadonlyMap<ControllerControl, number>
  armed: boolean
}>
export const initialControllerFrame = (): ControllerFrameState => ({
  held: new Set(),
  nextRepeat: new Map(),
  armed: false,
})

const pressed = (value: number, wasHeld: boolean): boolean =>
  Number.isFinite(value) &&
  value >= (wasHeld ? CONTROLLER_RELEASE_THRESHOLD : CONTROLLER_PRESS_THRESHOLD)

export default function advanceControllerFrame(
  previous: ControllerFrameState,
  sample: ControllerSample,
  bindings: PlayerInputBindings,
  nowMs: number,
): Readonly<{
  state: ControllerFrameState
  actions: readonly PlayerInputAction[]
  intentional: boolean
}> {
  const held = new Set<ControllerControl>()
  CONTROLLER_BUTTONS.forEach((control, index) => {
    if (pressed(sample.buttons[index] ?? 0, previous.held.has(control)))
      held.add(control)
  })
  const x = sample.axes[0] ?? 0
  const y = sample.axes[1] ?? 0
  const stick: readonly (readonly [ControllerControl, number])[] = [
    ["stickLeft", -x],
    ["stickRight", x],
    ["stickUp", -y],
    ["stickDown", y],
  ]
  for (const [control, value] of stick) {
    if (pressed(value, previous.held.has(control))) held.add(control)
  }
  const nextRepeat = new Map<ControllerControl, number>()
  if (!previous.armed)
    return {
      state: { held, nextRepeat, armed: held.size === 0 },
      actions: [],
      intentional: false,
    }
  const actions = new Set<PlayerInputAction>()
  let intentional = false
  for (const control of held) {
    const action = actionForControllerControl(bindings, control)
    const fresh = !previous.held.has(control)
    intentional ||= fresh
    if (action === undefined) continue
    if (fresh) actions.add(action)
    if (!isInputDirection(action)) continue
    const deadline =
      previous.nextRepeat.get(control) ?? nowMs + CONTROLLER_REPEAT_DELAY_MS
    if (!fresh && nowMs >= deadline) actions.add(action)
    nextRepeat.set(
      control,
      nowMs >= deadline ? nowMs + CONTROLLER_REPEAT_INTERVAL_MS : deadline,
    )
  }
  return {
    state: { held, nextRepeat, armed: true },
    actions: [...actions],
    intentional,
  }
}
