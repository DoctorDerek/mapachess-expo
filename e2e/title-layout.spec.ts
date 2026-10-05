import { expect, test } from "@playwright/test"

for (const { width, rootSize, titleSize } of [
  { width: 320, rootSize: 16, titleSize: 30 },
  { width: 412, rootSize: 16, titleSize: 30 },
  { width: 1279, rootSize: 16, titleSize: 30 },
  { width: 1280, rootSize: 16, titleSize: 36 },
  { width: 1440, rootSize: 16, titleSize: 36 },
  { width: 320, rootSize: 20, titleSize: 37.5 },
]) {
  test(`larger title fits at ${width}px with ${rootSize}px browser text`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/")
    await page.evaluate((size) => {
      document.documentElement.style.fontSize = `${size}px`
    }, rootSize)
    const title = page.getByRole("img", { name: "Mapachess", exact: true })
    const lettering = title.locator(":scope > span").last()
    const settings = page.getByRole("button", {
      name: "Settings",
      exact: true,
    })
    await expect(title).toBeVisible()
    await expect(lettering).toHaveCSS("font-size", `${titleSize}px`)
    await expect(settings).toBeVisible()
    const titleBounds = await title.boundingBox()
    const settingsBounds = await settings.boundingBox()
    if (titleBounds === null || settingsBounds === null)
      throw new Error("Title and Settings must have visible bounds.")
    expect(titleBounds.x).toBeGreaterThanOrEqual(0)
    expect(titleBounds.x + titleBounds.width).toBeLessThanOrEqual(width)
    expect(settingsBounds.x + settingsBounds.width).toBeLessThanOrEqual(width)
    expect(
      titleBounds.x + titleBounds.width <= settingsBounds.x ||
        titleBounds.y + titleBounds.height <= settingsBounds.y,
    ).toBe(true)
    await settings.click()
    await expect(
      page.getByRole("heading", { name: "Settings & Player Data" }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Close Settings" }).click()
    await expect(title).toBeVisible()
    await testInfo.attach("actual-title-layout", {
      body: await page.screenshot(),
      contentType: "image/png",
    })
  })
}
