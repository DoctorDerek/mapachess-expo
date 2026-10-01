"use client"

import { useCallback, useEffect, useRef } from "react"
import type { ActorRefFrom } from "xstate"
import profileMachine from "@mapachess/profile/profile-machine"
import {
  selectWebNavigationDestination,
  type WebMatchSessionActor,
} from "./webMatchSessionMachine"
import {
  parseWebNavigationDestination,
  type WebNavigationDestination,
  type WebNavigationOverlay,
} from "./webNavigationDestination"

type NavigationEntry = Readonly<{
  scope: string
  index: number
  destination: WebNavigationDestination
}>
export type WebNavigationCommands = Readonly<{
  back: () => void
  open: (overlay: WebNavigationOverlay) => void
}>

const entryFromState = (state: unknown): NavigationEntry | null => {
  if (
    typeof state !== "object" ||
    state === null ||
    !("mapachessNavigation" in state)
  )
    return null
  const entry = state.mapachessNavigation
  if (
    typeof entry !== "object" ||
    entry === null ||
    !("scope" in entry) ||
    typeof entry.scope !== "string" ||
    !("index" in entry) ||
    typeof entry.index !== "number" ||
    !Number.isSafeInteger(entry.index) ||
    entry.index < 0 ||
    !("destination" in entry)
  )
    return null
  const destination = parseWebNavigationDestination(entry.destination)
  return destination === null
    ? null
    : { scope: entry.scope, index: entry.index, destination }
}

const sameDestination = (
  left: WebNavigationDestination,
  right: WebNavigationDestination,
): boolean => JSON.stringify(left) === JSON.stringify(right)

const writeEntry = (entry: NavigationEntry, replace: boolean): void => {
  const state: unknown = window.history.state
  const retainedState = typeof state === "object" && state !== null ? state : {}
  const nextState = { ...retainedState, mapachessNavigation: entry }
  if (replace) window.history.replaceState(nextState, "")
  else window.history.pushState(nextState, "")
}

export default function useWebNavigationHistory(
  actor: WebMatchSessionActor,
  profileActor: ActorRefFrom<typeof profileMachine>,
): WebNavigationCommands {
  const scope = useRef<string | null>(null)
  useEffect(() => {
    scope.current ??= globalThis.crypto.randomUUID()
    const currentScope = scope.current
    let restoring = false
    let focusFrame: number | null = null
    const returnFocus = new Map<number, HTMLElement>()
    const synchronize = (): void => {
      const destination = selectWebNavigationDestination(actor.getSnapshot())
      if (destination === null || restoring) return
      const entry = entryFromState(window.history.state)
      if (entry?.scope !== currentScope) {
        const root = { ...destination, screen: "menu" as const, overlays: [] }
        writeEntry({ scope: currentScope, index: 0, destination: root }, true)
        if (!sameDestination(root, destination))
          writeEntry({ scope: currentScope, index: 1, destination }, false)
        return
      }
      if (sameDestination(entry.destination, destination)) return
      const nextIndex = entry.index + 1
      if (document.activeElement instanceof HTMLElement)
        returnFocus.set(nextIndex, document.activeElement)
      const closingOverlay =
        destination.screen === entry.destination.screen &&
        destination.matchId === entry.destination.matchId &&
        destination.overlays.length < entry.destination.overlays.length
      writeEntry(
        {
          scope: currentScope,
          index: closingOverlay ? entry.index : nextIndex,
          destination,
        },
        closingOverlay,
      )
    }
    const restore = (event: PopStateEvent): void => {
      const current = selectWebNavigationDestination(actor.getSnapshot())
      if (current === null) return
      const profile = profileActor.getSnapshot()
      const entry = entryFromState(event.state)
      if (
        profile.matches("recovery") ||
        profile.matches("importPreview") ||
        profile.matches("persistenceFailure") ||
        profile.matches("retryingPersistence") ||
        profile.matches("loadFailure")
      ) {
        writeEntry(
          {
            scope: currentScope,
            index: entry?.scope === currentScope ? entry.index : 0,
            destination: current,
          },
          true,
        )
        return
      }
      const destination =
        entry?.scope === currentScope
          ? entry.destination
          : { ...current, screen: "menu" as const, overlays: [] }
      restoring = true
      actor.send({ type: "WEB_MATCH_SESSION.NAVIGATION_RESTORED", destination })
      restoring = false
      const accepted = selectWebNavigationDestination(actor.getSnapshot())
      if (accepted !== null)
        writeEntry(
          {
            scope: currentScope,
            index: entry?.scope === currentScope ? entry.index : 0,
            destination: accepted,
          },
          true,
        )
      const trigger = returnFocus.get((entry?.index ?? -1) + 1)
      if (focusFrame !== null) cancelAnimationFrame(focusFrame)
      focusFrame = requestAnimationFrame(() => {
        focusFrame = null
        if (
          trigger?.isConnected &&
          trigger.closest("[hidden], [inert]") === null
        )
          trigger.focus()
      })
    }
    window.addEventListener("popstate", restore)
    const subscription = actor.subscribe(synchronize)
    synchronize()
    return () => {
      subscription.unsubscribe()
      window.removeEventListener("popstate", restore)
      if (focusFrame !== null) cancelAnimationFrame(focusFrame)
    }
  }, [actor, profileActor])
  const back = useCallback(() => {
    const entry = entryFromState(window.history.state)
    if (entry?.scope === scope.current && entry.index > 0) window.history.back()
    else if (actor.getSnapshot().context.overlays.length > 0)
      actor.send({ type: "WEB_MATCH_SESSION.OVERLAY_CLOSED" })
    else actor.send({ type: "WEB_MATCH_SESSION.MAIN_MENU_REQUESTED" })
  }, [actor])
  const open = useCallback(
    (overlay: WebNavigationOverlay) =>
      actor.send({ type: "WEB_MATCH_SESSION.OVERLAY_OPENED", overlay }),
    [actor],
  )
  return { back, open }
}
