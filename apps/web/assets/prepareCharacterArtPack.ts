import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  hasPublishedLicensedPresentationAssets,
  readLicensedPresentationAssetManifest,
} from "@repo/ghost-assets/presentationAssetArchive"
import writeIndexedArtPack from "@/assets/writeIndexedArtPack"
import {
  CHARACTER_PACK_BOOT,
  CHARACTER_PACK_ROOT,
} from "./characterArtPaths.js"

async function encodeStrip(
  file: string,
  expectedDigest: string,
): Promise<Buffer> {
  const { default: sharp } = await import("sharp")
  const original = await readFile(file)
  if (createHash("sha256").update(original).digest("hex") !== expectedDigest)
    throw new Error(
      `Character art does not match the licensed manifest: ${file}`,
    )
  const encoded = await sharp(original)
    .webp({ lossless: true, exact: true })
    .toBuffer()
  const rgba = (bytes: Buffer) =>
    sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const [source, restored] = await Promise.all([rgba(original), rgba(encoded)])
  if (
    source.info.width !== restored.info.width ||
    source.info.height !== restored.info.height ||
    !source.data.equals(restored.data)
  )
    throw new Error(`Character strip changed during lossless encoding: ${file}`)
  return encoded
}

async function prepareCharacterArtPack(): Promise<void> {
  if (!(await hasPublishedLicensedPresentationAssets())) return
  const [
    { default: resolveOpponentPresentation },
    { MAPACHITO_SPRITE_MANIFEST, presentationAssetSource },
    { DEFAULT_PLAYER_APPEARANCE, heroLayerPaths },
    { isCharacterArtSource },
  ] = await Promise.all([
    import("@mapachess/match-presentation/opponent-presentation"),
    import("@mapachess/match-presentation/presentation-assets"),
    import("@mapachess/profile/player-appearance"),
    import("@/lib/presentation/characterArtFormat"),
  ])
  const publicRoot = fileURLToPath(new URL("../public/", import.meta.url))
  const files = (await readLicensedPresentationAssetManifest()).filter(
    ({ path }) => isCharacterArtSource(presentationAssetSource(path)),
  )
  const aliases = new Map<string, string[]>()
  for (const { path, sha256 } of files) {
    const paths = aliases.get(sha256)
    if (paths) paths.push(path)
    else aliases.set(sha256, [path])
  }
  const companion = resolveOpponentPresentation(
    DEFAULT_PLAYER_APPEARANCE.animal,
  )
  if (companion.kind !== "sprite")
    throw new Error("The default companion has no registered pose.")
  const seedSources = new Set<string>([
    ...heroLayerPaths(DEFAULT_PLAYER_APPEARANCE).map(presentationAssetSource),
    companion.steps[0].animation.sourceId,
    MAPACHITO_SPRITE_MANIFEST.animations.run.sourceId,
  ])
  const seed: [string, string][] = []
  const index: [string[], number][] = []
  const payload: Buffer[] = []
  for (const digest of [...aliases.keys()].sort()) {
    const paths = aliases.get(digest)!.sort()
    const bytes = await encodeStrip(
      join(publicRoot, presentationAssetSource(paths[0]!)),
      digest,
    )
    index.push([paths, bytes.byteLength])
    payload.push(bytes)
    for (const path of paths) {
      const source = presentationAssetSource(path)
      if (seedSources.has(source))
        seed.push([
          source,
          `data:image/webp;base64,${bytes.toString("base64")}`,
        ])
    }
  }
  if (seed.length !== seedSources.size)
    throw new Error("The default character art is incomplete.")
  const descriptor = await writeIndexedArtPack(
    publicRoot,
    CHARACTER_PACK_ROOT,
    index,
    payload,
  )
  await writeFile(
    join(publicRoot, CHARACTER_PACK_ROOT, CHARACTER_PACK_BOOT),
    JSON.stringify({ ...descriptor, seed }),
  )
}

await prepareCharacterArtPack()
