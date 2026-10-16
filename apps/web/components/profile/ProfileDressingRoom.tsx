"use client"

import cx from "classix"
import { useState } from "react"
import {
  HERO_CATALOG,
  heroWeaponDefinition,
} from "@mapachess/profile/hero-catalog"
import type { PlayerAppearance } from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import {
  cardFacts,
  INITIAL_CARD_CONTENT,
} from "../../lib/presentation/profileCardArtwork"
import { useMapachessCopy, useMapachessLocale } from "./MapachessLocaleProvider"
import PlayerAnimalChoices from "./PlayerAnimalChoices"
import ProfileAction from "./ProfileAction"
import ProfileCard, { ProfileArtwork } from "./ProfileCard"

type Category = "Clothes" | "Weapons" | "Hair" | "Skin" | "Face" | "Animal"
export default function ProfileDressingRoom({
  active,
  data,
  draft,
  dirty,
  busy,
  failed,
  onChange,
  onSave,
  onCancel,
  onShare,
  onRetry,
}: Readonly<{
  active: boolean
  data: MapachessPlayerData
  draft: PlayerAppearance
  dirty: boolean
  busy: boolean
  failed: boolean
  onChange: (appearance: PlayerAppearance) => void
  onSave: () => void
  onCancel: () => void
  onShare: () => void
  onRetry: () => void
}>) {
  const copy = useMapachessCopy()
  const locale = useMapachessLocale()
  const messages = copy.interface.profileDressingRoom
  const dressing = copy.profile.dressing

  const [category, setCategory] = useState<Category>("Clothes")
  const [colors, setColors] = useState(false)
  const clothing = HERO_CATALOG.cloth.find(({ id }) => id === draft.cloth)
  const hair = HERO_CATALOG.hair.find(({ id }) => id === draft.hair)
  const weapon = heroWeaponDefinition(draft.weapon)
  if (clothing === undefined || hair === undefined)
    throw new Error("The editor requires a validated appearance.")
  const options: readonly {
    label: string
    selected: boolean
    appearance: PlayerAppearance
  }[] =
    category === "Weapons"
      ? colors && weapon.variants.length > 1
        ? weapon.variants.map((variant, index) => ({
            label: dressing.weaponColor(dressing.weapons[weapon.id], index + 1),
            selected: variant === draft.weapon,
            appearance: { ...draft, weapon: variant },
          }))
        : HERO_CATALOG.weapons.map((item) => ({
            label: dressing.weapons[item.id],
            selected: item.id === weapon.id,
            appearance: {
              ...draft,
              weapon:
                item.variants.find((variant) => variant === draft.weapon) ??
                item.variants[0],
            },
          }))
      : category === "Clothes"
        ? colors
          ? clothing.colors.map((color) => ({
              label: dressing.clothingColor(color),
              selected: color === draft.clothColor,
              appearance: { ...draft, clothColor: color },
            }))
          : HERO_CATALOG.cloth.map((item) => ({
              label: dressing.outfit(item.id.slice(5)),
              selected: item.id === draft.cloth,
              appearance: {
                ...draft,
                cloth: item.id,
                clothColor:
                  item.colors.find((color) => color === draft.clothColor) ??
                  item.colors[0],
              },
            }))
        : category === "Hair"
          ? colors
            ? hair.colors.map((color) => ({
                label: dressing.hairColor(color),
                selected: color === draft.hairColor,
                appearance: { ...draft, hairColor: color },
              }))
            : HERO_CATALOG.hair.map((item) => ({
                label: dressing.hairstyle(item.id),
                selected: item.id === draft.hair,
                appearance: {
                  ...draft,
                  hair: item.id,
                  hairColor:
                    item.colors.find((color) => color === draft.hairColor) ??
                    item.colors[0],
                },
              }))
          : category === "Skin"
            ? HERO_CATALOG.skin.map((skin) => ({
                label: dressing.skin(skin),
                selected: skin === draft.skin,
                appearance: { ...draft, skin },
              }))
            : category === "Face"
              ? HERO_CATALOG.face.map((face) => ({
                  label: dressing.face(face),
                  selected: face === draft.face,
                  appearance: { ...draft, face },
                }))
              : []
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="min-w-0">
        <ProfileCard data={data} appearance={draft} />
        <p role="status" className="mt-4 min-h-6 text-base">
          {busy ? dressing.saving : dirty ? dressing.unsaved : dressing.saved}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <ProfileAction
            className="bg-mapachito-violet shadow-[0.375rem_0.375rem_0_#9c0052]"
            onClick={onSave}
            disabled={busy || !dirty}
          >
            <span aria-hidden="true">✓</span> {messages.saveAppearance}
          </ProfileAction>
          <ProfileAction
            className="bg-mapachito-blue shadow-[0.375rem_0.375rem_0_#008b8b]"
            onClick={onShare}
            disabled={busy}
          >
            <span aria-hidden="true">↗</span> {messages.shareProfileCard}
          </ProfileAction>
          <ProfileAction
            className="bg-mapachito-charcoal shadow-[0.375rem_0.375rem_0_#790fc5]"
            onClick={onCancel}
            disabled={busy}
          >
            <span aria-hidden="true">×</span> {messages.cancelChanges}
          </ProfileAction>
        </div>
        {failed ? (
          <div role="alert" className="mt-4">
            <p>{messages.appearanceCouldNotBeSavedLocallyYour}</p>
            <ProfileAction
              onClick={onRetry}
              className="bg-mapachito-violet mt-3"
            >
              {messages.retrySave}
            </ProfileAction>
          </div>
        ) : null}
      </div>
      <div className="min-w-0">
        <div
          role="group"
          aria-label={messages.appearanceCategories}
          className="flex flex-wrap gap-3"
        >
          {(
            ["Clothes", "Weapons", "Hair", "Skin", "Face", "Animal"] as const
          ).map((name) => (
            <ProfileAction
              key={name}
              disabled={busy}
              aria-pressed={category === name}
              onClick={() => {
                setCategory(name)
                setColors(false)
              }}
              className={cx(
                "bg-mapachito-violet shadow-[0.375rem_0.375rem_0_#9c0052]",
                category === name &&
                  "ring-2 ring-white ring-offset-4 ring-offset-[#1e1e1e]",
              )}
            >
              {dressing.categories[name]}
            </ProfileAction>
          ))}
        </div>
        {category === "Clothes" ||
        category === "Hair" ||
        (category === "Weapons" && weapon.variants.length > 1) ? (
          <div
            className="my-4 flex flex-wrap gap-3"
            role="group"
            aria-label={dressing.choices(dressing.categories[category])}
          >
            <ProfileAction
              aria-pressed={!colors}
              className="bg-mapachito-blue"
              onClick={() => setColors(false)}
            >
              {messages.styles}
            </ProfileAction>
            <ProfileAction
              aria-pressed={colors}
              className="bg-mapachito-blue"
              onClick={() => setColors(true)}
            >
              {messages.colors}
            </ProfileAction>
          </div>
        ) : null}
        {category === "Animal" ? (
          <div className="mt-5">
            <PlayerAnimalChoices
              active={active}
              disabled={busy}
              onSelected={(animal) => onChange({ ...draft, animal })}
              selectedId={draft.animal}
              storyProgress={data.storyProgress}
            />
          </div>
        ) : (
          <div
            role="group"
            aria-label={dressing.selection(dressing.categories[category])}
            className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-3"
          >
            {options.map(({ label, selected, appearance }) => (
              <button
                type="button"
                key={label}
                disabled={busy}
                aria-pressed={selected}
                onClick={() => onChange(appearance)}
                className={cx(
                  "text-mapachito-white cursor-pointer rounded-lg bg-[#333] px-2 py-2 text-base font-bold",
                  selected && "ring-3 ring-[#71dfe7]",
                )}
              >
                <ProfileArtwork
                  input={{
                    locale,
                    appearance,
                    facts: cardFacts(data),
                    content: {
                      ...INITIAL_CARD_CONTENT,
                      animal: false,
                    },
                    format: "PNG",
                  }}
                />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
