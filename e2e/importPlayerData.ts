import { createHash } from "node:crypto"
import { expect, type Page } from "@playwright/test"
import type { MapachessPlayerData } from "../packages/profile/src/playerData.js"
import { createMapachessPortableBackup } from "../packages/profile/src/portableBackup.js"
import { requireSha256Hex } from "../packages/profile/src/sha256.js"

export default async function importPlayerData(
  page: Page,
  playerData: MapachessPlayerData,
): Promise<void> {
  const backup = await createMapachessPortableBackup({
    playerData,
    applicationVersion: "local-test",
    gddRevision: "5.0",
    sha256: async (value) =>
      requireSha256Hex(createHash("sha256").update(value).digest("hex")),
  })
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await page.locator('input[type="file"]').setInputFiles({
    name: "player.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  })
  await page
    .getByRole("button", { name: "Replace Local Player Data", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: "Customize profile card", exact: true }),
  ).toBeEnabled()
}
