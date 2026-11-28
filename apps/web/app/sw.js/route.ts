import { randomUUID } from "node:crypto"
import { createSerwistRoute } from "@serwist/turbopack"
import { CHARACTER_PACK_ROOT } from "@/assets/characterArtPaths"
import { CHESS_APPEARANCE_PACK_ROOT } from "@/assets/chessAppearancePaths"

const route = createSerwistRoute({
  swSrc: "app/sw.ts",
  useNativeEsbuild: true,
  esbuildOptions: { sourcemap: false },
  globPatterns: [
    ".next/static/**/*.{js,css,woff2,png,svg,webp}",
    "public/generated/first-arrival/*",
    "public/generated/presentation-assets/coach/**/*.{png,svg,webp}",
    `public${CHARACTER_PACK_ROOT}/*.pack`,
    `public${CHESS_APPEARANCE_PACK_ROOT}/*.pack`,
    "public/input-prompts/**/*.{png,svg}",
  ],
  additionalPrecacheEntries: [
    { url: "/", revision: process.env.VERCEL_GIT_COMMIT_SHA ?? randomUUID() },
  ],
})
export const dynamic = "force-static"
export const revalidate = false
export const GET = (request: Request) => {
  if (!process.env.MAPACHESS_CHESS_APPEARANCE)
    throw new Error(
      "Prepare the chess appearance pack before building the offline worker.",
    )
  return route.GET(request, { params: Promise.resolve({ path: "sw.js" }) })
}
