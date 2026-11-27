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

export type MatchMenuDecision = "restart" | "resign" | "draw"

const pairedActionsClassName = "grid min-w-0 grid-cols-2 items-stretch gap-1.5"

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
  onDecisionRequested,
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
  onDecisionRequested?: (action: MatchMenuDecision) => void
}>) {
  const { Action, Group, Text } = elements
  const messages = copy.interface.matchCommands
  const persisting = selectIsPersistingMutation(snapshot)
  const usesPairedRows = closeAction !== undefined
  const sessionActionSizing = usesPairedRows
    ? { density: "compact" as const, className: "text-base" }
    : {}
  const outcomeActionSizing = usesPairedRows
    ? {
        density: "compact" as const,
        className:
          "flex min-w-min flex-1 flex-row items-center justify-center gap-1 text-base",
      }
    : {}
  const restart = sessionActions && (
    <Action
      {...sessionActionSizing}
      variant="secondary"
      busy={sessionActions.restarting}
      busyLabel={copy.setup.restartingMatch}
      onActivate={() => {
        if (onDecisionRequested && selectMatchConclusion(snapshot) === null)
          onDecisionRequested("restart")
        else sessionActions.onRestartRequested()
      }}
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
      {usesPairedRows
        ? messages.saveAndExit
        : copy.interface.webGame.returnToMenu}
    </Action>
  )
  const offerDraw = (
    <Action
      {...outcomeActionSizing}
      busy={persisting && drawAvailable}
      disabled={!selectCanOfferDraw(snapshot) || !drawAvailable}
      onActivate={
        onDecisionRequested ? () => onDecisionRequested("draw") : onOfferDraw
      }
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
        if (onDecisionRequested) {
          onDecisionRequested("resign")
          return
        }
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
    <Group className="flex min-w-0 flex-col gap-1.5">
      {sessionActions === undefined ? null : (
        <Group className={pairedActionsClassName}>
          {restart}
          {returnToMenu}
        </Group>
      )}
      <Group className="flex min-w-0 flex-wrap gap-1.5">
        {offerDraw}
        {resign}
      </Group>
      {drawResponse}
      {sessionActions?.settings}
      {details}
      {closeAction}
    </Group>
  )
}
