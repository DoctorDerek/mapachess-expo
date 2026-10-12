import { createHash } from "node:crypto"
import AxeBuilder from "@axe-core/playwright"
import { expect } from "@playwright/test"
import { createMapachessPortableBackup } from "../packages/profile/src/portableBackup.js"
import { requireSha256Hex } from "../packages/profile/src/sha256.js"
import prepareControllerInput, {
  activate,
  frames,
  press,
} from "./controllerInput.js"
import { test } from "./fixtures.js"
import savedProfile from "./savedProfile.js"

test.beforeEach(prepareControllerInput)

test("saves remapping atomically, recovers a failed write and updates effective glyphs", async ({
  page,
}, testInfo) => {
  await activate(
    page,
    page.getByRole("button", { name: "Settings", exact: true }),
  )
  await activate(
    page,
    page.getByRole("button", { name: "Controls", exact: true }),
  )
  await activate(
    page,
    page.getByRole("button", { name: "Confirm Bottom face", exact: true }),
  )
  await activate(
    page,
    page.getByRole("button", { name: "Right face", exact: true }),
  )
  await expect(page.getByText(/Already assigned to Cancel/)).toBeVisible()
  await activate(
    page,
    page.getByRole("button", { name: "Swap bindings", exact: true }),
  )
  await page.screenshot({
    path: testInfo.outputPath("controller-settings-1280.png"),
  })
  const before = await savedProfile(page)
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function () {
      IDBObjectStore.prototype.put = original
      throw new DOMException(
        "Injected controller setting save failure",
        "QuotaExceededError",
      )
    }
  })
  await activate(
    page,
    page.getByRole("button", { name: "Save controls", exact: true }),
  )
  const retry = page.getByRole("button", { name: "Retry save", exact: true })
  await expect(retry).toBeVisible()
  expect((await savedProfile(page)).settings.inputBindings).toEqual(
    before.settings.inputBindings,
  )
  await activate(page, retry)
  await expect
    .poll(
      async () =>
        (await savedProfile(page)).settings.inputBindings.controller.confirm,
    )
    .toEqual(["east"])
  await frames(page)
  await press(page, 0)
  await expect(
    page.getByRole("dialog", { name: "Your game customization" }),
  ).toHaveCount(0)
  await activate(
    page,
    page.getByRole("button", { name: "Settings", exact: true }),
    1,
  )
  await activate(
    page,
    page.getByRole("button", { name: "Controls", exact: true }),
    1,
  )
  await expect(
    page.getByRole("button", { name: "Confirm Right face", exact: true }),
  ).toBeVisible()
  await activate(
    page,
    page.getByRole("button", { name: "Restore defaults", exact: true }),
    1,
  )
  await press(page, 0)
  expect(
    (await savedProfile(page)).settings.inputBindings.controller.confirm,
  ).toEqual(["east"])
  await page.reload()
  await expect(
    page.getByRole("dialog", { name: "Your game customization" }),
  ).toBeVisible()
  await frames(page)
  await press(page, 0)
  await expect(
    page.getByRole("dialog", { name: "Your game customization" }),
  ).toHaveCount(0)
})

test("releases held input on new scopes and preserves keyboard remapping and normal text entry", async ({
  page,
}) => {
  await activate(
    page,
    page.getByRole("button", { name: "Settings", exact: true }),
  )
  await activate(
    page,
    page.getByRole("button", { name: "Controls", exact: true }),
  )
  await activate(
    page,
    page.getByRole("button", { name: "Keyboard", exact: true }),
  )
  await activate(
    page,
    page.getByRole("button", { name: "Better Hints H", exact: true }),
  )
  await page.keyboard.press("k")
  await expect(
    page.getByRole("button", { name: "Better Hints K", exact: true }),
  ).toBeVisible()
  await activate(
    page,
    page.getByRole("button", { name: "Save controls", exact: true }),
  )
  await expect
    .poll(
      async () =>
        (await savedProfile(page)).settings.inputBindings.keyboard.hints,
    )
    .toBe("KeyK")
  await press(page, 1)
  await page
    .getByRole("button", { name: "Chess960 Challenge", exact: true })
    .focus()
  await page.evaluate(() => {
    const pad = window.mapachessTestPads[0]
    if (pad !== undefined) pad.buttons = [0]
  })
  await frames(page, 35)
  await expect(
    page.getByRole("button", { name: "Start match", exact: true }),
  ).toBeVisible()
  await page.evaluate(() => {
    const pad = window.mapachessTestPads[0]
    if (pad !== undefined) pad.buttons = []
  })
  await frames(page)
  await page.getByRole("spinbutton").fill("123")
  await expect(page.getByRole("spinbutton")).toHaveValue("123")
  await page.keyboard.press("Tab")
  await expect(page.getByRole("button", { name: /Randomize/ })).toBeFocused()
})

