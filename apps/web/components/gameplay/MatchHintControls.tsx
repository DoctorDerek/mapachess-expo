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
      className="contents text-sm [--hint-target:max(--spacing(16),2rem)] xl:grid xl:min-w-0 xl:flex-[1_1_min-content] xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-stretch xl:gap-1.5"
    >
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
      <MapachessButton
        aria-haspopup="dialog"
        aria-expanded={overlays.includes("match-hints")}
        disabled={complete}
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true })
          navigation.open("match-hints")
        }}
        variant="secondary"
        className="col-span-2 row-start-2 flex min-h-(--hint-target)! max-w-full min-w-0 flex-wrap items-center justify-center gap-x-1 px-1! py-1! text-sm leading-tight wrap-break-word xl:col-span-1 xl:col-start-1 xl:row-start-1 xl:flex-col"
      >
        <span className="max-w-full min-w-0 wrap-anywhere">
          {hints.autoLabel}
        </span>
        <span className="max-w-full min-w-0 wrap-anywhere">
          {hints.autoMode[autoHintMode]}{" "}
          <span aria-hidden="true" className="text-[0.5em] leading-none">
            ▾
          </span>
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
        className="col-start-3 row-start-2 min-h-(--hint-target)! w-(--hint-target) px-1! py-1! text-xl leading-tight xl:col-start-2 xl:row-start-1"
      >
        <span aria-hidden="true">?</span>
      </MapachessButton>
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
