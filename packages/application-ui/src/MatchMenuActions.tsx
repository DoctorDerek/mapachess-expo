import type { ReactNode } from "react"
import type { ActorRefFrom } from "xstate"
import type { MapachessCatalog } from "@mapachess/localization/catalog"
import matchMachine, {
  selectCanOfferDraw,
  selectCanResign,
  selectDrawOfferResponse,
  selectIsPersistingMutation,
  selectMatchConclusion,
  selectMatchPosition,
  type MatchMachineSnapshot,
} from "@mapachess/match/match-machine"
import type { RecoveryElements } from "./recoveryElements.js"
import type { SetupElements } from "./setupElements.js"

export type MatchMenuSessionActions = Readonly<{
  restarting: boolean
  returning: boolean
  onRestartRequested: () => void
  onMainMenuRequested: () => void
  settings: ReactNode
}>

const pairedActionsClassName = "flex min-w-0 flex-row items-stretch gap-2"
const pairedActionCellClassName =
  "flex min-w-0 flex-1 basis-0 flex-col items-stretch"

export default function MatchMenuActions({
  actor,
  snapshot,
  copy,
  elements,
  sessionActions,
  details,
  closeAction,
  drawAvailable,
  opponentName,
  onOfferDraw,
  onMenuClosed,
}: Readonly<{
  actor: ActorRefFrom<typeof matchMachine>
  snapshot: MatchMachineSnapshot
  copy: MapachessCatalog
  elements: Pick<RecoveryElements, "Action"> &
    Pick<SetupElements, "Group" | "Text">
  sessionActions?: MatchMenuSessionActions | undefined
  details: ReactNode
  closeAction?: ReactNode
  drawAvailable: boolean
  opponentName: string
  onOfferDraw: () => void
  onMenuClosed: () => void
}>) {
  const { Action, Group, Text } = elements
  const messages = copy.interface.matchCommands
  const persisting = selectIsPersistingMutation(snapshot)
  const usesPairedRows = closeAction !== undefined
  const sessionActionSizing = usesPairedRows
    ? { className: "min-w-0 flex-1 basis-0 px-2! text-base wrap-anywhere" }
    : {}
  const outcomeActionSizing = usesPairedRows
    ? {
        className:
          "flex min-w-0 flex-1 basis-0 flex-row items-center justify-center gap-2 px-2! text-base wrap-anywhere",
      }
    : {}
  const restart = sessionActions && (
    <Action
      {...sessionActionSizing}
      variant="secondary"
      busy={sessionActions.restarting}
      busyLabel={copy.setup.restartingMatch}
      onActivate={sessionActions.onRestartRequested}
    >
      {copy.interface.webGame.restartMatch}
    </Action>
  )
  const returnToMenu = sessionActions && (
    <Action
      {...sessionActionSizing}
      variant="secondary"
      busy={sessionActions.returning}
      busyLabel={copy.setup.returningToMenu}
      onActivate={sessionActions.onMainMenuRequested}
    >
      {copy.interface.webGame.returnToMenu}
    </Action>
  )
  const offerDraw = (
    <Action
      {...outcomeActionSizing}
      busy={persisting && drawAvailable}
      disabled={!selectCanOfferDraw(snapshot) || !drawAvailable}
      onActivate={onOfferDraw}
      variant="secondary"
    >
      {usesPairedRows && (
        <Text kind="text" decorative className="text-xl">
          ½
        </Text>
      )}
      {messages.offerDraw}
    </Action>
  )
  const drawResponse = selectDrawOfferResponse(snapshot) === "rejected" && (
    <Text
      kind="text"
      {...(usesPairedRows
        ? { role: "status", className: "text-mapachito-charcoal" }
        : {})}
    >
      {copy.gameplay.drawDeclined(opponentName)}
    </Text>
  )
  const resign = (
    <Action
      {...outcomeActionSizing}
      busy={
        persisting &&
        selectMatchConclusion(snapshot) === null &&
        selectMatchPosition(snapshot).status.type === "playing"
      }
      disabled={!selectCanResign(snapshot)}
      onActivate={() => {
        onMenuClosed()
        actor.send({ type: "MATCH.RESIGN_REQUESTED" })
      }}
      variant="destructive"
    >
      {usesPairedRows && (
        <Text kind="text" decorative className="text-xl">
          ⚑
        </Text>
      )}
      {messages.resign}
    </Action>
  )

  if (!usesPairedRows)
    return (
      <>
        {details}
        {restart}
        {returnToMenu}
        {sessionActions?.settings}
        {offerDraw}
        {drawResponse}
        {resign}
      </>
    )

  return (
    <Group className="flex min-w-0 flex-col gap-2">
      {sessionActions === undefined ? null : (
        <Group className={pairedActionsClassName}>
          {restart}
          {returnToMenu}
        </Group>
      )}
      <Group className={pairedActionsClassName}>
        {offerDraw}
        {resign}
      </Group>
      {drawResponse}
      <Group className={pairedActionsClassName}>
        {sessionActions === undefined ? null : (
          <Group className={pairedActionCellClassName}>
            {sessionActions.settings}
          </Group>
        )}
        <Group className={pairedActionCellClassName}>{closeAction}</Group>
      </Group>
      {details}
    </Group>
  )
}
