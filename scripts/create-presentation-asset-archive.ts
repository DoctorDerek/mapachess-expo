import { createLicensedPresentationAssetArchive } from "./ghost-assets/presentationAssetArchive.js"

try {
  await createLicensedPresentationAssetArchive()
} catch {
  process.stderr.write("Licensed presentation archive creation failed.\n")
  process.exitCode = 1
}
