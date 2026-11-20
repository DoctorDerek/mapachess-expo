import { animate } from "motion/mini"
import type { SpriteFrameRange } from "@mapachess/match-presentation/presentation-asset-manifest"
import { battleSpriteFrameKeyframes } from "./battleSpriteFrames"

export default function animateBattleSprite(
  sprite: HTMLSpanElement,
  frameCount: number,
  durationMilliseconds: number,
  loop: boolean,
  frameRange?: SpriteFrameRange,
) {
  const { positions, times } = battleSpriteFrameKeyframes(
    frameCount,
    frameRange,
  )
  return animate(
    [sprite],
    { "--sprite-frame": positions },
    {
      duration: durationMilliseconds / 1000,
      ease: "linear",
      times,
      repeat: loop ? Infinity : 0,
    },
  )
}
