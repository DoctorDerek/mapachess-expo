"use client"

import cx from "classix"
import { useId, useState } from "react"
import {
  COACH_COLLECTION_IDS,
  type CoachCollectionId,
  type CoachPortraitLabel,
} from "@mapachess/match-presentation/coach-portrait"
import useDecodedCoachPortrait from "../../lib/presentation/useDecodedCoachPortrait"
import CoachPortraitImage from "../presentation/CoachPortraitImage"
import CustomizationChoice from "./CustomizationChoice"
import { useMapachessCopy } from "./MapachessLocaleProvider"

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
  const copy = useMapachessCopy()
  const messages = copy.interface.coachCollectionChoices

  const id = useId()
  const [open, setOpen] = useState(false)
  return (
    <CustomizationChoice
      kind="coach"
      value={copy.profile.coachCollections[collection]}
      preview={<CoachSample collection={collection} expression="neutral" />}
      open={open}
      onToggle={() => setOpen((current) => !current)}
    >
      <fieldset
        disabled={disabled}
        aria-describedby={`${id}-description`}
        className="mt-4"
      >
        <legend className="sr-only">{messages.coach}</legend>
        <p
          id={`${id}-description`}
          className="text-mapachito-charcoal mt-2 text-sm"
        >
          {messages.oneRaccoonOrACastOfAnimals}
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
                {copy.profile.coachCollections[choice]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </CustomizationChoice>
  )
}
