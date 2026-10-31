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
    mapachessTestTap: (button: number) => Promise<void>
  }
}

export const frames = async (page: Page, count = 3): Promise<void> =>
  page.evaluate(async (remaining) => {
    for (let frame = 0; frame < remaining; frame++)
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      )
  }, count)

export const press = async (page: Page, button: number): Promise<void> =>
  page.evaluate((index) => window.mapachessTestTap(index), button)
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
    let tap: {
      samples: number[][]
      complete: () => void
    } | null = null
    window.mapachessTestTap = (button) =>
      new Promise<void>((complete) => {
        if (window.mapachessTestPads[0] === undefined)
          throw new Error("A controller must be connected before tapping")
        if (tap !== null)
          throw new Error("Await the previous controller tap before tapping")
        tap = { samples: [[], [button], []], complete }
      })
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => {
        const pads = window.mapachessTestPads.map((pad, index) => {
          const buttons =
            index === 0 && tap !== null
              ? (tap.samples.shift() ?? pad.buttons)
              : pad.buttons
          return {
            id: pad.id,
            index,
            mapping: pad.mapping,
            connected: pad.connected,
            axes: pad.axes,
            buttons: Array.from({ length: 17 }, (_, button) => ({
              value: buttons.includes(button) ? 1 : 0,
              pressed: buttons.includes(button),
              touched: false,
            })),
          }
        })
        if (tap?.samples.length === 0) {
          tap.complete()
          tap = null
        }
        return pads
      },
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
  const start = page.getByRole("button", { name: "Start", exact: true })
  await page.removeLocatorHandler(start)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto("/")
  await start.click()
  await page
    .getByRole("button", { name: "Standard Chess Story", exact: true })
    .waitFor({ state: "visible" })
  await expect(
    page.getByRole("button", { name: "Standard Chess Story", exact: true }),
  ).toBeVisible()
}
