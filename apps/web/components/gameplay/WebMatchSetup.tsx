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
import type { PlayerAppearance } from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
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
import AutoHintModeChoices from "../profile/AutoHintModeChoices"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"
import PlayerAnimalChoices from "../profile/PlayerAnimalChoices"
import ChallengeAnimalPortrait from "./ChallengeAnimalPortrait"
import ChallengeDifficultyChoices from "./ChallengeDifficultyChoices"
import ChallengeOpponentChoices from "./ChallengeOpponentChoices"
import Chess960PositionChoice from "./Chess960PositionChoice"
import MatchColorChoices from "./MatchColorChoices"
import MatchSetupPicker from "./MatchSetupPicker"
import StoryLadderProgress from "./StoryLadderProgress"

export type WebMatchSetupProps = Readonly<{
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

type SetupEditor = "opponent" | "difficulty" | "hints" | "player"

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
    <div className="flex min-w-0 items-center gap-3">
      {preview === undefined ? null : (
        <span className="pointer-events-none block size-20 shrink-0">
          {preview}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-28 wrap-anywhere">
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
          className="px-3! py-2! text-base"
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
}: WebMatchSetupProps) {
  const catalog = useMapachessCopy()
  const animalCopy = catalog.animals
  const copy = catalog.setup
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
  const openEditor = (
    editor: SetupEditor,
    trigger: HTMLButtonElement,
  ): void => {
    trigger.focus({ preventScroll: true })
    onEditorOpened(editor)
  }
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
      onStart({ ...setup, opponentId: selectedOpponentId })
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
      mode: "challenge",
      challengeSetup: parsed.setup,
      ...(variant === "chess960" && displayedPosition.ok
        ? { displayedChess960PositionId: displayedPosition.positionId }
        : {}),
    })
  }

  return (
    <section aria-labelledby="match-setup-title" className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <MapachessButton
          disabled={disabled}
          onClick={onBack}
          variant="secondary"
        >
          <span aria-hidden="true">← </span>
          {copy.allModes}
        </MapachessButton>
        <h1
          className="font-display text-mapachito-white text-2xl leading-tight font-black"
          id="match-setup-title"
          ref={heading}
          tabIndex={-1}
        >
          {copy.presentations[variant][setup.mode].title}
        </h1>
      </div>
      <form onSubmit={startMatch} className="grid gap-3 text-base">
        <div className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal grid gap-5 rounded-xl border-3 p-4">
          {setup.mode === "story" &&
          playerAnimal !== null &&
          onPlayerAnimalChanged !== undefined ? (
            <MatchSetupChoice
              label={copy.color}
              value={animalCopy.names[playerAnimal.id]}
              actionLabel={copy.playAsAction(animalCopy.names[playerAnimal.id])}
              disabled={disabled || opening}
              onChange={(event) => openEditor("player", event.currentTarget)}
              preview={
                <ChallengeAnimalPortrait
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
            onChange={(event) => openEditor("opponent", event.currentTarget)}
            preview={
              <ChallengeAnimalPortrait
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
        <p className="text-mapachito-white text-sm">
          {copy.untimed}
          {challenge === null ? ` · ${copy.randomColor}` : null}
        </p>
        <div className="grid py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <MapachessButton
            aria-busy={opening}
            busyLabel={copy.openingMatch}
            disabled={disabled || !selectionAvailable}
            type="submit"
          >
            <span aria-hidden="true">▶ </span>
            {copy.startMatch}
          </MapachessButton>
        </div>

        {editing === null ? null : (
          <MatchSetupPicker
            onDone={onEditorClosed}
            title={
              editing === "player"
                ? copy.color
                : editing === "hints"
                  ? copy.betterHints
                  : editing === "difficulty"
                    ? copy.chooseDifficulty
                    : copy.chooseOpponent
            }
          >
            {editing === "player" &&
            playerAppearance !== undefined &&
            onPlayerAnimalChanged !== undefined ? (
              <div className="bg-mapachito-charcoal rounded-lg p-3">
                <PlayerAnimalChoices
                  active={visible}
                  presentation="dialog"
                  disabled={disabled || opening}
                  onSelected={onPlayerAnimalChanged}
                  selectedId={playerAppearance.animal}
                  storyProgress={storyProgress}
                />
              </div>
            ) : editing === "hints" ? (
              <AutoHintModeChoices
                autoHintMode={autoHintMode}
                disabled={disabled}
                onAutoHintModeChanged={onAutoHintModeChanged}
              />
            ) : editing === "difficulty" ? (
              <ChallengeDifficultyChoices
                disabled={disabled}
                history={challengeHistory[variant]}
                onSelected={setDifficultyTargetElo}
                selectedElo={difficultyTargetElo}
                targets={difficultyTargets}
              />
            ) : setup.mode === "story" ? (
              <StoryLadderProgress
                progress={storyProgress}
                variant={variant}
                selection={{
                  disabled,
                  opponentId: selectedOpponentId,
                  onSelected: setSelectedOpponentId,
                }}
              />
            ) : (
              <ChallengeOpponentChoices
                disabled={disabled}
                onSelected={setSelectedOpponentId}
                opponents={challengeOpponents}
                selectedId={selectedOpponentId}
              />
            )}
          </MatchSetupPicker>
        )}
      </form>
    </section>
  )
}
