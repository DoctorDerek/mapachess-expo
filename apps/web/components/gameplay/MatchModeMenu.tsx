import cx from "classix"
import {
  MATCH_MODE_CHOICES,
  type MatchModeSelection,
} from "@mapachess/match/match-setup"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"
import ProfileAction from "../profile/ProfileAction"
import ProfileCard from "../profile/ProfileCard"

export type MatchModeMenuProps = Readonly<{
  disabled: boolean
  onModeSelected: (selection: MatchModeSelection) => void
  playerData: MapachessPlayerData
  onCustomize: () => void
  onShare: () => void
}>
export default function MatchModeMenu({
  disabled,
  onModeSelected,
  playerData,
  onCustomize,
  onShare,
}: MatchModeMenuProps) {
  const copy = useMapachessCopy().setup
  return (
    <section
      aria-labelledby="game-modes-title"
      className="mx-auto max-w-[96rem]"
    >
      <div className="grid items-center gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <ProfileCard data={playerData} />
          <div className="mt-4 mr-1.5 flex flex-wrap gap-3">
            <ProfileAction
              size="home-card"
              disabled={disabled}
              onClick={onCustomize}
              className="bg-mapachito-violet min-w-0 flex-[1_1_5.8em] wrap-break-word shadow-[0.375rem_0.375rem_0_#9c0052]"
            >
              {copy.customizeProfile}
            </ProfileAction>
            <ProfileAction
              size="home-card"
              disabled={disabled}
              onClick={onShare}
              className="bg-mapachito-blue min-w-0 flex-[1_1_5.8em] wrap-break-word shadow-[0.375rem_0.375rem_0_#008b8b]"
            >
              {copy.shareProfile}
            </ProfileAction>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap gap-3 pr-1.5 pb-1.5">
          {MATCH_MODE_CHOICES.map(({ mode, variant }) => (
            <ProfileAction
              size="home-mode"
              key={`${variant}:${mode}`}
              disabled={disabled}
              onClick={() => onModeSelected({ mode, variant })}
              aria-label={copy.presentations[variant][mode].title}
              className={cx(
                "flex min-h-25 min-w-0 flex-[1_1_max(7em,calc((100%-0.75rem)/2))] flex-col items-stretch justify-center gap-3 text-left wrap-break-word xl:min-h-32",
                variant === "standard"
                  ? mode === "story"
                    ? "bg-mapachito-violet shadow-[0.375rem_0.375rem_0_#008ec1]"
                    : "bg-mapachito-orange shadow-[0.375rem_0.375rem_0_#a77e18]"
                  : mode === "story"
                    ? "bg-mapachito-deep-cyan shadow-[0.375rem_0.375rem_0_#008000]"
                    : "bg-mapachito-raspberry shadow-[0.375rem_0.375rem_0_#ff0000]",
              )}
            >
              <strong className="text-[1.28em] leading-[1.08] font-black">
                {copy.variants[variant]}
              </strong>
              <span className="flex flex-wrap items-center justify-between gap-1 text-[1.05556em]">
                {copy.modes[mode]}
                <span aria-hidden="true" className="font-mono">
                  →
                </span>
              </span>
            </ProfileAction>
          ))}
        </div>
      </div>
    </section>
  )
}
