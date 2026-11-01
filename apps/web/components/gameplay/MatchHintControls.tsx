import type { ActorRefFrom } from "xstate"
import matchMachine, {
  selectAreMatchMutationsFrozen,
  selectAutoHintMode,
  selectHintStage,
  selectIsPersistingMutation,
  selectMatchConclusion,
  selectMatchHints,
  selectMoveHintsUsed,
  selectPieceHintsUsed,
  type MatchMachineSnapshot,
} from "@mapachess/match/match-machine"
import type {
  MatchNavigationCommands,
  MatchNavigationOverlay,
} from "@mapachess/match/match-navigation"
import { matchMedalEligibility } from "@mapachess/profile/match-medal"
import MapachessButton from "../presentation/MapachessButton"
import MapachessDialog from "../presentation/MapachessDialog"
import MedalSymbol from "../presentation/MedalSymbol"
import AutoHintModeChoices from "../profile/AutoHintModeChoices"
import AutoHintsHelp from "../profile/AutoHintsHelp"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"
import SettingsView from "../profile/SettingsView"
import BetterHintsControl from "./BetterHintsControl"

export default function MatchHintControls({
  actor,
  snapshot,
  navigation,
  overlays,
}: Readonly<{
  actor: ActorRefFrom<typeof matchMachine>
  snapshot: MatchMachineSnapshot
  navigation: MatchNavigationCommands
  overlays: readonly MatchNavigationOverlay[]
}>) {
  const copy = useMapachessCopy()
  const hints = copy.gameplay.hints
  const autoHintMode = selectAutoHintMode(snapshot)
  const stage = selectHintStage(snapshot)
  const complete = selectMatchConclusion(snapshot) !== null
  const frozen = selectAreMatchMutationsFrozen(snapshot)
  const medal = matchMedalEligibility({
    moveHintsUsed: selectMoveHintsUsed(snapshot),
    pieceHintsUsed: selectPieceHintsUsed(snapshot),
  })
  const nextMedal =
    (stage === "ready" || stage === "failure") && medal === "gold"
      ? hints.nextMedal["piece-hints"]
      : stage === "piece-hints" && medal !== "bronze"
        ? hints.nextMedal["move-hints"]
        : null
  const view = overlays.at(-1)
  const helpOpen = view === "auto-hints-help" && !overlays.includes("settings")

  return (
    <section
      aria-labelledby="better-hints-title"
      className="flex min-w-0 flex-[1_1_min-content] flex-wrap items-stretch gap-1.5 text-sm [--hint-target:max(--spacing(16),2rem)]"
    >
      <MapachessButton
        aria-haspopup="dialog"
        aria-expanded={overlays.includes("match-hints")}
        disabled={complete}
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true })
          navigation.open("match-hints")
        }}
        variant="secondary"
        className="flex min-h-(--hint-target)! max-w-full min-w-0 flex-[1_1_min-content] flex-col items-center justify-center px-1! py-1! text-sm leading-tight wrap-break-word"
      >
        <span>{hints.autoLabel}</span>
        <span>
          {hints.autoMode[autoHintMode]} <span aria-hidden="true">▾</span>
        </span>
      </MapachessButton>
      <MapachessButton
        aria-label={copy.shared.settingsControls.explainAutoHints}
        aria-haspopup="dialog"
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true })
          navigation.open("auto-hints-help")
        }}
        variant="secondary"
        className="min-h-(--hint-target)! w-(--hint-target) flex-none px-1! py-1! text-xl leading-tight"
      >
        <span aria-hidden="true">?</span>
      </MapachessButton>
      <BetterHintsControl
        nextMedal={complete ? null : nextMedal}
        busy={selectIsPersistingMutation(snapshot)}
        disabled={frozen}
        hints={selectMatchHints(snapshot)}
        matchComplete={complete}
        onMoveHintsRequested={() =>
          actor.send({ type: "MATCH.MOVE_HINTS_REQUESTED" })
        }
        onPieceHintsRequested={() =>
          actor.send({ type: "MATCH.PIECE_HINTS_REQUESTED" })
        }
        stage={stage}
      />
      {view === "match-hints" || helpOpen ? (
        <MapachessDialog
          label={copy.shared.settingsControls.autoHints}
          onClose={navigation.back}
          fixedContent
        >
          {helpOpen ? (
            <AutoHintsHelp
              onClose={navigation.back}
              closeLabel={copy.shared.settingsControls.close}
            >
              {complete ? null : (
                <p role="status" className="mt-4 text-base font-bold">
                  <MedalSymbol medal={medal} />
                  {hints.eligibility(
                    copy.shared.story.medals[medal],
                    copy.shared.medalHintUse[medal],
                  )}
                </p>
              )}
            </AutoHintsHelp>
          ) : (
            <SettingsView
              title={copy.shared.settingsControls.autoHints}
              closeLabel={copy.shared.settingsControls.close}
              onClose={navigation.back}
            >
              <div className="mt-5">
                <AutoHintModeChoices
                  autoHintMode={autoHintMode}
                  disabled={frozen || complete}
                  onAutoHintModeChanged={(autoHintMode) =>
                    actor.send({
                      type: "MATCH.AUTO_HINT_MODE_CHANGED",
                      autoHintMode,
                    })
                  }
                  onExplain={() => navigation.open("auto-hints-help")}
                />
                <p className="mt-4">{hints.xpUnchanged}</p>
              </div>
            </SettingsView>
          )}
        </MapachessDialog>
      ) : null}
    </section>
  )
}
