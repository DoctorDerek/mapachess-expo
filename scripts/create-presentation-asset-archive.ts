import {
  createLicensedPresentationAssetArchive,
  describeLicensedPresentationAssetFailure,
  LICENSED_PRESENTATION_ASSET_ARCHIVE_PATH,
} from "./ghost-assets/presentationAssetArchive.js"

try {
  await createLicensedPresentationAssetArchive()
  process.stdout.write(`Created ${LICENSED_PRESENTATION_ASSET_ARCHIVE_PATH}.\n`)
} catch (error: unknown) {
  process.stderr.write(`${describeLicensedPresentationAssetFailure(error)}\n`)
  process.exitCode = 1
}
