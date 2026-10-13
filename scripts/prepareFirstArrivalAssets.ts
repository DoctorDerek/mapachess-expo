import { copyFile, mkdir } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"

export default async function prepareFirstArrivalAssets(): Promise<void> {
  const root = resolve(import.meta.dirname, "..")
  const source = join(root, "packages/match-presentation/assets/first-arrival")
  const destination = join(root, "apps/web/public/generated/first-arrival")
  const require = createRequire(join(root, "apps/web/package.json"))
  const runtime = dirname(require.resolve("@rive-app/canvas-lite"))
  await mkdir(destination, { recursive: true })
  await Promise.all([
    ...["ice-cream.png", "ice-cream.riv", "LICENSE.txt"].map((name) =>
      copyFile(join(source, name), join(destination, name)),
    ),
    ...["rive.wasm", "rive_fallback.wasm"].map((name) =>
      copyFile(join(runtime, name), join(destination, name)),
    ),
  ])
}
