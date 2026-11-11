import "./nativeUiEnvironment"
import { describe, expect, it, jest } from "@jest/globals"
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native"
import { useRef, type ReactNode } from "react"
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type MeasureInWindowOnSuccessCallback,
  type ViewProps,
} from "react-native"
import loadCatalog from "@mapachess/localization/catalog"
import { listLegalMatchMoves } from "@mapachess/match/match-move"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import {
  CONTROLLER_BUTTONS,
  DEFAULT_PLAYER_INPUT_BINDINGS,
  keyboardBindingLabel,
  type PlayerInputAction,
} from "@mapachess/match/player-input"
import createInitialPlayerData from "@mapachess/profile/player-data"
import type { ProfileActor } from "@mapachess/profile/profile-runtime"
import NativeChessboard from "@/components/gameplay/NativeChessboard"
import NativeInputBindingSettings from "@/components/input/NativeInputBindingSettings"
import NativeInputProvider, {
  NativeInputSurface,
  useNativeInput,
  useNativeInputControl,
} from "@/components/input/NativeInputProvider"
import openNativeProfileRuntime from "@/lib/profile/openNativeProfileRuntime"
import InMemoryAsyncStorage from "./nativeStorageFixture"

jest.mock("react-native", () => {
  const native =
    jest.requireActual<typeof import("react-native")>("react-native")
  const { forwardRef } = jest.requireActual<typeof import("react")>("react")
  const ViewWithFocusGeometry = forwardRef<View, ViewProps>(
    function ViewWithFocusGeometry(props, ref) {
      return (
        <native.View
          {...props}
          ref={(view) => {
            if (view !== null && props.focusable)
              Object.assign(view, {
                focus: () => undefined,
                measureInWindow: (report: MeasureInWindowOnSuccessCallback) =>
                  report(0, 0, 320, 320),
              })
            if (typeof ref === "function") ref(view)
            else if (ref !== null) ref.current = view
          }}
        />
      )
    },
  )
  return new Proxy(native, {
    get: (target, name) =>
      name === "View" ? ViewWithFocusGeometry : Reflect.get(target, name),
  })
})

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
  focusRequested = false,
}: Readonly<{
  label: string
  x: number
  onPress: () => void
  disabled?: boolean
  focusRequested?: boolean
}>) {
  const ref = useRef<View>(null)
  const selected = useNativeInputControl(
    ref,
    onPress,
    !disabled,
    undefined,
    focusRequested,
  )
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
  it("takes initial dialog focus and preserves exact entry against iOS hardware shortcuts", async () => {
    const platform = jest.replaceProperty(Platform, "OS", "ios")
    const accessibilityFocus = jest
      .spyOn(AccessibilityInfo, "sendAccessibilityEvent")
      .mockImplementation(() => undefined)
    const editor: { current: TextInput | null } = { current: null }
    const currentFocus = TextInput.State.currentlyFocusedInput
    const editing = jest.spyOn(TextInput.State, "currentlyFocusedInput")
    try {
      await withInputProfile(async (actor) => {
        const port = connectHardware()
        const dialog = jest.fn((_action: PlayerInputAction) => true)
        await render(
          <NativeInputProvider actor={actor}>
            <HardwarePort connect={port.connect} />
            <NativeInputSurface modal onAction={dialog}>
              <MeasuredControl
                label="Apply"
                x={0}
                onPress={jest.fn()}
                focusRequested
              />
              <MeasuredControl
                label="Unavailable"
                x={56}
                onPress={jest.fn()}
                focusRequested
                disabled
              />
              <TextInput
                accessibilityLabel="Exact Elo"
                ref={(input) => {
                  editor.current = input
                }}
              />
            </NativeInputSurface>
          </NativeInputProvider>,
        )
        if (editor.current === null) throw new Error("Expected exact Elo input")
        editing.mockReturnValue(editor.current)
        expect(
          screen.getByRole("button", { name: "Apply", selected: true }),
        ).toBeOnTheScreen()
        expect(accessibilityFocus).toHaveBeenCalledTimes(1)
        expect(accessibilityFocus).toHaveBeenCalledWith(
          expect.anything(),
          "focus",
        )
        const send = (code: string) =>
          act(() => port.current().receive(key(code)))
        await send("KeyH")
        await send("Enter")
        expect(dialog).not.toHaveBeenCalled()
        await send("Escape")
        expect(dialog).toHaveBeenCalledWith("cancel")
        editing.mockImplementation(currentFocus)
        await send("KeyH")
        expect(dialog).toHaveBeenLastCalledWith("hints")
      })
    } finally {
      editing.mockRestore()
      accessibilityFocus.mockRestore()
      platform.restore()
    }
  })

  it("routes Android surface events from either direction without activating on first focus", async () => {
    const platform = jest.replaceProperty(Platform, "OS", "android")
    try {
      await withInputProfile(async (actor) => {
        const apply = jest.fn()
        const cancel = jest.fn()
        await render(
          <NativeInputProvider actor={actor}>
            <NativeInputSurface accessibilityLabel="Match menu">
              <MeasuredControl label="Cancel" x={0} onPress={cancel} />
              <MeasuredControl label="Apply" x={56} onPress={apply} />
            </NativeInputSurface>
          </NativeInputProvider>,
        )
        const surface = screen.getByLabelText("Match menu")
        const send = (nativeEvent: unknown) =>
          fireEvent(surface, "input", { nativeEvent })
        await send({ kind: "keyboard", code: "Enter" })
        expect(screen.queryByRole("button", { selected: true })).toBeNull()
        await send(key("ArrowLeft"))
        expect(
          screen.getByRole("button", { name: "Apply", selected: true }),
        ).toBeOnTheScreen()
        expect(apply).not.toHaveBeenCalled()
        await send(key("ArrowLeft"))
        expect(
          screen.getByRole("button", { name: "Cancel", selected: true }),
        ).toBeOnTheScreen()
        await send(key("Enter"))
        expect(cancel).toHaveBeenCalledTimes(1)
        expect(apply).not.toHaveBeenCalled()
        await fireEvent(surface, "touchStart", { nativeEvent: {} })
        await send(key("ArrowRight"))
        expect(
          screen.getByRole("button", { name: "Cancel", selected: true }),
        ).toBeOnTheScreen()
      })
    } finally {
      platform.restore()
    }
  })

  it("plays a legal board move with keyboard focus, with Escape canceling a selected piece", async () => {
    await withInputProfile(async (actor) => {
      const port = connectHardware()
      const move = jest.fn()
      const copy = loadCatalog("en")
      const position = createInitialMatchPosition({
        variant: "standard",
        chess960PositionId: null,
      })
      await render(
        <NativeInputProvider actor={actor}>
          <HardwarePort connect={port.connect} />
          <NativeInputSurface>
            <NativeChessboard
              position={position}
              orientation="white"
              legalMoves={listLegalMatchMoves(position)}
              disabled={false}
              appearance={createInitialPlayerData().settings.chessAppearance}
              hints={null}
              showMoveHints={false}
              lastMove={null}
              onMove={move}
            />
          </NativeInputSurface>
        </NativeInputProvider>,
      )
      expect(
        screen.getByLabelText(copy.board.orientation("white")),
      ).toBeOnTheScreen()
      const send = (code: string) =>
        act(() => port.current().receive(key(code)))
      await send("Enter")
      await send("Enter")
      expect(
        screen.getByRole("button", { name: /^e2, White pawn/, selected: true }),
      ).toBeOnTheScreen()
      await send("ArrowUp")
      await send("ArrowUp")
      await send("Escape")
      expect(screen.queryByRole("button", { selected: true })).toBeNull()
      expect(move).not.toHaveBeenCalled()
      await send("BracketLeft")
      await send("BracketRight")
      await send("Enter")
      expect(
        screen.getByRole("button", { name: /^a2, White pawn/, selected: true }),
      ).toBeOnTheScreen()
      await send("ArrowUp")
      await send("ArrowUp")
      await send("Enter")
      expect(move).toHaveBeenCalledTimes(1)
      expect(move).toHaveBeenCalledWith("a2a4")
    })
  })

  it("captures deliberate native keyboard and controller remaps without saving them until Save", async () => {
    await withInputProfile(async (actor) => {
      const port = connectHardware()
      const save = jest.fn()
      const copy = loadCatalog("en")
      const messages = copy.interface.inputBindingSettings
      await render(
        <NativeInputProvider actor={actor}>
          <HardwarePort connect={port.connect} />
          <NativeInputBindingSettings
            bindings={DEFAULT_PLAYER_INPUT_BINDINGS}
            onCancel={jest.fn()}
            onSave={save}
          />
        </NativeInputProvider>,
      )
      const send = (event: unknown) => act(() => port.current().receive(event))
      const hints = () => {
        const row = screen.getByText(copy.shared.inputActions.hints).parent
        if (row === null) throw new Error("Expected a Hints binding row")
        return within(row)
      }
      const editKey = () =>
        fireEvent.press(
          hints().getByRole("button", {
            name: `${copy.controls.devices.keyboard}: ${keyboardBindingLabel("KeyH", copy.controls.keys)}`,
          }),
        )
      await editKey()
      await send(key("Escape"))
      expect(screen.queryByLabelText(messages.pressAKey)).toBeNull()
      await editKey()
      await send(key("KeyQ"))
      expect(screen.queryByLabelText(messages.pressAKey)).toBeNull()

      await fireEvent.press(
        hints().getByRole("button", {
          name: copy.controls.primary(copy.shared.controllerControls.west),
        }),
      )
      const sample = {
        kind: "controller",
        id: "deck",
        name: "Steam Deck",
        axes: [0, 0],
      }
      const thumbClick = CONTROLLER_BUTTONS.map((button) =>
        button === "leftStick" ? 1 : 0,
      )
      await send({ ...sample, buttons: thumbClick })
      expect(
        screen.getByRole("button", { name: messages.cancelBindingChange }),
      ).toBeOnTheScreen()
      await send({ ...sample, buttons: CONTROLLER_BUTTONS.map(() => 0) })
      await send({ ...sample, buttons: thumbClick })
      expect(
        hints().getByRole("button", {
          name: copy.controls.primary(copy.shared.controllerControls.leftStick),
        }),
      ).toBeOnTheScreen()
      expect(save).not.toHaveBeenCalled()
      await fireEvent.press(
        screen.getByRole("button", { name: messages.saveControls }),
      )
      expect(save).toHaveBeenCalledWith({
        keyboard: { ...DEFAULT_PLAYER_INPUT_BINDINGS.keyboard, hints: "KeyQ" },
        controller: {
          ...DEFAULT_PLAYER_INPUT_BINDINGS.controller,
          hints: ["leftStick"],
        },
      })
    })
  })

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
