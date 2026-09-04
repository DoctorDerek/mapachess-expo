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
    animationDirection: "normal",
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
    backgroundRepeat: "no-repeat",
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
    <div className="mapachess-battle-fighter">
      <motion.div
        animate={{ x: shouldReduceMotion ? 0 : movementPixels }}
        aria-label={`${displayName}: ${presentation.reactionSlot.replaceAll("-", " ")}`}
        className="mapachess-battle-fighter__motion"
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
            className={`mapachess-battle-sprite ${
              facing === "right" ? "mapachess-battle-sprite--faces-right" : ""
            }`}
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
            className="mapachess-battle-fighter__fallback"
          >
            {participant === "player" ? "M" : "C"}
          </span>
        )}
      </motion.div>
      <span className="mapachess-battle-fighter__name">{displayName}</span>
    </div>
  )
}
