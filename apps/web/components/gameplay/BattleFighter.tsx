"use client"

import cx from "classix"
import { animate } from "motion"
import { useReducedMotion } from "motion/react"
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import battleSpritePlayback, {
  BATTLE_FALLBACK_TRAVEL_MILLISECONDS,
  type BattleTravelTarget,
} from "@mapachess/match-presentation/battle-sprite-playback"
import type { MatchPresentationBeat } from "@mapachess/match-presentation/match-presentation-machine"
import type { MatchPresentationParticipant } from "@mapachess/match-presentation/match-reaction"
import type {
  ResolvedSpritePresentation,
  SpriteFacing,
} from "@mapachess/match-presentation/presentation-asset-manifest"
import createBattleRecipePreparation from "../../lib/presentation/battleRecipePreparation"
import {
  battleSpriteAnchorStyle,
  battleSpriteFrameKeyframes,
  battleSpriteFramePosition,
  battleSpriteFrameStyle,
  showBattleSpriteFrame,
} from "../../lib/presentation/battleSpriteFrames"
import createPresentationImages from "../../lib/presentation/presentationImages"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

export type BattleFighterProps = Readonly<{
  beat: MatchPresentationBeat
  displayName: string
  facing: SpriteFacing
  onAnimationCompleted: (
    participant: MatchPresentationParticipant,
    phaseIndex: number,
    reactionSequence: number,
  ) => void
  opposingPresentation: ResolvedSpritePresentation<string, string>
  participant: MatchPresentationParticipant
  pauseTransientOnBackground: boolean
  phaseIndex: number
  presentation: ResolvedSpritePresentation<string, string>
  reactionSequence: number
  shouldReportCompletion: boolean
}>

