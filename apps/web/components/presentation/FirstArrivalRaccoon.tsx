"use client"

import cx from "classix"
import { useEffect, useRef, useState, type CSSProperties } from "react"
import { preparedArtSource } from "@/lib/presentation/characterArtPack"
import animateBattleSprite from "../../lib/presentation/animateBattleSprite"
import {
  battleSpriteFrameStyle,
  SPRITE_FRAME_CLASSES,
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
    const source = preparedArtSource(run.sourceId)
    if (source === undefined) return
    let disposed = false
    const image = new Image()
    image.onload = () => {
      if (!disposed) setReady(true)
    }
    image.onerror = () => {
      if (!disposed) setFinished(true)
    }
    image.src = source
    return () => {
      disposed = true
      image.onload = null
      image.onerror = null
    }
  }, [])
  useEffect(() => {
    if (!ready || finished || sprite.current === null) return
    const animation = animateBattleSprite(
      sprite.current,
      run.frameCount,
      run.frameCount * run.frameDurationMilliseconds,
      true,
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
          className={cx(SPRITE_FRAME_CLASSES, "top-0 left-0")}
          style={
            battleSpriteFrameStyle(
              {
                animation: run,
                animationId: "run",
                beat: "idle",
                playback: "loop",
              },
              false,
            ) as CSSProperties
          }
        />
      </div>
    </div>
  )
}
