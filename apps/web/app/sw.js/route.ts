import { randomUUID } from "node:crypto"
import { createSerwistRoute } from "@serwist/turbopack"
import { STOCKFISH_18_WEB_WASM_ARTIFACT } from "@mapachess/stockfish/web-runtime-identity"

const route = createSerwistRoute({
  swSrc: "app/sw.ts",
  useNativeEsbuild: true,
  esbuildOptions: { sourcemap: false },
  globPatterns: [
    ".next/static/**/*.{js,css,woff2,png,svg,webp}",
    "public/generated/first-arrival/*",
    "public/generated/presentation-assets/**/*.{png,svg,webp}",
    "public/chess-assets/**/*.{png,svg}",
    "public/generated/chess-assets/**/*.{png,svg}",
    "public/input-prompts/**/*.{png,svg}",
    "public/stockfish-runtime/*.{js,wasm}",
  ],
  maximumFileSizeToCacheInBytes: STOCKFISH_18_WEB_WASM_ARTIFACT.byteLength,
  additionalPrecacheEntries: [
    { url: "/", revision: process.env.VERCEL_GIT_COMMIT_SHA ?? randomUUID() },
  ],
})
export const dynamic = "force-static"
export const revalidate = false
export const GET = (request: Request) =>
  route.GET(request, { params: Promise.resolve({ path: "sw.js" }) })
