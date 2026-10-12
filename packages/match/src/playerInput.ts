export const PLAYER_INPUT_ACTIONS = [
  "up",
  "down",
  "left",
  "right",
  "confirm",
  "cancel",
  "hints",
  "menu",
  "previousPiece",
  "nextPiece",
  "controls",
  "undo",
  "redo",
] as const

export type PlayerInputAction = (typeof PLAYER_INPUT_ACTIONS)[number]
export type InputDirection = "up" | "down" | "left" | "right"
export const INPUT_DIRECTIONS: readonly InputDirection[] = [
  "up",
  "down",
  "left",
  "right",
]
export const PLAYER_INPUT_LABELS = {
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  confirm: "Confirm",
  cancel: "Cancel / Back",
  hints: "Better Hints",
  menu: "Match menu",
  previousPiece: "Previous own piece",
  nextPiece: "Next own piece",
  controls: "Board / controls",
  undo: "Undo",
  redo: "Redo",
} as const satisfies Readonly<Record<PlayerInputAction, string>>

export const CONTROLLER_BUTTONS = [
  "south",
  "east",
  "west",
  "north",
  "leftShoulder",
  "rightShoulder",
  "leftTrigger",
  "rightTrigger",
  "view",
  "menu",
  "leftStick",
  "rightStick",
  "dpadUp",
  "dpadDown",
  "dpadLeft",
  "dpadRight",
] as const
export const CONTROLLER_CONTROLS = [
  ...CONTROLLER_BUTTONS,
  "stickUp",
  "stickDown",
  "stickLeft",
  "stickRight",
] as const
export type ControllerControl = (typeof CONTROLLER_CONTROLS)[number]
export const CONTROLLER_CONTROL_LABELS = {
  south: "Bottom face",
  east: "Right face",
  west: "Left face",
  north: "Top face",
  leftShoulder: "Left shoulder",
  rightShoulder: "Right shoulder",
  leftTrigger: "Left trigger",
  rightTrigger: "Right trigger",
  view: "View",
  menu: "Menu",
  leftStick: "Left stick press",
  rightStick: "Right stick press",
  dpadUp: "D-pad up",
  dpadDown: "D-pad down",
  dpadLeft: "D-pad left",
  dpadRight: "D-pad right",
  stickUp: "Left stick up",
  stickDown: "Left stick down",
  stickLeft: "Left stick left",
  stickRight: "Left stick right",
} as const satisfies Readonly<Record<ControllerControl, string>>

export type PlayerInputBindings = Readonly<{
  controller: Readonly<Record<PlayerInputAction, readonly ControllerControl[]>>
  keyboard: Readonly<Record<PlayerInputAction, string>>
}>

export const DEFAULT_PLAYER_INPUT_BINDINGS: PlayerInputBindings = Object.freeze(
  {
    controller: Object.freeze({
      up: ["dpadUp", "stickUp"],
      down: ["dpadDown", "stickDown"],
      left: ["dpadLeft", "stickLeft"],
      right: ["dpadRight", "stickRight"],
      confirm: ["south"],
      cancel: ["east"],
      hints: ["west"],
      menu: ["menu"],
      previousPiece: ["leftShoulder", "leftTrigger"],
      nextPiece: ["rightShoulder", "rightTrigger"],
      controls: ["north"],
      undo: [],
      redo: [],
    } satisfies PlayerInputBindings["controller"]),
    keyboard: Object.freeze({
      up: "ArrowUp",
      down: "ArrowDown",
      left: "ArrowLeft",
      right: "ArrowRight",
      confirm: "Enter",
      cancel: "Escape",
      hints: "KeyH",
      menu: "KeyM",
      previousPiece: "BracketLeft",
      nextPiece: "BracketRight",
      controls: "KeyC",
      undo: "KeyZ",
      redo: "KeyY",
    }),
  },
)

export const isInputDirection = (
  action: PlayerInputAction,
): action is InputDirection =>
  INPUT_DIRECTIONS.some((direction) => direction === action)

export const isControllerControl = (
  value: unknown,
): value is ControllerControl =>
  CONTROLLER_CONTROLS.some((control) => control === value)

