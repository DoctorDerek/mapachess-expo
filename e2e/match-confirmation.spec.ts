import { expect } from "@playwright/test"
import loadCatalog from "../packages/localization/src/catalog.js"
import { timeControlLabel } from "../packages/match/src/timeControl.js"
import { firstArrivalTest as test } from "./fixtures.js"
import savedProfile from "./savedProfile.js"
import startHintMatch from "./startHintMatch.js"

for (const locale of ["en", "es-419"] as const) {
  for (const width of [390, 1440]) {
    test(
      locale +
        " at " +
        width +
        "px keeps confirmation away from the initiating tap and preserves the match on Cancel",
      async ({ page }, info) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
        const copy = loadCatalog(locale),
          commands = copy.interface.matchCommands
        await startHintMatch(page, { locale })
        const board = page.getByRole("grid")
        await board.locator('[data-square="e2"]').click()
        await board.locator('[data-square="e4"]').click()
        // The opponent's reply and its move grade are separate durable writes.
        await expect
          .poll(async () => (await savedProfile(page)).activeMatch)
          .toMatchObject({ cursor: 2, moveFeedback: [{ ply: 1 }, { ply: 2 }] })
        const menu = page.getByRole("button", {
          name: commands.matchMenu,
          exact: true,
        })
        await menu.click()
        const sheet = page.getByRole("dialog", {
          name: commands.matchMenu,
          exact: true,
        })
        await expect(sheet).toBeVisible()
        const prior = await savedProfile(page)
        await page.screenshot({ path: info.outputPath("menu.png") })
        for (const [key, label] of [
          ["restart", copy.interface.webGame.restartMatch],
          ["draw", commands.offerDraw],
          ["resign", commands.resign],
          ["replace", copy.setup.startMatch],
        ] as const) {
          if (key === "replace") {
            await sheet
              .getByRole("button", { name: commands.saveAndExit, exact: true })
              .click()
            await expect(
              page.getByRole("button", {
                name: new RegExp(copy.interface.webGame.resumeMatch),
              }),
            ).toBeVisible()
            await page.screenshot({ path: info.outputPath("home-ongoing.png") })
            await page
              .getByRole("button", {
                name: copy.setup.presentations.standard.challenge.title,
                exact: true,
              })
              .click()
          }
          const origin = (key === "replace" ? page : sheet).getByRole(
            "button",
            { name: label, exact: true },
          )
          await origin.scrollIntoViewIfNeeded()
          const start = await origin.boundingBox()
          if (!start) throw Error("Expected a visible initiating action")
          await origin.click()
          const confirm = page.getByRole("alertdialog", {
            name: commands.confirmation[key].question,
          })
          await expect(confirm).toHaveAccessibleDescription(
            commands.confirmation[key].consequence,
          )
          const cancel = confirm.getByRole("button", {
            name: copy.interface.profileSettingsPanel.cancel,
            exact: true,
          })
          await expect(cancel).toBeFocused()
          const commit = confirm.getByRole("button", {
            name: key === "replace" ? commands.startReplacement : label,
            exact: true,
          })
          const end = await commit.boundingBox()
          if (!end) throw Error("Expected a visible confirmation")
          const overlapX =
            Math.min(start.x + start.width, end.x + end.width) -
            Math.max(start.x, end.x)
          const overlapY =
            Math.min(start.y + start.height, end.y + end.height) -
            Math.max(start.y, end.y)
          expect(Math.max(0, overlapX) * Math.max(0, overlapY)).toBe(0)
          expect(await savedProfile(page)).toEqual(prior)
          await page.screenshot({ path: info.outputPath(key + ".png") })
          if (key === "draw") await page.goBack()
          else if (key === "resign") await page.keyboard.press("Escape")
          else await cancel.click()
          await expect(confirm).toHaveCount(0)
          await expect(origin).toBeFocused()
          expect(await savedProfile(page)).toEqual(prior)
        }
        await page
          .getByRole("button", { name: copy.setup.startMatch, exact: true })
          .click()
        await page
          .getByRole("alertdialog")
          .getByRole("button", { name: commands.startReplacement, exact: true })
          .click()
        await expect(board).toBeVisible()
        await expect
          .poll(async () => (await savedProfile(page)).activeMatch?.matchId)
          .not.toBe(prior.activeMatch?.matchId)
        await menu.click()
        await sheet
          .getByRole("button", { name: commands.resign, exact: true })
          .click()
        await page
          .getByRole("alertdialog")
          .getByRole("button", { name: commands.resign, exact: true })
          .click()
        await page
          .getByRole("button", {
            name: copy.interface.matchCelebration.reviewBoard,
            exact: true,
          })
          .click()
        await menu.click()
        await sheet
          .getByRole("button", { name: commands.saveAndExit, exact: true })
          .click()
        const finished = (await savedProfile(page)).activeMatch
        if (!finished?.conclusion)
          throw Error("Expected a retained concluded board")
        const label =
          copy.interface.matchCelebration.reviewBoard +
          " " +
          copy.animals.names[finished.opponentId] +
          " · " +
          timeControlLabel(finished.timeControl, copy.gameplay.clock)
        const review = page.getByRole("button", { name: label, exact: true })
        await expect(review).toBeInViewport({ ratio: 1 })
        await page.screenshot({ path: info.outputPath("home-finished.png") })
        await review.click()
        await expect(board).toBeVisible()
        expect((await savedProfile(page)).activeMatch).toEqual(finished)
      },
    )
  }
}

test("a pointer press begun while the match sheet slides cannot activate a match action", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await startHintMatch(page)
  await page.emulateMedia({ reducedMotion: "no-preference" })
  const copy = loadCatalog("en"),
    menu = page.getByRole("button", {
      name: copy.interface.matchCommands.matchMenu,
      exact: true,
    })
  const sheet = page.getByRole("dialog", {
    name: copy.interface.matchCommands.matchMenu,
    exact: true,
  })
  const before = await savedProfile(page)
  const sample = await menu.evaluate(
    (button) =>
      new Promise<{ x: number; y: number }>((resolve, reject) => {
        button.click()
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const dialog = document.querySelector<HTMLDialogElement>(
              "dialog.mapachess-menu-sheet[open]",
            )
            const slide = dialog
              ?.getAnimations()
              .find(
                (a) =>
                  "transitionProperty" in a &&
                  a.transitionProperty === "transform",
              )
            const action = dialog?.querySelector("button")
            if (!slide || !action) {
              reject(
                Error("Expected a running entry slide and its Restart action"),
              )
              return
            }
            slide.playbackRate = 0.001
            slide.currentTime =
              Number(slide.effect?.getComputedTiming().duration) * 0.9
            const rect = action.getBoundingClientRect()
            resolve({
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            })
          }),
        )
      }),
  )
  await page.mouse.move(sample.x, sample.y)
  await page.mouse.down()
  await sheet.evaluate((d) => d.getAnimations().forEach((a) => a.finish()))
  await page.mouse.up()
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
  await expect(sheet).toBeVisible()
  await sheet
    .getByRole("button", {
      name: copy.interface.matchCommands.backToBoard,
      exact: true,
    })
    .click()
  await expect(sheet).toHaveCount(0)
  await expect(menu).toBeFocused()
  expect(await savedProfile(page)).toEqual(before)
})
