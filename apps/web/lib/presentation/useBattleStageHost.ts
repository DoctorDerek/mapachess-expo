"use client"

import { useLayoutEffect, useState, type RefCallback } from "react"

export default function useBattleStageHost(
  celebrationSlot: HTMLElement | null,
): Readonly<{
  gameplaySlotRef: RefCallback<HTMLDivElement>
  host: HTMLDivElement | null
}> {
  const [gameplaySlot, setGameplaySlot] = useState<HTMLDivElement | null>(null)
  const [host, setHost] = useState<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const container = document.createElement("div")
    setHost(container)
    return () => container.remove()
  }, [])

  useLayoutEffect(() => {
    const destination = celebrationSlot ?? gameplaySlot
    if (host === null || destination === null) return
    if (host.parentElement === destination) return
    if (host.isConnected && typeof destination.moveBefore === "function") {
      destination.moveBefore(host, null)
    } else {
      destination.appendChild(host)
    }
  }, [celebrationSlot, gameplaySlot, host])

  return { gameplaySlotRef: setGameplaySlot, host }
}
