import type { MatchPresentationBeat } from "./matchPresentationMachine.js"
import type {
  ResolvedSpritePresentation,
  ResolvedSpriteStep,
  SpriteFacing,
  SpriteFrameRange,
} from "./presentationAssetManifest.js"

export const BATTLE_FALLBACK_TRAVEL_MILLISECONDS = 360

export type BattleSpriteStep = ResolvedSpriteStep<string, string>
export type BattleTravelTarget = "home" | "contact" | "recoil"

export type SpriteStepPlayback = Readonly<{
  step: BattleSpriteStep
  frames: SpriteFrameRange
  durationMilliseconds: number
  stillFrame: number
}>

export type BattleSpritePlayback = Readonly<{
  sources: readonly string[]
  steps: readonly SpriteStepPlayback[]
  facing: SpriteFacing
  travelTarget: BattleTravelTarget
  repeatSequence: boolean
}>

export function spriteStepPlayback(step: BattleSpriteStep): SpriteStepPlayback {
  const frames = step.frames ?? [0, step.animation.frameCount]
  const [first, end] = frames
  return {
    step,
    frames,
    durationMilliseconds:
      (end - first) * step.animation.frameDurationMilliseconds,
    stillFrame:
      step.playback === "once-hold-final-frame"
        ? end - 1
        : Math.max(
            first,
            Math.min(end - 1, step.animation.reducedMotionFrameIndex),
          ),
  }
}

export default function battleSpritePlayback(
  presentation: ResolvedSpritePresentation<string, string>,
  beat: MatchPresentationBeat,
  facing: SpriteFacing,
  reducedMotion: boolean,
): BattleSpritePlayback {
  const allSteps = presentation.kind === "sprite" ? presentation.steps : []
  const travelsToOpponent =
    presentation.reactionSlot.endsWith("attacker") &&
    !(
      presentation.kind === "sprite" &&
      allSteps.every((step) => step.beat === "strike")
    )
  const playbackBeat =
    beat === "conclusion" && presentation.reactionSlot === "idle"
      ? "idle"
      : beat
  const steps = allSteps.filter((step) => step.beat === playbackBeat)
  return {
    sources: allSteps.map((step) => step.animation.sourceId),
    steps: (reducedMotion ? steps.slice(-1) : steps).map(spriteStepPlayback),
    facing:
      beat === "recovery" && travelsToOpponent
        ? facing === "left"
          ? "right"
          : "left"
        : facing,
    travelTarget: reducedMotion
      ? "home"
      : travelsToOpponent &&
          (beat === "approach" || beat === "strike" || beat === "reaction")
        ? "contact"
        : presentation.reactionSlot.endsWith("victim") && beat === "reaction"
          ? "recoil"
          : "home",
    repeatSequence:
      presentation.kind === "sprite" &&
      presentation.repeatSequence === true &&
      !reducedMotion,
  }
}
