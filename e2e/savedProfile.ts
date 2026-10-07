import type { Page } from "@playwright/test"
import type { MapachessPlayerData } from "../packages/profile/src/playerData.js"
import { decodeMapachessPlayerData } from "../packages/profile/src/playerDataCodec.js"

export default async function savedProfile(
  page: Page,
): Promise<MapachessPlayerData> {
  const raw = await page.evaluate(
    async () =>
      new Promise<string>((resolve, reject) => {
        const request = indexedDB.open("mapachess-player-data")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction(
            "durable-player-data",
            "readonly",
          )
          const read = transaction
            .objectStore("durable-player-data")
            .get("current")
          read.onerror = () => reject(read.error)
          read.onsuccess = () =>
            typeof read.result === "string"
              ? resolve(read.result)
              : reject(new Error("Expected durable player data"))
          transaction.oncomplete = () => database.close()
        }
      }),
  )
  const envelope: unknown = JSON.parse(raw)
  if (
    typeof envelope !== "object" ||
    envelope === null ||
    !("payload" in envelope)
  )
    throw new Error("Expected profile envelope")
  const decoded = decodeMapachessPlayerData(envelope.payload)
  if (!decoded.ok) throw new Error("Expected valid profile payload")
  return decoded.data
}
