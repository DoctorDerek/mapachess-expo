"use client"

import cx from "classix"
import { useState } from "react"
import { HERO_CATALOG } from "@mapachess/profile/hero-catalog"
import type { PlayerAppearance } from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import {
  cardFacts,
  INITIAL_CARD_CONTENT,
} from "../../lib/presentation/profileCardArtwork"
import PlayerAnimalChoices from "./PlayerAnimalChoices"
import ProfileAction from "./ProfileAction"
import ProfileCard, { ProfileArtwork } from "./ProfileCard"

type Category = "Clothes" | "Hair" | "Skin" | "Face" | "Animal"
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
  const [category, setCategory] = useState<Category>("Clothes")
  const [colors, setColors] = useState(false)
  const clothing = HERO_CATALOG.cloth.find(({ id }) => id === draft.cloth)
  const hair = HERO_CATALOG.hair.find(({ id }) => id === draft.hair)
  if (clothing === undefined || hair === undefined)
    throw new Error("The editor requires a validated appearance.")
  const options: readonly {
    label: string
    selected: boolean
    appearance: PlayerAppearance
  }[] =
    category === "Clothes"
      ? colors
        ? clothing.colors.map((color) => ({
            label: `Clothing color ${color}`,
            selected: color === draft.clothColor,
            appearance: { ...draft, clothColor: color },
          }))
        : HERO_CATALOG.cloth.map((item) => ({
            label: `Outfit ${item.id.slice(5)}`,
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
              label: `Hair color ${color}`,
              selected: color === draft.hairColor,
              appearance: { ...draft, hairColor: color },
            }))
          : HERO_CATALOG.hair.map((item) => ({
              label: `Hairstyle ${item.id}`,
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
              label: `Skin ${skin}`,
              selected: skin === draft.skin,
              appearance: { ...draft, skin },
            }))
          : category === "Face"
            ? HERO_CATALOG.face.map((face) => ({
                label: `Face ${face}`,
                selected: face === draft.face,
                appearance: { ...draft, face },
              }))
            : []
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="min-w-0">
        <ProfileCard data={data} appearance={draft} />
        <p role="status" className="mt-4 min-h-6 text-base">
          {busy
            ? "Saving appearance…"
            : dirty
              ? "Unsaved appearance"
              : "Saved appearance"}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <ProfileAction
            className="bg-mapachito-violet shadow-[0.375rem_0.375rem_0_#9c0052]"
            onClick={onSave}
            disabled={busy || !dirty}
          >
            <span aria-hidden="true">✓</span> Save appearance
          </ProfileAction>
          <ProfileAction
            className="bg-mapachito-blue shadow-[0.375rem_0.375rem_0_#008b8b]"
            onClick={onShare}
            disabled={busy}
          >
            <span aria-hidden="true">↗</span> Share profile card
          </ProfileAction>
          <ProfileAction
            className="bg-mapachito-charcoal shadow-[0.375rem_0.375rem_0_#790fc5]"
            onClick={onCancel}
            disabled={busy}
          >
            <span aria-hidden="true">×</span> Cancel changes
          </ProfileAction>
        </div>
        {failed ? (
          <div role="alert" className="mt-4">
            <p>
              Appearance could not be saved locally. Your edits are still here.
            </p>
            <ProfileAction
              onClick={onRetry}
              className="bg-mapachito-violet mt-3"
            >
              Retry save
            </ProfileAction>
          </div>
        ) : null}
      </div>
      <div className="min-w-0">
        <div
          role="group"
          aria-label="Appearance categories"
          className="flex flex-wrap gap-3"
        >
          {(["Clothes", "Hair", "Skin", "Face", "Animal"] as const).map(
            (name) => (
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
                {name}
              </ProfileAction>
            ),
          )}
        </div>
        {category === "Clothes" || category === "Hair" ? (
          <div
            className="my-4 flex gap-3"
            role="group"
            aria-label={`${category} choices`}
          >
            <ProfileAction
              aria-pressed={!colors}
              className="bg-mapachito-blue"
              onClick={() => setColors(false)}
            >
              Styles
            </ProfileAction>
            <ProfileAction
              aria-pressed={colors}
              className="bg-mapachito-blue"
              onClick={() => setColors(true)}
            >
              Colors
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
            aria-label={`${category} selection`}
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
