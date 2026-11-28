import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { withSerwist } from "@serwist/turbopack"
import type { NextConfig } from "next"
import { hasPublishedLicensedPresentationAssets } from "../../scripts/ghost-assets/presentationAssetArchive"
import {
  CHARACTER_PACK_BOOT,
  CHARACTER_PACK_ROOT,
} from "./assets/characterArtPaths"
import {
  CHESS_APPEARANCE_BOOT,
  CHESS_APPEARANCE_PACK_ROOT,
} from "./assets/chessAppearancePaths"

const nextConfig = async (): Promise<NextConfig> => {
  const licensed = await hasPublishedLicensedPresentationAssets()
  const chessBoot = join(
    process.cwd(),
    "public",
    CHESS_APPEARANCE_PACK_ROOT,
    CHESS_APPEARANCE_BOOT,
  )
  return {
    env: {
      MAPACHESS_CHESS_APPEARANCE: existsSync(chessBoot)
        ? await readFile(chessBoot, "utf8")
        : "",
      MAPACHESS_BUILD_HAS_PRESENTATION_ASSETS: String(licensed),
      MAPACHESS_CHARACTER_ART: licensed
        ? await readFile(
            join(
              process.cwd(),
              "public",
              CHARACTER_PACK_ROOT,
              CHARACTER_PACK_BOOT,
            ),
            "utf8",
          )
        : "",
      MAPACHESS_BUILD_HAS_CHESS_ASSETS: String(
        await hasPublishedLicensedPresentationAssets(undefined, "chess"),
      ),
    },
    headers: async () =>
      [CHARACTER_PACK_ROOT, CHESS_APPEARANCE_PACK_ROOT].map((root) => ({
        source: `${root}/:digest([0-9a-f]{64}).pack`,
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      })),
    reactStrictMode: true,
  }
}

export default async () => withSerwist(await nextConfig())
