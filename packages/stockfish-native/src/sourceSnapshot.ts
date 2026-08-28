import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { readdir } from "node:fs/promises"
import { join, relative } from "node:path"
import {
  parseSha256Hex,
  type Sha256Hex,
} from "@mapachess/stockfish/build-identity"

async function sha256File(path: string): Promise<Sha256Hex> {
  const digest = createHash("sha256")

  for await (const chunk of createReadStream(path)) digest.update(chunk)

  return parseSha256Hex(digest.digest("hex"))
}

async function collectFiles(directory: string): Promise<string[]> {
  const files: string[] = []

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await collectFiles(path)))
    else if (entry.isFile()) files.push(path)
    else throw new TypeError(`Unsupported Stockfish source entry: ${path}.`)
  }

  return files
}

export async function sha256StockfishSourceSnapshot(
  sourceRoot: string,
): Promise<Sha256Hex> {
  const entries = await Promise.all(
    (await collectFiles(sourceRoot)).map(async (path) => {
      const relativePath = relative(sourceRoot, path).replaceAll("\\", "/")
      return `${relativePath}\0${await sha256File(path)}\n`
    }),
  )
  entries.sort()

  return parseSha256Hex(
    createHash("sha256").update(entries.join(""), "utf8").digest("hex"),
  )
}
