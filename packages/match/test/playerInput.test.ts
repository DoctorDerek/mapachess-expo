import { describe, expect, it } from "vitest"
import DEFAULT_PLAYER_INPUT_BINDINGS, {
  changePlayerInputBinding,
  parsePlayerInputBindings,
  PLAYER_INPUT_ACTIONS,
} from "../src/playerInput.js"
import advanceControllerFrame, {
  initialControllerFrame,
  type ControllerFrameState,
} from "../src/playerInputFrame.js"

const sample = (
  buttons: readonly number[] = [],
  axes: readonly number[] = [],
) => ({
  buttons: Array.from({ length: 16 }, (_, index) =>
    buttons.includes(index) ? 1 : 0,
  ),
  axes,
})
const step = (
  state: ControllerFrameState,
  pressed: readonly number[],
  now: number,
) =>
  advanceControllerFrame(
    state,
    sample(pressed),
    DEFAULT_PLAYER_INPUT_BINDINGS,
    now,
  )

describe("semantic player input", () => {
  it("validates a complete map and rejects missing or colliding controls", () => {
    expect(parsePlayerInputBindings(DEFAULT_PLAYER_INPUT_BINDINGS)).toEqual(
      DEFAULT_PLAYER_INPUT_BINDINGS,
    )
    const defaults = DEFAULT_PLAYER_INPUT_BINDINGS
    expect(
      parsePlayerInputBindings({
        ...defaults,
        keyboard: { ...defaults.keyboard, confirm: "Tab" },
      }),
    ).toBeNull()
    expect(
      parsePlayerInputBindings({
        ...defaults,
        controller: { ...defaults.controller, cancel: ["south"] },
      }),
    ).toBeNull()
    expect(
      parsePlayerInputBindings({
        ...defaults,
        keyboard: { ...defaults.keyboard, cancel: "Enter" },
      }),
    ).toBeNull()
    for (const action of PLAYER_INPUT_ACTIONS.filter(
      (action) => action !== "undo" && action !== "redo",
    ))
      expect(
        parsePlayerInputBindings({
          ...defaults,
          controller: { ...defaults.controller, [action]: [] },
        }),
      ).toBeNull()
  })
  it("swaps collisions without dropping required actions or secondary bindings", () => {
    const changed = changePlayerInputBinding(DEFAULT_PLAYER_INPUT_BINDINGS, {
      action: "confirm",
      device: "controller",
      control: "east",
    })
    expect(changed.displaced).toBe("cancel")
    expect(changed.bindings?.controller.confirm).toEqual(["east"])
    expect(changed.bindings?.controller.cancel).toEqual(["south"])
    expect(changed.bindings?.controller.previousPiece).toEqual([
      "leftShoulder",
      "leftTrigger",
    ])
    expect(
      changePlayerInputBinding(DEFAULT_PLAYER_INPUT_BINDINGS, {
        action: "undo",
        device: "controller",
        control: "south",
      }).bindings,
    ).toBeNull()
    const keyboard = changePlayerInputBinding(DEFAULT_PLAYER_INPUT_BINDINGS, {
      action: "confirm",
      device: "keyboard",
      code: "KeyH",
    })
    expect(keyboard.bindings?.keyboard.hints).toBe("Enter")
  })
  it("requires neutral on startup/reconnect and emits Confirm only on a fresh press", () => {
    let next = step(initialControllerFrame(), [0], 0)
    expect(next.actions).toEqual([])
    next = step(next.state, [], 1)
    next = step(next.state, [0], 2)
    expect(next.actions).toEqual(["confirm"])
    expect(step(next.state, [0], 2000).actions).toEqual([])
  })
  it("edits and removes alternate bindings without stranding required actions", () => {
    const changed = changePlayerInputBinding(DEFAULT_PLAYER_INPUT_BINDINGS, {
      action: "up",
      device: "controller",
      slot: 1,
      control: "view",
    })
    expect(changed.bindings?.controller.up).toEqual(["dpadUp", "view"])
    expect(
      changePlayerInputBinding(DEFAULT_PLAYER_INPUT_BINDINGS, {
        action: "up",
        device: "controller",
        slot: 1,
        control: null,
      }).bindings?.controller.up,
    ).toEqual(["dpadUp"])
    expect(
      changePlayerInputBinding(DEFAULT_PLAYER_INPUT_BINDINGS, {
        action: "confirm",
        device: "controller",
        control: null,
      }).bindings,
    ).toBeNull()
    expect(
      changePlayerInputBinding(DEFAULT_PLAYER_INPUT_BINDINGS, {
        action: "up",
        device: "controller",
        slot: 1,
        control: "dpadUp",
      }).bindings?.controller.up,
    ).toEqual(["stickUp", "dpadUp"])
    expect(
      changePlayerInputBinding(DEFAULT_PLAYER_INPUT_BINDINGS, {
        action: "undo",
        device: "controller",
        control: "view",
      }).bindings?.controller.undo,
    ).toEqual(["view"])
  })
  it("prioritizes a new direction over an older held repeat", () => {
    const neutral = step(initialControllerFrame(), [], 0)
    const held = step(neutral.state, [12], 1)
    expect(step(held.state, [12, 15], 500).actions).toEqual(["right", "up"])
  })
  it("repeats only directions, deduplicates stick/d-pad and ignores drift/non-finite input", () => {
    let state = step(initialControllerFrame(), [], 0).state
    let next = step(state, [12], 1)
    expect(next.actions).toEqual(["up"])
    expect(step(next.state, [12], 449).actions).toEqual([])
    next = step(next.state, [12], 451)
    expect(next.actions).toEqual(["up"])
    expect(step(next.state, [12], 590).actions).toEqual([])
    expect(step(next.state, [12], 591).actions).toEqual(["up"])
    expect(
      advanceControllerFrame(
        state,
        sample([], [0.3, NaN]),
        DEFAULT_PLAYER_INPUT_BINDINGS,
        1,
      ).intentional,
    ).toBe(false)
    next = advanceControllerFrame(
      state,
      sample([12], [0, -0.7]),
      DEFAULT_PLAYER_INPUT_BINDINGS,
      1,
    )
    expect(next.actions).toEqual(["up"])
    state = advanceControllerFrame(
      next.state,
      sample([], [0, -0.4]),
      DEFAULT_PLAYER_INPUT_BINDINGS,
      2,
    ).state
    expect(state.held.has("stickUp")).toBe(true)
    expect(
      advanceControllerFrame(
        state,
        sample([], [0, -0.3]),
        DEFAULT_PLAYER_INPUT_BINDINGS,
        3,
      ).state.held.size,
    ).toBe(0)
  })
})
