"use client"

import cx from "classix"
import { useEffect, useRef, useState, type ReactNode } from "react"
import type { PlayerAppearance } from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import type { CardRatingContext } from "@mapachess/profile/rating-context"
import dressingRoomChoices, {
  DRESSING_CATEGORIES,
  type DressingCategory,
} from "../../lib/presentation/dressingRoomChoices"
import {
  cardFacts,
  INITIAL_CARD_CONTENT,
} from "../../lib/presentation/profileCardArtwork"
import { useMapachessCopy, useMapachessLocale } from "./MapachessLocaleProvider"
import PlayerAnimalChoices from "./PlayerAnimalChoices"
import ProfileAction from "./ProfileAction"
import ProfileAppearanceChoice from "./ProfileAppearanceChoice"
import { ProfileArtwork } from "./ProfileCard"
import ProfileCardRatingChoices from "./ProfileCardRatingChoices"

export default function ProfileDressingRoom({
  active,
  heading,
  data,
  draft,
  ratingContext,
  onRatingContextChanged,
  dirty,
  busy,
  failed,
  onChange,
  onSave,
  onCancel,
  onShare,
  onRetry,
  choosingCategory,
  onChooseCategory,
  onCloseCategories,
}: Readonly<{
  heading?: ReactNode
  active: boolean
  data: MapachessPlayerData
  draft: PlayerAppearance
  ratingContext: CardRatingContext
  onRatingContextChanged: (context: CardRatingContext) => void
  dirty: boolean
  busy: boolean
  failed: boolean
  onChange: (appearance: PlayerAppearance) => void
  onSave: () => void
  onCancel: () => void
  onShare: () => void
  onRetry: () => void
  choosingCategory: boolean
  onChooseCategory: () => void
  onCloseCategories: () => void
}>) {
  const copy = useMapachessCopy()
  const locale = useMapachessLocale()
  const messages = copy.interface.profileDressingRoom
  const dressing = copy.profile.dressing
  const [category, setCategory] = useState<DressingCategory>("Clothes")
  const choices = dressingRoomChoices(category, draft, dressing)
  const categoryName = dressing.categories[category]
  const selectedCategory = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (choosingCategory && active)
      selectedCategory.current?.focus({ preventScroll: true })
  }, [choosingCategory, active])
  return (
    <div className="grid h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto]">
      <div
        key={choosingCategory ? "categories" : category}
        className="min-h-0 min-w-0 overflow-y-auto overscroll-contain px-1 pb-3"
      >
        {heading}
        <div className="grid min-w-0 gap-3 xl:grid-cols-2 xl:gap-6">
          <div className="bg-profile-card-cyan from-profile-card-mint relative mx-auto h-28 w-full max-w-sm rounded-lg bg-radial-[ellipse_at_50%_70%] from-66% to-transparent to-66% xl:h-64 xl:max-w-none">
            <ProfileArtwork
              input={{
                locale,
                appearance: draft,
                facts: cardFacts(data, ratingContext),
                content: INITIAL_CARD_CONTENT,
                format: "GIF",
              }}
              fitStage
            />
          </div>
          <div className="min-w-0 px-1 pt-1">
            {failed ? (
              <p role="alert" className="mb-3">
                {messages.appearanceCouldNotBeSavedLocallyYour}
              </p>
            ) : null}
            {!choosingCategory ? (
              <>
                {category === "Animal" ? (
                  <PlayerAnimalChoices
                    active={active}
                    disabled={busy}
                    onSelected={(animal) => onChange({ ...draft, animal })}
                    selectedId={draft.animal}
                    storyProgress={data.storyProgress}
                  />
                ) : (
                  <div
                    role="group"
                    aria-label={dressing.selection(categoryName)}
                    className="flex flex-wrap items-stretch gap-3 px-1 pt-1"
                  >
                    {choices.styles.map((choice) => (
                      <ProfileAppearanceChoice
                        key={choice.label}
                        choice={choice}
                        data={data}
                        disabled={busy}
                        onChange={onChange}
                      />
                    ))}
                  </div>
                )}
                <ProfileCardRatingChoices
                  data={data}
                  draft={draft}
                  ratingContext={ratingContext}
                  onChange={onRatingContextChanged}
                  disabled={busy}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
      <footer className="grid min-w-0 gap-3 px-1 pt-3 pb-2">
        {choosingCategory ? (
          <div
            role="group"
            aria-label={messages.appearanceCategories}
            className="mt-auto grid grid-cols-2 gap-3 px-1 pb-2 xl:grid-cols-3"
          >
            {DRESSING_CATEGORIES.map((name) => (
              <ProfileAction
                key={name}
                size="compact"
                disabled={busy}
                ref={category === name ? selectedCategory : undefined}
                aria-pressed={category === name}
                onClick={() => {
                  setCategory(name)
                  onCloseCategories()
                }}
                className={cx(
                  "bg-mapachito-violet shadow-mapachess-raised shadow-mapachito-raspberry px-1!",
                  category === name &&
                    "ring-offset-mapachito-charcoal ring-2 ring-white ring-offset-2",
                )}
              >
                {dressing.categories[name]}
              </ProfileAction>
            ))}
          </div>
        ) : null}
        <ProfileAction
          size="compact"
          disabled={busy}
          aria-expanded={choosingCategory}
          onClick={(event) => {
            if (choosingCategory) onCloseCategories()
            else {
              event.currentTarget.focus({ preventScroll: true })
              onChooseCategory()
            }
          }}
          className="bg-mapachito-violet shadow-mapachess-raised shadow-mapachito-raspberry flex items-center justify-center gap-2"
        >
          {choosingCategory
            ? messages.backToCategory(categoryName)
            : categoryName}
          {!choosingCategory ? <span aria-hidden="true">⌃</span> : null}
        </ProfileAction>
        {!choosingCategory && choices.colors.length > 0 ? (
          <div
            role="group"
            aria-label={dressing.choices(categoryName)}
            className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2"
          >
            <span className="text-base font-bold">{messages.color}</span>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(44px,1fr))] gap-2">
              {choices.colors.map((choice) => (
                <ProfileAppearanceChoice
                  key={choice.label}
                  choice={choice}
                  data={data}
                  disabled={busy}
                  onChange={onChange}
                  compact
                />
              ))}
            </div>
          </div>
        ) : null}
        <p role="status" className="sr-only">
          {dirty ? dressing.unsaved : dressing.saved}
        </p>
        <div className="flex flex-wrap items-stretch gap-1 [&>button]:min-w-min [&>button]:flex-1">
          <ProfileAction
            size="compact"
            className="bg-mapachito-charcoal shadow-mapachess-raised shadow-mapachito-violet"
            onClick={onCancel}
            disabled={busy}
            aria-label={messages.cancelChanges}
          >
            {messages.cancel}
          </ProfileAction>
          <ProfileAction
            size="compact"
            className="bg-mapachito-blue shadow-mapachess-raised shadow-mapachito-deep-cyan"
            onClick={onShare}
            disabled={busy}
            aria-label={messages.shareProfileCard}
          >
            {messages.share}
          </ProfileAction>
          <ProfileAction
            size="compact"
            className="bg-mapachito-violet shadow-mapachess-raised shadow-mapachito-raspberry"
            onClick={failed ? onRetry : onSave}
            disabled={busy || (!dirty && !failed)}
            aria-label={failed ? messages.retrySave : messages.saveAppearance}
          >
            {failed
              ? messages.retrySave
              : busy
                ? dressing.saving
                : messages.save}
          </ProfileAction>
        </div>
      </footer>
    </div>
  )
}
