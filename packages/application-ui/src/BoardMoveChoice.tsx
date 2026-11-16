import type { MapachessCatalog } from "@mapachess/localization/catalog"
import type { BoardMoveChoice as PendingBoardChoice } from "@mapachess/match-presentation/board-interaction-machine"
import {
  MATCH_PROMOTION_ROLES,
  type LegalMatchMove,
  type MatchMoveId,
} from "@mapachess/match/match-move"
import type { MatchColor } from "@mapachess/match/match-position"
import type { BoardElements } from "./boardElements.js"

const choiceLabel = (
  move: LegalMatchMove,
  copy: MapachessCatalog["board"],
): string =>
  move.kind === "castle"
    ? copy.castle(move.san, move.to, move.rookTo)
    : move.promotion === null
      ? copy.moveKing(move.to)
      : copy.promote(move.promotion)

export default function BoardMoveChoice({
  choice,
  color,
  disabled,
  copy,
  elements,
  onCancel,
  onChoose,
}: Readonly<{
  choice: PendingBoardChoice
  color: MatchColor
  disabled: boolean
  copy: MapachessCatalog["board"]
  elements: BoardElements
  onCancel: () => void
  onChoose: (moveId: MatchMoveId) => void
}>) {
  const { Choice, ChoiceAction, Group, Piece } = elements
  const promotion = choice.moves.every(
    (move) => move.kind === "normal" && move.promotion !== null,
  )
  const moves = [...choice.moves].sort((left, right) =>
    left.kind === "normal" &&
    right.kind === "normal" &&
    left.promotion !== null &&
    right.promotion !== null
      ? MATCH_PROMOTION_ROLES.indexOf(left.promotion) -
        MATCH_PROMOTION_ROLES.indexOf(right.promotion)
      : 0,
  )
  const title = promotion
    ? copy.promoteOn(choice.to)
    : copy.chooseMove(choice.to)
  const groups = promotion ? [moves.slice(0, 2), moves.slice(2)] : [moves]
  return (
    <Choice
      title={title}
      onCancel={onCancel}
      actions={
        <ChoiceAction
          label={promotion ? copy.cancelPromotion : copy.cancelMove}
          className="w-full"
          disabled={false}
          first={false}
          onActivate={onCancel}
        >
          {promotion ? copy.cancelPromotion : copy.cancelMove}
        </ChoiceAction>
      }
    >
      <Group
        className={
          promotion
            ? "mt-4 flex flex-row flex-wrap gap-2"
            : "mt-4 flex flex-col gap-2"
        }
      >
        {groups.map((group, groupIndex) => (
          <Group
            key={group[0]?.id}
            kind="choice-row"
            className={
              promotion
                ? "flex min-w-0 flex-1 basis-26 flex-row gap-2"
                : "flex flex-col gap-2"
            }
          >
            {group.map((move, index) => (
              <ChoiceAction
                key={move.id}
                label={choiceLabel(move, copy)}
                disabled={disabled}
                first={groupIndex === 0 && index === 0}
                onActivate={() => onChoose(move.id)}
                className={
                  promotion
                    ? "aspect-square min-w-0 flex-1 items-center justify-center p-1!"
                    : "w-full min-w-0 wrap-anywhere"
                }
              >
                {move.kind === "normal" && move.promotion !== null ? (
                  <Group decorative className="relative aspect-square w-full">
                    <Piece color={color} role={move.promotion} fitToSquare />
                  </Group>
                ) : (
                  choiceLabel(move, copy)
                )}
              </ChoiceAction>
            ))}
          </Group>
        ))}
      </Group>
    </Choice>
  )
}
