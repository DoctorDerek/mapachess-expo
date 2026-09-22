import { useEffect, useRef, useState, type FormEvent } from "react"
import {
  AUTO_HINT_MODE_PRESENTATION,
  type AutoHintMode,
} from "@mapachess/match/auto-hint-mode"
import parseChallengeSetup from "@mapachess/match/challenge-setup"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import {
  MATCH_SETUP_COPY,
  matchModeLabel,
  type MatchSetup,
} from "@mapachess/match/match-setup"
import stockfishOpponent from "@mapachess/match/stockfish-opponent"
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
import ChallengeAnimalPortrait from "./ChallengeAnimalPortrait"
import ChallengeDifficultyChoices from "./ChallengeDifficultyChoices"
import ChallengeOpponentChoices from "./ChallengeOpponentChoices"
import Chess960PositionChoice from "./Chess960PositionChoice"
import MatchColorChoices from "./MatchColorChoices"
import MatchSetupPicker from "./MatchSetupPicker"
import StoryLadderProgress from "./StoryLadderProgress"

export type WebMatchSetupProps = Readonly<{
  autoHintMode: AutoHintMode
  challengeHistory: MapachessPlayerData["challengeHistory"]
  disabled: boolean
  opening?: boolean
  onAutoHintModeChanged: (mode: AutoHintMode) => void
  onBack: () => void
  onStart: (setup: MatchSetup) => void
  setup: MatchSetup
  storyProgress: StoryProgress
}>

type SetupEditor = "opponent" | "difficulty" | "hints"

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
}: WebMatchSetupProps) {
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
  const [editing, setEditing] = useState<SetupEditor | null>(null)
  const openEditor = (
    editor: SetupEditor,
    trigger: HTMLButtonElement,
  ): void => {
    trigger.focus({ preventScroll: true })
    setEditing(editor)
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
  usePreparedMatchImages(selectedOpponentId)
  const selectionAvailable =
    setup.mode === "challenge"
      ? challengeOpponents.some(({ id }) => id === selectedOpponentId) &&
        difficultyTargetElo !== undefined &&
        difficultyTargets.includes(difficultyTargetElo)
      : canPlayStoryOpponent(storyProgress, variant, selectedOpponentId)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])

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
          {MATCH_SETUP_COPY.allModes}
        </MapachessButton>
        <h1
          className="font-display text-mapachito-white text-2xl leading-tight font-black"
          id="match-setup-title"
          ref={heading}
          tabIndex={-1}
        >
          {matchModeLabel({ mode: setup.mode, variant })}
        </h1>
      </div>
      <form onSubmit={startMatch} className="grid gap-3 text-base">
        <div className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal grid gap-4 rounded-xl border-3 p-4">
          <button
            className="focus-visible:outline-mapachito-violet flex min-w-0 flex-wrap items-center justify-center gap-3 rounded-lg text-left focus-visible:outline-3 focus-visible:outline-offset-2 disabled:opacity-60"
            disabled={disabled || opening}
            onClick={(event) => openEditor("opponent", event.currentTarget)}
            type="button"
          >
            <span className="block h-26 w-24 shrink-0">
              <ChallengeAnimalPortrait
                key={opponent.id}
                active={editing === null}
                opponent={opponent}
              />
            </span>
            <span className="min-w-0 flex-1 basis-32 wrap-anywhere">
              <span className="font-display block text-xl font-black">
                {opponent.displayName}
              </span>
              {setup.mode === "story" ? (
                <span>{opponent.storyTargetElo} Elo</span>
              ) : null}
              <span className="text-mapachito-violet block font-bold">
                {setup.mode === "story"
                  ? "Choose Story opponent"
                  : "Change animal"}
              </span>
            </span>
            <span aria-hidden="true" className="inline-block -scale-x-100">
              ✎
            </span>
          </button>

          {challenge === null ? (
            <p>{MATCH_SETUP_COPY.randomColor}</p>
          ) : (
            <>
              <MapachessButton
                disabled={disabled || opening}
                onClick={(event) =>
                  openEditor("difficulty", event.currentTarget)
                }
                type="button"
                variant="secondary"
              >
                {difficultyTargetElo} Elo · Change difficulty{" "}
                <span aria-hidden="true" className="inline-block -scale-x-100">
                  ✎
                </span>
              </MapachessButton>
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
          <MapachessButton
            disabled={disabled || opening}
            onClick={(event) => openEditor("hints", event.currentTarget)}
            type="button"
            variant="secondary"
          >
            {AUTO_HINT_MODE_PRESENTATION[autoHintMode].label} · Change hints{" "}
            <span aria-hidden="true" className="inline-block -scale-x-100">
              ✎
            </span>
          </MapachessButton>
        </div>

        {!selectionAvailable ? (
          <MapachessNotice role="status" tone="warning">
            {MATCH_SETUP_COPY.unavailableSelection}
          </MapachessNotice>
        ) : null}
        {invalidSetup ? (
          <MapachessNotice role="alert" tone="warning">
            {MATCH_SETUP_COPY.invalidSetup}
          </MapachessNotice>
        ) : null}
        <p className="text-mapachito-white">{MATCH_SETUP_COPY.untimed}</p>
        <div className="grid py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <MapachessButton
            aria-busy={opening}
            busyLabel={MATCH_SETUP_COPY.openingMatch}
            disabled={disabled || !selectionAvailable}
            type="submit"
          >
            <span aria-hidden="true">▶ </span>
            {MATCH_SETUP_COPY.startMatch}
          </MapachessButton>
        </div>

        {editing === null ? null : (
          <MatchSetupPicker
            onDone={() => setEditing(null)}
            title={
              editing === "hints"
                ? "Better Hints"
                : editing === "difficulty"
                  ? "Choose difficulty"
                  : "Choose opponent"
            }
          >
            {editing === "hints" ? (
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