export default function BattleFighter({
  beat,
  displayName,
  facing,
  onAnimationCompleted,
  opposingPresentation,
  participant,
  pauseTransientOnBackground,
  phaseIndex,
  presentation,
  reactionSequence,
  shouldReportCompletion,
}: BattleFighterProps) {
  const copy = useMapachessCopy().presentation
  const shouldReduceMotion = useReducedMotion() === true
  const playback = useMemo(
    () => battleSpritePlayback(presentation, beat, facing, shouldReduceMotion),
    [presentation, beat, facing, shouldReduceMotion],
  )
  const spriteRef = useRef<HTMLSpanElement>(null)
  const travelerRef = useRef<HTMLDivElement>(null)
  const visibleSource = useRef<string | null>(null)
  const settledTravelTarget = useRef<BattleTravelTarget | null>("home")
  const [images] = useState(() => createPresentationImages())
  const [recipePreparation] = useState(() =>
    createBattleRecipePreparation(images),
  )
  const [initialFrameStyle] = useState(() => {
    if (presentation.kind !== "sprite") return undefined
    const initialStep = presentation.steps.find((step) => step.beat === beat)
    return battleSpriteFrameStyle(initialStep ?? presentation.steps[0], false)
  })
  const [imageUnavailable, setImageUnavailable] = useState(false)
  const reportCompletion = useEffectEvent(
    (completedPhase: number, completedSequence: number) => {
      if (shouldReportCompletion) {
        onAnimationCompleted(participant, completedPhase, completedSequence)
      }
    },
  )
  const skipHiddenTransient = useEffectEvent(
    (isTransient: boolean) => isTransient && !pauseTransientOnBackground,
  )

  useEffect(
    () => () => {
      recipePreparation.reset()
      images.retain([])
    },
    [images, recipePreparation],
  )

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
    const { repeatSequence, sources, steps, travelTarget } = playback
    images.retain(
      visibleSource.current === null
        ? sources
        : [...sources, visibleSource.current],
    )
    const recipeReady = recipePreparation.prepare({
      phaseIndex,
      reactionSequence,
      sources,
    })
    const move = async (
      duration: number,
      target: BattleTravelTarget = travelTarget,
    ): Promise<void> => {
      if (cancelled || settledTravelTarget.current === target) return
      settledTravelTarget.current = null
      movement = animate(
        traveler,
        {
          "--battle-advance": target === "contact" ? 1 : 0,
          "--battle-recoil": target === "recoil" ? 1 : 0,
        },
        {
          duration: shouldReduceMotion ? 0 : duration,
          ease: "linear",
        },
      )
      if (document.hidden && !shouldReduceMotion) movement.pause()
      await movement
      movement = null
      if (!cancelled) settledTravelTarget.current = target
    }

    const play = async (): Promise<void> => {
      if (document.hidden && skipHiddenTransient(isTransient)) {
        reportCompletion(phaseIndex, reactionSequence)
        return
      }
      const decoded = await recipeReady
      if (cancelled) return
      if (!decoded) {
        if (visibleSource.current === null) setImageUnavailable(true)
        await move(0, "home")
        if (!cancelled) reportCompletion(phaseIndex, reactionSequence)
        return
      }
      if (steps.length === 0) {
        await move(BATTLE_FALLBACK_TRAVEL_MILLISECONDS / 1000)
      } else {
        do {
          for (const {
            step,
            frames: frameRange,
            durationMilliseconds: duration,
          } of steps) {
            const { animation, playback: stepPlayback } = step
            showBattleSpriteFrame(sprite, step, shouldReduceMotion)
            visibleSource.current = animation.sourceId
            setImageUnavailable(false)
            const [, end] = frameRange
            const travel = move(duration / 1000)
            if (shouldReduceMotion) {
              await travel
              continue
            }
            frames = sprite.animate(
              battleSpriteFrameKeyframes(animation.frameCount, frameRange),
              {
                duration,
                fill: "forwards",
                iterations: stepPlayback === "loop" ? Infinity : 1,
              },
            )
            if (document.visibilityState === "hidden") {
              frames.pause()
              movement?.pause()
            }
            await Promise.all([frames.finished, travel])
            if (cancelled) return
            sprite.style.backgroundPosition = battleSpriteFramePosition(
              end - 1,
              animation.frameCount,
            )
            frames.cancel()
            frames = null
          }
        } while (repeatSequence && !cancelled)
      }
      if (!cancelled) reportCompletion(phaseIndex, reactionSequence)
    }

    const handleVisibility = (): void => {
      if (document.visibilityState === "hidden") {
        if (skipHiddenTransient(isTransient)) {
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
    images,
    participant,
    phaseIndex,
    playback,
    reactionSequence,
    recipePreparation,
    shouldReduceMotion,
  ])

  return (
    <div className="relative z-2 grid min-w-0 justify-items-center">
      <div
        aria-label={copy.fighter(displayName, presentation.reactionSlot)}
        className={cx(
          "relative flex h-[max(--spacing(24),calc(var(--battle-above)+var(--battle-below)+--spacing(2)))] w-full items-end justify-center pb-(--battle-below) [--opponent-width:var(--opponent-mobile-width)] [--sprite-scale:var(--sprite-mobile-scale)] xl:[--opponent-width:var(--opponent-desktop-width)] xl:[--sprite-scale:var(--sprite-desktop-scale)]",
          participant === "player"
            ? "[--battle-anchor:0%] [--battle-direction:1]"
            : "[--battle-anchor:100%] [--battle-direction:-1]",
        )}
        role="img"
        style={battleSpriteAnchorStyle(
          presentation,
          opposingPresentation,
          beat,
        )}
      >
        <div
          ref={travelerRef}
          className="relative h-0 w-full translate-x-[calc(var(--battle-direction)*(var(--battle-advance)*var(--battle-contact-distance)_-_var(--battle-recoil)*min(var(--battle-recoil-limit),var(--battle-contact-distance)/4)))] [--battle-advance:0] [--battle-contact-distance:max(0px,calc(200%_+_var(--battle-gap)_-_(var(--sprite-visible-width)*var(--sprite-scale)_+_var(--opponent-width))/2_+_var(--battle-contact-extension,0px)*var(--sprite-scale)))] [--battle-recoil:0]"
        >
          <span
            aria-hidden="true"
            className={cx(
              "relative left-(--battle-anchor) block size-0",
              presentation.kind === "sprite" &&
                playback.facing !== presentation.sourceFacing &&
                "-scale-x-100",
            )}
          >
            <span
              ref={spriteRef}
              className="absolute block bg-no-repeat [image-rendering:pixelated]"
              style={initialFrameStyle}
            />
          </span>
          {presentation.kind === "authored-fallback" || imageUnavailable ? (
            <span
              aria-hidden="true"
              className={cx(
                "border-mapachito-charcoal font-display text-mapachito-charcoal absolute bottom-0 left-(--battle-anchor) grid size-(--battle-fallback-size) -translate-x-1/2 place-items-center border-4 text-4xl font-black",
                participant === "player"
                  ? "bg-mapachito-orange"
                  : "bg-mapachito-white",
              )}
            >
              {displayName.slice(0, 1)}
            </span>
          ) : null}
        </div>
      </div>
      <span
        className={
          imageUnavailable
            ? "bg-mapachito-charcoal text-mapachito-white z-1 max-w-full px-2 py-1 text-center text-xs font-bold [overflow-wrap:anywhere]"
            : "sr-only"
        }
      >
        {imageUnavailable ? copy.unavailableFighter(displayName) : displayName}
      </span>
    </div>
  )
}
