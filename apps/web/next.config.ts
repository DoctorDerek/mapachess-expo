import type { NextConfig } from "next"
import { hasPublishedLicensedPresentationAssets } from "../../scripts/ghost-assets/presentationAssetArchive"

const nextConfig = async (): Promise<NextConfig> => ({
  env: {
    MAPACHESS_BUILD_HAS_PRESENTATION_ASSETS: String(
      await hasPublishedLicensedPresentationAssets(),
    ),
    MAPACHESS_BUILD_HAS_CHESS_ASSETS: String(
      await hasPublishedLicensedPresentationAssets(undefined, "chess"),
    ),
  },
  reactStrictMode: true,
})

export default nextConfig
