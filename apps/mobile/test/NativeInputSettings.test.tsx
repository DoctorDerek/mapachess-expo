import "./nativeUiEnvironment"
import { describe, expect, it, jest } from "@jest/globals"
import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native"
import loadCatalog from "@mapachess/localization/catalog"
import {
  DEFAULT_PLAYER_INPUT_BINDINGS,
  keyboardBindingLabel,
} from "@mapachess/match/player-input"
import NativeInputBindingSettings from "@/components/input/NativeInputBindingSettings"

const copy = loadCatalog("en")
const keyboard = (label: string) =>
  `${copy.controls.devices.keyboard}: ${label}`

describe("native input-binding editor", () => {
  it("requires confirmation before swapping occupied keyboard bindings and saves only on explicit Save", async () => {
    const save = jest.fn()
    await render(
      <NativeInputBindingSettings
        bindings={DEFAULT_PLAYER_INPUT_BINDINGS}
        onCancel={jest.fn()}
        onSave={save}
      />,
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: keyboard(
          keyboardBindingLabel(
            DEFAULT_PLAYER_INPUT_BINDINGS.keyboard.hints,
            copy.controls.keys,
          ),
        ),
      }),
    )
    await fireEvent.changeText(
      screen.getByLabelText(copy.interface.inputBindingSettings.pressAKey),
      "KeyM",
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.setup.accept }),
    )
    expect(save).not.toHaveBeenCalled()
    expect(
      screen.getByRole("button", {
        name: copy.interface.inputBindingSettings.swapBindings,
      }),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.interface.inputBindingSettings.swapBindings,
      }),
    )
    expect(save).not.toHaveBeenCalled()
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.interface.inputBindingSettings.saveControls,
      }),
    )
    expect(save).toHaveBeenCalledWith({
      ...DEFAULT_PLAYER_INPUT_BINDINGS,
      keyboard: {
        ...DEFAULT_PLAYER_INPUT_BINDINGS.keyboard,
        hints: "KeyM",
        menu: "KeyH",
      },
    })
  })

  it("does not lose required controller actions when removing a binding would make the scheme unusable", async () => {
    await render(
      <NativeInputBindingSettings
        bindings={DEFAULT_PLAYER_INPUT_BINDINGS}
        onCancel={jest.fn()}
        onSave={jest.fn()}
      />,
    )
    const row = screen.getByText(copy.shared.inputActions.confirm).parent
    if (row === null) throw new Error("Confirm binding row must render")
    await fireEvent.press(
      within(row).getByRole("button", {
        name: copy.controls.primary(copy.shared.controllerControls.south),
      }),
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.interface.inputBindingSettings.removeBinding,
      }),
    )
    expect(screen.getByRole("alert")).toHaveTextContent(
      copy.controls.requiredAction,
    )
    expect(
      screen.getByRole("button", {
        name: copy.interface.inputBindingSettings.cancelBindingChange,
      }),
    ).toBeOnTheScreen()
  })

  it("cancels the whole editor without committing an otherwise valid changed key", async () => {
    const save = jest.fn(),
      cancel = jest.fn()
    await render(
      <NativeInputBindingSettings
        bindings={DEFAULT_PLAYER_INPUT_BINDINGS}
        onCancel={cancel}
        onSave={save}
      />,
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: keyboard(
          keyboardBindingLabel(
            DEFAULT_PLAYER_INPUT_BINDINGS.keyboard.hints,
            copy.controls.keys,
          ),
        ),
      }),
    )
    await fireEvent.changeText(
      screen.getByLabelText(copy.interface.inputBindingSettings.pressAKey),
      "KeyQ",
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.setup.accept }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.setup.cancel }),
    )
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(save).not.toHaveBeenCalled()
    expect(DEFAULT_PLAYER_INPUT_BINDINGS.keyboard.hints).toBe("KeyH")
  })
})
