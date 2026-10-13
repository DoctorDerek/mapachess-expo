import { type MoveGrade } from "@mapachess/match/move-feedback"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

export default function ClassifiedMoveText({
  notation,
  grade,
}: Readonly<{ notation: string; grade: MoveGrade | null }>) {
  const copy = useMapachessCopy()
  return (
    <>
      <span className="font-normal">{notation}</span>
      {grade === null ? null : (
        <>
          {" "}
          <strong className="font-bold">{copy.shared.moveGrades[grade]}</strong>
        </>
      )}
    </>
  )
}
