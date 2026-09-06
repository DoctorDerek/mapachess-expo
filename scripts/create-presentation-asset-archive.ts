import {
  createLicensedPresentationAssetArchive,
  describeLicensedPresentationAssetFailure,
} from "./ghost-assets/presentationAssetArchive.js"

try {
  await createLicensedPresentationAssetArchive()
  process.stdout.write("Created ghost_assets/presentation-assets.zip.\n")
} catch (error: unknown) {
  process.stderr.write(`${describeLicensedPresentationAssetFailure(error)}\n`)
  process.exitCode = 1
}
