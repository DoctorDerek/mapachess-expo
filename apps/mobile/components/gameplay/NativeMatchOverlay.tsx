import { View } from "react-native"
import decideChickenDrawOffer from "@mapachess/evaluation/chicken-draw-decision"
import type { MatchSession } from "@mapachess/gameplay/match-session"
import type { MatchSessionController } from "@mapachess/gameplay/session-controller"
import { AUTO_HINT_MODES } from "@mapachess/match/auto-hint-mode"
import {
  selectAutoHintMode,
  selectCanOfferDraw,
  selectCanResign,
  selectDrawOfferResponse,
  selectMatchPosition,
  selectMatchTimeline,
} from "@mapachess/match/match-machine"
import { formatMatchMoveNotation } from "@mapachess/match/match-move"
import type {
  MatchNavigationCommands,
  MatchNavigationOverlay,
} from "@mapachess/match/match-navigation"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import type { NativeMatchRuntime } from "@/lib/gameplay/openNativeMatchRuntime"
import useActorSnapshot from "@/lib/useActorSnapshot"
import NativeButton from "../presentation/NativeButton"
import NativeChoicePanel from "../presentation/NativeChoicePanel"
import NativePanel from "../presentation/NativePanel"
import NativeText from "../presentation/NativeText"
import NativeAutoHintsHelp from "../profile/NativeAutoHintsHelp"
import { useNativeLocale } from "../profile/NativeLocaleProvider"

export default function NativeMatchOverlay({
  session,
  appActor,
  data,
  navigation,
  overlays,
}: Readonly<{
  session: MatchSession<NativeMatchRuntime>
  appActor: MatchSessionController<NativeMatchRuntime>["actor"]
  data: MapachessPlayerData
  navigation: MatchNavigationCommands
  overlays: readonly MatchNavigationOverlay[]
}>) {
  const snapshot = useActorSnapshot(session.actor)
  const evaluation = useActorSnapshot(session.evaluationActor)
  const { copy } = useNativeLocale()
  const overlay = overlays.at(-1)
  if (overlays.includes("settings")) return null
  if (overlay === "auto-hints-help")
    return <NativeAutoHintsHelp onBack={navigation.back} match={snapshot} />
  if (overlay === "match-hints")
    return (
      <NativeChoicePanel
        title={copy.shared.settingsControls.autoHints}
        value={selectAutoHintMode(snapshot)}
        onCancel={navigation.back}
        choices={AUTO_HINT_MODES.map((mode) => ({
          value: mode,
          label: copy.setup.autoHints[mode].label,
          description: copy.setup.autoHints[mode].description,
        }))}
        onAccept={(autoHintMode) => {
          navigation.back()
          session.actor.send({
            type: "MATCH.AUTO_HINT_MODE_CHANGED",
            autoHintMode,
          })
        }}
      />
    )
  if (overlay !== "match-menu" && overlay !== "match-details") return null
  const position = selectMatchPosition(snapshot)
  const timeline = selectMatchTimeline(snapshot)
  const decision = decideChickenDrawOffer({
    evaluationResult: evaluation.context.result,
    playerColor: session.match.playerColor,
    positionFen: position.fen,
  })
  const saved =
    data.activeMatch?.matchId === session.match.matchId
      ? data.activeMatch
      : null
  return (
    <NativePanel
      title={
        overlay === "match-details"
          ? copy.interface.classifiedMoveHistory.moveHistory
          : copy.interface.matchCommands.matchMenu
      }
      onBack={navigation.back}
      actions={
        <NativeButton
          variant="secondary"
          onPress={() => navigation.close("match-menu")}
        >
          {copy.shared.settingsControls.close}
        </NativeButton>
      }
    >
      {overlay === "match-details" ? (
        <>
          {timeline.cursor === 0 ? (
            <NativeText>
              {copy.interface.classifiedMoveHistory.noMovesYet}
            </NativeText>
          ) : (
            timeline.transitions
              .slice(0, timeline.cursor)
              .map((transition, index) => {
                const record = saved?.moveFeedback?.find(
                  (entry) =>
                    entry.ply === index + 1 &&
                    entry.moveId === transition.move.id &&
                    entry.beforeFen === transition.before.fen &&
                    entry.afterFen === transition.after.fen,
                )
                return (
                  <View
                    key={`${String(index)}/${transition.move.id}`}
                    className="bg-mapachito-surface flex-row flex-wrap justify-between gap-2 rounded-lg p-3"
                  >
                    <NativeText>
                      {formatMatchMoveNotation(transition.move)}
                    </NativeText>
                    {record === undefined ? null : (
                      <NativeText>
                        {copy.shared.moveGrades[record.grade]}
                      </NativeText>
                    )}
                  </View>
                )
              })
          )}
        </>
      ) : (
        <>
          <NativeButton
            variant="secondary"
            onPress={() => navigation.open("match-details")}
          >
            {copy.interface.webMatch.matchDetailsMoveHistory}
          </NativeButton>
          <NativeButton
            variant="secondary"
            onPress={() =>
              appActor.send({ type: "MATCH_SESSION.RESTART_REQUESTED" })
            }
          >
            {copy.interface.webGame.restartMatch}
          </NativeButton>
          <NativeButton
            variant="secondary"
            onPress={() =>
              appActor.send({ type: "MATCH_SESSION.MAIN_MENU_REQUESTED" })
            }
          >
            {copy.interface.webGame.returnToMenu}
          </NativeButton>
          <NativeButton
            variant="secondary"
            onPress={() => navigation.open("settings")}
          >
            {copy.interface.webGame.settings}
          </NativeButton>
          <NativeButton
            variant="secondary"
            disabled={!selectCanOfferDraw(snapshot) || decision === null}
            onPress={() => {
              if (decision !== null) {
                navigation.close("match-menu")
                session.actor.send({
                  type: "MATCH.DRAW_OFFER_REQUESTED",
                  decision,
                })
              }
            }}
          >
            {copy.interface.matchCommands.offerDraw}
          </NativeButton>
          {selectDrawOfferResponse(snapshot) === "rejected" ? (
            <NativeText>
              {copy.gameplay.drawDeclined(
                copy.animals.opponent(session.match.opponentId),
              )}
            </NativeText>
          ) : null}
          <NativeButton
            variant="destructive"
            disabled={!selectCanResign(snapshot)}
            onPress={() => {
              navigation.close("match-menu")
              session.actor.send({ type: "MATCH.RESIGN_REQUESTED" })
            }}
          >
            {copy.interface.matchCommands.resign}
          </NativeButton>
        </>
      )}
    </NativePanel>
  )
}
