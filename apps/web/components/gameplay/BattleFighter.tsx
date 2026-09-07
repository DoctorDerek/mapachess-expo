"use client"

import { animate } from "motion"
import { useReducedMotion } from "motion/react"
import { useEffect, useEffectEvent, useRef, useState, type Ref } from "react"
import type { MatchPresentationBeat } from "@mapachess/match-presentation/match-presentation-machine"
import type { MatchPresentationParticipant } from "@mapachess/match-presentation/match-reaction"
import type {
  ResolvedSpritePresentation,
  SpriteFacing,
} from "@mapachess/match-presentation/presentation-asset-manifest"
import {
  battleSpriteAnchorStyle,
  battleSpriteFrameKeyframes,
  showBattleSpriteFrame,
} from "../../lib/presentation/battleSpriteFrames"
import createBattleSpriteImages from "../../lib/presentation/battleSpriteImages"

const FALLBACK_MOVEMENT_SECONDS = 0.36

export type BattleFighterProps = Readonly<{
  anchorRef: Ref<HTMLDivElement>
  beat: MatchPresentationBeat
  contactDistance: number
  displayName: string
  facing: SpriteFacing
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

export default function BattleFighter({
  anchorRef,
  beat,
  contactDistance,
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
  const displayedFacing =
    beat === "recovery" && presentation.reactionSlot.endsWith("attacker")
      ? facing === "left"
        ? "right"
        : "left"
      : facing
  const spriteRef = useRef<HTMLSpanElement>(null)
  const travelerRef = useRef<HTMLDivElement>(null)
  const visibleSource = useRef<string | null>(null)
  const settledTravelTarget = useRef<number | null>(0)
  const [images] = useState(() => createBattleSpriteImages())
  const [hasVisibleSprite, setHasVisibleSprite] = useState(false)
  const reportCompletion = useEffectEvent(
    (completedPhase: number, completedSequence: number) => {
      if (shouldReportCompletion) {
        onAnimationCompleted(participant, completedPhase, completedSequence)
      }
    },
  )

  useEffect(() => () => images.retain([]), [images])

  useEffect(() => {
    const sprite = spriteRef.current
    const traveler = travelerRef.current
    if (sprite === null || traveler === null) return
    let cancelled = false
    let frames: Animation | null = null
    let movement: ReturnType<typeof animate> | null = null
    const isTransient = beat !== "idle" && beat !== "conclusion"
    const holdFrame = (): void => {
      if (frames === null) return
      sprite.style.backgroundPosition =
        getComputedStyle(sprite).backgroundPosition
      frames.cancel()
      frames = null
    }
    const towardOpponent = participant === "player" ? 1 : -1
    const isAttacker = presentation.reactionSlot.endsWith("attacker")
    const isVictim = presentation.reactionSlot.endsWith("victim")
    const targetX = shouldReduceMotion
      ? 0
      : isAttacker &&
          (beat === "approach" || beat === "strike" || beat === "reaction")
        ? towardOpponent * contactDistance
        : isVictim && beat === "reaction"
          ? -towardOpponent * Math.min(contactDistance / 4, 10)
          : 0
    const allSteps = presentation.kind === "sprite" ? presentation.steps : []
    const steps = allSteps.filter((step) => step.beat === beat)
    const sources = allSteps.map((step) => step.animation.sourceId)
    images.retain(
      visibleSource.current === null
        ? sources
        : [...sources, visibleSource.current],
    )
    const prepared = images.prepare(sources)

    const move = async (duration: number): Promise<void> => {
      if (cancelled || settledTravelTarget.current === targetX) return
      settledTravelTarget.current = null
      movement = animate(
        traveler,
        { x: targetX },
        {
          duration: shouldReduceMotion ? 0 : duration,
          ease: "linear",
        },
      )
      await movement
      if (!cancelled) settledTravelTarget.current = targetX
    }

    const play = async (): Promise<void> => {
      if (document.visibilityState === "hidden" && isTransient) {
        reportCompletion(phaseIndex, reactionSequence)
        return
      }
      if (steps.length === 0) {
        await move(FALLBACK_MOVEMENT_SECONDS)
      } else if (await prepared) {
        for (const step of shouldReduceMotion ? steps.slice(-1) : steps) {
          if (cancelled) return
          const { animation, playback } = step
          showBattleSpriteFrame(sprite, step, shouldReduceMotion)
          visibleSource.current = animation.sourceId
          setHasVisibleSprite(true)
          const duration =
            animation.frameCount * animation.frameDurationMilliseconds
          const travel = move(duration / 1000)
          if (shouldReduceMotion) {
            await travel
            continue
          }
          frames = sprite.animate(
            battleSpriteFrameKeyframes(animation.frameCount),
            {
              duration,
              fill: "forwards",
              iterations: playback === "loop" ? Infinity : 1,
            },
          )
          if (document.visibilityState === "hidden") {
            frames.pause()
            movement?.pause()
          }
          await Promise.all([frames.finished, travel])
          if (cancelled) return
          sprite.style.backgroundPosition = "100% 0"
          frames.cancel()
          frames = null
        }
      }
      if (!cancelled) reportCompletion(phaseIndex, reactionSequence)
    }

    const handleVisibility = (): void => {
      if (document.visibilityState === "hidden") {
        if (isTransient) {
          cancelled = true
          holdFrame()
          movement?.stop()
          reportCompletion(phaseIndex, reactionSequence)
        } else {
          frames?.pause()
          movement?.pause()
        }
      } else {
        frames?.play()
        movement?.play()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    void play().catch(() => {
      if (!cancelled) reportCompletion(phaseIndex, reactionSequence)
    })

    return () => {
      cancelled = true
      holdFrame()
      movement?.stop()
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [
    beat,
    contactDistance,
    images,
    participant,
    phaseIndex,
    presentation,
    reactionSequence,
    shouldReduceMotion,
  ])

  return (
    <div className="relative z-2 row-span-2 grid min-w-0 grid-rows-subgrid justify-items-center">
      <div
        ref={anchorRef}
        aria-label={`${displayName}: ${presentation.reactionSlot.replaceAll("-", " ")}`}
        className="relative flex h-32 w-18 items-end justify-center [--sprite-scale:var(--sprite-mobile-scale)] xl:[--sprite-scale:var(--sprite-desktop-scale)]"
        role="img"
        style={
          presentation.kind === "sprite"
            ? battleSpriteAnchorStyle(presentation)
            : undefined
        }
      >
        <div
          ref={travelerRef}
          className="relative grid size-0 place-items-end"
        >
          <span
            aria-hidden="true"
            className={`relative block size-0 ${presentation.kind === "sprite" && displayedFacing !== presentation.sourceFacing ? "-scale-x-100" : ""}`}
          >
            <span
              ref={spriteRef}
              className="absolute block bg-no-repeat [image-rendering:pixelated]"
            />
          </span>
          {!hasVisibleSprite ? (
            <span
              aria-hidden="true"
              className={`border-mapachito-charcoal font-display text-mapachito-charcoal absolute bottom-0 left-0 grid size-18 -translate-x-1/2 place-items-center border-4 text-4xl font-black ${participant === "player" ? "bg-mapachito-orange" : "bg-mapachito-white"}`}
            >
              {displayName.slice(0, 1)}
            </span>
          ) : null}
        </div>
      </div>
      <span
        className={`border-mapachito-charcoal text-mapachito-white z-1 mt-2 max-w-full border-2 px-2 py-1 text-center font-mono text-xs font-bold [overflow-wrap:anywhere] forced-colors:border-[CanvasText] ${participant === "player" ? "bg-mapachito-violet" : "bg-mapachito-raspberry"}`}
      >
        {displayName}
      </span>
    </div>
  )
}