test("honors a remapped Home key on the board while preserving unassigned End navigation", async ({
  page,
}) => {
  test.setTimeout(60000)
  await activate(
    page,
    page.getByRole("button", { name: "Settings", exact: true }),
  )
  await activate(
    page,
    page.getByRole("radio", { name: "No Auto Hints", exact: true }),
  )
  await activate(
    page,
    page.getByRole("button", { name: "Controls", exact: true }),
  )
  await activate(
    page,
    page.getByRole("button", { name: "Keyboard", exact: true }),
  )
  await activate(
    page,
    page.getByRole("button", { name: "Better Hints H", exact: true }),
  )
  await page.keyboard.press("Home")
  await activate(
    page,
    page.getByRole("button", { name: "Save controls", exact: true }),
  )
  await expect
    .poll(
      async () =>
        (await savedProfile(page)).settings.inputBindings.keyboard.hints,
    )
    .toBe("Home")
  await press(page, 1)
  await activate(
    page,
    page.getByRole("button", { name: "Standard Chess Challenge", exact: true }),
  )
  await activate(
    page,
    page.getByRole("button", { name: "Start match", exact: true }),
  )
  const e2 = page.getByRole("gridcell", { name: /^e2, White pawn/ })
  await expect(e2).toHaveAttribute("aria-disabled", "false", { timeout: 30000 })
  await e2.focus()
  await page.keyboard.press("Home")
  await expect(
    page.getByRole("button", { name: /Show Move Hints/ }),
  ).toBeEnabled({ timeout: 30000 })
  await expect(e2).toBeFocused()
  await page.keyboard.press("End")
  await expect(
    page.getByRole("gridcell", { name: /^h2, White pawn/ }),
  ).toBeFocused()
  await page.keyboard.press("Home")
  await expect(page.locator('[data-hint-kind="move"]')).toHaveCount(6)
})

test("retains last intentional device and rejects reconnect, background and second-pad held input", async ({
  page,
}) => {
  await activate(
    page,
    page.getByRole("button", { name: "Settings", exact: true }),
  )
  await activate(
    page,
    page.getByRole("button", { name: "Controls", exact: true }),
  )
  const method = page.locator("[data-input-method]")
  await expect(method).toHaveAttribute("data-input-method", "controller")
  await page.evaluate(() => {
    window.mapachessTestPads.push({
      id: "XInput controller",
      buttons: [],
      axes: [0.2, 0.1],
      mapping: "standard",
      connected: true,
    })
  })
  await frames(page)
  await expect(page.locator('img[src$="steamdeck_button_a.png"]')).toBeVisible()
  await page.keyboard.press("Tab")
  await expect(method).toHaveAttribute("data-input-method", "keyboard")
  await page.evaluate(() => {
    window.mapachessTestPads[0]!.connected = false
  })
  await frames(page)
  await expect(method).toHaveAttribute("data-input-method", "keyboard")
  await page.evaluate(() => {
    window.mapachessTestPads[0]!.connected = true
    window.mapachessTestPads[0]!.buttons = [1]
  })
  await frames(page)
  await expect(
    page.getByRole("button", { name: "Restore defaults", exact: true }),
  ).toBeVisible()
  await page.evaluate(() => {
    window.mapachessTestPads[0]!.buttons = []
  })
  await press(page, 13)
  await page.evaluate(() => {
    window.mapachessTestPads[1]!.buttons = [1]
  })
  await frames(page)
  await expect(
    page.getByRole("button", { name: "Restore defaults", exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("dialog", { name: "Your game customization" }),
  ).toBeVisible()
  await page.evaluate(() => {
    window.mapachessTestPads[1]!.connected = false
  })
  await frames(page)
  await expect(method).toHaveAttribute("data-input-method", "keyboard")
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"))
    window.mapachessTestPads[0]!.buttons = [1]
  })
  await frames(page)
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await frames(page)
  await expect(
    page.getByRole("dialog", { name: "Your game customization" }),
  ).toBeVisible()
  await page.evaluate(() => {
    window.mapachessTestPads[0]!.buttons = []
  })
  await press(page, 1)
  await expect(
    page.getByRole("dialog", { name: "Your game customization" }),
  ).toHaveCount(0)
})

