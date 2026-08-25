import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test("presents the honest Mapachess pre-production status", async ({
  page,
}) => {
  await page.goto("/")

  await expect(page).toHaveTitle("Mapachess — In Development")
  await expect(
    page.getByRole("heading", { level: 1, name: "Mapachess" }),
  ).toBeVisible()
  await expect(page.getByText("Pre-production", { exact: true })).toBeVisible()
  await expect(
    page.getByText(
      "No playable public build yet. Mapachess is in development.",
      { exact: true },
    ),
  ).toBeVisible()
})

test("has no serious or critical accessibility violations", async ({
  page,
}) => {
  await page.goto("/")

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze()
  const highImpactViolations = accessibilityScanResults.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  )

  expect(highImpactViolations).toEqual([])
})
