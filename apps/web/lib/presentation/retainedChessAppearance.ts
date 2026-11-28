const DATABASE = "mapachess-chess-appearance"
const STORE = "verified-pack"

function access<Result>(
  mode: IDBTransactionMode,
  command: (store: IDBObjectStore) => IDBRequest<Result>,
): Promise<Result> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DATABASE, 1)
    let blocked = false
    opening.onblocked = () => {
      blocked = true
      reject(new Error("Chess appearance storage is blocked."))
    }
    opening.onerror = () => reject(opening.error)
    opening.onupgradeneeded = () => {
      if (blocked) opening.transaction?.abort()
      else opening.result.createObjectStore(STORE)
    }
    opening.onsuccess = () => {
      const database = opening.result
      if (blocked) {
        database.close()
        return
      }
      database.onversionchange = () => database.close()
      try {
        const transaction = database.transaction(STORE, mode)
        const result = command(transaction.objectStore(STORE))
        transaction.oncomplete = () => {
          database.close()
          resolve(result.result)
        }
        transaction.onabort = () => {
          database.close()
          reject(
            transaction.error ??
              new Error("Chess appearance storage was interrupted."),
          )
        }
      } catch (error) {
        database.close()
        reject(error)
      }
    }
  })
}

const retainedChessAppearance = {
  async read(url: string) {
    const bytes: unknown = await access<unknown>("readonly", (store) =>
      store.get(url),
    )
    return bytes instanceof ArrayBuffer ? bytes : undefined
  },
  async write(url: string, bytes: ArrayBuffer) {
    await access("readwrite", (store) => {
      store.clear()
      return store.put(bytes, url)
    })
  },
  async remove(url: string) {
    await access("readwrite", (store) => store.delete(url))
  },
}
export default retainedChessAppearance
