import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, relative, resolve } from "node:path"
import {
  describeLicensedPresentationAssetFailure,
  prepareLicensedPresentationAssets,
} from "./ghost-assets/presentationAssetArchive.js"

const root = resolve(import.meta.dirname, "..")
const mobile = join(root, "apps/mobile")
const output = join(mobile, ".prepared-assets")
const modulePath = join(mobile, "lib/presentation/nativeAssetManifest.js")
const images: string[] = []
const animations: string[] = []
const svg: string[] = []

async function collect(directory: string, prefix: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const source = join(directory, entry.name)
    const key = `${prefix}/${entry.name}`
    if (entry.isDirectory()) await collect(source, key)
    else if (/\.(png|riv)$/.test(entry.name)) {
      const path = relative(dirname(modulePath), source).replaceAll("\\", "/")
      const entry = `${JSON.stringify(key)}: require(${JSON.stringify(path)})`
      if (source.endsWith(".riv")) animations.push(entry)
      else images.push(entry)
    } else if (entry.name.endsWith(".svg")) {
      svg.push(
        `${JSON.stringify(key)}: ${JSON.stringify(await readFile(source, "utf8"))}`,
      )
    }
  }
}

async function copyPublic(
  directory: string,
  destination: string,
): Promise<void> {
  await mkdir(destination, { recursive: true })
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const source = join(directory, entry.name)
    const target = join(destination, entry.name)
    if (entry.isDirectory()) await copyPublic(source, target)
    else await copyFile(source, target)
  }
}

try {
  await mkdir(output, { recursive: true })
  for (const bundle of ["presentation", "chess"] as const) {
    await prepareLicensedPresentationAssets(root, bundle, "native")
    const directory = join(output, bundle)
    const files = await readdir(output)
    if (files.includes(bundle))
      await collect(
        directory,
        `/generated/${bundle === "presentation" ? "presentation-assets" : "chess-assets"}`,
      )
  }
  for (const [source, name, prefix] of [
    ["apps/web/public/chess-assets", "public-chess", "/chess-assets"],
    ["apps/web/public/input-prompts", "input-prompts", "/input-prompts"],
    ["packages/match-presentation/assets/medals", "medals", "/medals"],
    [
      "packages/match-presentation/assets/first-arrival",
      "first-arrival",
      "/first-arrival",
    ],
  ] as const) {
    const destination = join(output, name)
    await copyPublic(join(root, source), destination)
    await collect(destination, prefix)
  }
  await mkdir(dirname(modulePath), { recursive: true })
  await writeFile(
    modulePath,
    `export default Object.freeze({images: Object.freeze({${images.join(",\n")}}),svg: Object.freeze({${svg.join(",\n")}})})\n`,
  )
  await writeFile(
    join(dirname(modulePath), "nativeAnimationManifest.js"),
    `export default Object.freeze({${animations.join(",\n")}})\n`,
  )
  process.stdout.write(
    `Prepared native asset references: ${images.length} images, ${svg.length} vectors, ${animations.length} animations.\n`,
  )
} catch (error: unknown) {
  process.stderr.write(`${describeLicensedPresentationAssetFailure(error)}\n`)
  process.exitCode = 1
}