export const isBindableKeyboardCode = (value: unknown): value is string =>
  typeof value === "string" &&
  /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Enter|Escape|Space|Bracket(Left|Right)|Comma|Period|Slash|Backslash|Semicolon|Quote|Minus|Equal|Home|End|PageUp|PageDown)$/.test(
    value,
  )

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const exactActions = (
  value: unknown,
): value is Record<PlayerInputAction, unknown> =>
  isRecord(value) &&
  Object.keys(value).length === PLAYER_INPUT_ACTIONS.length &&
  PLAYER_INPUT_ACTIONS.every((action) => Object.hasOwn(value, action))

export function parsePlayerInputBindings(
  value: unknown,
): PlayerInputBindings | null {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 2 ||
    !exactActions(value.controller) ||
    !exactActions(value.keyboard)
  )
    return null
  const controller = { ...DEFAULT_PLAYER_INPUT_BINDINGS.controller }
  const keyboard = { ...DEFAULT_PLAYER_INPUT_BINDINGS.keyboard }
  const usedControls = new Set<ControllerControl>()
  const usedKeys = new Set<string>()
  for (const action of PLAYER_INPUT_ACTIONS) {
    const controls: unknown = value.controller[action]
    const key = value.keyboard[action]
    if (
      !Array.isArray(controls) ||
      controls.length > 2 ||
      (controls.length === 0 && action !== "undo" && action !== "redo") ||
      !isBindableKeyboardCode(key) ||
      usedKeys.has(key)
    )
      return null
    const accepted: ControllerControl[] = []
    for (const control of controls) {
      if (!isControllerControl(control) || usedControls.has(control))
        return null
      usedControls.add(control)
      accepted.push(control)
    }
    usedKeys.add(key)
    controller[action] = Object.freeze(accepted)
    keyboard[action] = key
  }
  return Object.freeze({
    controller: Object.freeze(controller),
    keyboard: Object.freeze(keyboard),
  })
}

export const samePlayerInputBindings = (
  left: PlayerInputBindings,
  right: PlayerInputBindings,
): boolean =>
  PLAYER_INPUT_ACTIONS.every(
    (action) =>
      left.keyboard[action] === right.keyboard[action] &&
      left.controller[action].length === right.controller[action].length &&
      left.controller[action].every(
        (control, index) => control === right.controller[action][index],
      ),
  )

export const actionForControllerControl = (
  bindings: PlayerInputBindings,
  control: ControllerControl,
): PlayerInputAction | undefined =>
  PLAYER_INPUT_ACTIONS.find((action) =>
    bindings.controller[action].includes(control),
  )

export const actionForKeyboardCode = (
  bindings: PlayerInputBindings,
  code: string,
): PlayerInputAction | undefined =>
  PLAYER_INPUT_ACTIONS.find((action) => bindings.keyboard[action] === code)

export type BindingChange =
  | Readonly<{
      device: "controller"
      action: PlayerInputAction
      control: ControllerControl
    }>
  | Readonly<{ device: "keyboard"; action: PlayerInputAction; code: string }>

export function changePlayerInputBinding(
  bindings: PlayerInputBindings,
  change: BindingChange,
): Readonly<{
  bindings: PlayerInputBindings | null
  displaced: PlayerInputAction | null
}> {
  if (change.device === "keyboard") {
    const displaced = actionForKeyboardCode(bindings, change.code)
    const keyboard = { ...bindings.keyboard, [change.action]: change.code }
    if (displaced !== undefined && displaced !== change.action)
      keyboard[displaced] = bindings.keyboard[change.action]
    return {
      bindings: parsePlayerInputBindings({ ...bindings, keyboard }),
      displaced: displaced === change.action ? null : (displaced ?? null),
    }
  }
  const displaced = actionForControllerControl(bindings, change.control)
  const controller = { ...bindings.controller }
  const previous = controller[change.action][0]
  controller[change.action] = [
    change.control,
    ...controller[change.action]
      .slice(1)
      .filter((control) => control !== change.control),
  ]
  if (displaced !== undefined && displaced !== change.action) {
    controller[displaced] = controller[displaced].flatMap((control) =>
      control !== change.control
        ? [control]
        : previous === undefined
          ? []
          : [previous],
    )
  }
  return {
    bindings: parsePlayerInputBindings({ ...bindings, controller }),
    displaced: displaced === change.action ? null : (displaced ?? null),
  }
}

export const keyboardBindingLabel = (code: string): string =>
  code
    .replace(/^Key|^Digit/, "")
    .replace("Arrow", "")
    .replace("BracketLeft", "[")
    .replace("BracketRight", "]")

export default DEFAULT_PLAYER_INPUT_BINDINGS
