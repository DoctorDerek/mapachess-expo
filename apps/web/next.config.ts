import type { NextConfig } from "next"
import { hasPublishedLicensedPresentationAssets } from "../../scripts/ghost-assets/presentationAssetArchive"

const nextConfig = async (): Promise<NextConfig> => ({
  env: {
    MAPACHESS_BUILD_HAS_PRESENTATION_ASSETS: String(
      await hasPublishedLicensedPresentationAssets(),
    ),
  },
  reactStrictMode: true,
})

export default nextConfig
