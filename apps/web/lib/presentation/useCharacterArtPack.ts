import { useSyncExternalStore } from "react"
import { hasCharacterArtPack, subscribeCharacterArt } from "./characterArtPack"

const initiallyUnloaded = (): boolean => false
const skipSubscription = () => () => undefined

export default function useCharacterArtPack(needed: boolean): void {
  useSyncExternalStore(
    needed ? subscribeCharacterArt : skipSubscription,
    hasCharacterArtPack,
    initiallyUnloaded,
  )
}
