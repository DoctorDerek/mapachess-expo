import { useCallback, useMemo } from "react"
import { View } from "react-native"
import Svg from "react-native-svg"
import type { AcceptedMatchPresentationBinding } from "@mapachess/match-presentation/accepted-match-presentation"
import {
  selectMatchPresentationAnimalReaction,
  selectMatchPresentationBeat,
  selectMatchPresentationVariationOrdinal,
} from "@mapachess/match-presentation/match-presentation-machine"
import type { MatchPresentationParticipant } from "@mapachess/match-presentation/match-reaction"
import resolveOpponentPresentation from "@mapachess/match-presentation/opponent-presentation"
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import assets from "@/lib/presentation/nativeAssetManifest"
import useNativePresentationActivity from "@/lib/presentation/useNativePresentationActivity"
import useActorSnapshot from "@/lib/useActorSnapshot"
import { useNativeLocale } from "../profile/NativeLocaleProvider"
import NativeBattleFighter from "./NativeBattleFighter"

const sourceAvailable = (sourceId: string): boolean =>
  assets.images[sourceId] !== undefined

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
  const playerIdle = useMemo(
    () =>
      resolveOpponentPresentation(playerAnimal, undefined, 0, sourceAvailable),
    [playerAnimal],
  )
  const opponentIdle = useMemo(
    () =>
      resolveOpponentPresentation(
        opponentAnimal,
        undefined,
        0,
        sourceAvailable,
      ),
    [opponentAnimal],
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
  return (
    <View
      accessibilityLabel={
        copy.interface.reactiveBattleStage.reactiveBattleStage
      }
      className="border-mapachito-deep-gold bg-mapachito-blue h-32 w-full overflow-hidden border-b-8 xl:h-44"
    >
      <Svg width="100%" height="100%" viewBox="0 0 360 120">
        <NativeBattleFighter
          participant="player"
          presentation={player}
          idle={playerIdle}
          opposing={opponent}
          beat={beat}
          phaseIndex={snapshot.context.phaseIndex}
          sequence={snapshot.context.reactionSequence}
          report={
            snapshot.matches("reacting") &&
            snapshot.context.pendingParticipants.includes("player")
          }
          active={active && visible}
          reducedMotion={reducedMotion}
          onComplete={complete}
        />
        <NativeBattleFighter
          participant="opponent"
          presentation={opponent}
          idle={opponentIdle}
          opposing={player}
          beat={beat}
          phaseIndex={snapshot.context.phaseIndex}
          sequence={snapshot.context.reactionSequence}
          report={
            snapshot.matches("reacting") &&
            snapshot.context.pendingParticipants.includes("opponent")
          }
          active={active && visible}
          reducedMotion={reducedMotion}
          onComplete={complete}
        />
      </Svg>
    </View>
  )
}
