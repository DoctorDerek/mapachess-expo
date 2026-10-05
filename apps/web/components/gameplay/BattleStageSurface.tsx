"use client"

import { createPortal } from "react-dom"
import { battleStageStyle } from "../../lib/presentation/battleSpriteFrames"
import useBattleStageHost from "../../lib/presentation/useBattleStageHost"
import resolveWebOpponentPresentation from "../../lib/presentation/webOpponentPresentation"
import ReactiveBattleStage, {
  type ReactiveBattleStageProps,
} from "./ReactiveBattleStage"

export default function BattleStageSurface({
  celebrationSlot,
  ...props
}: ReactiveBattleStageProps &
  Readonly<{
    celebrationSlot: HTMLElement | null
  }>) {
  const { gameplaySlotRef, host } = useBattleStageHost(celebrationSlot)

  return (
    <>
      <div
        className="min-h-[calc(max(--spacing(24),calc(var(--battle-above)+var(--battle-below)+--spacing(2)))+--spacing(2))] w-full [--battle-above:var(--battle-mobile-above)] [--battle-below:var(--battle-mobile-below)] [--battle-fallback-size:--spacing(18)] [grid-area:battle] xl:[--battle-above:var(--battle-desktop-above)] xl:[--battle-below:var(--battle-desktop-below)] xl:[grid-area:auto]"
        ref={gameplaySlotRef}
        style={battleStageStyle(
          resolveWebOpponentPresentation(
            props.playerAnimal ?? "raccoon-stockfish",
          ),
          props.opponentPresentation,
        )}
      />
      {host === null
        ? null
        : createPortal(
            <ReactiveBattleStage
              {...props}
              pauseTransientOnBackground={celebrationSlot !== null}
            />,
            host,
          )}
    </>
  )
}
