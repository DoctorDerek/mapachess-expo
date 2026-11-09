import cx from "classix"
import { useCallback, useMemo, type ReactNode } from "react"
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
import { hasNativeArtwork } from "@/lib/presentation/useNativeArtworkReadiness"
import useNativePresentationActivity from "@/lib/presentation/useNativePresentationActivity"
import useActorSnapshot from "@/lib/useActorSnapshot"
import { useNativeLocale } from "../profile/NativeLocaleProvider"
import NativeBattleFighter, {
  type NativeFighterGeometry,
} from "./NativeBattleFighter"

const STAGE_HEIGHT_CLASS =
  "[height:calc(var(--native-stage-height)+--spacing(4))] min-h-26 xl:[height:calc(var(--native-stage-wide-height)+--spacing(4))]"
const IDLE_REACTION = { family: "idle" } as const

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
  renderHost,
}: Readonly<{
  binding: AcceptedMatchPresentationBinding | null
  playerAnimal: StockfishOpponentId
  opponentAnimal: StockfishOpponentId
  visible: boolean
  renderHost: (stage: ReactNode, stageHeightClassName: string) => ReactNode
}>) {
  const snapshot = useActorSnapshot(binding?.actor ?? null)
  const { copy } = useNativeLocale()
  const { active, reducedMotion } = useNativePresentationActivity()
  const [fallbackSize, recoilLimit] = useCSSVariable([
    "--spacing-battle-fallback",
    "--spacing-battle-recoil-limit",
  ])
  const beat =
    snapshot === null ? "idle" : selectMatchPresentationBeat(snapshot)
  const playerReaction =
    snapshot === null
      ? IDLE_REACTION
      : selectMatchPresentationAnimalReaction(snapshot, "player")
  const opponentReaction =
    snapshot === null
      ? IDLE_REACTION
      : selectMatchPresentationAnimalReaction(snapshot, "opponent")
  const playerOrdinal =
    snapshot === null
      ? 0
      : selectMatchPresentationVariationOrdinal(snapshot, "player")
  const opponentOrdinal =
    snapshot === null
      ? 0
      : selectMatchPresentationVariationOrdinal(snapshot, "opponent")
  const player = useMemo(
    () =>
      resolveOpponentPresentation(
        playerAnimal,
        playerReaction,
        playerOrdinal,
        hasNativeArtwork,
      ),
    [playerAnimal, playerReaction, playerOrdinal],
  )
  const opponent = useMemo(
    () =>
      resolveOpponentPresentation(
        opponentAnimal,
        opponentReaction,
        opponentOrdinal,
        hasNativeArtwork,
      ),
    [opponentAnimal, opponentReaction, opponentOrdinal],
  )
  const complete = useCallback(
    (
      participant: MatchPresentationParticipant,
      phaseIndex: number,
      reactionSequence: number,
    ) =>
      binding?.actor.send({
        type: "MATCH_PRESENTATION.PARTICIPANT_ANIMATION_COMPLETED",
        participant,
        phaseIndex,
        reactionSequence,
      }),
    [binding],
  )
  const label = copy.interface.reactiveBattleStage.reactiveBattleStage
  const playerGeometry = stageFighterGeometry(
    battleSpriteGeometry(player),
    typeof fallbackSize === "number" ? fallbackSize : 0,
  )
  const opponentGeometry = stageFighterGeometry(
    battleSpriteGeometry(opponent),
    typeof fallbackSize === "number" ? fallbackSize : 0,
  )
  const mobile = stageExtent(playerGeometry, opponentGeometry, "mobile")
  const desktop = stageExtent(playerGeometry, opponentGeometry, "desktop")
  const fighterProps =
    snapshot === null ||
    typeof fallbackSize !== "number" ||
    typeof recoilLimit !== "number"
      ? null
      : {
          beat,
          phaseIndex: snapshot.context.phaseIndex,
          sequence: snapshot.context.reactionSequence,
          active: active && visible,
          reducedMotion,
          recoilLimit,
          onComplete: complete,
        }
  const pending = snapshot?.matches("reacting")
    ? snapshot.context.pendingParticipants
    : []
  return (
    <ScopedVariables
      variables={{
        "--native-stage-below": mobile.below,
        "--native-stage-height": mobile.height,
        "--native-stage-wide-below": desktop.below,
        "--native-stage-wide-height": desktop.height,
      }}
    >
      {renderHost(
        <View
          accessibilityLabel={label}
          className={cx(
            "bg-mapachito-blue relative w-full shrink-0 overflow-hidden",
            STAGE_HEIGHT_CLASS,
          )}
        >
          {fighterProps === null ? null : (
            <View className="absolute inset-x-0 top-0 bottom-2">
              <NativeBattleFighter
                {...fighterProps}
                participant="player"
                displayName={copy.animals.names[playerAnimal]}
                presentation={player}
                opposing={opponent}
                geometry={playerGeometry}
                opposingGeometry={opponentGeometry}
                report={pending.includes("player")}
              />
              <NativeBattleFighter
                {...fighterProps}
                participant="opponent"
                displayName={copy.animals.names[opponentAnimal]}
                presentation={opponent}
                opposing={player}
                geometry={opponentGeometry}
                opposingGeometry={playerGeometry}
                report={pending.includes("opponent")}
              />
            </View>
          )}
          <View className="bg-mapachito-deep-gold absolute inset-x-0 bottom-0 h-2" />
        </View>,
        STAGE_HEIGHT_CLASS,
      )}
    </ScopedVariables>
  )
}
