import cx from "classix"
import type { Ref } from "react"
import stockfishOpponent from "@mapachess/match/stockfish-opponent"
import { HERO_IDLE_GEOMETRY } from "@mapachess/profile/hero-catalog"
import {
  heroLayerPaths,
  type PlayerAppearance,
} from "@mapachess/profile/player-appearance"
import {
  DRESSING_CATEGORIES,
  type DressingCategory,
} from "../../lib/presentation/dressingRoomChoices"
import { presentationAssetSource } from "../../lib/presentation/webPresentationAssets"
import ChallengeAnimalPortrait from "../gameplay/ChallengeAnimalPortrait"
import { useMapachessCopy } from "./MapachessLocaleProvider"
import ProfileAction from "./ProfileAction"

function CategoryArtwork({
  category,
  draft,
  active,
}: Readonly<{
  category: DressingCategory
  draft: PlayerAppearance
  active: boolean
}>) {
  if (category === "Animal")
    return (
      <ChallengeAnimalPortrait
        opponent={stockfishOpponent(draft.animal)}
        active={active}
        compact
        fit
      />
    )
  const head = category === "Hair" || category === "Face"
  const layers = heroLayerPaths(
    category === "Weapons" && draft.weapon === "none"
      ? { ...draft, weapon: "weapon1" }
      : draft,
  ).filter((path) => {
    switch (category) {
      case "Clothes":
        return true
      case "Weapons":
        return path.includes("/weapon/")
      case "Skin":
        return path.includes("/skin/")
      case "Face":
        return path.includes("/skin/") || path.includes("/face/")
      case "Hair":
        return (
          path.includes("/skin/") ||
          path.includes("/face/") ||
          path.includes("/hair/")
        )
    }
  })
  return (
    <svg
      viewBox={
        head
          ? "9 0 25 17"
          : `0 0 ${HERO_IDLE_GEOMETRY.width} ${HERO_IDLE_GEOMETRY.height}`
      }
      className="size-full overflow-hidden [image-rendering:pixelated]"
    >
      {layers.map((path) => (
        <image
          key={path}
          href={presentationAssetSource(path)}
          width={HERO_IDLE_GEOMETRY.width * HERO_IDLE_GEOMETRY.frameCount}
          height={HERO_IDLE_GEOMETRY.height}
        />
      ))}
    </svg>
  )
}

export default function ProfileDressingCategories({
  category,
  draft,
  busy,
  active,
  selectedRef,
  onSelect,
}: Readonly<{
  category: DressingCategory
  draft: PlayerAppearance
  busy: boolean
  active: boolean
  selectedRef: Ref<HTMLButtonElement>
  onSelect: (category: DressingCategory) => void
}>) {
  const copy = useMapachessCopy()
  return (
    <div
      role="group"
      aria-label={copy.interface.profileDressingRoom.appearanceCategories}
      className="grid grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-3 p-1 pb-2 xl:grid-cols-[repeat(auto-fit,minmax(min(6rem,100%),1fr))]"
    >
      {DRESSING_CATEGORIES.map((name) => (
        <ProfileAction
          key={name}
          size="compact"
          disabled={busy}
          ref={category === name ? selectedRef : undefined}
          aria-pressed={category === name}
          onClick={() => onSelect(name)}
          className={cx(
            "shadow-mapachess-raised flex min-w-0 items-center justify-center gap-2 px-2!",
            category === name
              ? "bg-mapachito-blue shadow-mapachito-deep-cyan"
              : "bg-mapachito-violet shadow-mapachito-raspberry",
          )}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none relative block size-12 shrink-0 overflow-hidden xl:hidden"
          >
            <CategoryArtwork category={name} draft={draft} active={active} />
          </span>
          <span>{copy.profile.dressing.categories[name]}</span>
        </ProfileAction>
      ))}
    </div>
  )
}
