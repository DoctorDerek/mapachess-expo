// @vitest-environment happy-dom
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import { IDBObjectStore } from "fake-indexeddb"
import { describe, expect, it, vi } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import dressingRoomChoices from "../../lib/presentation/dressingRoomChoices"
import { bootApplication, savedProfile } from "../../test/applicationHarness"
import { installDomHarness } from "../../test/domHarness"

installDomHarness()
const copy = loadCatalog("en")

describe("profile-card studio with real editing and durable acceptance", () => {
  it("keeps a dirty contextual card draft through browser Back, permits continued editing, then explicitly discards it", async () => {
    const { indexedDb } = await bootApplication()
    const before = await savedProfile(indexedDb)
    fireEvent.click(
      screen.getByRole("button", { name: copy.setup.customizeProfile }),
    )
    fireEvent.change(
      screen.getByRole("combobox", { name: copy.profile.cardTimeCategory }),
      { target: { value: "blitz" } },
    )
    act(() => window.history.back())
    const confirmation = within(await screen.findByRole("alertdialog"))
    expect(await savedProfile(indexedDb)).toEqual(before)
    fireEvent.click(
      confirmation.getByRole("button", {
        name: copy.interface.profileCardJourney.keepEditing,
      }),
    )
    expect(
      screen.getByRole("combobox", { name: copy.profile.cardTimeCategory }),
    ).toHaveProperty("value", "blitz")
    act(() => window.history.back())
    const reopened = within(await screen.findByRole("alertdialog"))
    fireEvent.click(
      reopened.getByRole("button", {
        name: copy.interface.profileCardJourney.discardChanges,
      }),
    )
    await screen.findByRole("button", {
      name: new RegExp(copy.setup.presentations.standard.story.title),
    })
    expect(await savedProfile(indexedDb)).toEqual(before)
  })

  it("saves a pending card draft from the leave-confirmation surface rather than losing it", async () => {
    const { indexedDb } = await bootApplication()
    fireEvent.click(
      screen.getByRole("button", { name: copy.setup.customizeProfile }),
    )
    fireEvent.change(
      screen.getByRole("combobox", { name: copy.profile.cardAssistance }),
      { target: { value: "gold" } },
    )
    act(() => window.history.back())
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: copy.interface.profileCardJourney.saveAppearance,
      }),
    )
    await waitFor(async () =>
      expect(
        (await savedProfile(indexedDb)).settings.cardRatingContext.assistance,
      ).toBe("gold"),
    )
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  it("retains a failed appearance draft and accepts it after durable retry", async () => {
    const { indexedDb } = await bootApplication()
    const before = await savedProfile(indexedDb)
    fireEvent.click(
      screen.getByRole("button", { name: copy.setup.customizeProfile }),
    )
    fireEvent.change(
      screen.getByRole("combobox", { name: copy.profile.cardTimeCategory }),
      { target: { value: "rapid" } },
    )
    const fail = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementationOnce(() => {
        throw new Error("Owned failed appearance write")
      })
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.profileDressingRoom.saveAppearance,
      }),
    )
    await screen.findByRole("button", {
      name: copy.interface.profilePersistenceFailurePanel
        .exportPendingPlayerData,
    })
    expect(await savedProfile(indexedDb)).toEqual(before)
    fail.mockRestore()
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.profilePersistenceFailurePanel.retrySave,
      }),
    )
    await waitFor(async () =>
      expect(
        (await savedProfile(indexedDb)).settings.cardRatingContext.category,
      ).toBe("rapid"),
    )
    expect(
      screen.getByRole("combobox", { name: copy.profile.cardTimeCategory }),
    ).toHaveProperty("value", "rapid")
  })

  it("opens a share preview from unsaved customization without committing it, then returns to the same draft", async () => {
    const { indexedDb } = await bootApplication()
    const before = await savedProfile(indexedDb)
    fireEvent.click(
      screen.getByRole("button", { name: copy.setup.customizeProfile }),
    )
    fireEvent.change(
      screen.getByRole("combobox", { name: copy.profile.cardTimeCategory }),
      { target: { value: "bullet" } },
    )
    fireEvent.click(
      within(
        screen.getByRole("region", { name: copy.setup.customizeProfile }),
      ).getByRole("button", {
        name: copy.interface.profileDressingRoom.shareProfileCard,
      }),
    )
    expect(
      screen.getByText(
        copy.interface.profileCardPreview
          .previewingUnsavedAppearanceImageExportDoesNot,
      ),
    ).toBeTruthy()
    expect(await savedProfile(indexedDb)).toEqual(before)
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.profileCardJourney.back,
      }),
    )
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: copy.profile.cardTimeCategory }),
      ).toHaveProperty("value", "bullet"),
    )
    expect(await savedProfile(indexedDb)).toEqual(before)
  })
  it.each(["Clothes", "Weapons", "Hair", "Skin", "Face"] as const)(
    "previews a %s change without mutating accepted appearance, then cancels",
    async (category) => {
      const { indexedDb, container } = await bootApplication()
      const before = await savedProfile(indexedDb)
      fireEvent.click(
        screen.getByRole("button", { name: copy.setup.customizeProfile }),
      )
      fireEvent.click(
        screen.getByRole("button", {
          name: copy.profile.dressing.categories[category],
        }),
      )
      const choices = dressingRoomChoices(
        category,
        before.appearance,
        copy.profile.dressing,
      )
      const different = choices.styles.find((choice) => !choice.selected)
      if (different === undefined)
        throw new Error("The category requires an alternative style.")
      fireEvent.click(screen.getByRole("button", { name: different.label }))
      expect(
        screen
          .getByRole("button", { name: different.label })
          .getAttribute("aria-pressed"),
      ).toBe("true")
      expect(container.querySelector("button button")).toBeNull()
      expect(
        screen.getAllByRole("button", {
          name: copy.interface.profileCard.retryArtwork,
        }).length,
      ).toBeGreaterThan(0)
      expect((await savedProfile(indexedDb)).appearance).toEqual(
        before.appearance,
      )
      fireEvent.click(
        screen.getByRole("button", {
          name: copy.interface.profileDressingRoom.cancelChanges,
        }),
      )
      await screen.findByRole("button", {
        name: new RegExp(copy.setup.presentations.standard.story.title),
      })
      expect((await savedProfile(indexedDb)).appearance).toEqual(
        before.appearance,
      )
    },
    15000,
  )
  it("saves appearance and contextual card ratings together, retaining every other rating", async () => {
    const { indexedDb } = await bootApplication()
    const before = await savedProfile(indexedDb)
    fireEvent.click(
      screen.getByRole("button", { name: copy.setup.customizeProfile }),
    )
    fireEvent.change(
      screen.getByRole("combobox", { name: copy.profile.cardTimeCategory }),
      { target: { value: "blitz" } },
    )
    fireEvent.change(
      screen.getByRole("combobox", { name: copy.profile.cardAssistance }),
      { target: { value: "gold" } },
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.profile.dressing.categories.Weapons,
      }),
    )
    const weapon = dressingRoomChoices(
      "Weapons",
      before.appearance,
      copy.profile.dressing,
    ).styles.find((choice) => !choice.selected)
    if (weapon === undefined)
      throw new Error("A weapon alternative must be offered.")
    fireEvent.click(screen.getByRole("button", { name: weapon.label }))
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.profileDressingRoom.saveAppearance,
      }),
    )
    await waitFor(async () => {
      const after = await savedProfile(indexedDb)
      expect(after.appearance).toEqual(weapon.appearance)
      expect(after.settings.cardRatingContext).toEqual({
        category: "blitz",
        assistance: "gold",
      })
      expect(after.ratings).toEqual(before.ratings)
      expect(after.totalXp).toBe(before.totalXp)
    })
  })
  it("keeps all categories discoverable and shows locked animals without granting them", async () => {
    const { indexedDb } = await bootApplication()
    const before = await savedProfile(indexedDb)
    fireEvent.click(
      screen.getByRole("button", { name: copy.setup.customizeProfile }),
    )
    const categories = within(
      screen.getByRole("group", {
        name: copy.interface.profileDressingRoom.appearanceCategories,
      }),
    )
    expect(categories.getAllByRole("button")).toHaveLength(6)
    fireEvent.click(
      categories.getByRole("button", {
        name: copy.profile.dressing.categories.Animal,
      }),
    )
    expect(
      screen.getByRole("button", {
        name: copy.interface.profileDressingRoom.backToCategories,
      }),
    ).toBeTruthy()
    const animals = within(
      screen.getByRole("region", {
        name: copy.interface.playerAnimalChoices.playerAnimals,
      }),
    )
    expect(
      animals.getByRole("radio", {
        name: new RegExp("^" + copy.animals.names["chicken-stockfish"]),
      }),
    ).toHaveProperty("disabled", true)
    expect(
      animals.getByRole("radio", {
        name: new RegExp("^" + copy.animals.names["raccoon-stockfish"]),
      }),
    ).toHaveProperty("checked", true)
    expect((await savedProfile(indexedDb)).storyProgress).toEqual(
      before.storyProgress,
    )
  })
  it("replays format preparation and content choices without saving the profile", async () => {
    const { indexedDb } = await bootApplication()
    const before = await savedProfile(indexedDb)
    fireEvent.click(
      screen.getByRole("button", { name: copy.setup.shareProfile }),
    )
    const gif = screen.getByRole("button", {
      name: copy.profile.cardFormats.GIF,
    })
    const png = screen.getByRole("button", {
      name: copy.profile.cardFormats.PNG,
    })
    expect(gif.getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(png)
    expect(png.getAttribute("aria-pressed")).toBe("true")
    for (const checkbox of screen.getAllByRole("checkbox"))
      fireEvent.click(checkbox)
    await screen.findByRole("button", { name: copy.profile.retryFormat("PNG") })
    fireEvent.click(
      screen.getByRole("button", { name: copy.profile.retryFormat("PNG") }),
    )
    await screen.findByRole("button", { name: copy.profile.retryFormat("PNG") })
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.profileCardJourney.back,
      }),
    )
    await screen.findByRole("button", {
      name: new RegExp(copy.setup.presentations.standard.story.title),
    })
    expect(await savedProfile(indexedDb)).toEqual(before)
  })
})
