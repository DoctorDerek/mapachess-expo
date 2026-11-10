import "./nativeUiEnvironment"
import { describe, expect, it, jest } from "@jest/globals"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { useRef, type ReactNode } from "react"
import {
  Pressable,
  Text,
  View,
  type MeasureInWindowOnSuccessCallback,
} from "react-native"
import {
  CONTROLLER_BUTTONS,
  type PlayerInputAction,
} from "@mapachess/match/player-input"
import type { ProfileActor } from "@mapachess/profile/profile-runtime"
import NativeInputProvider, {
  NativeInputSurface,
  useNativeInput,
  useNativeInputControl,
} from "@/components/input/NativeInputProvider"
import openNativeProfileRuntime from "@/lib/profile/openNativeProfileRuntime"
import InMemoryAsyncStorage from "./nativeStorageFixture"

let mockActive = true
jest.mock("@/lib/gameplay/nativeApplicationActivity", () => ({
  __esModule: true,
  default: () => ({
    isActive: () => mockActive,
    subscribe: () => () => undefined,
  }),
}))

function MeasuredControl({
  label,
  x,
  onPress,
  disabled = false,
}: Readonly<{
  label: string
  x: number
  onPress: () => void
  disabled?: boolean
}>) {
  const ref = useRef<View>(null)
  const selected = useNativeInputControl(ref, onPress, !disabled)
  return (
    <Pressable
      ref={(view) => {
        ref.current = view
        if (view !== null)
          Object.assign(view, {
            focus: () => undefined,
            measureInWindow: (report: MeasureInWindowOnSuccessCallback) =>
              report(x, 0, 48, 48),
          })
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      disabled={disabled}
      onPress={onPress}
    />
  )
}

function HardwarePort({
  connect,
}: Readonly<{
  connect: (input: NonNullable<ReturnType<typeof useNativeInput>>) => void
}>) {
  const input = useNativeInput()
  if (input === null) throw new Error("Expected native input provider")
  connect(input)
  return <Text accessibilityLabel="Input device">{input.device.method}</Text>
}

async function withInputProfile(run: (actor: ProfileActor) => Promise<void>) {
  mockActive = true
  const profile = await openNativeProfileRuntime({
    storage: new InMemoryAsyncStorage(),
  })
  try {
    await run(profile.actor)
  } finally {
    await profile.close()
    mockActive = true
  }
}

function connectHardware() {
  let input: ReturnType<typeof useNativeInput> = null
  return {
    connect: (value: typeof input) => {
      input = value
    },
    current: () => {
      if (input === null) throw new Error("Expected connected input port")
      return input
    },
  }
}

const key = (code: string) => ({
  kind: "keyboard",
  code,
  pressed: true,
  repeat: false,
})

describe("native input ownership", () => {
  it("moves focus by measured position, never activates disabled controls and resets focus on touch", async () => {
    await withInputProfile(async (actor) => {
      const port = connectHardware()
      const first = jest.fn(),
        second = jest.fn(),
        disabled = jest.fn()
      await render(
        <NativeInputProvider actor={actor}>
          <HardwarePort connect={port.connect} />
          <NativeInputSurface accessibilityLabel="Game controls">
            <MeasuredControl label="First" x={0} onPress={first} />
            <MeasuredControl
              label="Disabled"
              x={56}
              onPress={disabled}
              disabled
            />
            <MeasuredControl label="Second" x={112} onPress={second} />
          </NativeInputSurface>
        </NativeInputProvider>,
      )
      const send = (code: string) =>
        act(() => port.current().receive(key(code)))
      await send("Enter")
      expect(
        screen.getByRole("button", { name: "First", selected: true }),
      ).toBeOnTheScreen()
      expect(first).not.toHaveBeenCalled()
      await send("ArrowRight")
      expect(
        screen.getByRole("button", { name: "Second", selected: true }),
      ).toBeOnTheScreen()
      await send("Enter")
      expect(second).toHaveBeenCalledTimes(1)
      expect(disabled).not.toHaveBeenCalled()
      expect(screen.getByLabelText("Input device")).toHaveTextContent(
        "keyboard",
      )
      await fireEvent(screen.getByLabelText("Game controls"), "touchStart", {
        nativeEvent: {},
      })
      expect(screen.queryByRole("button", { selected: true })).toBeNull()
      expect(screen.getByLabelText("Input device")).toHaveTextContent("touch")
    })
  })

  it("routes only the highest active scope and isolates binding capture and background input", async () => {
    await withInputProfile(async (actor) => {
      const port = connectHardware()
      const game = jest.fn((_action: PlayerInputAction) => true)
      const modal = jest.fn((_action: PlayerInputAction) => true)
      const harness = (child: ReactNode) => (
        <NativeInputProvider actor={actor}>
          <HardwarePort connect={port.connect} />
          <NativeInputSurface onAction={game}>{child}</NativeInputSurface>
        </NativeInputProvider>
      )
      const app = await render(
        harness(
          <NativeInputSurface modal onAction={modal}>
            <Text>Menu</Text>
          </NativeInputSurface>,
        ),
      )
      const send = (event: unknown) => act(() => port.current().receive(event))
      await send(key("Escape"))
      expect(modal).toHaveBeenCalledWith("cancel")
      expect(game).not.toHaveBeenCalled()
      const capture = jest.fn(() => true)
      const stop = port.current().capture(capture)
      await send(key("KeyH"))
      expect(capture).toHaveBeenCalledWith(key("KeyH"))
      expect(modal).toHaveBeenCalledTimes(1)
      stop()
      await app.rerender(harness(<Text>Board</Text>))
      mockActive = false
      await send(key("KeyH"))
      expect(game).not.toHaveBeenCalled()
      mockActive = true
      const sample = {
        kind: "controller",
        id: "deck",
        name: "Steam Deck",
        axes: [0, 0],
      } as const
      const frame = jest
        .spyOn(globalThis, "requestAnimationFrame")
        .mockReturnValue(1)
      await send({ ...sample, buttons: CONTROLLER_BUTTONS.map(() => 0) })
      const neutral = frame.mock.lastCall?.[0]
      if (neutral === undefined) throw new Error("Expected a controller poll")
      await act(() => neutral(0))
      await send({
        ...sample,
        buttons: CONTROLLER_BUTTONS.map((button) =>
          button === "south" ? 1 : 0,
        ),
      })
      const pressed = frame.mock.lastCall?.[0]
      if (pressed === undefined) throw new Error("Expected a controller poll")
      await act(() => pressed(16))
      expect(screen.getByLabelText("Input device")).toHaveTextContent(
        "controller",
      )
      expect(game).toHaveBeenCalledWith("confirm")
      await send({ kind: "disconnect", id: "deck" })
      await app.unmount()
    })
  })
})
