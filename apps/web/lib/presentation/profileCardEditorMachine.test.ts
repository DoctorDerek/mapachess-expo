import { describe, expect, it, vi } from "vitest"
import { createActor } from "xstate"
import { DEFAULT_PLAYER_APPEARANCE } from "@mapachess/profile/player-appearance"
import profileCardEditorMachine from "./profileCardEditorMachine"

describe("profile-card appearance drafts", () => {
  it("keeps draft edits through profile notifications and only accepts the matching save", () => {
    const save = vi.fn()
    const actor = createActor(profileCardEditorMachine, {
      input: { appearance: DEFAULT_PLAYER_APPEARANCE, save },
    }).start()
    const draft = { ...DEFAULT_PLAYER_APPEARANCE, face: 5 }
    actor.send({ type: "CARD.APPEARANCE_CHANGED", appearance: draft })
    actor.send({
      type: "CARD.PROFILE_ACCEPTED",
      appearance: DEFAULT_PLAYER_APPEARANCE,
    })
    expect(actor.getSnapshot().context.draft).toEqual(draft)
    actor.send({ type: "CARD.SAVE_REQUESTED" })
    expect(save).toHaveBeenCalledExactlyOnceWith(draft)
    actor.send({
      type: "CARD.PROFILE_ACCEPTED",
      appearance: DEFAULT_PLAYER_APPEARANCE,
    })
    expect(actor.getSnapshot().matches("saving")).toBe(true)
    actor.send({ type: "CARD.PROFILE_ACCEPTED", appearance: draft })
    expect(actor.getSnapshot().matches("editing")).toBe(true)
    expect(actor.getSnapshot().context.saved).toEqual(draft)
    actor.stop()
  })

  it("asks before losing edits and discards only to the accepted appearance", () => {
    const actor = createActor(profileCardEditorMachine, {
      input: { appearance: DEFAULT_PLAYER_APPEARANCE, save: vi.fn() },
    }).start()
    const draft = { ...DEFAULT_PLAYER_APPEARANCE, face: 5 }
    actor.send({ type: "CARD.APPEARANCE_CHANGED", appearance: draft })
    actor.send({ type: "CARD.LEAVE_REQUESTED" })
    expect(actor.getSnapshot().matches("confirmingDiscard")).toBe(true)
    actor.send({ type: "CARD.RETURN_REQUESTED" })
    expect(actor.getSnapshot().context.draft).toEqual(draft)
    actor.send({ type: "CARD.DISCARD_REQUESTED" })
    expect(actor.getSnapshot().context.draft).toEqual(DEFAULT_PLAYER_APPEARANCE)
    actor.stop()
  })

  it("recognizes a successful retry from the canonical profile recovery surface", () => {
    const actor = createActor(profileCardEditorMachine, {
      input: { appearance: DEFAULT_PLAYER_APPEARANCE, save: vi.fn() },
    }).start()
    const draft = { ...DEFAULT_PLAYER_APPEARANCE, skin: 4 }
    actor.send({ type: "CARD.APPEARANCE_CHANGED", appearance: draft })
    actor.send({ type: "CARD.SAVE_REQUESTED" })
    actor.send({ type: "CARD.SAVE_FAILED" })
    expect(actor.getSnapshot().matches("failed")).toBe(true)
    actor.send({ type: "CARD.PROFILE_ACCEPTED", appearance: draft })
    expect(actor.getSnapshot().matches("editing")).toBe(true)
    expect(actor.getSnapshot().context.requested).toBeNull()
    expect(actor.getSnapshot().context.draft).toEqual(draft)
    actor.stop()
  })
})
