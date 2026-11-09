import { useEffect, useMemo, useState } from "react"
import { useResolveClassNames } from "uniwind"
import { createActor, type ActorRefFrom } from "xstate"
import animalAttentionMachine from "@mapachess/match-presentation/animal-attention-machine"
import battleSpritePlayback, {
  spriteStepPlayback,
} from "@mapachess/match-presentation/battle-sprite-playback"
import resolveOpponentPresentation, {
  resolveOpponentAttention,
} from "@mapachess/match-presentation/opponent-presentation"
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import { hasNativeArtwork } from "@/lib/presentation/useNativeArtworkReadiness"
import useActorSnapshot from "@/lib/useActorSnapshot"
import NativeSpriteFrame from "./NativeSpriteFrame"
import NativeSpritePlayback from "./NativeSpritePlayback"

type AnimalMotion = Readonly<{
  active: boolean
  reducedMotion: boolean
  attention?: boolean
}>

function StillAnimal({ animal }: Readonly<{ animal: StockfishOpponentId }>) {
  const presentation = resolveOpponentPresentation(animal)
  if (presentation.kind !== "sprite") return null
  const animation = presentation.steps[0].animation
  return (
    <NativeSpriteFrame
      sourceId={animation.sourceId}
      frameWidth={animation.geometry.frameWidth}
      frameHeight={animation.geometry.frameHeight}
      frameCount={animation.frameCount}
    />
  )
}

function AnimalPlayback({
  actor,
  animal,
  motion,
  size,
}: Readonly<{
  actor: ActorRefFrom<typeof animalAttentionMachine>
  animal: StockfishOpponentId
  motion: AnimalMotion
  size: number
}>) {
  const { active, reducedMotion, attention = false } = motion
  const snapshot = useActorSnapshot(actor)
  const calmOrdinal = Math.max(0, snapshot.context.calmOrdinal)
  const attentionOrdinal = snapshot.matches("attention")
    ? snapshot.context.ordinal
    : null
  const calm = useMemo(() => {
    const presentation = resolveOpponentPresentation(
      animal,
      { family: "idle" },
      calmOrdinal,
      hasNativeArtwork,
    )
    return battleSpritePlayback(
      presentation,
      "idle",
      presentation.kind === "sprite" ? presentation.sourceFacing : "right",
      reducedMotion,
    )
  }, [animal, calmOrdinal, reducedMotion])
  const attentionStep = useMemo(
    () =>
      attentionOrdinal === null
        ? null
        : resolveOpponentAttention(animal, attentionOrdinal, hasNativeArtwork),
    [animal, attentionOrdinal],
  )
  const playback = useMemo(
    () =>
      attentionStep === null
        ? calm
        : {
            sources: [attentionStep.animation.sourceId],
            steps: [spriteStepPlayback(attentionStep)],
            repeatSequence: false,
          },
    [attentionStep, calm],
  )
  useEffect(() => {
    actor.send({ type: "ANIMAL_ATTENTION.INPUT_CHANGED", active, attention })
  }, [actor, active, attention])
  useEffect(() => {
    if (attentionOrdinal !== null && attentionStep === null)
      actor.send({
        type: "ANIMAL_ATTENTION.COMPLETED",
        ordinal: attentionOrdinal,
      })
  }, [actor, attentionOrdinal, attentionStep])

  return (
    <NativeSpritePlayback
      active={active}
      identity={
        attentionStep === null
          ? `calm:${String(calmOrdinal)}`
          : `attention:${String(attentionOrdinal)}`
      }
      playback={playback}
      placement={{ kind: "preview", size }}
      reducedMotion={reducedMotion}
      onComplete={
        attentionOrdinal === null || attentionStep === null
          ? undefined
          : () =>
              actor.send({
                type: "ANIMAL_ATTENTION.COMPLETED",
                ordinal: attentionOrdinal,
              })
      }
      fallback={<StillAnimal animal={animal} />}
    />
  )
}

function AnimatedAnimal({
  animal,
  motion,
}: Readonly<{ animal: StockfishOpponentId; motion: AnimalMotion }>) {
  const size = useResolveClassNames("w-16").width
  const [actor, setActor] = useState<ActorRefFrom<
    typeof animalAttentionMachine
  > | null>(null)
  useEffect(() => {
    const opened = createActor(animalAttentionMachine).start()
    setActor(opened)
    return () => {
      opened.stop()
    }
  }, [])
  return actor === null || typeof size !== "number" ? (
    <StillAnimal animal={animal} />
  ) : (
    <AnimalPlayback actor={actor} animal={animal} motion={motion} size={size} />
  )
}

export default function NativeAnimal({
  animal,
  motion,
}: Readonly<{ animal: StockfishOpponentId; motion?: AnimalMotion }>) {
  return motion === undefined ? (
    <StillAnimal animal={animal} />
  ) : (
    <AnimatedAnimal key={animal} animal={animal} motion={motion} />
  )
}
