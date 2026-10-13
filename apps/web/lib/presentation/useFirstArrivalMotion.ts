"use client"

import type { Rive } from "@rive-app/canvas-lite"
import { useCallback, useEffect, useRef, useState, type RefObject } from "react"

type FirstArrivalMotion = Readonly<{
  canvasRef: RefObject<HTMLCanvasElement | null>
  cancel: () => void
  visible: boolean
  runRaccoon: boolean
}>

export default function useFirstArrivalMotion(
  enabled: boolean,
): FirstArrivalMotion {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cancelled, setCancelled] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [finished, setFinished] = useState(false)
  const cancel = useCallback(() => setCancelled(true), [])

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const forcedColors = window.matchMedia("(forced-colors: active)")
    const cancelIfInaccessible = () => {
      if (document.hidden || reducedMotion.matches || forcedColors.matches)
        cancel()
    }
    cancelIfInaccessible()
    document.addEventListener("visibilitychange", cancelIfInaccessible)
    reducedMotion.addEventListener("change", cancelIfInaccessible)
    forcedColors.addEventListener("change", cancelIfInaccessible)
    return () => {
      document.removeEventListener("visibilitychange", cancelIfInaccessible)
      reducedMotion.removeEventListener("change", cancelIfInaccessible)
      forcedColors.removeEventListener("change", cancelIfInaccessible)
    }
  }, [cancel])

  useEffect(() => {
    if (!enabled || cancelled || finished) return
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const forcedColors = window.matchMedia("(forced-colors: active)")
    if (reducedMotion.matches || forcedColors.matches || document.hidden) return
    let disposed = false
    let reportedAdvance = false
    let idle: number | undefined
    let frame: number | undefined
    let rive: Rive | undefined
    const finish = () => {
      if (!disposed) setFinished(true)
    }
    const load = async () => {
      try {
        const { Rive, Layout, Fit, Alignment, RuntimeLoader } =
          await import("@rive-app/canvas-lite")
        if (disposed || canvasRef.current === null) return
        RuntimeLoader.setWasmUrl("/generated/first-arrival/rive.wasm")
        RuntimeLoader.setWasmFallbackUrl(
          "/generated/first-arrival/rive_fallback.wasm",
        )
        await RuntimeLoader.awaitInstance()
        if (disposed || canvasRef.current === null) return
        rive = new Rive({
          canvas: canvasRef.current,
          src: "/generated/first-arrival/ice-cream.riv",
          // One-time exception: the original ident's state machine never exits; its one-shot timeline does.
          animations: "Hero Animation",
          layout: new Layout({ fit: Fit.Cover, alignment: Alignment.Center }),
          autoplay: true,
          enableRiveAssetCDN: false,
          shouldDisableRiveListeners: true,
          onAdvance: () => {
            if (disposed || reportedAdvance) return
            reportedAdvance = true
            setAdvanced(true)
          },
          onStop: finish,
          onLoadError: finish,
        })
      } catch {
        finish()
      }
    }
    const schedule = () => {
      if (
        typeof window.requestIdleCallback === "function" &&
        typeof window.cancelIdleCallback === "function"
      )
        idle = window.requestIdleCallback(() => void load(), { timeout: 2000 })
      else frame = window.requestAnimationFrame(() => void load())
    }
    if (document.readyState === "complete") schedule()
    else window.addEventListener("load", schedule, { once: true })
    return () => {
      disposed = true
      window.removeEventListener("load", schedule)
      if (idle !== undefined) window.cancelIdleCallback(idle)
      if (frame !== undefined) window.cancelAnimationFrame(frame)
      rive?.cleanup()
    }
  }, [enabled, cancelled, finished])

  return {
    canvasRef,
    cancel,
    visible: enabled && !cancelled && !finished,
    runRaccoon: enabled && !cancelled && advanced,
  }
}
