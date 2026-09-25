import {
  MOVE_GRADE_LABELS,
  type MoveGrade,
} from "@mapachess/match/move-feedback"

export default function ClassifiedMoveText({
  notation,
  grade,
}: Readonly<{ notation: string; grade: MoveGrade | null }>) {
  return (
    <>
      <span className="font-normal">{notation}</span>
      {grade === null ? null : (
        <>
          {" "}
          <strong className="font-bold">{MOVE_GRADE_LABELS[grade]}</strong>
        </>
      )}
    </>
  )
}
