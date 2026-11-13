"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import {
  battleSpriteFrameKeyframes,
  battleSpriteFrameStyle,
} from "../../lib/presentation/battleSpriteFrames"
import {
  LICENSED_PRESENTATION_ASSETS_ENABLED,
  MAPACHITO_SPRITE_MANIFEST,
} from "../../lib/presentation/webPresentationAssets"

const run = MAPACHITO_SPRITE_MANIFEST.animations.run
const scale = MAPACHITO_SPRITE_MANIFEST.standaloneScale

export default function FirstArrivalRaccoon() {
  const sprite = useRef<HTMLSpanElement>(null)
  const [ready, setReady] = useState(false)
  const [finished, setFinished] = useState(false)
  useEffect(() => {
    if (!LICENSED_PRESENTATION_ASSETS_ENABLED) return
    let disposed = false
    const image = new Image()
    image.onload = () => {
      if (!disposed) setReady(true)
    }
    image.onerror = () => {
      if (!disposed) setFinished(true)
    }
    image.src = run.sourceId
    return () => {
      disposed = true
      image.onload = null
      image.onerror = null
    }
  }, [])
  useEffect(() => {
    if (!ready || finished || sprite.current === null) return
    const animation = sprite.current.animate(
      battleSpriteFrameKeyframes(run.frameCount),
      {
        duration: run.frameCount * run.frameDurationMilliseconds,
        iterations: Infinity,
      },
    )
    return () => animation.cancel()
  }, [ready, finished])
  if (!LICENSED_PRESENTATION_ASSETS_ENABLED || finished) return null
  const geometry: CSSProperties &
    Readonly<
      Record<
        "--sprite-scale" | "--arrival-sprite-width" | "--arrival-sprite-height",
        string | number
      >
    > = {
    "--sprite-scale": scale,
    "--arrival-sprite-width": `${run.geometry.frameWidth * scale}px`,
    "--arrival-sprite-height": `${run.geometry.frameHeight * scale}px`,
  }
  return (
    <div
      aria-hidden="true"
      style={geometry}
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-(--arrival-sprite-height) overflow-hidden"
    >
      <div
        data-ready={ready}
        className="relative -left-(--arrival-sprite-width) h-full w-[calc(100%+var(--arrival-sprite-width))] animate-[first-arrival-crossing_linear_both] [animation-delay:var(--arrival-crossing-delay)] [animation-duration:var(--arrival-crossing-duration)] [animation-play-state:paused] data-[ready=true]:[animation-play-state:running] xl:[animation-duration:var(--arrival-crossing-wide-duration)]"
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) setFinished(true)
        }}
      >
        <span
          ref={sprite}
          className="absolute bg-no-repeat [image-rendering:pixelated]"
          style={{
            ...battleSpriteFrameStyle(
              {
                animation: run,
                animationId: "run",
                beat: "idle",
                playback: "loop",
              },
              false,
            ),
            left: 0,
            top: 0,
          }}
        />
      </div>
    </div>
  )
}
