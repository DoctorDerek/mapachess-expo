import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { withSerwist } from "@serwist/turbopack"
import type { NextConfig } from "next"
import { hasPublishedLicensedPresentationAssets } from "../../scripts/ghost-assets/presentationAssetArchive"
import {
  CHARACTER_PACK_BOOT,
  CHARACTER_PACK_ROOT,
} from "./lib/presentation/characterArtFormat"

const nextConfig = async (): Promise<NextConfig> => {
  const licensed = await hasPublishedLicensedPresentationAssets()
  return {
    env: {
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
    headers: async () => [
      {
        source: `${CHARACTER_PACK_ROOT}/:digest([0-9a-f]{64}).pack`,
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ],
    reactStrictMode: true,
  }
}

export default async () => withSerwist(await nextConfig())
