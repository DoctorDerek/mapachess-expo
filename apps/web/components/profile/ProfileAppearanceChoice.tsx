import cx from "classix"
import type { PlayerAppearance } from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import type { DressingChoice } from "../../lib/presentation/dressingRoomChoices"
import {
  cardFacts,
  INITIAL_CARD_CONTENT,
} from "../../lib/presentation/profileCardArtwork"
import { useMapachessLocale } from "./MapachessLocaleProvider"
import { ProfileArtwork } from "./ProfileCard"

export default function ProfileAppearanceChoice({
  choice,
  data,
  disabled,
  onChange,
  compact = false,
}: Readonly<{
  choice: DressingChoice
  data: MapachessPlayerData
  disabled: boolean
  onChange: (appearance: PlayerAppearance) => void
  compact?: boolean
}>) {
  const locale = useMapachessLocale()
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={choice.selected}
      aria-label={choice.label}
      onClick={() => onChange(choice.appearance)}
      className={cx(
        "text-mapachito-white bg-mapachito-surface relative min-h-[44px] cursor-pointer rounded-lg text-base font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50",
        compact ? "h-12 min-w-[44px]" : "min-w-min flex-1 basis-20 px-2 py-2",
        choice.selected && "ring-profile-card-cyan ring-2",
      )}
    >
      <span className={cx("relative block", compact ? "h-full" : "h-20")}>
        <ProfileArtwork
          input={{
            locale,
            appearance: choice.appearance,
            facts: cardFacts(data),
            content: { ...INITIAL_CARD_CONTENT, animal: false },
            format: "PNG",
          }}
          fitStage
        />
      </span>
      {compact ? (
        choice.selected ? (
          <span
            aria-hidden="true"
            className="bg-mapachito-charcoal absolute right-0 bottom-0 rounded text-xs leading-none"
          >
            ✓
          </span>
        ) : null
      ) : (
        <span>{choice.label}</span>
      )}
    </button>
  )
}
