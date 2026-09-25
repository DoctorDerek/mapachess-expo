"use client"

import { useActorRef } from "@xstate/react"
import { useCallback, useEffect, useRef } from "react"
import { MOVE_CLASSIFICATION_POLICY_ID } from "@mapachess/evaluation/move-classification"
import moveReactionMachine from "@mapachess/evaluation/move-reaction-machine"
import { formatMatchMoveNotation } from "@mapachess/match/match-move"
import type { MatchTimeline } from "@mapachess/match/match-timeline"
import type { MoveFeedbackRecord } from "@mapachess/match/move-feedback"

export default function useMoveReactions(
  timeline: MatchTimeline,
  records: readonly MoveFeedbackRecord[],
  paused: boolean,
) {
  const actor = useActorRef(moveReactionMachine)
  const previous = useRef(timeline)
  const eligible = useRef(new Set<string>())
  const clear = useCallback(() => {
    eligible.current.clear()
    actor.send({ type: "MOVE_REACTION.CLEARED" })
  }, [actor])

  useEffect(() => {
    const visibilityChanged = () => {
      if (document.hidden) clear()
    }
    document.addEventListener("visibilitychange", visibilityChanged)
    return () => {
      document.removeEventListener("visibilitychange", visibilityChanged)
      clear()
    }
  }, [clear])

  useEffect(() => {
    const before = previous.current
    previous.current = timeline
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
      document.hidden ||
      branchChanged ||
      (!newMove && timeline.cursor !== before.cursor) ||
      (newMove && before.cursor < before.transitions.length)
    ) {
      clear()
    }
    if (newMove && !paused && !document.hidden) {
      for (let index = before.cursor; index < timeline.cursor; index += 1) {
        const transition = timeline.transitions[index]
        if (transition)
          eligible.current.add(
            `${String(index + 1)}/${transition.before.fen}/${transition.move.id}`,
          )
      }
    }
    for (const record of records) {
      const id = `${String(record.ply)}/${record.beforeFen}/${record.moveId}`
      const transition = timeline.transitions[record.ply - 1]
      if (
        !eligible.current.has(id) ||
        transition === undefined ||
        record.afterFen !== transition.after.fen ||
        record.policyId !== MOVE_CLASSIFICATION_POLICY_ID
      )
        continue
      eligible.current.delete(id)
      if (paused || document.hidden || record.ply > timeline.cursor) continue
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
  }, [actor, clear, paused, records, timeline])
  return { actor, clear }
}
