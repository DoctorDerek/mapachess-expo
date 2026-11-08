import { createActor, type ActorRefFrom } from "xstate"
import { formatMatchMoveNotation } from "@mapachess/match/match-move"
import type { MatchTimeline } from "@mapachess/match/match-timeline"
import type { MoveFeedbackRecord } from "@mapachess/match/move-feedback"
import { MOVE_CLASSIFICATION_POLICY_ID } from "./moveClassification.js"
import moveReactionMachine from "./moveReactionMachine.js"

export type MoveReactionController = Readonly<{
  actor: ActorRefFrom<typeof moveReactionMachine>
  clear: () => void
  update: (
    timeline: MatchTimeline,
    records: readonly MoveFeedbackRecord[],
    paused: boolean,
  ) => void
  close: () => void
}>

export default function createMoveReactionController(
  initial: MatchTimeline,
  providedActor?: ActorRefFrom<typeof moveReactionMachine>,
): MoveReactionController {
  const actor = providedActor ?? createActor(moveReactionMachine).start()
  let previous = initial
  const eligible = new Set<string>()
  const clear = (): void => {
    eligible.clear()
    actor.send({ type: "MOVE_REACTION.CLEARED" })
  }
  return {
    actor,
    clear,
    update: (
      timeline: MatchTimeline,
      records: readonly MoveFeedbackRecord[],
      paused: boolean,
    ): void => {
      const before = previous
      previous = timeline
      const branchChanged = before.transitions.some((transition, index) => {
        const current = timeline.transitions[index]
        return (
          current === undefined ||
          current.move.id !== transition.move.id ||
          current.before.fen !== transition.before.fen
        )
      })
      const newMove =
        timeline.transitions !== before.transitions &&
        timeline.cursor > before.cursor &&
        timeline.cursor === timeline.transitions.length
      if (
        paused ||
        branchChanged ||
        (!newMove && timeline.cursor !== before.cursor) ||
        (newMove && before.cursor < before.transitions.length)
      )
        clear()
      if (newMove && !paused)
        for (let index = before.cursor; index < timeline.cursor; index += 1) {
          const transition = timeline.transitions[index]
          if (transition !== undefined)
            eligible.add(
              `${String(index + 1)}/${transition.before.fen}/${transition.move.id}`,
            )
        }
      for (const record of records) {
        const id = `${String(record.ply)}/${record.beforeFen}/${record.moveId}`
        const transition = timeline.transitions[record.ply - 1]
        if (
          !eligible.has(id) ||
          transition === undefined ||
          record.afterFen !== transition.after.fen ||
          record.policyId !== MOVE_CLASSIFICATION_POLICY_ID
        )
          continue
        eligible.delete(id)
        if (paused || record.ply > timeline.cursor) continue
        actor.send({
          type: "MOVE_REACTION.RECEIVED",
          reaction: {
            id,
            ply: record.ply,
            notation: formatMatchMoveNotation(transition.move),
            mover: record.mover,
            classification: {
              grade: record.grade,
              reason: record.reason,
              policyId: record.policyId,
            },
          },
        })
      }
    },
    close: (): void => {
      if (providedActor === undefined) actor.stop()
    },
  }
}
