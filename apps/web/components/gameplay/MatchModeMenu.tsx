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
      className="max-w-mapachess mx-auto"
    >
      <div className="grid items-center gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <ProfileCard data={playerData} />
          <div className="mt-4 mr-1.5 flex flex-wrap gap-3">
            <ProfileAction
              size="home-card"
              disabled={disabled}
              onClick={onCustomize}
              className="bg-mapachito-violet shadow-mapachess-raised shadow-mapachito-raspberry min-w-0 flex-[1_1_5.8em] wrap-break-word"
            >
              {copy.customizeProfile}
            </ProfileAction>
            <ProfileAction
              size="home-card"
              disabled={disabled}
              onClick={onShare}
              className="bg-mapachito-blue shadow-mapachess-raised shadow-mapachito-deep-cyan min-w-0 flex-[1_1_5.8em] wrap-break-word"
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
                "shadow-mapachess-raised flex min-h-25 min-w-0 flex-[1_1_max(7em,calc((100%-0.75rem)/2))] flex-col items-stretch justify-center gap-3 text-left wrap-break-word xl:min-h-32",
                variant === "standard"
                  ? mode === "story"
                    ? "bg-mapachito-violet shadow-mapachito-blue"
                    : "bg-mapachito-orange shadow-mapachito-deep-gold"
                  : mode === "story"
                    ? "bg-mapachito-deep-cyan shadow-mapachito-green-shadow"
                    : "bg-mapachito-raspberry shadow-mapachito-red",
              )}
            >
              <strong className="text-xl leading-tight font-black xl:text-2xl">
                {copy.variants[variant]}
              </strong>
              <span className="flex flex-wrap items-center justify-between gap-1 text-lg">
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
