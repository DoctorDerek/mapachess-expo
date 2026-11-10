import { expect, it, vi } from "vitest"
import { createActor } from "xstate"
import loadCatalog from "@mapachess/localization/catalog"
import dressingRoomChoices, {
  DRESSING_CATEGORIES,
} from "../src/dressingRoomChoices.js"
import {
  decodePlayerAppearance,
  DEFAULT_PLAYER_APPEARANCE,
  type PlayerAppearance,
} from "../src/playerAppearance.js"
import profileCardEditorMachine, {
  isProfileCardEditorDirty,
} from "../src/profileCardEditorMachine.js"
import {
  DEFAULT_CARD_RATING_CONTEXT,
  type CardRatingContext,
} from "../src/ratingContext.js"

const appearance = DEFAULT_PLAYER_APPEARANCE
const originalRating = DEFAULT_CARD_RATING_CONTEXT
const changedRating = {
  category: "bullet",
  assistance: "silver",
} as const satisfies CardRatingContext
const english = loadCatalog("en").profile.dressing

it("only offers validated, round-trippable appearance choices for each category", () => {
  const initial = {
    ...appearance,
    weapon: "weapon5_c4",
  } as const satisfies PlayerAppearance
  for (const category of DRESSING_CATEGORIES) {
    const selected = category === "Weapons" ? initial : appearance
    const { styles, colors } = dressingRoomChoices(category, selected, english)
    if (category === "Animal") {
      expect({ styles, colors }).toEqual({ styles: [], colors: [] })
      continue
    }
    expect(styles.filter((choice) => choice.selected)).toHaveLength(1)
    for (const choice of [...styles, ...colors]) {
      expect(choice.label).not.toBe("")
      expect(
        decodePlayerAppearance(
          choice.appearance,
          { standard: [], chess960: [] },
          "appearance",
        ),
      ).toEqual(choice.appearance)
      if (choice.selected) expect(choice.appearance).toEqual(selected)
    }
  }
  expect(dressingRoomChoices("Weapons", appearance, english).colors).toEqual([])
  expect(dressingRoomChoices("Weapons", initial, english).colors).toHaveLength(
    4,
  )
})

it("keeps the draft through navigation and storage failure and accepts only the requested save", ({
  onTestFinished,
}) => {
  const save =
    vi.fn<(appearance: PlayerAppearance, rating: CardRatingContext) => void>()
  const actor = createActor(profileCardEditorMachine, {
    input: { appearance, ratingContext: originalRating, save },
  }).start()
  onTestFinished(() => actor.stop())
  const draft = { ...appearance, weapon: "weapon1" } as const
  const snapshot = () => actor.getSnapshot()
  actor.send({ type: "CARD.SAVE_REQUESTED" })
  expect(save).not.toHaveBeenCalled()
  actor.send({ type: "CARD.APPEARANCE_CHANGED", appearance: draft })
  actor.send({
    type: "CARD.RATING_CONTEXT_CHANGED",
    ratingContext: changedRating,
  })
  actor.send({ type: "CARD.LEAVE_REQUESTED" })
  expect(snapshot().matches("confirmingDiscard")).toBe(true)
  actor.send({ type: "CARD.RETURN_REQUESTED" })
  expect(snapshot().context.draft).toEqual(draft)
  actor.send({ type: "CARD.LEAVE_REQUESTED" })
  actor.send({ type: "CARD.SAVE_REQUESTED" })
  expect(save).toHaveBeenCalledExactlyOnceWith(draft, changedRating)
  actor.send({
    type: "CARD.PROFILE_ACCEPTED",
    appearance: draft,
    ratingContext: originalRating,
  })
  expect(snapshot().matches("saving")).toBe(true)
  actor.send({ type: "CARD.SAVE_FAILED" })
  expect(snapshot().matches("failed")).toBe(true)
  expect(snapshot().context.draftRatingContext).toEqual(changedRating)
  actor.send({ type: "CARD.RETRY_REQUESTED" })
  actor.send({
    type: "CARD.PROFILE_ACCEPTED",
    appearance: draft,
    ratingContext: changedRating,
  })
  expect(snapshot().matches("editing")).toBe(true)
  expect(snapshot().context.requested).toBeNull()
  expect(isProfileCardEditorDirty(snapshot().context)).toBe(false)
  expect(snapshot().context.saved).toEqual(draft)

  actor.send({
    type: "CARD.RATING_CONTEXT_CHANGED",
    ratingContext: originalRating,
  })
  actor.send({ type: "CARD.LEAVE_REQUESTED" })
  actor.send({ type: "CARD.DISCARD_REQUESTED" })
  expect(snapshot().context.draftRatingContext).toEqual(changedRating)
  expect(isProfileCardEditorDirty(snapshot().context)).toBe(false)
  actor.send({
    type: "CARD.PROFILE_ACCEPTED",
    appearance,
    ratingContext: originalRating,
  })
  expect(snapshot().context.draft).toEqual(appearance)
  expect(snapshot().context.draftRatingContext).toEqual(originalRating)
})
