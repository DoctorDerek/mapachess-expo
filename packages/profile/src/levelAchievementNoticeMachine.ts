import { assign, setup, type SnapshotFrom } from "xstate"
import { LEVEL_ACHIEVEMENTS, type LevelAchievementId } from "./globalXp.js"

export const LEVEL_ACHIEVEMENT_NOTICE_DURATION_MS = 5_000

type LevelAchievementNoticeInput = Readonly<{
  ids: readonly LevelAchievementId[]
  paused: boolean
}>

type LevelAchievementNoticeContext = {
  pendingIds: readonly LevelAchievementId[]
  observedIds: readonly LevelAchievementId[]
  paused: boolean
}

type LevelAchievementNoticeEvent =
  | Readonly<{
      type: "LEVEL_NOTICE.SOURCE_CHANGED"
      ids: readonly LevelAchievementId[]
    }>
  | Readonly<{
      type: "LEVEL_NOTICE.ACTIVITY_CHANGED"
      paused: boolean
    }>

const catalogOrder = (
  ids: readonly LevelAchievementId[],
): readonly LevelAchievementId[] =>
  LEVEL_ACHIEVEMENTS.filter(({ id }) => ids.includes(id)).map(({ id }) => id)

const levelAchievementNoticeMachine = setup({
  types: {
    context: {} as LevelAchievementNoticeContext,
    input: {} as LevelAchievementNoticeInput,
    events: {} as LevelAchievementNoticeEvent,
  },
  delays: { displayDuration: LEVEL_ACHIEVEMENT_NOTICE_DURATION_MS },
  guards: {
    ready: ({ context }) => !context.paused && context.pendingIds.length > 0,
    paused: ({ context }) => context.paused,
  },
  actions: {
    updateActivity: assign(({ event }) =>
      event.type === "LEVEL_NOTICE.ACTIVITY_CHANGED"
        ? { paused: event.paused }
        : {},
    ),
    admitNotices: assign(({ context, event }) => {
      if (event.type !== "LEVEL_NOTICE.SOURCE_CHANGED") return {}
      const added = catalogOrder(event.ids).filter(
        (id) => !context.observedIds.includes(id),
      )
      return {
        pendingIds: [...context.pendingIds, ...added],
        observedIds: [...context.observedIds, ...added],
      }
    }),
    advance: assign(({ context }) => ({
      pendingIds: context.pendingIds.slice(1),
    })),
  },
}).createMachine({
  id: "levelAchievementNotice",
  context: ({ input }) => {
    const ids = catalogOrder(input.ids)
    return { pendingIds: ids, observedIds: ids, paused: input.paused }
  },
  initial: "waiting",
  on: {
    "LEVEL_NOTICE.SOURCE_CHANGED": { actions: "admitNotices" },
    "LEVEL_NOTICE.ACTIVITY_CHANGED": { actions: "updateActivity" },
  },
  states: {
    waiting: {
      always: { guard: "ready", target: "displaying" },
    },
    displaying: {
      always: { guard: "paused", target: "waiting" },
      after: {
        displayDuration: { actions: "advance", target: "waiting" },
      },
    },
  },
})

export const selectLevelAchievementNotice = (
  snapshot: SnapshotFrom<typeof levelAchievementNoticeMachine>,
): (typeof LEVEL_ACHIEVEMENTS)[number] | null =>
  snapshot.matches("displaying")
    ? (LEVEL_ACHIEVEMENTS.find(
        ({ id }) => id === snapshot.context.pendingIds[0],
      ) ?? null)
    : null

export default levelAchievementNoticeMachine
