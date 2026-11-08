import { useCallback, useSyncExternalStore } from "react"

export type SubscribableActor<Snapshot> = Readonly<{
  getSnapshot: () => Snapshot
  subscribe: (listener: (snapshot: Snapshot) => void) => {
    unsubscribe: () => void
  }
}>

export default function useActorSnapshot<Snapshot>(
  actor: SubscribableActor<Snapshot>,
): Snapshot {
  const subscribe = useCallback(
    (listener: () => void) => {
      const subscription = actor.subscribe(listener)
      return () => subscription.unsubscribe()
    },
    [actor],
  )
  const getSnapshot = useCallback(() => actor.getSnapshot(), [actor])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
