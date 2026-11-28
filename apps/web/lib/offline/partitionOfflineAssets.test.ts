import { expect, it } from "vitest"
import { CHESS_APPEARANCE_PACK_ROOT } from "@/assets/chessAppearancePaths"
import partitionOfflineAssets from "@/lib/offline/partitionOfflineAssets"

it("keeps chess programs distinct from artwork and assigns content-addressed offline keys", () => {
  const origin = "https://mapachess.com"
  const home = { url: "/", revision: "release" }
  const chunk = "/_next/static/chunks/engine-hash.js"
  const poster = "/generated/first-arrival/ice-cream.png"
  const tiger = {
    url: "/generated/presentation-assets/battle/tiger/tiger_idle.png",
    revision: "one",
  }
  const board = {
    url: `${CHESS_APPEARANCE_PACK_ROOT}/${"a".repeat(64)}.pack`,
    revision: "two",
  }
  const files = partitionOfflineAssets(
    [home, chunk, poster, tiger, board, "https://other.example/a.js"],
    origin,
  )
  expect(files.core).toEqual([home, chunk, poster])
  expect(files.art.get(tiger.url)).toBe(origin + tiger.url + "?revision=one")
  expect(files.art.get(board.url)).toBe(origin + board.url)
  expect(
    partitionOfflineAssets([{ ...tiger, revision: "new" }], origin).art.get(
      tiger.url,
    ),
  ).toBe(origin + tiger.url + "?revision=new")
})
