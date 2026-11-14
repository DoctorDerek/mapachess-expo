import { webcrypto } from "node:crypto"
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { IDBFactory } from "fake-indexeddb"
import { expect, vi } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import SerializedPlayerDataStore from "@mapachess/profile/durable-store"
import WebMapachessApplication from "../components/profile/WebMapachessApplication"
import IndexedDbDurableStore from "../lib/profile/IndexedDbDurableStore"
import webSha256 from "../lib/profile/webSha256"

const copy = loadCatalog("en")

export async function bootApplication() {
  const indexedDb = new IDBFactory()
  vi.stubGlobal("indexedDB", indexedDb)
  const view = render(<WebMapachessApplication />)
  const start = await screen.findByRole("button", {
    name: copy.introduction.start,
  })
  await waitFor(() => expect(start.hasAttribute("disabled")).toBe(false))
  fireEvent.click(start)
  await waitFor(async () =>
    expect((await savedProfile(indexedDb)).introductionCompleted).toBe(true),
  )
  await act(async () => {
    await vi.dynamicImportSettled()
  })
  await screen.findByRole(
    "button",
    { name: new RegExp(copy.setup.presentations.standard.story.title) },
    { timeout: 5000 },
  )
  return { ...view, indexedDb }
}

export async function openSettings() {
  fireEvent.click(
    screen.getByRole("button", { name: copy.interface.webGame.settings }),
  )
  return within(
    await screen.findByRole("dialog", { name: copy.profile.settingsTitle }),
  )
}

export async function savedProfile(indexedDb: IDBFactory) {
  const storage = new IndexedDbDurableStore(indexedDb)
  const store = new SerializedPlayerDataStore(storage, (value) =>
    webSha256(value, webcrypto.subtle),
  )
  try {
    const loaded = await store.load()
    if (loaded.current.type !== "valid")
      throw new Error("The integration fixture requires accepted player data.")
    return loaded.current.data
  } finally {
    await storage.close()
  }
}
