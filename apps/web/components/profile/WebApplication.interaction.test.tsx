// @vitest-environment happy-dom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { IDBFactory } from "fake-indexeddb"
import { describe, expect, it, vi } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import createInitialPlayerData from "@mapachess/profile/player-data"
import WebMapachessApplication from "@/components/profile/WebMapachessApplication"
import IndexedDbDurableStore from "@/lib/profile/IndexedDbDurableStore"
import * as backupFiles from "@/lib/profile/webPlayerDataFiles"
import {
  bootApplication as boot,
  savedProfile,
  openSettings as settings,
} from "@/test/applicationHarness"
import { installDomHarness } from "@/test/domHarness"

installDomHarness()
const copy = loadCatalog("en")

async function importFile(container: HTMLElement, text: string) {
  const file = new File([text], "mapachess.json", { type: "application/json" })
  Object.defineProperty(file, "text", { value: async () => text })
  const input = container.querySelector('input[type="file"]')
  if (!(input instanceof HTMLInputElement))
    throw new Error("The import control must expose a file input.")
  fireEvent.change(input, { target: { files: [file] } })
}

describe("local application boot and player journeys", () => {
  it("changes the first-arrival language, keeps it through Start, and changes it again later in Settings", async () => {
    const indexedDb = new IDBFactory()
    vi.stubGlobal("indexedDB", indexedDb)
    render(<WebMapachessApplication />)
    const spanish = loadCatalog("es-419")
    const language = await screen.findByRole("combobox", {
      name: copy.introduction.language,
    })
    fireEvent.change(language, { target: { value: "es-419" } })
    const start = await screen.findByRole("button", {
      name: spanish.introduction.start,
    })
    await waitFor(() => expect(start).toHaveProperty("disabled", false))
    fireEvent.click(start)
    await waitFor(async () =>
      expect((await savedProfile(indexedDb)).introductionCompleted).toBe(true),
    )
    await act(async () => {
      await vi.dynamicImportSettled()
    })
    await screen.findByRole(
      "button",
      { name: new RegExp(spanish.setup.presentations.standard.story.title) },
      { timeout: 5000 },
    )
    expect((await savedProfile(indexedDb)).settings.locale).toBe("es-419")
    fireEvent.click(
      screen.getByRole("button", { name: spanish.interface.webGame.settings }),
    )
    fireEvent.change(
      screen.getByRole("combobox", { name: spanish.introduction.language }),
      { target: { value: "en" } },
    )
    await screen.findByRole("dialog", { name: copy.profile.settingsTitle })
    await waitFor(async () =>
      expect((await savedProfile(indexedDb)).settings.locale).toBe("en"),
    )
    expect((await savedProfile(indexedDb)).introductionCompleted).toBe(true)
  }, 15000)

  it("resets only the confirmed rating context after importing real earned counts", async () => {
    const view = await boot()
    const initial = createInitialPlayerData()
    const data = {
      ...initial,
      introductionCompleted: true,
      totalXp: 4,
      ratings: {
        ...initial.ratings,
        "standard-untimed-gold": 650,
        "standard-untimed-silver": 450,
      },
      ratedMatchCounts: {
        ...initial.ratedMatchCounts,
        "standard-untimed-gold": 7,
        "standard-untimed-silver": 9,
      },
    }
    const backup = await backupFiles.createWebPlayerDataBackup(
      data,
      crypto.subtle,
    )
    await settings()
    await importFile(view.container, backup)
    fireEvent.click(
      await screen.findByRole("button", {
        name: copy.interface.profileImportPreviewPanel.replaceLocalPlayerData,
      }),
    )
    await waitFor(async () =>
      expect((await savedProfile(view.indexedDb)).ratings).toEqual(
        data.ratings,
      ),
    )
    const panel = await settings()
    const rating = copy.gameplay.clock.rating(
      copy.setup.variants.standard,
      copy.gameplay.clock.category.untimed,
      copy.shared.story.medals.gold,
    )
    fireEvent.click(
      panel.getByRole("button", { name: copy.profile.resetRating(rating) }),
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.profile.resetConfirmation(rating),
      }),
    )
    await waitFor(async () =>
      expect(
        (await savedProfile(view.indexedDb)).ratedMatchCounts[
          "standard-untimed-gold"
        ],
      ).toBe(0),
    )
    const saved = await savedProfile(view.indexedDb)
    expect(saved.ratings).toEqual({
      ...data.ratings,
      "standard-untimed-gold": 100,
    })
    expect(saved.ratedMatchCounts).toEqual({
      ...data.ratedMatchCounts,
      "standard-untimed-gold": 0,
    })
    expect(saved.totalXp).toBe(4)
    expect(saved.storyProgress).toEqual(data.storyProgress)
  })

  it("cancels an in-progress integrity check without accepting its late import result", async ({
    onTestFinished,
  }) => {
    const indexedDb = new IDBFactory()
    const storage = new IndexedDbDurableStore(indexedDb)
    onTestFinished(async () => storage.close())
    const empty = await storage.read()
    const before = { ...empty, current: "Unreadable but preserved original" }
    await storage.compareAndSwapVerified({ expected: empty, next: before })
    vi.stubGlobal("indexedDB", indexedDb)
    const backup = await backupFiles.createWebPlayerDataBackup(
      createInitialPlayerData(),
      crypto.subtle,
    )
    const view = render(<WebMapachessApplication />)
    await screen.findByRole("heading", {
      name: copy.interface.profileRecoveryPanel.yourSaveNeedsAttention,
    })
    const gate = Promise.withResolvers<void>()
    onTestFinished(() => gate.resolve())
    const digest = crypto.subtle.digest.bind(crypto.subtle)
    vi.spyOn(crypto.subtle, "digest").mockImplementationOnce(
      (algorithm, data) => {
        const result = digest(algorithm, data)
        return gate.promise.then(() => result)
      },
    )
    await importFile(view.container, backup)
    fireEvent.click(
      await screen.findByRole("button", {
        name: copy.interface.webMapachessApplication.cancelImport,
      }),
    )
    gate.resolve()
    await waitFor(() =>
      expect(
        screen.queryByRole("button", {
          name: copy.interface.profileImportPreviewPanel.replaceLocalPlayerData,
        }),
      ).toBeNull(),
    )
    expect(await storage.read()).toEqual(before)
  })
  it("recovers unsupported storage in place and completes first arrival", async () => {
    vi.stubGlobal("indexedDB", undefined)
    render(<WebMapachessApplication />)
    expect(
      await screen.findByRole("heading", {
        name: copy.interface.webMapachessApplication.localSavesAreUnavailable,
      }),
    ).toBeTruthy()
    vi.stubGlobal("indexedDB", new IDBFactory())
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.webMapachessApplication.tryAgain,
      }),
    )
    expect(
      await screen.findByRole("button", { name: copy.introduction.start }),
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", { name: copy.introduction.start }),
    )
    expect(
      await screen.findByRole(
        "button",
        { name: new RegExp(copy.setup.presentations.standard.story.title) },
        { timeout: 5000 },
      ),
    ).toBeTruthy()
  })
  it("saves Auto-Hints without reopening the settings surface", async () => {
    await boot()
    const panel = await settings()
    for (const mode of [
      "no-auto-hints",
      "auto-piece-hints",
      "auto-move-hints",
    ] as const) {
      fireEvent.click(
        panel.getByRole("radio", { name: copy.setup.autoHints[mode].label }),
      )
      await waitFor(() =>
        expect(
          panel.getByRole("radio", { name: copy.setup.autoHints[mode].label }),
        ).toHaveProperty("checked", true),
      )
    }
    fireEvent.click(
      panel.getByRole("button", {
        name: copy.interface.profileSettingsPanel.closeSettings,
      }),
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    const reopened = await settings()
    expect(
      reopened.getByRole("radio", {
        name: copy.setup.autoHints["auto-move-hints"].label,
      }),
    ).toHaveProperty("checked", true)
  })
  it.each(["coach", "pieces", "board"] as const)(
    "opens the %s picker and returns without leaving Settings",
    async (kind) => {
      await boot()
      const panel = await settings()
      fireEvent.click(
        panel.getByRole("button", {
          name: copy.profile.customization[kind].change,
        }),
      )
      const picker = within(
        screen.getByRole("dialog", {
          name: copy.profile.customization[kind].label,
        }),
      )
      expect(picker.getAllByRole("radio").length).toBeGreaterThan(1)
      fireEvent.click(
        picker.getByRole("button", {
          name: copy.profile.customization[kind].done,
        }),
      )
      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", {
            name: copy.profile.customization[kind].label,
          }),
        ).toBeNull(),
      )
      expect(
        screen.getByRole("dialog", { name: copy.profile.settingsTitle }),
      ).toBeTruthy()
    },
  )
  it("opens readable Credits, hint help, classifications, and Elo explanation with Back", async () => {
    await boot()
    let panel = await settings()
    fireEvent.click(
      panel.getByRole("button", { name: copy.shared.creditControls.title }),
    )
    expect(
      await screen.findByRole("heading", {
        name: copy.shared.creditControls.title,
      }),
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", { name: copy.shared.settingsControls.back }),
    )
    panel = within(
      await screen.findByRole("dialog", { name: copy.profile.settingsTitle }),
    )
    fireEvent.click(
      panel.getByRole("button", {
        name: copy.shared.settingsControls.explainAutoHints,
      }),
    )
    expect(
      await screen.findByRole("heading", {
        name: copy.shared.settingsControls.autoHints,
      }),
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", { name: copy.shared.settingsControls.back }),
    )
    panel = within(
      await screen.findByRole("dialog", { name: copy.profile.settingsTitle }),
    )
    fireEvent.click(
      panel.getByRole("button", {
        name: copy.interface.profileSettingsPanel.aboutEloRatings,
      }),
    )
    expect(
      screen.getByRole("dialog", {
        name: copy.interface.profileSettingsPanel.aboutEloRatings,
      }),
    ).toBeTruthy()
    fireEvent.click(
      within(
        screen.getByRole("dialog", {
          name: copy.interface.profileSettingsPanel.aboutEloRatings,
        }),
      ).getByRole("button", { name: copy.shared.settingsControls.back }),
    )
  })
  it.each(["untimed", "bullet", "blitz", "rapid"] as const)(
    "exposes six independently scoped %s rating resets and safely cancels",
    async (category) => {
      await boot()
      const panel = await settings()
      fireEvent.click(
        panel.getByRole("radio", {
          name: copy.gameplay.clock.category[category],
        }),
      )
      const rating = copy.gameplay.clock.rating(
        copy.setup.variants.standard,
        copy.gameplay.clock.category[category],
        copy.shared.story.medals.gold,
      )
      fireEvent.click(
        panel.getByRole("button", { name: copy.profile.resetRating(rating) }),
      )
      const dialog = within(
        screen.getByRole("dialog", {
          name: copy.profile.resetQuestion(rating),
        }),
      )
      expect(
        dialog.getByRole("button", {
          name: copy.profile.resetConfirmation(rating),
        }),
      ).toBeTruthy()
      fireEvent.click(
        dialog.getByRole("button", {
          name: copy.interface.profileSettingsPanel.cancel,
        }),
      )
      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", {
            name: copy.profile.resetQuestion(rating),
          }),
        ).toBeNull(),
      )
    },
  )
  it("exports a verified whole-profile backup and retains a usable app after download failure", async () => {
    const download = vi
      .spyOn(backupFiles, "downloadTextFile")
      .mockImplementation(() => undefined)
    await boot()
    const panel = await settings()
    fireEvent.click(
      panel.getByRole("button", {
        name: copy.interface.profileSettingsPanel.exportPlayerData,
      }),
    )
    await waitFor(() => expect(download).toHaveBeenCalledOnce())
    const raw = download.mock.calls[0]?.[0]
    expect(raw).toMatch(/"introductionCompleted":\s*true/)
    expect(raw).toContain('"integrity"')
    download.mockImplementation(() => {
      throw new Error("Blocked download")
    })
    fireEvent.click(
      panel.getByRole("button", {
        name: copy.interface.profileSettingsPanel.exportPlayerData,
      }),
    )
    expect(
      await screen.findByText(
        copy.interface.webMapachessApplication.theDownloadCouldNotBeCreatedYour,
      ),
    ).toBeTruthy()
    expect(
      panel.getByRole("button", {
        name: copy.interface.profileSettingsPanel.closeSettings,
      }),
    ).toBeTruthy()
  })
  it("previews, cancels, then accepts a real integrity-checked backup without silent replacement", async () => {
    const view = await boot()
    const homePlay = screen.getByRole("button", {
      name: new RegExp(copy.setup.presentations.standard.story.title),
    })
    const before = await savedProfile(view.indexedDb)
    const data = {
      ...createInitialPlayerData(),
      introductionCompleted: true,
      totalXp: 4,
    }
    const backup = await backupFiles.createWebPlayerDataBackup(
      data,
      crypto.subtle,
    )
    const panel = await settings()
    const importTrigger = panel.getByRole("button", {
      name: copy.interface.profileFoundation.importBackup,
    })
    importTrigger.focus()
    await importFile(view.container, backup)
    expect(
      await screen.findByRole("heading", {
        name: copy.interface.profileImportPreviewPanel
          .reviewBeforeReplacingLocalData,
      }),
    ).toBeTruthy()
    expect(homePlay.isConnected).toBe(true)
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.profileImportPreviewPanel.cancelImport,
      }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", {
          name: copy.interface.profileImportPreviewPanel
            .reviewBeforeReplacingLocalData,
        }),
      ).toBeNull(),
    )
    expect(document.activeElement).toBe(
      screen.getByRole("button", {
        name: copy.interface.profileSettingsPanel.closeSettings,
      }),
    )
    expect(
      screen.getByRole("button", {
        name: new RegExp(copy.setup.presentations.standard.story.title),
      }),
    ).toBe(homePlay)
    expect(await savedProfile(view.indexedDb)).toEqual(before)
    await importFile(view.container, backup)
    fireEvent.click(
      await screen.findByRole("button", {
        name: copy.interface.profileImportPreviewPanel.replaceLocalPlayerData,
      }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole("button", {
          name: copy.interface.profileImportPreviewPanel.replaceLocalPlayerData,
        }),
      ).toBeNull(),
    )
    expect(
      screen.getByRole("dialog", { name: copy.profile.settingsTitle }),
    ).toBeTruthy()
  })
  it("rejects malformed imports without stranding the current profile", async () => {
    const view = await boot()
    await settings()
    await importFile(view.container, "not JSON")
    expect(
      await screen.findByText(copy.profile.importIssue.invalid),
    ).toBeTruthy()
    expect(
      screen.queryByRole("button", {
        name: copy.interface.profileImportPreviewPanel.replaceLocalPlayerData,
      }),
    ).toBeNull()
  })
  it("reviews a backup from corrupt-save recovery, cancels safely, then replaces only on explicit confirmation", async ({
    onTestFinished,
  }) => {
    const indexedDb = new IDBFactory()
    const storage = new IndexedDbDurableStore(indexedDb)
    onTestFinished(() => storage.close())
    const empty = await storage.read()
    const original = {
      ...empty,
      current: "corrupt save kept until confirmation",
    }
    await storage.compareAndSwapVerified({ expected: empty, next: original })
    vi.stubGlobal("indexedDB", indexedDb)
    const view = render(<WebMapachessApplication />)
    await screen.findByRole("button", {
      name: copy.interface.profileFoundation.importBackup,
    })
    const backup = await backupFiles.createWebPlayerDataBackup(
      { ...createInitialPlayerData(), totalXp: 12 },
      crypto.subtle,
    )
    await importFile(view.container, backup)
    await screen.findByRole("heading", {
      name: copy.interface.profileImportPreviewPanel
        .reviewBeforeReplacingLocalData,
    })
    fireEvent.click(
      await screen.findByRole("button", {
        name: copy.interface.profileImportPreviewPanel.cancelImport,
      }),
    )
    expect(await storage.read()).toEqual(original)
    await screen.findByRole("button", {
      name: copy.interface.profileFoundation.importBackup,
    })
    await importFile(view.container, backup)
    fireEvent.click(
      await screen.findByRole("button", {
        name: copy.interface.profileImportPreviewPanel.replaceLocalPlayerData,
      }),
    )
    await screen.findByRole("button", { name: copy.introduction.start })
    expect((await savedProfile(indexedDb)).totalXp).toBe(12)
  })
  it("preserves unreadable bytes and makes a full reset explicitly cancelable", async () => {
    const indexedDb = new IDBFactory()
    const storage = new IndexedDbDurableStore(indexedDb)
    const expected = await storage.read()
    await storage.compareAndSwapVerified({
      expected,
      next: { ...expected, current: "unreadable saved data" },
    })
    await storage.close()
    vi.stubGlobal("indexedDB", indexedDb)
    const download = vi
      .spyOn(backupFiles, "downloadTextFile")
      .mockImplementation(() => undefined)
    render(<WebMapachessApplication />)
    await screen.findByRole("heading", {
      name: copy.interface.profileRecoveryPanel.yourSaveNeedsAttention,
    })
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.profileRecoveryPanel.exportUnreadableData,
      }),
    )
    expect(download).toHaveBeenCalledWith(
      "unreadable saved data",
      backupFiles.MAPACHESS_UNREADABLE_DATA_FILE_NAME,
      "text/plain;charset=utf-8",
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.profileRecoveryPanel.reviewFullLocalReset,
      }),
    )
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: copy.interface.profileRecoveryPanel.cancel,
      }),
    )
    expect(await storage.read()).toHaveProperty(
      "current",
      "unreadable saved data",
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.profileRecoveryPanel.tryAgain,
      }),
    )
    await screen.findByRole("heading", {
      name: copy.interface.profileRecoveryPanel.yourSaveNeedsAttention,
    })
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.profileRecoveryPanel.reviewFullLocalReset,
      }),
    )
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: copy.interface.profileRecoveryPanel.resetAllLocalPlayerData2,
      }),
    )
    await screen.findByRole("button", { name: copy.introduction.start })
    expect(await savedProfile(indexedDb)).toEqual(createInitialPlayerData())
    await storage.close()
  })
})
