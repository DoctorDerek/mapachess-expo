import { prepareLicensedPresentationAssets } from "./ghost-assets/presentationAssetArchive.js"

try {
  await prepareLicensedPresentationAssets()
} catch {
  process.stderr.write("Licensed presentation asset preparation failed.\n")
  process.exitCode = 1
}
