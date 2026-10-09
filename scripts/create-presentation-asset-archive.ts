import {
  LICENSED_ASSET_BUNDLES,
  parseLicensedAssetBundleArgument,
  type LicensedAssetBundleId,
} from "./ghost-assets/licensedAssetBundles.js"
import {
  createLicensedPresentationAssetArchive,
  describeLicensedPresentationAssetFailure,
} from "./ghost-assets/presentationAssetArchive.js"

let bundleId: LicensedAssetBundleId = "presentation"
try {
  bundleId = parseLicensedAssetBundleArgument(process.argv.slice(3))
  await createLicensedPresentationAssetArchive(undefined, bundleId)
  process.stdout.write(`Created ${LICENSED_ASSET_BUNDLES[bundleId].archive}.\n`)
} catch (error: unknown) {
  process.stderr.write(
    `${describeLicensedPresentationAssetFailure(error, bundleId)}\n`,
  )
  process.exitCode = 1
}
