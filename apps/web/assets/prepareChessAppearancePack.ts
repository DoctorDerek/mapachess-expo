import { createHash } from "node:crypto"
import { readdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"
import provenance from "@repo/ghost-assets/chess-provenance"
import { LICENSED_ASSET_BUNDLES } from "@repo/ghost-assets/licensedAssetBundles"
import {
  hasPublishedLicensedPresentationAssets,
  readLicensedPresentationAssetManifest,
} from "@repo/ghost-assets/presentationAssetArchive"
import {
  CHESS_APPEARANCE_BOOT,
  CHESS_APPEARANCE_PACK_ROOT,
  chessMemberMediaType,
} from "@/assets/chessAppearancePaths"
import writeIndexedArtPack from "@/assets/writeIndexedArtPack"

const publicRoot = fileURLToPath(new URL("../public/", import.meta.url))
const licensedManifest = fileURLToPath(
  new URL(
    LICENSED_ASSET_BUNDLES.chess.manifest,
    new URL("../../../", import.meta.url),
  ),
)
const protectedFiles = new Map(
  (await readLicensedPresentationAssetManifest(licensedManifest)).map(
    (file) => [file.path, file.sha256],
  ),
)
const licensed = await hasPublishedLicensedPresentationAssets(
  undefined,
  "chess",
)
const registered = new Map<string, string>()
for (const { runtime, sha256 } of provenance.files) {
  const previous = registered.get(runtime)
  if (
    !chessMemberMediaType(runtime) ||
    !/^[a-f\d]{64}$/.test(sha256) ||
    (previous !== undefined && previous !== sha256)
  )
    throw new Error("Invalid chess appearance provenance.")
  registered.set(runtime, sha256)
}
for (const [path, sha256] of protectedFiles) {
  if (registered.get(path) !== sha256)
    throw new Error(
      "Chess appearance provenance disagrees with the licensed manifest.",
    )
}

const members: Buffer[] = []
const index: [string[], number][] = []
for (const path of [...registered.keys()].sort()) {
  const protectedMember = protectedFiles.has(path)
  if (protectedMember && !licensed) continue
  const source = join(
    publicRoot,
    protectedMember ? "generated/chess-assets" : "chess-assets",
    path,
  )
  const bytes = await readFile(source)
  if (createHash("sha256").update(bytes).digest("hex") !== registered.get(path))
    throw new Error(`Chess artwork failed verification: ${path}`)
  members.push(bytes)
  index.push([[path], bytes.byteLength])
}
if (index.length === 0) throw new Error("The chess appearance pack is empty.")
const descriptor = await writeIndexedArtPack(
  publicRoot,
  CHESS_APPEARANCE_PACK_ROOT,
  index,
  members,
)
const output = join(publicRoot, CHESS_APPEARANCE_PACK_ROOT)
const boot = join(output, CHESS_APPEARANCE_BOOT)
const temporary = `${boot}.${process.pid}.tmp`
await writeFile(temporary, JSON.stringify(descriptor))
await rename(temporary, boot)
for (const name of await readdir(output)) {
  if (/^[a-f\d]{64}\.pack$/.test(name) && name !== basename(descriptor.url))
    await unlink(join(output, name))
}
