import { describe, expect, it, vi } from "vitest"
import { createActor, SimulatedClock } from "xstate"
import { LEVEL_ACHIEVEMENTS, type LevelAchievementId } from "../src/globalXp.js"
import levelAchievementNoticeMachine, {
  LEVEL_ACHIEVEMENT_NOTICE_DURATION_MS,
  selectLevelAchievementNotice,
} from "../src/levelAchievementNoticeMachine.js"

const first = LEVEL_ACHIEVEMENTS[0]
const second = LEVEL_ACHIEVEMENTS[1]
const third = LEVEL_ACHIEVEMENTS[2]

function open(ids: readonly LevelAchievementId[], paused = false) {
  const clock = new SimulatedClock()
  const actor = createActor(levelAchievementNoticeMachine, {
    input: { ids, paused },
    clock,
  }).start()
  return {
    actor,
    clock,
    notice: () => selectLevelAchievementNotice(actor.getSnapshot()),
    pause: (value: boolean) =>
      actor.send({ type: "LEVEL_NOTICE.ACTIVITY_CHANGED", paused: value }),
    admit: (source: readonly LevelAchievementId[]) =>
      actor.send({ type: "LEVEL_NOTICE.SOURCE_CHANGED", ids: source }),
  }
}

describe("shared Level achievement notices", () => {
  it("deduplicates and presents accepted IDs in catalog order for five seconds each", () => {
    const { actor, clock, notice } = open([second.id, first.id, second.id])
    expect(notice()).toEqual(first)
    clock.increment(LEVEL_ACHIEVEMENT_NOTICE_DURATION_MS - 1)
    expect(notice()).toEqual(first)
    clock.increment(1)
    expect(notice()).toEqual(second)
    clock.increment(LEVEL_ACHIEVEMENT_NOTICE_DURATION_MS)
    expect(notice()).toBeNull()
    actor.stop()
  })

  it("waits while blocked and restarts the current notice's full duration after resume", () => {
    const { actor, clock, notice, pause } = open([first.id, second.id], true)
    clock.increment(20_000)
    expect(notice()).toBeNull()
    pause(false)
    expect(notice()).toEqual(first)
    clock.increment(4_000)
    pause(true)
    expect(notice()).toBeNull()
    clock.increment(20_000)
    pause(false)
    clock.increment(4_999)
    expect(notice()).toEqual(first)
    clock.increment(1)
    expect(notice()).toEqual(second)
    actor.stop()
  })

  it("does not extend an active notice on repeated activity or duplicate source updates", () => {
    const { actor, clock, notice, pause, admit } = open([first.id])
    clock.increment(4_000)
    pause(false)
    admit([first.id, first.id, third.id, second.id])
    clock.increment(1_000)
    expect(notice()).toEqual(second)
    clock.increment(LEVEL_ACHIEVEMENT_NOTICE_DURATION_MS)
    expect(notice()).toEqual(third)
    clock.increment(LEVEL_ACHIEVEMENT_NOTICE_DURATION_MS)
    expect(notice()).toBeNull()
    admit([first.id, second.id, third.id])
    pause(true)
    pause(false)
    expect(notice()).toBeNull()
    actor.stop()
  })

  it("admits a new source into an empty presentation without inventing a notice", () => {
    const { actor, clock, notice, admit } = open([])
    clock.increment(10_000)
    expect(notice()).toBeNull()
    admit([])
    expect(notice()).toBeNull()
    admit([first.id])
    expect(notice()).toEqual(first)
    clock.increment(LEVEL_ACHIEVEMENT_NOTICE_DURATION_MS)
    expect(notice()).toBeNull()
    actor.stop()
  })

  it("removes the owned deadline on pause, completion, and scope disposal", () => {
    vi.useFakeTimers()
    const actor = createActor(levelAchievementNoticeMachine, {
      input: { ids: [first.id], paused: false },
    }).start()
    try {
      expect(vi.getTimerCount()).toBe(1)
      actor.send({ type: "LEVEL_NOTICE.ACTIVITY_CHANGED", paused: true })
      expect(vi.getTimerCount()).toBe(0)
      actor.send({ type: "LEVEL_NOTICE.ACTIVITY_CHANGED", paused: false })
      vi.advanceTimersByTime(LEVEL_ACHIEVEMENT_NOTICE_DURATION_MS)
      expect(selectLevelAchievementNotice(actor.getSnapshot())).toBeNull()
      expect(vi.getTimerCount()).toBe(0)
      actor.send({ type: "LEVEL_NOTICE.SOURCE_CHANGED", ids: [second.id] })
      expect(vi.getTimerCount()).toBe(1)
      actor.stop()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      actor.stop()
      vi.useRealTimers()
    }
  })
})
