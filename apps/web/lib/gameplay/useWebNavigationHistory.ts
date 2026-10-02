"use client"

import { useCallback, useEffect, useRef } from "react"
import {
  parseMatchNavigationDestination,
  type MatchNavigationCommands,
  type MatchNavigationDestination,
  type MatchNavigationOverlay,
} from "@mapachess/match/match-navigation"
import {
  selectWebNavigationDestination,
  type WebMatchSessionActor,
} from "./webMatchSessionMachine"

type NavigationEntry = Readonly<{
  scope: string
  index: number
  destination: MatchNavigationDestination
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
  const destination = parseMatchNavigationDestination(entry.destination)
  return destination === null
    ? null
    : { scope: entry.scope, index: entry.index, destination }
}

const sameDestination = (
  left: MatchNavigationDestination,
  right: MatchNavigationDestination,
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
): MatchNavigationCommands {
  const scope = useRef<string | null>(null)
  useEffect(() => {
    scope.current ??= globalThis.crypto.randomUUID()
    const currentScope = scope.current
    let disposed = false
    let restoring = false
    let restoringInitialEntry = false
    let traversalPending = false
    let lastDestination = selectWebNavigationDestination(actor.getSnapshot())
    let focusFrame: number | null = null
    const returnFocus = new Map<number, HTMLElement>()
    const restoreFocus = (index: number): void => {
      const trigger = returnFocus.get(index + 1)
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
    const synchronize = (): void => {
      const destination = selectWebNavigationDestination(actor.getSnapshot())
      if (destination === null || restoring || disposed) return
      lastDestination = destination
      const entry = entryFromState(window.history.state)
      if (traversalPending) {
        writeEntry(
          {
            scope: currentScope,
            index: entry?.scope === currentScope ? entry.index : 0,
            destination,
          },
          true,
        )
        traversalPending = false
        restoreFocus(entry?.scope === currentScope ? entry.index : -1)
        return
      }
      if (entry?.scope !== currentScope) {
        if (entry !== null && !restoringInitialEntry) {
          restoringInitialEntry = true
          restoring = true
          actor.send({
            type: "MATCH_SESSION.NAVIGATION_RESTORED",
            destination: entry.destination,
          })
          restoring = false
          queueMicrotask(synchronize)
          return
        }
        restoringInitialEntry = false
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
      const replacingConcludingMenu =
        destination.screen === "match" &&
        destination.matchId === entry.destination.matchId &&
        destination.overlays.at(-1) === "rewards" &&
        entry.destination.overlays.at(-1) === "match-menu" &&
        destination.overlays.length === entry.destination.overlays.length
      const replaceCurrentEntry = closingOverlay || replacingConcludingMenu
      writeEntry(
        {
          scope: currentScope,
          index: replaceCurrentEntry ? entry.index : nextIndex,
          destination,
        },
        replaceCurrentEntry,
      )
    }
    const restore = (event: PopStateEvent): void => {
      const current =
        selectWebNavigationDestination(actor.getSnapshot()) ?? lastDestination
      const entry = entryFromState(event.state)
      const destination =
        entry?.scope === currentScope
          ? entry.destination
          : current === null
            ? null
            : { ...current, screen: "menu" as const, overlays: [] }
      if (destination === null) return
      traversalPending = true
      restoring = true
      actor.send({ type: "MATCH_SESSION.NAVIGATION_RESTORED", destination })
      restoring = false
      const accepted = selectWebNavigationDestination(actor.getSnapshot())
      if (accepted !== null) {
        lastDestination = accepted
        traversalPending = false
        writeEntry(
          {
            scope: currentScope,
            index: entry?.scope === currentScope ? entry.index : 0,
            destination: accepted,
          },
          true,
        )
        restoreFocus(entry?.scope === currentScope ? entry.index : -1)
      }
    }
    window.addEventListener("popstate", restore)
    const subscription = actor.subscribe(synchronize)
    synchronize()
    return () => {
      disposed = true
      subscription.unsubscribe()
      window.removeEventListener("popstate", restore)
      if (focusFrame !== null) cancelAnimationFrame(focusFrame)
    }
  }, [actor])
  const back = useCallback(() => {
    const entry = entryFromState(window.history.state)
    if (entry?.scope === scope.current && entry.index > 0) window.history.back()
    else actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
  }, [actor])
  const open = useCallback(
    (overlay: MatchNavigationOverlay) =>
      actor.send({ type: "MATCH_SESSION.OVERLAY_OPENED", overlay }),
    [actor],
  )
  return { back, open }
}
