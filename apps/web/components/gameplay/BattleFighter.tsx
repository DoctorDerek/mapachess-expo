"use client"

import { motion, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState, type CSSProperties } from "react"
import type { MatchPresentationParticipant } from "@mapachess/match-presentation/match-reaction"
import type { ResolvedSpritePresentation } from "@mapachess/match-presentation/presentation-asset-manifest"

const AUTHORED_FALLBACK_ANIMATION_SECONDS = 0.36
const ATTACKER_TRAVEL_PIXELS_PER_STEP = 24
const VICTIM_RECOIL_PIXELS = 10

export type BattleFighterProps = Readonly<{
  displayName: string
  facing: "left" | "right"
  onAnimationCompleted: (
    participant: MatchPresentationParticipant,
    phaseIndex: number,
    reactionSequence: number,
  ) => void
  participant: MatchPresentationParticipant
  phaseIndex: number
  presentation: ResolvedSpritePresentation<string, string>
  reactionSequence: number
  shouldReportCompletion: boolean
}>

const reactionMovementPixels = (
  participant: MatchPresentationParticipant,
  reactionSlot: BattleFighterProps["presentation"]["reactionSlot"],
  stepIndex: number,
): number => {
  const directionTowardCenter = participant === "player" ? 1 : -1
  if (reactionSlot.endsWith("attacker")) {
    return (
      directionTowardCenter * ATTACKER_TRAVEL_PIXELS_PER_STEP * (stepIndex + 1)
    )
  }
  return reactionSlot.endsWith("victim")
    ? -directionTowardCenter * VICTIM_RECOIL_PIXELS
    : 0
}

const spriteStyle = (
  presentation: Extract<BattleFighterProps["presentation"], { kind: "sprite" }>,
  stepIndex: number,
  shouldReduceMotion: boolean,
): CSSProperties => {
  const step = shouldReduceMotion
    ? presentation.steps.at(-1)
    : presentation.steps[stepIndex]
  if (step === undefined) {
    throw new Error("Battle fighter has no resolved sprite step.")
  }

  const { animation, playback } = step
  const frameTransitionCount = Math.max(1, animation.frameCount - 1)
  const reducedMotionFrameProgress =
    animation.frameCount === 1
      ? 0
      : (animation.reducedMotionFrameIndex / (animation.frameCount - 1)) * 100

  return {
    animationDuration: `${String(
      (animation.frameCount * animation.frameDurationMilliseconds) / 1000,
    )}s`,
    animationFillMode:
      playback === "once-hold-final-frame" ? "forwards" : "none",
    animationIterationCount: playback === "loop" ? "infinite" : 1,
    animationName: shouldReduceMotion
      ? undefined
      : "mapachess-battle-sprite-frames",
    animationTimingFunction: `steps(${String(frameTransitionCount)}, end)`,
    backgroundImage: `url("${animation.sourceId}")`,
    backgroundPosition: shouldReduceMotion
      ? `${String(reducedMotionFrameProgress)}% 0`
      : "0 0",
    backgroundSize: `${String(animation.frameCount * 100)}% 100%`,
    height: animation.geometry.frameHeight,
    width: animation.geometry.frameWidth,
  }
}

export default function BattleFighter({
  displayName,
  facing,
  onAnimationCompleted,
  participant,
  phaseIndex,
  presentation,
  reactionSequence,
  shouldReportCompletion,
}: BattleFighterProps) {
  const shouldReduceMotion = useReducedMotion() === true
  const [stepIndex, setStepIndex] = useState(0)
  const renderedStepIndex = shouldReduceMotion
    ? Math.max(
        0,
        presentation.kind === "sprite" ? presentation.steps.length - 1 : 0,
      )
    : stepIndex
  const hasNextStep =
    presentation.kind === "sprite" &&
    !shouldReduceMotion &&
    renderedStepIndex < presentation.steps.length - 1
  const completionIdentity = `${String(reactionSequence)}:${String(
    phaseIndex,
  )}:${String(renderedStepIndex)}`
  const completedIdentity = useRef<string | null>(null)
  const movementPixels = reactionMovementPixels(
    participant,
    presentation.reactionSlot,
    renderedStepIndex,
  )

  const completeCurrentAnimation = (): void => {
    if (completedIdentity.current === completionIdentity) return
    completedIdentity.current = completionIdentity

    if (hasNextStep) {
      setStepIndex((currentStepIndex) => currentStepIndex + 1)
    } else if (shouldReportCompletion) {
      onAnimationCompleted(participant, phaseIndex, reactionSequence)
    }
  }

  useEffect(() => {
    if (shouldReduceMotion && shouldReportCompletion) {
      completeCurrentAnimation()
    }
  })

  const animationDurationSeconds =
    presentation.kind === "sprite"
      ? (() => {
          const step = presentation.steps[renderedStepIndex]
          if (step === undefined) {
            throw new Error("Battle fighter has no active animation step.")
          }
          return (
            (step.animation.frameCount *
              step.animation.frameDurationMilliseconds) /
            1000
          )
        })()
      : AUTHORED_FALLBACK_ANIMATION_SECONDS

  return (
    <div className="relative z-2 grid min-w-0 justify-items-center">
      <motion.div
        animate={{ x: shouldReduceMotion ? 0 : movementPixels }}
        aria-label={`${displayName}: ${presentation.reactionSlot.replaceAll("-", " ")}`}
        className="grid h-34 w-full [place-items:end_center]"
        initial={{ x: 0 }}
        role="img"
        transition={{
          duration: animationDurationSeconds,
          ease: "easeInOut",
        }}
        {...(shouldReduceMotion || (!hasNextStep && !shouldReportCompletion)
          ? {}
          : { onAnimationComplete: completeCurrentAnimation })}
      >
        {presentation.kind === "sprite" ? (
          <span
            aria-hidden="true"
            className={`drop-shadow-mapachito-charcoal block origin-bottom scale-y-300 bg-no-repeat drop-shadow-[0.18rem_0.18rem_0] [animation-direction:normal] [image-rendering:pixelated] xl:scale-y-400 ${facing === "right" ? "-scale-x-300 xl:-scale-x-400" : "scale-x-300 xl:scale-x-400"}`}
            key={`${presentation.steps[renderedStepIndex]?.animationId ?? "missing"}:${String(renderedStepIndex)}`}
            style={spriteStyle(
              presentation,
              renderedStepIndex,
              shouldReduceMotion,
            )}
          />
        ) : (
          <span
            aria-hidden="true"
            className={`border-mapachito-charcoal font-display text-mapachito-charcoal shadow-mapachito-charcoal grid size-18 place-items-center border-[0.35rem] text-[2.6rem] font-black shadow-[0.3rem_0.3rem_0] ${participant === "player" ? "bg-mapachito-orange" : "bg-mapachito-white"}`}
          >
            {participant === "player" ? "M" : "C"}
          </span>
        )}
      </motion.div>
      <span
        className={`border-mapachito-charcoal text-mapachito-white z-1 mt-[0.45rem] max-w-full truncate border-2 px-[0.35rem] py-[0.2rem] text-center font-mono text-[0.65rem] font-black tracking-[0.04em] uppercase [text-shadow:2px_2px_0_var(--color-mapachito-charcoal)] forced-colors:border-[CanvasText] forced-colors:shadow-none ${participant === "player" ? "bg-mapachito-violet" : "bg-mapachito-raspberry"}`}
      >
        {displayName}
      </span>
    </div>
  )
}
