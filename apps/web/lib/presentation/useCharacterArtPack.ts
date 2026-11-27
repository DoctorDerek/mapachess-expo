import { useEffect, useSyncExternalStore } from "react"
import {
  hasCharacterArtPack,
  prepareCharacterArtPack,
  subscribeCharacterArt,
} from "./characterArtPack"

const initiallyUnloaded = (): boolean => false

export default function useCharacterArtPack(needed: boolean): void {
  useSyncExternalStore(
    subscribeCharacterArt,
    hasCharacterArtPack,
    initiallyUnloaded,
  )
  useEffect(() => {
    if (needed) void prepareCharacterArtPack().catch(() => undefined)
  }, [needed])
}
