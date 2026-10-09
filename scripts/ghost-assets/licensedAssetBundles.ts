export const LICENSED_ASSET_BUNDLES = Object.freeze({
  presentation: Object.freeze({
    archive: "ghost_assets/seethingswarm-captainskolot-heroes99.zip",
    manifest: "ghost_assets/presentation-assets.manifest.json",
    localSource: "vendor/presentation-assets",
    archiveSource: "vendor/presentation-assets-archive",
    publicAssets: "apps/web/public/generated/presentation-assets",
  }),
  chess: Object.freeze({
    archive: "ghost_assets/backterria-toffeecraft-chess.zip",
    manifest: "ghost_assets/chess-assets.manifest.json",
    localSource: "vendor/chess-runtime-assets",
    archiveSource: "vendor/chess-assets-archive",
    publicAssets: "apps/web/public/generated/chess-assets",
  }),
})

export type LicensedAssetBundleId = keyof typeof LICENSED_ASSET_BUNDLES

export const LICENSED_ASSET_BUNDLE_USAGE =
  "Choose --bundle=presentation or --bundle=chess."

export function parseLicensedAssetBundleArgument(
  arguments_: readonly string[],
): LicensedAssetBundleId {
  if (arguments_.length === 0) return "presentation"
  const [argument] = arguments_
  if (arguments_.length === 1 && argument === "--bundle=chess") return "chess"
  if (arguments_.length === 1 && argument === "--bundle=presentation")
    return "presentation"
  throw new Error(LICENSED_ASSET_BUNDLE_USAGE)
}
