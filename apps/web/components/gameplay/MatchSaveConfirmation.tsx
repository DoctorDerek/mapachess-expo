"use client"

import { animate, motion, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"
import pausePresentationWhileHidden from "../../lib/presentation/pausePresentationWhileHidden"

const SAVE_CONFIRMATION_DURATION_MS = 5_000

export default function MatchSaveConfirmation() {
  const [visible, setVisible] = useState(true)
  const reduceMotion = useReducedMotion() === true
  useEffect(() => {
    let stopFollowingVisibility: (() => void) | undefined
    const playback = animate(0, 1, {
      duration: SAVE_CONFIRMATION_DURATION_MS / 1000,
      ease: "linear",
      onComplete: () => {
        stopFollowingVisibility?.()
        setVisible(false)
      },
    })
    stopFollowingVisibility = pausePresentationWhileHidden(playback)
    return () => {
      stopFollowingVisibility()
      playback.stop()
    }
  }, [])

  return (
    <motion.span
      animate={{ opacity: visible ? 1 : 0 }}
      aria-hidden={!visible}
      className="bg-mapachito-white text-mapachito-charcoal pointer-events-none absolute top-2 right-2 z-3 inline-flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-full px-2 py-1 text-base font-normal shadow-sm"
      role="status"
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
    >
      <svg
        aria-hidden="true"
        className="bg-mapachito-green h-5 w-5 shrink-0 rounded-full p-0.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      >
        <path d="m5 12 4 4L19 6" />
      </svg>
      Saved locally
    </motion.span>
  )
}
