import { expect, type Locator, type Page } from "@playwright/test"
import loadCatalog from "../packages/localization/src/catalog.js"
import { parseMatchMoveId } from "../packages/match/src/matchMove.js"
import { createInitialMatchPosition } from "../packages/match/src/matchPosition.js"
import {
  applyMatchTimelineMove,
  createMatchTimeline,
  currentMatchPosition,
} from "../packages/match/src/matchTimeline.js"
import {
  GLOBAL_XP_QUANTUM,
  xpAtLevel,
} from "../packages/profile/src/globalXp.js"
import { replaceActiveMatch } from "../packages/profile/src/profileMutations.js"
import completedStoryMatch from "../packages/profile/test/storyProgressTestSupport.js"
import { test } from "./fixtures.js"
import importPlayerData from "./importPlayerData.js"
import savedProfile from "./savedProfile.js"

const expectContained = async (surface: Locator): Promise<void> => {
  await expect
    .poll(() =>
      surface.evaluate((element) => element.scrollWidth - element.clientWidth),
    )
    .toBeLessThanOrEqual(1)
}

const startMatch = async (
  page: Page,
  color: "White" | "Black",
): Promise<void> => {
  await page.goto("/")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await page.getByRole("radio", { name: "No Auto Hints", exact: true }).check()
  await page
    .getByRole("button", { name: "Close Settings", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Standard Chess Challenge", exact: true })
    .click()
  await page.getByRole("radio", { name: color, exact: true }).check()
  await page.getByRole("button", { name: "Start match", exact: true }).click()
  await expect(page.locator('[data-square="e2"]')).toHaveAttribute(
    "aria-disabled",
    "false",
    { timeout: 30000 },
  )
}

for (const locale of ["en", "es-419"] as const) {
  const copy = loadCatalog(locale)
  test(`setup actions and long-picker Done stay reachable without scrolling through choices in ${locale}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    await page.getByRole("button", { name: "Settings", exact: true }).click()
    await page
      .getByRole("combobox", { name: "Language", exact: true })
      .selectOption(locale)
    await page
      .getByRole("button", {
        name: copy.interface.profileSettingsPanel.closeSettings,
        exact: true,
      })
      .click()
    const before = await savedProfile(page)
    for (const variant of ["standard", "chess960"] as const) {
      for (const mode of ["story", "challenge"] as const) {
        await page
          .getByRole("button", {
            name: copy.setup.presentations[variant][mode].title,
            exact: true,
          })
          .click()
        await page.mouse.move(0, 0)
        const start = page.getByRole("button", {
          name: copy.setup.startMatch,
          exact: true,
        })
        const modes = page.getByRole("button", {
          name: copy.setup.allModes,
          exact: true,
        })
        for (const percent of [100, 200]) {
          const scale = await page.addStyleTag({
            content: `:root { font-size: ${percent}%; }`,
          })
          await expect(start).toBeInViewport({ ratio: 1 })
          await expect(modes).toBeInViewport({ ratio: 1 })
          const footer = page.locator("form footer")
          await expectContained(footer)
          const geometry = await footer.evaluate((element) => {
            const [modes, start] = element.querySelectorAll("button")
            const content = element.previousElementSibling
            if (
              modes === undefined ||
              start === undefined ||
              !(content instanceof HTMLElement)
            )
              throw new Error("Expected setup choices above their two actions")
            const startBounds = start.getBoundingClientRect()
            const rowOffset = modes.getBoundingClientRect().y - startBounds.y
            content.scrollTop = content.scrollHeight
            return {
              rowOffset,
              contentHeight: content.clientHeight,
              actionShift: start.getBoundingClientRect().y - startBounds.y,
            }
          })
          expect(geometry.rowOffset).toBeCloseTo(0, 1)
          expect(geometry.contentHeight).toBeGreaterThan(120)
          expect(geometry.actionShift).toBe(0)
          await scale.evaluate((element) => element.remove())
        }
        if (mode === "story") {
          const trigger = page.getByRole("button", {
            name: copy.setup.changeStoryOpponent,
            exact: true,
          })
          await trigger.click()
          const done = page.getByRole("button", {
            name: copy.setup.done,
            exact: true,
          })
          await expect(done).toBeInViewport({ ratio: 1 })
          const doneBounds = await done.boundingBox()
          const opponents = page
            .getByRole("list", {
              name: copy.shared.story.opponents,
              exact: true,
            })
            .getByRole("listitem")
          await expect(opponents).toHaveCount(23)
          await opponents.last().scrollIntoViewIfNeeded()
          await expect(opponents.last()).toBeInViewport({ ratio: 1 })
          await expect.poll(() => done.boundingBox()).toEqual(doneBounds)
          await done.click()
          await expect(trigger).toBeFocused()
        }
        await modes.click()
      }
    }
    expect(await savedProfile(page)).toEqual(before)
  })

  test(`promotion pieces remain inside reachable choices at phone sizes in ${locale}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000)
    await page.setViewportSize({ width: 320, height: 844 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await startMatch(page, "White")
    const profile = await savedProfile(page)
    const match = profile.activeMatch
    if (match === null) throw new Error("Expected saved match")
    let timeline = createMatchTimeline(
      createInitialMatchPosition(match.startingPosition),
    )
    for (const uci of [
      "a2a4",
      "h7h5",
      "a4a5",
      "h5h4",
      "a5a6",
      "h4h3",
      "a6b7",
      "h3g2",
    ]) {
      const parsed = parseMatchMoveId(uci)
      if (!parsed.ok) throw new Error("Expected fixture move")
      const moved = applyMatchTimelineMove(timeline, parsed.moveId)
      if (!moved.ok) throw new Error("Expected legal fixture move")
      timeline = moved.timeline
    }
    const activeMatch = {
      ...match,
      cursor: timeline.cursor,
      currentFen: currentMatchPosition(timeline).fen,
      moveIds: timeline.transitions.map(({ move }) => move.id),
      moveFeedback: [],
    }
    await page.getByLabel("Match menu", { exact: true }).click()
    await importPlayerData(page, {
      ...profile,
      activeMatch,
      settings: { ...profile.settings, locale },
    })
    await page.locator('[data-square="b7"]').click()
    await page.locator('[data-square="a8"]').click()
    const promotion = page.getByRole("dialog", {
      name: copy.board.promoteOn("a8"),
      exact: true,
    })
    await expect(promotion).toBeVisible()
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 })
      for (const percent of [100, 200]) {
        const scale = await page.addStyleTag({
          content: `:root { font-size: ${percent}%; }`,
        })
        await expectContained(promotion)
        for (const role of ["queen", "rook", "bishop", "knight"] as const) {
          const choice = promotion.getByRole("button", {
            name: copy.board.promote(role),
            exact: true,
          })
          await choice.focus()
          await choice.scrollIntoViewIfNeeded()
          await expect(choice).toBeInViewport({ ratio: 1 })
          await expectContained(choice)
          const geometry = await choice.evaluate((button) => {
            const bounds = button.getBoundingClientRect()
            const glyph = button.querySelector("span > span")
            if (glyph === null) throw new Error("Expected piece glyph")
            const piece = glyph.getBoundingClientRect()
            return {
              width: bounds.width,
              height: bounds.height,
              contained:
                piece.left >= bounds.left &&
                piece.right <= bounds.right &&
                piece.top >= bounds.top &&
                piece.bottom <= bounds.bottom,
            }
          })
          expect(geometry.width).toBeGreaterThanOrEqual(48)
          expect(geometry.height).toBeGreaterThanOrEqual(48)
          expect(geometry.contained).toBe(true)
        }
        const cancel = promotion.getByRole("button", {
          name: copy.board.cancelPromotion,
          exact: true,
        })
        await cancel.focus()
        await cancel.scrollIntoViewIfNeeded()
        await expect(cancel).toBeInViewport({ ratio: 1 })
        await page.screenshot({
          path: testInfo.outputPath(`promotion-${width}-${percent}.png`),
        })
        expect((await savedProfile(page)).activeMatch).toEqual(activeMatch)
        await scale.evaluate((element) => element.remove())
      }
    }
    await promotion
      .getByRole("button", { name: copy.board.promote("knight"), exact: true })
      .click()
    await expect(promotion).toHaveCount(0)
    await expect(page.locator('[data-square="a8"]')).toHaveAttribute(
      "aria-label",
      /knight|caballo/,
    )
  })

  test(`long rating context and large Levels reflow in rewards without changing the saved result in ${locale}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000)
    await page.setViewportSize({ width: 320, height: 844 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await startMatch(page, "Black")
    const current = await savedProfile(page)
    if (current.activeMatch === null) throw new Error("Expected saved match")
    const { conclusion, currentFen, cursor, moveIds } = completedStoryMatch()
    const totalXp =
      Math.ceil(xpAtLevel(9000) / GLOBAL_XP_QUANTUM) * GLOBAL_XP_QUANTUM
    const completed = replaceActiveMatch(
      { ...current, totalXp, settings: { ...current.settings, locale } },
      {
        ...current.activeMatch,
        conclusion,
        currentFen,
        cursor,
        moveIds,
        moveFeedback: [],
      },
    )
    await page.getByLabel("Match menu", { exact: true }).click()
    await importPlayerData(page, completed)
    await page
      .getByRole("button", {
        name: copy.interface.webMatch.viewRewards,
        exact: true,
      })
      .click()
    const rewards = page.getByRole("dialog")
    await expect(rewards).toBeVisible()
    for (const width of [320, 390, 430, 1280]) {
      await page.setViewportSize({ width, height: 844 })
      for (const percent of [100, 200]) {
        const scale = await page.addStyleTag({
          content: `:root { font-size: ${percent}%; }`,
        })
        await expectContained(rewards)
        const label = rewards.getByText(copy.profile.ratingLabel.standard, {
          exact: true,
        })
        await expect(label).toBeVisible()
        const level = rewards.getByRole("region", { name: /^Level|^Nivel/ })
        await expectContained(level)
        await label.scrollIntoViewIfNeeded()
        if (percent === 100) {
          const geometry = await label.locator("..").evaluate((context) => {
            const change = context.parentElement?.querySelector("strong")
            if (change === null || change === undefined)
              throw new Error("Expected the rating change beside its context")
            const contextBounds = context.getBoundingClientRect()
            const changeBounds = change.getBoundingClientRect()
            return {
              horizontalGap: changeBounds.left - contextBounds.right,
              centerOffset:
                changeBounds.y +
                changeBounds.height / 2 -
                (contextBounds.y + contextBounds.height / 2),
            }
          })
          expect(geometry.horizontalGap).toBeGreaterThanOrEqual(0)
          expect(geometry.centerOffset).toBeCloseTo(0, 0)
        }
        await page.screenshot({
          path: testInfo.outputPath(`rewards-${width}-${percent}.png`),
        })
        const review = rewards.getByRole("button", {
          name: copy.interface.matchCelebration.reviewBoard,
          exact: true,
        })
        await review.focus()
        await review.scrollIntoViewIfNeeded()
        await expect(review).toBeInViewport({ ratio: 1 })
        await expectContained(review)
        await scale.evaluate((element) => element.remove())
      }
    }
    const beforeDismissal = await savedProfile(page)
    await rewards
      .getByRole("button", {
        name: copy.interface.matchCelebration.reviewBoard,
        exact: true,
      })
      .click()
    await page
      .getByRole("button", {
        name: copy.interface.webMatch.viewRewards,
        exact: true,
      })
      .click()
    expect(await savedProfile(page)).toEqual(beforeDismissal)
  })
}
