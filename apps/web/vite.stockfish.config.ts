import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

const stockfishHarnessDirectory = fileURLToPath(
  new URL("./stockfish-integration-harness", import.meta.url),
)
const webPublicDirectory = fileURLToPath(new URL("./public", import.meta.url))

export default defineConfig({
  root: stockfishHarnessDirectory,
  publicDir: webPublicDirectory,
  cacheDir: fileURLToPath(
    new URL("./node_modules/.vite-stockfish-harness", import.meta.url),
  ),
  server: {
    host: "127.0.0.1",
    port: 3107,
    strictPort: true,
  },
})
