import { useCallback, useMemo } from "react"
import { View } from "react-native"
import { ScopedVariables, useCSSVariable } from "uniwind"
import type { AcceptedMatchPresentationBinding } from "@mapachess/match-presentation/accepted-match-presentation"
import {
  selectMatchPresentationAnimalReaction,
  selectMatchPresentationBeat,
  selectMatchPresentationVariationOrdinal,
} from "@mapachess/match-presentation/match-presentation-machine"
import type { MatchPresentationParticipant } from "@mapachess/match-presentation/match-reaction"
import resolveOpponentPresentation from "@mapachess/match-presentation/opponent-presentation"
import {
  battleSpriteGeometry,
  type BattleSpriteGeometry,
  type BattleSpriteScale,
} from "@mapachess/match-presentation/sprite-presentation-geometry"
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import assets from "@/lib/presentation/nativeAssetManifest"
import useNativePresentationActivity from "@/lib/presentation/useNativePresentationActivity"
import useActorSnapshot from "@/lib/useActorSnapshot"
import { useNativeLocale } from "../profile/NativeLocaleProvider"
import NativeBattleFighter, {
  type NativeFighterGeometry,
} from "./NativeBattleFighter"

const sourceAvailable = (sourceId: string): boolean =>
  assets.images[sourceId] !== undefined

function stageFighterGeometry(
  geometry: BattleSpriteGeometry,
  fallbackSize: number,
): NativeFighterGeometry {
  if (geometry.kind === "sprite") return geometry
  const fallback: BattleSpriteScale = {
    integerScale: 1,
    visibleWidthPixels: fallbackSize,
    clearance: {
      above: fallbackSize,
      below: 0,
      horizontalRadius: fallbackSize / 2,
    },
  }
  return { mobile: fallback, desktop: fallback }
}

function stageExtent(
  player: NativeFighterGeometry,
  opponent: NativeFighterGeometry,
  layout: keyof NativeFighterGeometry,
) {
  const first = player[layout].clearance
  const second = opponent[layout].clearance
  const below = Math.max(first.below, second.below)
  return { below, height: below + Math.max(first.above, second.above) }
}

export default function NativeBattleStage({
  binding,
  playerAnimal,
  opponentAnimal,
  visible,
}: Readonly<{
  binding: AcceptedMatchPresentationBinding
  playerAnimal: StockfishOpponentId
  opponentAnimal: StockfishOpponentId
  visible: boolean
}>) {
  const snapshot = useActorSnapshot(binding.actor)
  const { copy } = useNativeLocale()
  const { active, reducedMotion } = useNativePresentationActivity()
  const [fallbackSize, recoilLimit] = useCSSVariable([
    "--spacing-battle-fallback",
    "--spacing-battle-recoil-limit",
  ])
  const beat = selectMatchPresentationBeat(snapshot)
  const playerReaction = selectMatchPresentationAnimalReaction(
    snapshot,
    "player",
  )
  const opponentReaction = selectMatchPresentationAnimalReaction(
    snapshot,
    "opponent",
  )
  const playerOrdinal = selectMatchPresentationVariationOrdinal(
    snapshot,
    "player",
  )
  const opponentOrdinal = selectMatchPresentationVariationOrdinal(
    snapshot,
    "opponent",
  )
  const player = useMemo(
    () =>
      resolveOpponentPresentation(
        playerAnimal,
        playerReaction,
        playerOrdinal,
        sourceAvailable,
      ),
    [playerAnimal, playerReaction, playerOrdinal],
  )
  const opponent = useMemo(
    () =>
      resolveOpponentPresentation(
        opponentAnimal,
        opponentReaction,
        opponentOrdinal,
        sourceAvailable,
      ),
    [opponentAnimal, opponentReaction, opponentOrdinal],
  )
  const complete = useCallback(
    (
      participant: MatchPresentationParticipant,
      phaseIndex: number,
      reactionSequence: number,
    ) =>
      binding.actor.send({
        type: "MATCH_PRESENTATION.PARTICIPANT_ANIMATION_COMPLETED",
        participant,
        phaseIndex,
        reactionSequence,
      }),
    [binding],
  )
  const label = copy.interface.reactiveBattleStage.reactiveBattleStage
  if (typeof fallbackSize !== "number" || typeof recoilLimit !== "number")
    return (
      <View
        accessibilityLabel={label}
        className="bg-mapachito-blue border-mapachito-deep-gold min-h-26 w-full border-b-8"
      />
    )

  const playerGeometry = stageFighterGeometry(
    battleSpriteGeometry(player),
    fallbackSize,
  )
  const opponentGeometry = stageFighterGeometry(
    battleSpriteGeometry(opponent),
    fallbackSize,
  )
  const mobile = stageExtent(playerGeometry, opponentGeometry, "mobile")
  const desktop = stageExtent(playerGeometry, opponentGeometry, "desktop")
  const { phaseIndex, reactionSequence, pendingParticipants } = snapshot.context
  const reacting = snapshot.matches("reacting")
  const fighterProps = {
    beat,
    phaseIndex,
    sequence: reactionSequence,
    active: active && visible,
    reducedMotion,
    recoilLimit,
    onComplete: complete,
  }
  return (
    <ScopedVariables
      variables={{
        "--native-stage-below": mobile.below,
        "--native-stage-height": mobile.height,
        "--native-stage-wide-below": desktop.below,
        "--native-stage-wide-height": desktop.height,
      }}
    >
      <View
        accessibilityLabel={label}
        className="bg-mapachito-blue relative [height:calc(var(--native-stage-height)+--spacing(4))] min-h-26 w-full overflow-hidden xl:[height:calc(var(--native-stage-wide-height)+--spacing(4))]"
      >
        <View className="absolute inset-x-0 top-0 bottom-2">
          <NativeBattleFighter
            {...fighterProps}
            participant="player"
            displayName={copy.animals.names[playerAnimal]}
            presentation={player}
            opposing={opponent}
            geometry={playerGeometry}
            opposingGeometry={opponentGeometry}
            report={reacting && pendingParticipants.includes("player")}
          />
          <NativeBattleFighter
            {...fighterProps}
            participant="opponent"
            displayName={copy.animals.names[opponentAnimal]}
            presentation={opponent}
            opposing={player}
            geometry={opponentGeometry}
            opposingGeometry={playerGeometry}
            report={reacting && pendingParticipants.includes("opponent")}
          />
        </View>
        <View className="bg-mapachito-deep-gold absolute inset-x-0 bottom-0 h-2" />
      </View>
    </ScopedVariables>
  )
}
