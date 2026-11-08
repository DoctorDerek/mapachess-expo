import { describe, expect, it, jest } from "@jest/globals"
import type { PlayerInputDevice } from "@mapachess/match-presentation/input-prompts"
import {
  changePlayerInputBinding,
  DEFAULT_PLAYER_INPUT_BINDINGS,
  type PlayerInputAction,
  type PlayerInputBindings,
} from "@mapachess/match/player-input"
import createNativeInputDispatcher, {
  decodeNativeInputEvent,
  type NativeInputEvent,
} from "@/lib/input/nativeInput"

function pad(pressed: readonly number[] = []): NativeInputEvent {
  return {
    kind: "controller",
    id: "pad-1",
    name: "Steam Deck",
    buttons: Array.from({ length: 16 }, (_, index) =>
      pressed.includes(index) ? 1 : 0,
    ),
    axes: [0, 0],
  }
}

describe("native semantic input boundary", () => {
  it("rejects malformed native samples without exposing invalid controls", () => {
    for (const value of [
      null,
      {},
      { kind: "keyboard", code: "Delete", pressed: true, repeat: false },
      { ...pad(), axes: [NaN, 0] },
      { ...pad(), buttons: [] },
      { ...pad(), axes: [0, 2] },
    ])
      expect(decodeNativeInputEvent(value)).toBeNull()
    expect(decodeNativeInputEvent(pad())).toEqual(pad())
  })
  it("requires released controls before arming and never repeats confirm", () => {
    const action =
      jest.fn<(action: PlayerInputAction, device: PlayerInputDevice) => void>()
    const input = createNativeInputDispatcher(
      () => DEFAULT_PLAYER_INPUT_BINDINGS,
      action,
    )
    input.receive(pad([0]))
    input.tick(0)
    expect(action).not.toHaveBeenCalled()
    input.receive(pad())
    input.tick(1)
    expect(input.needsFrame()).toBe(false)
    input.receive(pad([0]))
    input.tick(2)
    input.tick(1000)
    expect(action).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenCalledWith("confirm", {
      method: "controller",
      family: "steam-deck",
    })
  })
  it("reuses directional repeat and resets ownership on disconnect", () => {
    const action =
      jest.fn<(action: PlayerInputAction, device: PlayerInputDevice) => void>()
    const input = createNativeInputDispatcher(
      () => DEFAULT_PLAYER_INPUT_BINDINGS,
      action,
    )
    input.receive(pad())
    input.tick(0)
    input.receive(pad([15]))
    input.tick(1)
    input.tick(200)
    input.tick(451)
    expect(action.mock.calls.map(([value]) => value)).toEqual([
      "right",
      "right",
    ])
    input.receive({ kind: "disconnect", id: "pad-1" })
    input.tick(1000)
    expect(input.needsFrame()).toBe(false)
    expect(action).toHaveBeenCalledTimes(2)
  })
  it("applies saved remapping through the canonical binding resolver", () => {
    let bindings: PlayerInputBindings = DEFAULT_PLAYER_INPUT_BINDINGS
    const action =
      jest.fn<(action: PlayerInputAction, device: PlayerInputDevice) => void>()
    const input = createNativeInputDispatcher(() => bindings, action)
    input.receive(pad())
    input.tick(0)
    const changed = changePlayerInputBinding(bindings, {
      device: "controller",
      action: "hints",
      control: "north",
    })
    if (changed.bindings === null)
      throw new Error("The fixture requires a valid swap.")
    bindings = changed.bindings
    input.tick(1)
    input.receive(pad([3]))
    input.tick(2)
    expect(action).toHaveBeenCalledWith("hints", {
      method: "controller",
      family: "steam-deck",
    })
  })
  it("routes physical keyboard codes and isolates binding capture from navigation", () => {
    const action =
      jest.fn<(action: PlayerInputAction, device: PlayerInputDevice) => void>()
    let capturing = true
    const capture = jest.fn(() => capturing)
    const input = createNativeInputDispatcher(
      () => DEFAULT_PLAYER_INPUT_BINDINGS,
      action,
      capture,
    )
    input.receive({
      kind: "keyboard",
      code: "KeyH",
      pressed: true,
      repeat: false,
    })
    expect(capture).toHaveBeenCalledTimes(1)
    expect(action).not.toHaveBeenCalled()
    capturing = false
    input.receive({
      kind: "keyboard",
      code: "KeyH",
      pressed: true,
      repeat: false,
    })
    input.receive({
      kind: "keyboard",
      code: "KeyH",
      pressed: true,
      repeat: true,
    })
    expect(action).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenCalledWith("hints", { method: "keyboard" })
  })
})
