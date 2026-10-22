import cx from "classix"
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
import {
  MATCH_MEDALS,
  matchMedalEligibility,
} from "@mapachess/profile/match-medal"
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
  const eligibility = (tier: (typeof MATCH_MEDALS)[number]) =>
    hints.eligibility(
      copy.shared.story.medals[tier],
      copy.shared.medalHintUse[tier],
    )
  const view = overlays.at(-1)
  const helpOpen = view === "auto-hints-help" && !overlays.includes("settings")

  return (
    <div className="grid min-w-0 gap-2">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] items-stretch gap-2">
        <BetterHintsControl
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
          className="flex min-w-0 items-center justify-center gap-2 px-2! py-2! text-base"
        >
          <span className="grid min-w-0 wrap-anywhere">
            {Object.entries(hints.autoMode).map(([mode, label]) => (
              <span
                aria-hidden="true"
                className="invisible col-start-1 row-start-1"
                key={mode}
              >
                {label}
              </span>
            ))}
            <span className="col-start-1 row-start-1">
              {hints.autoMode[autoHintMode]}
            </span>
          </span>
          <span aria-hidden="true">▾</span>
        </MapachessButton>
      </div>
      <div className="text-mapachito-white flex items-start gap-2">
        <div
          className={cx(
            "min-w-0 flex-1 text-base wrap-anywhere",
            complete && "invisible",
          )}
          aria-hidden={complete}
        >
          <div className="grid">
            {MATCH_MEDALS.map((tier) => (
              <span
                aria-hidden="true"
                className="invisible col-start-1 row-start-1"
                key={tier}
              >
                <MedalSymbol medal={tier} />
                {eligibility(tier)}
              </span>
            ))}
            <p className="col-start-1 row-start-1" role="status">
              <MedalSymbol medal={medal} />
              {eligibility(medal)}
            </p>
          </div>
          <div className="grid">
            {Object.entries(hints.nextMedal).map(([kind, label]) => (
              <span
                aria-hidden="true"
                className="invisible col-start-1 row-start-1"
                key={kind}
              >
                {label}
              </span>
            ))}
            <p className="col-start-1 row-start-1">{nextMedal}</p>
          </div>
        </div>
        <MapachessButton
          aria-label={copy.shared.settingsControls.explainAutoHints}
          aria-haspopup="dialog"
          onClick={(event) => {
            event.currentTarget.focus({ preventScroll: true })
            navigation.open("auto-hints-help")
          }}
          variant="secondary"
          className="shrink-0 px-3! py-2!"
        >
          <span aria-hidden="true">?</span>
        </MapachessButton>
      </div>
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
            />
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
    </div>
  )
}
