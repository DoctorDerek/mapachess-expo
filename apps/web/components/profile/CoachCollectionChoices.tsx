"use client"

import cx from "classix"
import { useId } from "react"
import {
  COACH_COLLECTION_IDS,
  COACH_COLLECTIONS,
  type CoachCollectionId,
  type CoachPortraitLabel,
} from "@mapachess/match-presentation/coach-portrait"
import useDecodedCoachPortrait from "../../lib/presentation/useDecodedCoachPortrait"
import CoachPortraitImage from "../presentation/CoachPortraitImage"

const SAMPLE_EXPRESSIONS = [
  "neutral",
  "happy_high",
  "hurt_high",
] as const satisfies readonly CoachPortraitLabel[]

function CoachSample({
  collection,
  expression,
}: Readonly<{
  collection: CoachCollectionId
  expression: CoachPortraitLabel
}>) {
  const portrait = useDecodedCoachPortrait(
    { kind: "portrait", label: expression },
    collection,
  )
  return (
    <span
      className="bg-mapachito-charcoal grid size-12 shrink-0 place-items-center overflow-hidden rounded-md"
      aria-hidden="true"
    >
      <CoachPortraitImage portrait={portrait} />
    </span>
  )
}

export default function CoachCollectionChoices({
  collection,
  disabled,
  onChange,
}: Readonly<{
  collection: CoachCollectionId
  disabled: boolean
  onChange: (collection: CoachCollectionId) => void
}>) {
  const id = useId()
  return (
    <fieldset
      disabled={disabled}
      aria-describedby={`${id}-description`}
      className="mt-8"
    >
      <legend className="font-display text-mapachito-charcoal text-[1.35rem] font-black uppercase">
        Coach
      </legend>
      <p
        id={`${id}-description`}
        className="text-mapachito-charcoal mt-2 text-sm"
      >
        One raccoon, or a cast of animals whose expressions follow the match.
      </p>
      <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3">
        {COACH_COLLECTION_IDS.map((choice) => (
          <label
            key={choice}
            className={cx(
              "bg-mapachito-violet text-mapachito-white has-[:focus-visible]:outline-mapachito-orange grid cursor-pointer justify-items-center gap-3 rounded-lg p-3 font-bold has-[:disabled]:cursor-not-allowed has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2",
              collection === choice &&
                "ring-mapachito-orange ring-3 ring-offset-2",
            )}
          >
            <span className="flex gap-2">
              {SAMPLE_EXPRESSIONS.map((expression) => (
                <CoachSample
                  key={expression}
                  collection={choice}
                  expression={expression}
                />
              ))}
            </span>
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name={`${id}-coach`}
                checked={collection === choice}
                value={choice}
                onChange={() => onChange(choice)}
                className="accent-mapachito-orange size-4 shrink-0"
              />
              {COACH_COLLECTIONS[choice].label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
