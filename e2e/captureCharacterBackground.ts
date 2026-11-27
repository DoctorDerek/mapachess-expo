import { expect, type Locator, type Page } from "@playwright/test"
import { CHARACTER_PACK_ROOT } from "../apps/web/assets/characterArtPaths.js"
import {
  isCharacterArtSource,
  readCharacterArtPack,
} from "../apps/web/lib/presentation/characterArtFormat.js"
import { presentationAssetSource } from "../packages/match-presentation/src/presentationAssets.js"
import { readLicensedPresentationAssetManifest } from "../scripts/ghost-assets/presentationAssetArchive.js"

export function trackCharacterArtRequests(page: Page): string[] {
  const paths: string[] = []
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname
    if (
      isCharacterArtSource(path) ||
      path.startsWith(CHARACTER_PACK_ROOT + "/")
    )
      paths.push(path)
  })
  return paths
}

export async function expectPackedBackground(
  locator: Locator,
  backgrounds: readonly string[],
): Promise<void> {
  await expect
    .poll(
      async () =>
        backgrounds.includes(
          await locator.evaluate(
            (element) => getComputedStyle(element).backgroundImage,
          ),
        ),
      {
        message:
          "Display a strip from the selected animal's registered artwork.",
      },
    )
    .toBe(true)
}

export default async function captureCharacterBackground(
  page: Page,
): Promise<(source: string) => string> {
  const [response, files] = await Promise.all([
    page.waitForResponse((candidate) => {
      const path = new URL(candidate.url()).pathname
      return (
        path.startsWith(CHARACTER_PACK_ROOT + "/") && path.endsWith(".pack")
      )
    }),
    readLicensedPresentationAssetManifest(),
  ])
  const count = files.filter(({ path }) =>
    isCharacterArtSource(presentationAssetSource(path)),
  ).length
  const lookup = readCharacterArtPack(
    new Uint8Array(await response.body()).buffer,
    count,
  )
  return (source: string): string => {
    const strip = lookup(source)
    if (strip === undefined)
      throw new Error(`Missing registered character strip: ${source}`)
    return `url("${strip}")`
  }
}
