import { webcrypto } from "node:crypto"
import { cleanup } from "@testing-library/react"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, vi, type TestContext } from "vitest"
import { waitFor } from "xstate"
import SerializedPlayerDataStore from "@mapachess/profile/durable-store"
import createInitialPlayerData, {
  type MapachessPlayerData,
} from "@mapachess/profile/player-data"
import IndexedDbDurableStore from "../lib/profile/IndexedDbDurableStore"
import openWebProfileRuntime from "../lib/profile/openWebProfileRuntime"
import webSha256 from "../lib/profile/webSha256"

export function installDomHarness(): void {
  const polyfills = [
    [HTMLElement.prototype, "scrollIntoView"],
    [HTMLElement.prototype, "checkVisibility"],
    [HTMLDialogElement.prototype, "showModal"],
    [HTMLDialogElement.prototype, "close"],
  ] as const
  const originalDescriptors = polyfills.map(([target, name]) => ({
    target,
    name,
    descriptor: Object.getOwnPropertyDescriptor(target, name),
  }))
  beforeEach(() => {
    vi.stubGlobal("crypto", webcrypto)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("The DOM fixture is offline.")),
    )
    vi.stubGlobal("matchMedia", (query: string): MediaQueryList => ({
      matches: query.includes("reduced-motion"),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    }))
    if (!HTMLElement.prototype.scrollIntoView)
      HTMLElement.prototype.scrollIntoView = () => undefined
    if (!HTMLDialogElement.prototype.showModal)
      HTMLDialogElement.prototype.showModal = function () {
        this.open = true
      }
    if (!HTMLDialogElement.prototype.close)
      HTMLDialogElement.prototype.close = function () {
        this.open = false
      }
    window.history.replaceState(null, "")
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined)
    Object.defineProperty(HTMLElement.prototype, "checkVisibility", {
      configurable: true,
      writable: true,
      value: () => true,
    })
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    for (const { target, name, descriptor } of originalDescriptors) {
      if (descriptor === undefined) Reflect.deleteProperty(target, name)
      else Object.defineProperty(target, name, descriptor)
    }
  })
}

export async function readyProfile(
  onTestFinished: TestContext["onTestFinished"],
  playerData: MapachessPlayerData = createInitialPlayerData(),
) {
  const indexedDb = new IDBFactory()
  const storage = new IndexedDbDurableStore(indexedDb)
  const store = new SerializedPlayerDataStore(storage, (value) =>
    webSha256(value, webcrypto.subtle),
  )
  const seeded = await store.commitCurrent(await store.load(), playerData)
  if (!seeded.ok) throw new Error("The integration fixture must persist.")
  const profile = openWebProfileRuntime({
    indexedDb,
    subtleCrypto: webcrypto.subtle,
  })
  onTestFinished(async () => {
    cleanup()
    await profile.close()
    await storage.close()
  })
  await waitFor(profile.actor, (snapshot) => snapshot.matches("ready"))
  return { ...profile, storage, indexedDb }
}
