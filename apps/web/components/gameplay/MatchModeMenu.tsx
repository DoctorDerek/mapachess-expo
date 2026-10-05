import cx from "classix"
import {
  MATCH_MODE_CHOICES,
  type MatchModeSelection,
} from "@mapachess/match/match-setup"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
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
  return (
    <section
      aria-labelledby="game-modes-title"
      className="mx-auto max-w-[96rem]"
    >
      <div className="grid items-center gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <ProfileCard data={playerData} />
          <div className="mt-5 flex flex-wrap gap-4">
            <ProfileAction
              disabled={disabled}
              onClick={onCustomize}
              className="bg-mapachito-violet flex-1 shadow-[0.375rem_0.375rem_0_#9c0052]"
            >
              <span aria-hidden="true" className="inline-block -scale-x-100">
                ✎
              </span>{" "}
              Customize profile card
            </ProfileAction>
            <ProfileAction
              disabled={disabled}
              onClick={onShare}
              className="bg-mapachito-blue flex-1 shadow-[0.375rem_0.375rem_0_#008b8b]"
            >
              <span aria-hidden="true">↗</span> Share profile card
            </ProfileAction>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 pr-1.5 pb-1.5">
          {MATCH_MODE_CHOICES.map(({ mode, variant, title }) => (
            <ProfileAction
              key={`${variant}:${mode}`}
              disabled={disabled}
              onClick={() => onModeSelected({ mode, variant })}
              aria-label={title}
              className={cx(
                "flex min-h-24 min-w-0 flex-[1_1_max(9.5rem,calc((100%-1rem)/2))] flex-col items-stretch justify-center gap-2 px-4 text-left xl:min-h-32",
                variant === "standard"
                  ? mode === "story"
                    ? "bg-mapachito-violet shadow-[0.375rem_0.375rem_0_#008ec1]"
                    : "bg-mapachito-orange shadow-[0.375rem_0.375rem_0_#a77e18]"
                  : mode === "story"
                    ? "bg-mapachito-deep-cyan shadow-[0.375rem_0.375rem_0_#008000]"
                    : "bg-mapachito-raspberry shadow-[0.375rem_0.375rem_0_#ff0000]",
              )}
            >
              <strong className="text-xl xl:text-2xl">
                {variant === "standard" ? "Standard" : "Chess960"}
              </strong>
              <span className="flex items-center justify-between gap-2">
                {mode === "story" ? "Story" : "Challenge"}
                <span aria-hidden="true">→</span>
              </span>
            </ProfileAction>
          ))}
        </div>
      </div>
    </section>
  )
}
