import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEventHandler,
  type ReactNode,
} from "react"
import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import parseChallengeSetup from "@mapachess/match/challenge-setup"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import { type MatchSetup } from "@mapachess/match/match-setup"
import stockfishOpponent from "@mapachess/match/stockfish-opponent"
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import {
  timeCategory,
  timeControlLabel,
  UNTIMED,
} from "@mapachess/match/time-control"
import type { PlayerAppearance } from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import {
  playerRatingId,
  startingRatingAssistance,
} from "@mapachess/profile/rating-context"
import {
  canPlayStoryOpponent,
  selectChallengeUnlockedOpponents,
  selectDefaultStoryOpponent,
  type StoryProgress,
} from "@mapachess/profile/story-progress"
import { generateWebChess960Position } from "../../lib/gameplay/webOpponent"
import { webChallengeDifficultyTargets } from "../../lib/gameplay/webOpponentPolicy"
import usePreparedMatchImages from "../../lib/presentation/usePreparedMatchImages"
import MapachessButton from "../presentation/MapachessButton"
import MapachessNotice from "../presentation/MapachessNotice"
import MedalSymbol from "../presentation/MedalSymbol"
import ScrollActions from "../presentation/ScrollActions"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"
import ChallengeAnimalPortrait from "./ChallengeAnimalPortrait"
import Chess960PositionChoice from "./Chess960PositionChoice"
import MatchColorChoices from "./MatchColorChoices"
import MatchSetupEditor, { type SetupEditor } from "./MatchSetupEditor"

export type WebMatchSetupProps = Readonly<{
  header?: ReactNode
  ratings?: MapachessPlayerData["ratings"]
  playerAppearance?: PlayerAppearance
  onPlayerAnimalChanged?: (animal: StockfishOpponentId) => void
  autoHintMode: AutoHintMode
  challengeHistory: MapachessPlayerData["challengeHistory"]
  disabled: boolean
  opening?: boolean
  onAutoHintModeChanged: (mode: AutoHintMode) => void
  onBack: () => void
  onStart: (setup: MatchSetup) => void
  setup: MatchSetup
  storyProgress: StoryProgress
  visible: boolean
  editing: SetupEditor | null
  onEditorOpened: (editor: SetupEditor) => void
  onEditorClosed: () => void
}>

function MatchSetupChoice({
  label,
  value,
  detail,
  preview,
  actionLabel,
  disabled,
  onChange,
}: Readonly<{
  label: string
  value: string
  detail?: string | undefined
  preview?: ReactNode
  actionLabel: string
  disabled: boolean
  onChange: MouseEventHandler<HTMLButtonElement>
}>) {
  const copy = useMapachessCopy().setup
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {preview === undefined ? null : (
        <span className="pointer-events-none block size-16 shrink-0">
          {preview}
        </span>
      )}
      <div className="flex min-w-0 flex-1 basis-40 flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 basis-16 wrap-break-word">
          <p className="text-sm font-semibold">{label}</p>
          <p className="font-display text-xl leading-tight font-black">
            {value}
          </p>
          {detail === undefined ? null : (
            <p className="font-semibold">{detail}</p>
          )}
        </div>
        <MapachessButton
          aria-haspopup="dialog"
          aria-label={actionLabel}
          className="px-2! py-2! text-base"
          disabled={disabled}
          onClick={onChange}
          type="button"
          variant="secondary"
        >
          {copy.change}
        </MapachessButton>
      </div>
    </div>
  )
}

