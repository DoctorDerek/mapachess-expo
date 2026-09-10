import type { StoryMedal } from "@mapachess/profile/story-progress"

const MEDAL_SYMBOLS = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
} as const satisfies Readonly<Record<StoryMedal, string>>

export default function MedalSymbol({
  medal,
}: Readonly<{ medal: StoryMedal }>) {
  return (
    <span aria-hidden="true" className="mr-1 inline-block align-middle text-xl">
      {MEDAL_SYMBOLS[medal]}
    </span>
  )
}
