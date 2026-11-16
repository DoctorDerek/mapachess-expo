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

export default function MatchMenuActions({
  actor,
  snapshot,
  copy,
  elements,
  sessionActions,
  details,
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
  drawAvailable: boolean
  opponentName: string
  onOfferDraw: () => void
  onMenuClosed: () => void
}>) {
  const { Action, Group, Text } = elements
  const messages = copy.interface.matchCommands
  const persisting = selectIsPersistingMutation(snapshot)
  return (
    <Group className="flex min-w-0 flex-col gap-3">
      {sessionActions === undefined ? null : (
        <>
          <Action
            variant="secondary"
            busy={sessionActions.restarting}
            busyLabel={copy.setup.restartingMatch}
            onActivate={sessionActions.onRestartRequested}
          >
            {copy.interface.webGame.restartMatch}
          </Action>
          <Action
            variant="secondary"
            busy={sessionActions.returning}
            busyLabel={copy.setup.returningToMenu}
            onActivate={sessionActions.onMainMenuRequested}
          >
            {copy.interface.webGame.returnToMenu}
          </Action>
          {sessionActions.settings}
        </>
      )}
      {details}
      <Action
        busy={persisting && drawAvailable}
        className="min-w-0 px-2! text-base wrap-anywhere"
        disabled={!selectCanOfferDraw(snapshot) || !drawAvailable}
        onActivate={onOfferDraw}
        variant="secondary"
      >
        <Text decorative className="text-xl">
          ½
        </Text>
        {messages.offerDraw}
      </Action>
      {selectDrawOfferResponse(snapshot) === "rejected" ? (
        <Text role="status" className="text-mapachito-charcoal">
          {copy.gameplay.drawDeclined(opponentName)}
        </Text>
      ) : null}
      <Action
        busy={
          persisting &&
          selectMatchConclusion(snapshot) === null &&
          selectMatchPosition(snapshot).status.type === "playing"
        }
        className="min-w-0 px-2! text-base wrap-anywhere"
        disabled={!selectCanResign(snapshot)}
        onActivate={() => {
          onMenuClosed()
          actor.send({ type: "MATCH.RESIGN_REQUESTED" })
        }}
        variant="destructive"
      >
        <Text decorative className="text-xl">
          ⚑
        </Text>
        {messages.resign}
      </Action>
    </Group>
  )
}
