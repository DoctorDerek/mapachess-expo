import { getErrorMessage } from "../packages/diagnostics/src/errorDiagnostic.js"
import type { LicensedAssetBundleId } from "./ghost-assets/licensedAssetBundles.js"
import {
  describeLicensedPresentationAssetFailure,
  prepareLicensedPresentationAssets,
} from "./ghost-assets/presentationAssetArchive.js"
import prepareFirstArrivalAssets from "./prepareFirstArrivalAssets.js"

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

try {
  await prepareFirstArrivalAssets()
} catch (error: unknown) {
  process.stderr.write(
    `First-arrival assets could not be prepared: ${getErrorMessage(error)}\n`,
  )
  process.exitCode = 1
}
