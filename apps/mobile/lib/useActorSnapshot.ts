import { useCallback, useSyncExternalStore } from "react"

export type SubscribableActor<Snapshot> = Readonly<{
  getSnapshot: () => Snapshot
  subscribe: (listener: (snapshot: Snapshot) => void) => {
    unsubscribe: () => void
  }
}>

function useActorSnapshot<Snapshot>(
  actor: SubscribableActor<Snapshot>,
): Snapshot
function useActorSnapshot<Snapshot>(
  actor: SubscribableActor<Snapshot> | null,
): Snapshot | null
function useActorSnapshot<Snapshot>(
  actor: SubscribableActor<Snapshot> | null,
): Snapshot | null {
  const subscribe = useCallback(
    (listener: () => void) => {
      const subscription = actor?.subscribe(listener)
      return () => subscription?.unsubscribe()
    },
    [actor],
  )
  const getSnapshot = useCallback(
    () => (actor === null ? null : actor.getSnapshot()),
    [actor],
  )
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export default useActorSnapshot
