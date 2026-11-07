// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import {
  bootApplication,
  openSettings,
  savedProfile,
} from "../../test/applicationHarness"
import { installDomHarness } from "../../test/domHarness"

installDomHarness()
const copy = loadCatalog("en")

async function editHints(device: "controller" | "keyboard") {
  const panel = await openSettings()
  fireEvent.click(
    panel.getByRole("button", {
      name: copy.interface.inputBindingSettings.controls,
    }),
  )
  const editor = within(
    screen.getByRole("dialog", {
      name: copy.interface.inputBindingSettings.controls,
    }),
  )
  fireEvent.click(
    editor.getByRole("button", { name: copy.controls.devices[device] }),
  )
  fireEvent.click(
    editor.getByRole("button", {
      name: new RegExp("^" + copy.shared.inputActions.hints + " "),
    }),
  )
  return within(
    screen.getByRole("dialog", {
      name: copy.controls.changeBinding(copy.shared.inputActions.hints),
    }),
  )
}

describe("remapping through real Settings and durable profile writes", () => {
  it("applies a new keyboard binding only after Save controls", async () => {
    const { indexedDb } = await bootApplication()
    const before = await savedProfile(indexedDb)
    const binding = await editHints("keyboard")
    fireEvent.keyDown(
      binding.getByRole("button", {
        name: copy.interface.inputBindingSettings.pressAKey,
      }),
      { code: "KeyQ" },
    )
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: copy.controls.changeBinding(copy.shared.inputActions.hints),
        }),
      ).toBeNull(),
    )
    expect((await savedProfile(indexedDb)).settings.inputBindings).toEqual(
      before.settings.inputBindings,
    )
    fireEvent.click(
      within(
        screen.getByRole("dialog", {
          name: copy.interface.inputBindingSettings.controls,
        }),
      ).getByRole("button", {
        name: copy.interface.inputBindingSettings.saveControls,
      }),
    )
    await waitFor(async () =>
      expect(
        (await savedProfile(indexedDb)).settings.inputBindings.keyboard.hints,
      ).toBe("KeyQ"),
    )
  })
  it("requires an explicit swap for a conflicting key and cancels without changing controls", async () => {
    const { indexedDb } = await bootApplication()
    const before = await savedProfile(indexedDb)
    const binding = await editHints("keyboard")
    fireEvent.keyDown(
      binding.getByRole("button", {
        name: copy.interface.inputBindingSettings.pressAKey,
      }),
      { code: before.settings.inputBindings.keyboard.menu },
    )
    expect(
      binding.getByRole("button", {
        name: copy.interface.inputBindingSettings.swapBindings,
      }),
    ).toBeTruthy()
    fireEvent.click(
      binding.getByRole("button", {
        name: copy.interface.inputBindingSettings.cancelSwap,
      }),
    )
    fireEvent.click(
      binding.getByRole("button", {
        name: copy.interface.inputBindingSettings.cancelBindingChange,
      }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: copy.controls.changeBinding(copy.shared.inputActions.hints),
        }),
      ).toBeNull(),
    )
    expect(
      within(
        screen.getByRole("dialog", {
          name: copy.interface.inputBindingSettings.controls,
        }),
      ).getByRole("button", {
        name: copy.interface.inputBindingSettings.saveControls,
      }),
    ).toHaveProperty("disabled", true)
    expect((await savedProfile(indexedDb)).settings.inputBindings).toEqual(
      before.settings.inputBindings,
    )
  })
  it("swaps controller controls while preserving mandatory actions", async () => {
    const { indexedDb } = await bootApplication()
    const before = await savedProfile(indexedDb)
    const binding = await editHints("controller")
    fireEvent.click(
      binding.getByRole("button", {
        name: copy.shared.controllerControls.north,
      }),
    )
    fireEvent.click(
      binding.getByRole("button", {
        name: copy.interface.inputBindingSettings.swapBindings,
      }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: copy.controls.changeBinding(copy.shared.inputActions.hints),
        }),
      ).toBeNull(),
    )
    fireEvent.click(
      within(
        screen.getByRole("dialog", {
          name: copy.interface.inputBindingSettings.controls,
        }),
      ).getByRole("button", {
        name: copy.interface.inputBindingSettings.saveControls,
      }),
    )
    await waitFor(async () => {
      const after = await savedProfile(indexedDb)
      expect(after.settings.inputBindings.controller.hints).toEqual(["north"])
      expect(after.settings.inputBindings.controller.controls).toEqual(
        before.settings.inputBindings.controller.hints,
      )
    })
  })
  it.each([
    { code: "KeyQ", ctrlKey: true },
    { code: "KeyQ", altKey: true },
    { code: "KeyQ", repeat: true },
    { code: "F1" },
    { code: "Escape" },
  ])(
    "rejects unsupported capture %# without altering the draft",
    async (event) => {
      const { indexedDb } = await bootApplication()
      const before = await savedProfile(indexedDb)
      const binding = await editHints("keyboard")
      fireEvent.keyDown(
        binding.getByRole("button", {
          name: copy.interface.inputBindingSettings.pressAKey,
        }),
        event,
      )
      expect(
        binding.getByRole("button", {
          name: copy.interface.inputBindingSettings.pressAKey,
        }),
      ).toBeTruthy()
      expect((await savedProfile(indexedDb)).settings.inputBindings).toEqual(
        before.settings.inputBindings,
      )
    },
  )
})
