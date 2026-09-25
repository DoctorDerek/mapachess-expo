import {
  formatMatchMoveNotation,
  type MatchMoveTransition,
} from "@mapachess/match/match-move"
import type { MoveFeedbackRecord } from "@mapachess/match/move-feedback"
import ClassifiedMoveText from "./ClassifiedMoveText"

export default function ClassifiedMoveHistory({
  transitions,
  records,
}: Readonly<{
  transitions: readonly MatchMoveTransition[]
  records: readonly MoveFeedbackRecord[]
}>) {
  return (
    <section
      aria-labelledby="move-history-title"
      className="bg-mapachito-white rounded-lg p-3 [grid-area:history]"
    >
      <h2
        className="font-display text-mapachito-charcoal text-[1.35rem] leading-none font-black tracking-[0.015em] uppercase"
        id="move-history-title"
      >
        Move History
      </h2>
      {transitions.length === 0 ? (
        <p className="text-mapachito-charcoal mt-3 text-sm leading-[1.55] font-semibold opacity-76">
          No moves yet.
        </p>
      ) : (
        <ol className="border-mapachito-charcoal bg-mapachito-white inset-shadow-mapachito-deep-cyan mt-3 max-h-64 space-y-1 overflow-y-auto rounded-[1rem_0.25rem_1rem_0.25rem] border-3 p-3 text-base inset-shadow-[0.5rem_0_0]">
          {transitions.map((transition, index) => {
            const record = records.find(
              (entry) =>
                entry.ply === index + 1 &&
                entry.moveId === transition.move.id &&
                entry.beforeFen === transition.before.fen &&
                entry.afterFen === transition.after.fen,
            )
            return (
              <li
                className="odd:bg-mapachito-charcoal/6 rounded-lg px-2 py-1.5 wrap-anywhere"
                key={`${String(index)}-${transition.move.beforeFen}`}
              >
                <ClassifiedMoveText
                  notation={formatMatchMoveNotation(transition.move)}
                  grade={record?.grade ?? null}
                />
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
