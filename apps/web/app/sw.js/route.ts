import { randomUUID } from "node:crypto"
import { createSerwistRoute } from "@serwist/turbopack"
import { CHARACTER_PACK_ROOT } from "@/assets/characterArtPaths"

const route = createSerwistRoute({
  swSrc: "app/sw.ts",
  useNativeEsbuild: true,
  esbuildOptions: { sourcemap: false },
  globPatterns: [
    ".next/static/**/*.{js,css,woff2,png,svg,webp}",
    "public/generated/first-arrival/*",
    "public/generated/presentation-assets/coach/**/*.{png,svg,webp}",
    `public${CHARACTER_PACK_ROOT}/*.pack`,
    "public/chess-assets/**/*.{png,svg}",
    "public/generated/chess-assets/**/*.{png,svg}",
    "public/input-prompts/**/*.{png,svg}",
  ],
  additionalPrecacheEntries: [
    { url: "/", revision: process.env.VERCEL_GIT_COMMIT_SHA ?? randomUUID() },
  ],
})
export const dynamic = "force-static"
export const revalidate = false
export const GET = (request: Request) =>
  route.GET(request, { params: Promise.resolve({ path: "sw.js" }) })