for (const width of [320, 1279]) {
  test(`keeps ${width}px controls visible with Reduced Motion`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 800 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await activate(
      page,
      page.getByRole("button", { name: "Settings", exact: true }),
    )
    await activate(
      page,
      page.getByRole("button", { name: "Controls", exact: true }),
    )
    await expect(
      page.getByRole("button", { name: "Controller", exact: true }),
    ).toBeInViewport()
    expect(
      (
        await new AxeBuilder({ page })
          .include('[aria-label="Controls"]')
          .analyze()
      ).violations,
    ).toEqual([])
    await expect
      .poll(() =>
        page
          .locator('img[src^="/input-prompts/"]')
          .evaluateAll((images) =>
            images.every(
              (image) =>
                image instanceof HTMLImageElement && image.naturalWidth > 0,
            ),
          ),
      )
      .toBe(true)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath(`controller-settings-${width}.png`),
    })
    await activate(
      page,
      page.getByRole("button", { name: "Confirm Bottom face", exact: true }),
    )
    await expect(
      page.getByRole("dialog", { name: "Change Confirm binding" }),
    ).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath(`controller-chooser-${width}.png`),
    })
    await press(page, 1)
    await expect(
      page.getByRole("button", { name: "Confirm Bottom face", exact: true }),
    ).toBeFocused()
    await press(page, 1)
    await press(page, 1)
  })
}

test("remaps an alternate and leaves canceling recovery and import previews non-destructive", async ({
  page,
}) => {
  await activate(
    page,
    page.getByRole("button", { name: "Settings", exact: true }),
  )
  await activate(
    page,
    page.getByRole("button", { name: "Controls", exact: true }),
  )
  await activate(
    page,
    page.getByRole("button", {
      name: "Up D-pad up Left stick up",
      exact: true,
    }),
  )
  await activate(
    page,
    page.getByRole("button", { name: "Alternate: Left stick up", exact: true }),
  )
  await activate(page, page.getByRole("button", { name: "View", exact: true }))
  await activate(
    page,
    page.getByRole("button", { name: "Save controls", exact: true }),
  )
  await expect
    .poll(
      async () =>
        (await savedProfile(page)).settings.inputBindings.controller.up,
    )
    .toEqual(["dpadUp", "view"])
  const profile = await savedProfile(page)
  const rawBackup = await createMapachessPortableBackup({
    playerData: profile,
    applicationVersion: "local-test",
    gddRevision: "5.2",
    sha256: async (value) =>
      requireSha256Hex(createHash("sha256").update(value).digest("hex")),
  })
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("mapachess-player-data")
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction(
          "durable-player-data",
          "readwrite",
        )
        transaction
          .objectStore("durable-player-data")
          .put("{corrupt-controller-test", "current")
        transaction.oncomplete = () => {
          database.close()
          resolve()
        }
        transaction.onerror = () => {
          database.close()
          reject(transaction.error)
        }
      }
    })
  })
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "Your save needs attention." }),
  ).toBeVisible()
  await activate(
    page,
    page.getByRole("button", { name: "Review Full Local Reset", exact: true }),
  )
  await expect(
    page.getByRole("heading", { name: "Reset all local player data?" }),
  ).toBeVisible()
  await press(page, 1)
  await expect(
    page.getByRole("heading", { name: "Reset all local player data?" }),
  ).toHaveCount(0)
  await page.locator('input[type="file"]').setInputFiles({
    name: "profile.json",
    mimeType: "application/json",
    buffer: Buffer.from(rawBackup),
  })
  await expect(
    page.getByRole("button", { name: "Cancel Import", exact: true }),
  ).toBeVisible()
  await press(page, 1)
  await expect(
    page.getByRole("heading", { name: "Your save needs attention." }),
  ).toBeVisible()
  const download = page.waitForEvent("download")
  await page
    .getByRole("button", { name: "Export Unreadable Data", exact: true })
    .click()
  const stream = await (await download).createReadStream()
  if (stream === null) throw new Error("Expected preserved raw-data download")
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  expect(Buffer.concat(chunks).toString()).toBe("{corrupt-controller-test")
})

test("leaves keyboard and pointer usable when controller mapping or access is unavailable", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.evaluate(() => {
    window.mapachessTestPads[0]!.mapping = ""
  })
  await press(page, 0)
  await expect(
    page.getByRole("button", { name: "Standard Chess Story", exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await page.evaluate(() =>
    Object.defineProperty(navigator, "getGamepads", {
      value: () => {
        throw new DOMException("Gamepad denied", "SecurityError")
      },
    }),
  )
  await frames(page)
  await page.keyboard.press("Escape")
  await expect(
    page.getByRole("dialog", { name: "Your game customization" }),
  ).toHaveCount(0)
  expect(errors).toEqual([])
})
