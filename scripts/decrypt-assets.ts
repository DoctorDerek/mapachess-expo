import type { LicensedAssetBundleId } from "./ghost-assets/licensedAssetBundles.js"
import {
  describeLicensedPresentationAssetFailure,
  prepareLicensedPresentationAssets,
} from "./ghost-assets/presentationAssetArchive.js"

let bundleId: LicensedAssetBundleId = "presentation"
try {
  for (const selected of ["presentation", "chess"] as const) {
    bundleId = selected
    await prepareLicensedPresentationAssets(undefined, selected)
  }
} catch (error: unknown) {
  process.stderr.write(
    `${describeLicensedPresentationAssetFailure(error, bundleId)}\n`,
  )
  process.exitCode = 1
}
