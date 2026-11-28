import { IDBFactory } from "fake-indexeddb"
import { afterEach, expect, it, vi } from "vitest"
import retainedChessAppearance from "@/lib/presentation/retainedChessAppearance"

afterEach(() => vi.unstubAllGlobals())

it("retains one release's encoded chess art across connections and removes only the requested identity", async () => {
  vi.stubGlobal("indexedDB", new IDBFactory())
  const first = new Uint8Array([1, 2, 3]).buffer
  const next = new Uint8Array([4, 5]).buffer
  await retainedChessAppearance.write("first.pack", first)
  expect(await retainedChessAppearance.read("first.pack")).toEqual(first)
  await retainedChessAppearance.write("next.pack", next)
  expect(await retainedChessAppearance.read("first.pack")).toBeUndefined()
  await retainedChessAppearance.remove("first.pack")
  expect(await retainedChessAppearance.read("next.pack")).toEqual(next)
  await retainedChessAppearance.remove("next.pack")
  expect(await retainedChessAppearance.read("next.pack")).toBeUndefined()
})
