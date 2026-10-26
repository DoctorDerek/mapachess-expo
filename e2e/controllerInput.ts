import { expect, type Locator, type Page } from "@playwright/test"

type InjectedPad = {
  id: string
  buttons: number[]
  axes: number[]
  mapping: string
  connected: boolean
}
declare global {
  interface Window {
    mapachessTestPads: InjectedPad[]
  }
}

export const frames = async (page: Page, count = 3): Promise<void> =>
  page.evaluate(async (remaining) => {
    for (let frame = 0; frame < remaining; frame++)
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      )
  }, count)

export const press = async (page: Page, button: number): Promise<void> => {
  await frames(page)
  await page.evaluate((index) => {
    const pad = window.mapachessTestPads[0]
    if (pad !== undefined) pad.buttons = [index]
  }, button)
  await frames(page)
  await page.evaluate(() => {
    const pad = window.mapachessTestPads[0]
    if (pad !== undefined) pad.buttons = []
  })
  await frames(page)
}
export const activate = async (
  page: Page,
  target: Locator,
  button = 0,
): Promise<void> => {
  await expect(target).toBeEnabled()
  await target.focus()
  await expect(target).toBeFocused()
  await press(page, button)
}

export const isolateControllerInput = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    window.mapachessTestPads ??= []
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () =>
        window.mapachessTestPads.map((pad, index) => ({
          id: pad.id,
          index,
          mapping: pad.mapping,
          connected: pad.connected,
          axes: pad.axes,
          buttons: Array.from({ length: 17 }, (_, button) => ({
            value: pad.buttons.includes(button) ? 1 : 0,
            pressed: pad.buttons.includes(button),
            touched: false,
          })),
        })),
    })
  })
}

export const injectControllerInput = async (page: Page): Promise<void> => {
  await isolateControllerInput(page)
  await page.addInitScript(() => {
    window.mapachessTestPads = [
      {
        id: "Steam Deck",
        buttons: [],
        axes: [0, 0],
        mapping: "standard",
        connected: true,
      },
    ]
  })
}

export default async function prepareControllerInput({
  page,
}: Readonly<{ page: Page }>): Promise<void> {
  await injectControllerInput(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto("/")
  await expect(
    page.getByRole("button", { name: "Standard Chess Story", exact: true }),
  ).toBeVisible()
  await frames(page)
}
