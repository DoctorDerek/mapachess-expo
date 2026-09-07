import { useEffect, useRef, useState, type FormEvent } from "react"
import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import parseChallengeSetup from "@mapachess/match/challenge-setup"
import { CHESS960_POSITION_COUNT } from "@mapachess/match/chess960-position"
import {
  MATCH_SETUP_COPY,
  matchModeLabel,
  type MatchSetup,
} from "@mapachess/match/match-setup"
import type { StockfishOpponentDefinition } from "@mapachess/match/stockfish-opponent"
import MapachessButton from "../presentation/MapachessButton"
import MapachessNotice from "../presentation/MapachessNotice"
import AutoHintModeChoices from "../profile/AutoHintModeChoices"

export type WebMatchSetupProps = Readonly<{
  activityMessage: string | null
  autoHintMode: AutoHintMode
  disabled: boolean
  onAutoHintModeChanged: (mode: AutoHintMode) => void
  onBack: () => void
  onStart: (setup: MatchSetup) => void
  opponent: StockfishOpponentDefinition
  setup: MatchSetup
}>

const LAST_CHESS960_POSITION = CHESS960_POSITION_COUNT - 1

export default function WebMatchSetup({
  activityMessage,
  autoHintMode,
  disabled,
  onAutoHintModeChanged,
  onBack,
  onStart,
  opponent,
  setup,
}: WebMatchSetupProps) {
  const challenge = setup.mode === "challenge" ? setup.challengeSetup : null
  const variant =
    setup.mode === "story" ? setup.variant : setup.challengeSetup.variant
  const [numberedPosition, setNumberedPosition] = useState(
    challenge?.variant === "chess960" && challenge.chess960PositionId !== null,
  )
  const [invalidSetup, setInvalidSetup] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])

  const startMatch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (disabled) return
    if (setup.mode === "story") {
      onStart(setup)
      return
    }
    const formData = new FormData(event.currentTarget)
    const rawPosition = formData.get("chess960-position")
    const parsed = parseChallengeSetup({
      variant,
      playerColor: formData.get("player-color"),
      chess960PositionId:
        variant === "standard" || !numberedPosition
          ? null
          : typeof rawPosition === "string" && rawPosition.trim() !== ""
            ? Number(rawPosition)
            : Number.NaN,
    })
    if (!parsed.ok) {
      setInvalidSetup(true)
      return
    }
    setInvalidSetup(false)
    onStart({ mode: "challenge", challengeSetup: parsed.setup })
  }

  return (
    <section aria-labelledby="match-setup-title" className="mx-auto max-w-6xl">
      <MapachessButton disabled={disabled} onClick={onBack} variant="secondary">
        <span aria-hidden="true">← </span>
        {MATCH_SETUP_COPY.allModes}
      </MapachessButton>
      <h1
        className="font-display text-mapachito-white mt-6 mb-8 text-[clamp(2.25rem,6vw,4rem)] leading-tight font-black text-balance"
        id="match-setup-title"
        ref={heading}
        tabIndex={-1}
      >
        {matchModeLabel({ mode: setup.mode, variant })}
      </h1>
      <form
        onSubmit={startMatch}
        className="grid items-start gap-6 xl:grid-cols-2"
      >
        <div className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal rounded-xl border-3 p-[clamp(1.25rem,3vw,2rem)]">
          <h2 className="text-mapachito-violet text-sm font-black uppercase">
            {MATCH_SETUP_COPY.opponent}
          </h2>
          <p className="font-display mt-2 text-3xl font-black">
            {opponent.displayName}
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            {setup.mode === "story"
              ? MATCH_SETUP_COPY.storyAvailability
              : MATCH_SETUP_COPY.challengeAvailability}
          </p>
          <p className="border-mapachito-deep-cyan mt-5 border-l-4 pl-3 text-sm leading-relaxed">
            {MATCH_SETUP_COPY.provisionalDifficulty}
          </p>
          <p className="mt-3 text-sm font-bold">{MATCH_SETUP_COPY.untimed}</p>

          {challenge === null ? (
            <p className="mt-5 text-sm leading-relaxed">
              {MATCH_SETUP_COPY.randomColor}
            </p>
          ) : (
            <fieldset className="mt-6" disabled={disabled}>
              <legend className="text-lg font-black">
                {MATCH_SETUP_COPY.color}
              </legend>
              <div className="mt-3 flex flex-wrap gap-4">
                <label className="border-mapachito-charcoal/30 has-checked:border-mapachito-violet flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3">
                  <input
                    className="accent-mapachito-violet focus-visible:outline-mapachito-violet size-5"
                    defaultChecked={challenge.playerColor === "white"}
                    name="player-color"
                    type="radio"
                    value="white"
                  />
                  {MATCH_SETUP_COPY.white}
                </label>
                <label className="border-mapachito-charcoal/30 has-checked:border-mapachito-violet flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3">
                  <input
                    className="accent-mapachito-violet focus-visible:outline-mapachito-violet size-5"
                    defaultChecked={challenge.playerColor === "black"}
                    name="player-color"
                    type="radio"
                    value="black"
                  />
                  {MATCH_SETUP_COPY.black}
                </label>
              </div>
            </fieldset>
          )}

          {challenge?.variant === "chess960" ? (
            <fieldset className="mt-6" disabled={disabled}>
              <legend className="text-lg font-black">
                {MATCH_SETUP_COPY.position}
              </legend>
              <label className="mt-3 flex min-h-12 cursor-pointer items-center gap-3">
                <input
                  checked={!numberedPosition}
                  className="accent-mapachito-violet focus-visible:outline-mapachito-violet size-5"
                  name="position-choice"
                  onChange={() => setNumberedPosition(false)}
                  type="radio"
                  value="random"
                />
                {MATCH_SETUP_COPY.randomPosition}
              </label>
              <label className="flex min-h-12 cursor-pointer items-center gap-3">
                <input
                  checked={numberedPosition}
                  className="accent-mapachito-violet focus-visible:outline-mapachito-violet size-5"
                  name="position-choice"
                  onChange={() => setNumberedPosition(true)}
                  type="radio"
                  value="numbered"
                />
                {MATCH_SETUP_COPY.numberedPosition}
              </label>
              <label
                className="mt-2 block text-sm font-bold"
                htmlFor="chess960-position"
              >
                {MATCH_SETUP_COPY.positionNumber} (0–{LAST_CHESS960_POSITION})
              </label>
              <input
                className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal focus-visible:outline-mapachito-violet mt-2 min-h-12 w-full rounded-lg border-2 px-4 py-3 disabled:opacity-50"
                defaultValue={challenge.chess960PositionId ?? 0}
                disabled={!numberedPosition}
                id="chess960-position"
                inputMode="numeric"
                max={LAST_CHESS960_POSITION}
                min={0}
                name="chess960-position"
                required={numberedPosition}
                step={1}
                type="number"
              />
            </fieldset>
          ) : null}
        </div>

        <div className="border-mapachito-charcoal bg-mapachito-white rounded-xl border-3 p-[clamp(1.25rem,3vw,2rem)] xl:row-span-2">
          <AutoHintModeChoices
            autoHintMode={autoHintMode}
            disabled={disabled}
            onAutoHintModeChanged={onAutoHintModeChanged}
          />
        </div>

        <div className="grid gap-4 xl:col-start-1 xl:row-start-2">
          {invalidSetup ? (
            <MapachessNotice role="alert" tone="warning">
              {MATCH_SETUP_COPY.invalidSetup}
            </MapachessNotice>
          ) : null}
          {activityMessage === null ? null : (
            <MapachessNotice role="status">{activityMessage}</MapachessNotice>
          )}
          <MapachessButton disabled={disabled} type="submit">
            {MATCH_SETUP_COPY.startMatch}
          </MapachessButton>
        </div>
      </form>
    </section>
  )
}
