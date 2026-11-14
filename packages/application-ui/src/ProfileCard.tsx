import cx from "classix"
import { useMemo } from "react"
import type { MapachessCatalog } from "@mapachess/localization/catalog"
import type { ShippedLocale } from "@mapachess/localization/locale"
import type { PlayerAppearance } from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import {
  cardFacts,
  INITIAL_CARD_CONTENT,
  type CardInput,
} from "@mapachess/profile/profile-card-model"
import type { CardRatingContext } from "@mapachess/profile/rating-context"
import type { ProfileCardElements } from "./homeElements.js"

export default function ProfileCard({
  data,
  copy,
  locale,
  elements: { Group, Text, Medal, Artwork },
  appearance = data.appearance,
  ratingContext = data.settings.cardRatingContext,
}: Readonly<{
  data: MapachessPlayerData
  copy: MapachessCatalog
  locale: ShippedLocale
  elements: ProfileCardElements
  appearance?: PlayerAppearance
  ratingContext?: CardRatingContext
}>) {
  const facts = useMemo(
    () => cardFacts(data, ratingContext),
    [data, ratingContext],
  )
  const contextLabel = copy.profile.cardRatingContext(
    copy.gameplay.clock.category[ratingContext.category],
    copy.shared.story.medals[ratingContext.assistance],
  )
  const input = useMemo<CardInput>(
    () => ({
      appearance,
      facts,
      content: INITIAL_CARD_CONTENT,
      format: "GIF",
      locale,
    }),
    [appearance, facts, locale],
  )
  const description = copy.profile.cardDescription(
    facts.level,
    facts.standard,
    facts.chess960,
    contextLabel,
  )
  return (
    <Group
      region="card"
      description={description}
      className="font-home shadow-mapachess-raised shadow-profile-card-blue"
    >
      <Group
        region="body"
        className="text-profile-card-ink flex flex-row flex-wrap-reverse"
      >
        <Group
          region="facts"
          description={description}
          className="bg-profile-card-yellow flex min-w-0 shrink grow-[2] basis-32 flex-col justify-evenly gap-3"
        >
          {(["level", "standard", "chess960"] as const).map((kind) => (
            <Group
              key={kind}
              region="row"
              className={cx(
                "flex min-w-0 flex-row",
                kind === "level"
                  ? "flex-wrap items-baseline gap-x-1"
                  : "flex-wrap-reverse items-center justify-between gap-x-2",
              )}
            >
              <Group
                region="label"
                rating={kind !== "level"}
                className={cx("min-w-0", kind !== "level" && "grow basis-28")}
              >
                <Text
                  kind="label"
                  className="font-home text-profile-card-ink text-lg leading-tight font-bold"
                >
                  {kind === "level"
                    ? copy.profile.level
                    : copy.profile.ratingLabel[kind]}
                </Text>
                {kind === "level" ? null : (
                  <Group
                    region="context"
                    className="flex flex-row flex-wrap items-center"
                  >
                    <Medal
                      medal={ratingContext.assistance}
                      className="mr-1 size-6 shrink-0"
                    />
                    <Text
                      kind="context"
                      className="font-home text-profile-card-ink text-sm"
                    >
                      {contextLabel}
                    </Text>
                  </Group>
                )}
              </Group>
              <Text
                kind="value"
                className="font-home text-profile-card-ink mt-1 text-3xl leading-none font-black break-all tabular-nums"
              >
                {facts[kind]}
              </Text>
            </Group>
          ))}
        </Group>
        <Group
          region="artwork"
          className="bg-profile-card-cyan relative min-h-58 min-w-0 shrink grow-[3] basis-36"
        >
          <Artwork input={input} />
        </Group>
      </Group>
    </Group>
  )
}