export default function WebMatchSetup({
  header,
  autoHintMode,
  challengeHistory,
  disabled,
  opening = false,
  onAutoHintModeChanged,
  onBack,
  onStart,
  setup,
  storyProgress,
  visible,
  editing,
  onEditorOpened,
  onEditorClosed,
  playerAppearance,
  onPlayerAnimalChanged,
  ratings,
}: WebMatchSetupProps) {
  const catalog = useMapachessCopy()
  const animalCopy = catalog.animals
  const copy = catalog.setup
  const clockCopy = catalog.gameplay.clock
  const [timeControl, setTimeControl] = useState(setup.timeControl ?? UNTIMED)
  const category = timeCategory(timeControl)
  const challenge = setup.mode === "challenge" ? setup.challengeSetup : null
  const variant =
    setup.mode === "story" ? setup.variant : setup.challengeSetup.variant
  const [numberedPosition, setNumberedPosition] = useState(
    challenge?.variant === "chess960" && challenge.chess960PositionId !== null,
  )
  const [positionNumber, setPositionNumber] = useState(() =>
    String(
      challenge?.chess960PositionId ??
        (setup.mode === "challenge"
          ? setup.displayedChess960PositionId
          : undefined) ??
        "",
    ),
  )
  const [invalidSetup, setInvalidSetup] = useState(false)
  const editorTrigger = useRef<HTMLButtonElement | null>(null)
  const openEditor = (
    editor: SetupEditor,
    trigger: HTMLButtonElement,
  ): void => {
    trigger.focus({ preventScroll: true })
    editorTrigger.current = trigger
    onEditorOpened(editor)
  }
  useEffect(() => {
    if (!visible) {
      editorTrigger.current = null
      return
    }
    if (editing !== null || disabled || opening) return
    editorTrigger.current?.focus({ preventScroll: true })
    editorTrigger.current = null
  }, [disabled, editing, opening, visible])
  const [selectedOpponentId, setSelectedOpponentId] = useState(() =>
    setup.mode === "story"
      ? (setup.opponentId ?? selectDefaultStoryOpponent(storyProgress, variant))
      : setup.challengeSetup.opponentId,
  )
  const difficultyTargets = webChallengeDifficultyTargets(variant)
  const [difficultyTargetElo, setDifficultyTargetElo] = useState(
    challenge?.difficultyTargetElo,
  )
  const challengeOpponents = selectChallengeUnlockedOpponents(storyProgress)
  const opponent = stockfishOpponent(selectedOpponentId)
  const playerAnimal =
    playerAppearance === undefined
      ? null
      : stockfishOpponent(playerAppearance.animal)
  usePreparedMatchImages(
    selectedOpponentId,
    setup.mode === "story" ? playerAppearance?.animal : "raccoon-stockfish",
  )
  const selectionAvailable =
    setup.mode === "challenge"
      ? challengeOpponents.some(({ id }) => id === selectedOpponentId) &&
        difficultyTargetElo !== undefined &&
        difficultyTargets.includes(difficultyTargetElo)
      : canPlayStoryOpponent(storyProgress, variant, selectedOpponentId)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (visible) heading.current?.focus()
  }, [visible])

  const startMatch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (disabled || opening || editing !== null || !selectionAvailable) return
    if (setup.mode === "story") {
      onStart({ ...setup, timeControl, opponentId: selectedOpponentId })
      return
    }
    const formData = new FormData(event.currentTarget)
    const rawPosition = formData.get("chess960-position")
    const displayedPosition = parseChess960PositionId(
      typeof rawPosition === "string" && rawPosition.trim() !== ""
        ? Number(rawPosition)
        : Number.NaN,
    )
    const parsed = parseChallengeSetup({
      opponentId: selectedOpponentId,
      difficultyTargetElo,
      variant,
      playerColor: formData.get("player-color"),
      chess960PositionId:
        variant === "standard" || !numberedPosition
          ? null
          : typeof rawPosition === "string" && rawPosition.trim() !== ""
            ? Number(rawPosition)
            : Number.NaN,
    })
    if (!parsed.ok || (variant === "chess960" && !displayedPosition.ok)) {
      setInvalidSetup(true)
      return
    }
    setInvalidSetup(false)
    onStart({
      timeControl,
      mode: "challenge",
      challengeSetup: parsed.setup,
      ...(variant === "chess960" && displayedPosition.ok
        ? { displayedChess960PositionId: displayedPosition.positionId }
        : {}),
    })
  }

  return (
    <section
      aria-labelledby="match-setup-title"
      className="mx-auto h-full min-h-0 w-full max-w-3xl"
    >
      <form onSubmit={startMatch} className="h-full min-h-0 min-w-0 text-base">
        <ScrollActions
          actions={
            <div className="grid grid-cols-2 items-stretch gap-2">
              <MapachessButton
                className="min-w-0 px-0! py-1! text-base wrap-break-word"
                disabled={disabled}
                onClick={onBack}
                variant="secondary"
              >
                {copy.allModes}
              </MapachessButton>
              <MapachessButton
                className="min-w-0 px-0! py-1! text-base wrap-break-word"
                aria-busy={opening}
                busyLabel={copy.openingMatch}
                disabled={disabled || !selectionAvailable}
                type="submit"
              >
                <span aria-hidden="true">▶ </span>
                {copy.startMatch}
              </MapachessButton>
            </div>
          }
        >
          {header}
          <h1
            className="font-display text-mapachito-white mb-4 text-2xl leading-tight font-black"
            id="match-setup-title"
            ref={heading}
            tabIndex={-1}
          >
            {copy.presentations[variant][setup.mode].title}
          </h1>
          <div className="grid min-w-0 gap-3">
            <div className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal grid gap-5 rounded-xl border-3 p-4">
              {setup.mode === "story" &&
              playerAnimal !== null &&
              onPlayerAnimalChanged !== undefined ? (
                <MatchSetupChoice
                  label={copy.color}
                  value={animalCopy.names[playerAnimal.id]}
                  actionLabel={copy.playAsAction(
                    animalCopy.names[playerAnimal.id],
                  )}
                  disabled={disabled || opening}
                  onChange={(event) =>
                    openEditor("player", event.currentTarget)
                  }
                  preview={
                    <ChallengeAnimalPortrait
                      compact
                      key={playerAnimal.id}
                      active={visible && editing === null}
                      opponent={playerAnimal}
                    />
                  }
                />
              ) : null}
              <MatchSetupChoice
                label={copy.opponent}
                value={animalCopy.opponent(opponent.id)}
                detail={
                  setup.mode === "story"
                    ? copy.elo(String(opponent.storyTargetElo))
                    : undefined
                }
                actionLabel={
                  setup.mode === "story"
                    ? copy.changeStoryOpponent
                    : copy.changeAnimal
                }
                disabled={disabled || opening}
                onChange={(event) =>
                  openEditor("opponent", event.currentTarget)
                }
                preview={
                  <ChallengeAnimalPortrait
                    compact
                    key={opponent.id}
                    active={visible && editing === null}
                    opponent={opponent}
                  />
                }
              />

              {challenge === null ? null : (
                <>
                  <MatchSetupChoice
                    label={copy.difficultyLabel}
                    value={copy.elo(String(difficultyTargetElo))}
                    actionLabel={copy.changeDifficulty}
                    disabled={disabled || opening}
                    onChange={(event) =>
                      openEditor("difficulty", event.currentTarget)
                    }
                  />
                  <MatchColorChoices
                    disabled={disabled || opening}
                    initialColor={challenge.playerColor}
                  />
                </>
              )}
              {challenge?.variant === "chess960" ? (
                <Chess960PositionChoice
                  disabled={disabled || opening}
                  numberedPosition={numberedPosition}
                  onChanged={(value) => {
                    setPositionNumber(value)
                    setNumberedPosition(true)
                  }}
                  onRandomize={() => {
                    setPositionNumber(
                      String(generateWebChess960Position(globalThis.crypto)),
                    )
                    setNumberedPosition(false)
                  }}
                  value={positionNumber}
                />
              ) : null}
              <MatchSetupChoice
                label={copy.betterHints}
                value={copy.autoHints[autoHintMode].label}
                actionLabel={copy.changeHints}
                disabled={disabled || opening}
                onChange={(event) => openEditor("hints", event.currentTarget)}
              />
              <MatchSetupChoice
                label={clockCopy.timeControl}
                value={timeControlLabel(timeControl, clockCopy)}
                actionLabel={clockCopy.change}
                disabled={disabled || opening}
                onChange={(event) =>
                  openEditor("time-control", event.currentTarget)
                }
              />
              {ratings === undefined ? null : (
                <p className="font-bold">
                  <MedalSymbol medal={startingRatingAssistance(autoHintMode)} />
                  {catalog.profile.rating(
                    clockCopy.rating(
                      copy.variants[variant],
                      clockCopy.category[category],
                      catalog.shared.story.medals[
                        startingRatingAssistance(autoHintMode)
                      ],
                    ),
                    ratings[
                      playerRatingId(
                        variant,
                        category,
                        startingRatingAssistance(autoHintMode),
                      )
                    ],
                  )}
                </p>
              )}
            </div>

            {!selectionAvailable ? (
              <MapachessNotice role="status" tone="warning">
                {copy.unavailableSelection}
              </MapachessNotice>
            ) : null}
            {invalidSetup ? (
              <MapachessNotice role="alert" tone="warning">
                {copy.invalidSetup}
              </MapachessNotice>
            ) : null}
            {challenge === null ? (
              <p className="text-mapachito-white text-sm">{copy.randomColor}</p>
            ) : null}
          </div>
        </ScrollActions>
        {editing === null ? null : (
          <MatchSetupEditor
            key={editing}
            editor={editing}
            active={visible}
            disabled={disabled || opening}
            mode={setup.mode}
            variant={variant}
            storyProgress={storyProgress}
            challengeHistory={challengeHistory}
            difficultyTargets={difficultyTargets}
            initialValues={{
              player: playerAppearance?.animal,
              opponent: selectedOpponentId,
              difficulty: difficultyTargetElo,
              hints: autoHintMode,
              "time-control": timeControl,
            }}
            onCancel={onEditorClosed}
            onDone={(values) => {
              switch (editing) {
                case "player":
                  if (values.player !== undefined)
                    onPlayerAnimalChanged?.(values.player)
                  break
                case "opponent":
                  setSelectedOpponentId(values.opponent)
                  break
                case "difficulty":
                  setDifficultyTargetElo(values.difficulty)
                  break
                case "hints":
                  onAutoHintModeChanged(values.hints)
                  break
                case "time-control":
                  setTimeControl(values["time-control"])
                  break
              }
              onEditorClosed()
            }}
          />
        )}
      </form>
    </section>
  )
}
