// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import createInitialPlayerData from "@mapachess/profile/player-data"
import { installDomHarness } from "../../test/domHarness"
import ProfileCardPreview from "./ProfileCardPreview"

const rendering = vi.hoisted(() => ({ prepare: vi.fn() }))
vi.mock("../../lib/presentation/profileCardExport", async (original) => ({
  ...(await original<
    typeof import("../../lib/presentation/profileCardExport")
  >()),
  default: rendering.prepare,
}))
installDomHarness()
const copy = loadCatalog("en")
beforeEach(() => {
  rendering.prepare.mockImplementation(
    async ({ format }: { format: string }) =>
      new File(
        ["Owned image output"],
        `Mapachess-profile.${format.toLowerCase()}`,
        { type: format === "PNG" ? "image/png" : "image/gif" },
      ),
  )
})

async function preview(
  share: () => Promise<void> = vi.fn(async () => undefined),
  canShare = vi.fn(() => true),
) {
  vi.stubGlobal("navigator", { share, canShare })
  const data = createInitialPlayerData()
  const back = vi.fn()
  const view = render(
    <ProfileCardPreview
      data={data}
      appearance={data.appearance}
      ratingContext={data.settings.cardRatingContext}
      unsaved
      onBack={back}
    />,
  )
  await screen.findByRole("button", { name: copy.profile.shareFormat("GIF") })
  return { ...view, share, canShare, back, data }
}

describe("profile-card file sharing and download recovery", () => {
  it("shares the prepared file, disables conflicting actions while sharing, and preserves unsaved appearance", async () => {
    const pending = Promise.withResolvers<void>()
    const shared = vi.fn(() => pending.promise)
    const view = await preview(shared)
    const button = screen.getByRole("button", {
      name: copy.profile.shareFormat("GIF"),
    })
    fireEvent.click(button)
    expect(shared).toHaveBeenCalledExactlyOnceWith({
      files: [
        expect.objectContaining({
          name: "Mapachess-profile.gif",
          type: "image/gif",
        }),
      ],
    })
    expect(button.hasAttribute("disabled")).toBe(true)
    expect(
      screen
        .getByRole("button", { name: copy.interface.profileCardJourney.back })
        .hasAttribute("disabled"),
    ).toBe(true)
    fireEvent.click(button)
    expect(shared).toHaveBeenCalledOnce()
    await act(async () => pending.resolve())
    expect(screen.getByRole("status").textContent).toContain(
      copy.profile.shared,
    )
    expect(view.data).toEqual(createInitialPlayerData())
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.profileCardJourney.back,
      }),
    )
    expect(view.back).toHaveBeenCalledOnce()
  })

  it.each([
    new DOMException("Player canceled", "AbortError"),
    new Error("Share provider unavailable"),
  ])(
    "recovers a share rejection without trapping the preview: %s",
    async (reason) => {
      await preview(
        vi.fn(async () => {
          throw reason
        }),
      )
      fireEvent.click(
        screen.getByRole("button", { name: copy.profile.shareFormat("GIF") }),
      )
      await waitFor(() =>
        expect(
          screen
            .getByRole("button", {
              name: copy.interface.profileCardJourney.back,
            })
            .hasAttribute("disabled"),
        ).toBe(false),
      )
      expect(screen.getByRole("status").textContent).toBe(
        reason instanceof DOMException ? "" : copy.profile.shareFailed,
      )
    },
  )

  it("omits unsupported file sharing, including a capability check that throws, while keeping image download available", async () => {
    vi.stubGlobal("navigator", {
      share: vi.fn(),
      canShare: () => {
        throw new Error("Capability unavailable")
      },
    })
    const data = createInitialPlayerData()
    render(
      <ProfileCardPreview
        data={data}
        appearance={data.appearance}
        ratingContext={data.settings.cardRatingContext}
        unsaved={false}
        onBack={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: copy.profile.saveFormat("GIF") })
          .hasAttribute("disabled"),
      ).toBe(false),
    )
    expect(
      screen.queryByRole("button", { name: copy.profile.shareFormat("GIF") }),
    ).toBeNull()
    expect(screen.getByRole("status").textContent).toContain(
      copy.profile.saveToShare,
    )
  })

  it.each([false, true])(
    "releases download URLs and removes temporary links even when browser saving fails: %s",
    async (fail) => {
      await preview()
      const originalCreate = Object.getOwnPropertyDescriptor(
        URL,
        "createObjectURL",
      )
      const originalRevoke = Object.getOwnPropertyDescriptor(
        URL,
        "revokeObjectURL",
      )
      const create = vi.fn(() => "blob:owned-profile-output")
      const revoke = vi.fn()
      Object.defineProperties(URL, {
        createObjectURL: { configurable: true, value: create },
        revokeObjectURL: { configurable: true, value: revoke },
      })
      onTestFinished(() => {
        if (originalCreate === undefined)
          Reflect.deleteProperty(URL, "createObjectURL")
        else Object.defineProperty(URL, "createObjectURL", originalCreate)
        if (originalRevoke === undefined)
          Reflect.deleteProperty(URL, "revokeObjectURL")
        else Object.defineProperty(URL, "revokeObjectURL", originalRevoke)
      })
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
        if (fail) throw new Error("Download unavailable")
      })
      fireEvent.click(
        screen.getByRole("button", { name: copy.profile.saveFormat("GIF") }),
      )
      expect(create).toHaveBeenCalledOnce()
      expect(revoke).toHaveBeenCalledExactlyOnceWith(
        "blob:owned-profile-output",
      )
      expect(document.querySelector("a[download]")).toBeNull()
      expect(screen.getByRole("status").textContent).toBe(
        fail
          ? copy.profile.downloadFailed
          : copy.profile.downloadRequested("GIF"),
      )
    },
  )
})
