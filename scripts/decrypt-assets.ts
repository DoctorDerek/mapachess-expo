import {
  describeLicensedPresentationAssetFailure,
  prepareLicensedPresentationAssets,
} from "./ghost-assets/presentationAssetArchive.js"

try {
  await prepareLicensedPresentationAssets()
} catch (error: unknown) {
  process.stderr.write(`${describeLicensedPresentationAssetFailure(error)}\n`)
  process.exitCode = 1
}
