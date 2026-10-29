"use client"

import cx from "classix"
import { useEffect, useRef, useState, type ReactNode } from "react"
import type { PlayerAppearance } from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import type { CardRatingContext } from "@mapachess/profile/rating-context"
import dressingRoomChoices, {
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
import ProfileCard, { ProfileArtwork } from "./ProfileCard"
import ProfileCardRatingChoices from "./ProfileCardRatingChoices"
import ProfileDressingCategories from "./ProfileDressingCategories"

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
  editingCategory,
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
  editingCategory: boolean
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
  const categoryHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (!active) return
    const target = editingCategory
      ? categoryHeading.current
      : selectedCategory.current
    target?.focus({ preventScroll: true })
  }, [editingCategory, active, category])
  return (
    <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto]">
      <div
        className={cx(
          editingCategory && "[&>header]:sr-only xl:[&>header]:not-sr-only",
        )}
      >
        {heading}
      </div>
      <div
        className={cx(
          "min-h-0 min-w-0 overscroll-contain px-1 pb-3 xl:grid xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:gap-8 xl:overflow-hidden",
          editingCategory ? "overflow-hidden" : "overflow-y-auto",
        )}
      >
        <div
          className={cx(
            "min-h-0 min-w-0 px-1 pb-3 xl:block xl:overflow-y-auto",
            editingCategory && "hidden",
          )}
        >
          <ProfileCard
            data={data}
            appearance={draft}
            ratingContext={ratingContext}
          />
          <ProfileCardRatingChoices
            ratingContext={ratingContext}
            onChange={onRatingContextChanged}
            disabled={busy}
          />
        </div>
        <div
          className={cx(
            "min-h-0 min-w-0 gap-3 xl:flex xl:h-full xl:flex-col",
            editingCategory && "flex h-full flex-col",
          )}
        >
          <div className={cx("xl:block", editingCategory && "hidden")}>
            <h2 className="my-3 font-bold xl:hidden">
              {messages.customizeAppearance}
            </h2>
            <ProfileDressingCategories
              category={category}
              draft={draft}
              busy={busy}
              active={active}
              selectedRef={selectedCategory}
              onSelect={(name) => {
                setCategory(name)
                onChooseCategory()
              }}
            />
          </div>
          <div
            className={cx(
              "order-1 shrink-0 xl:block",
              !editingCategory && "hidden",
            )}
          >
            <h2
              ref={categoryHeading}
              tabIndex={-1}
              className="mb-2 px-1 font-bold outline-none"
            >
              {categoryName}
            </h2>
          </div>
          <div
            key={category}
            className={cx(
              "order-3 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-1 py-2 xl:block",
              !editingCategory && "hidden",
            )}
          >
            <div className="bg-profile-card-cyan from-profile-card-mint relative mb-3 h-28 w-full rounded-lg bg-radial-[ellipse_at_50%_70%] from-66% to-transparent to-66% xl:hidden">
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
            {category === "Animal" ? (
              <PlayerAnimalChoices
                presentation="dialog"
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
                className="grid grid-cols-[repeat(auto-fit,minmax(min(6rem,100%),1fr))] items-stretch gap-3 px-1 pt-1"
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
          </div>
          {choices.colors.length > 0 ? (
            <div
              role="group"
              aria-label={dressing.choices(categoryName)}
              className={cx(
                "order-4 shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 px-1 pb-1 xl:order-2 xl:grid",
                editingCategory ? "grid" : "hidden",
              )}
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
          {editingCategory ? (
            <ProfileAction
              size="compact"
              disabled={busy}
              onClick={onCloseCategories}
              className="bg-mapachito-violet shadow-mapachess-raised shadow-mapachito-raspberry order-5 shrink-0 xl:hidden"
            >
              {messages.backToCategories}
            </ProfileAction>
          ) : null}
        </div>
      </div>
      <footer className="grid min-w-0 gap-3 px-1 pt-3 pb-2">
        {failed ? (
          <p role="alert">{messages.appearanceCouldNotBeSavedLocallyYour}</p>
        ) : null}
        <p role="status" className="sr-only">
          {dirty ? dressing.unsaved : dressing.saved}
        </p>
        <div className="flex flex-wrap items-stretch gap-1 xl:ml-auto xl:w-3/5 [&>button]:min-w-min [&>button]:flex-1">
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
