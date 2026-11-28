import { createHash } from "node:crypto"
import { mkdir, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { ART_PACK_HEADER_BYTES } from "@/lib/presentation/readIndexedArtPack"

export default async function writeIndexedArtPack(
  publicRoot: string,
  root: string,
  index: readonly (readonly [readonly string[], number])[],
  payload: readonly Buffer[],
) {
  const directory = Buffer.from(JSON.stringify(index))
  const header = Buffer.alloc(ART_PACK_HEADER_BYTES)
  header.writeUInt32LE(directory.byteLength)
  const pack = Buffer.concat([header, directory, ...payload])
  const digest = createHash("sha256").update(pack).digest()
  const filename = `${digest.toString("hex")}.pack`
  const output = join(publicRoot, root)
  await mkdir(output, { recursive: true })
  const target = join(output, filename)
  const temporary = `${target}.${process.pid}.tmp`
  await writeFile(temporary, pack)
  await rename(temporary, target)
  return {
    url: `${root}/${filename}`,
    integrity: `sha256-${digest.toString("base64")}`,
    count: index.reduce((total, [paths]) => total + paths.length, 0),
  }
}
