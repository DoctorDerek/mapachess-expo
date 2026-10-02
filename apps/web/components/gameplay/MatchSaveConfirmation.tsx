"use client"

import { motion, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"

const SAVE_CONFIRMATION_DURATION_MS = 5_000

export default function MatchSaveConfirmation() {
  const [visible, setVisible] = useState(true)
  const reduceMotion = useReducedMotion() === true
  useEffect(() => {
    const timeout = window.setTimeout(
      () => setVisible(false),
      SAVE_CONFIRMATION_DURATION_MS,
    )
    return () => window.clearTimeout(timeout)
  }, [])

  return (
    <motion.span
      animate={{ opacity: visible ? 1 : 0 }}
      aria-hidden={!visible}
      className="text-mapachito-charcoal inline-flex items-center gap-1 text-base font-normal"
      role="status"
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
    >
      <svg
        aria-hidden="true"
        className="bg-mapachito-green h-5 w-5 rounded-full p-0.5"
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
