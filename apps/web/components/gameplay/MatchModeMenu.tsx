import { useEffect, useRef } from "react"
import {
  MATCH_MODE_CHOICES,
  MATCH_SETUP_COPY,
  type MatchModeSelection,
} from "@mapachess/match/match-setup"
import MapachessButton from "../presentation/MapachessButton"

export type MatchModeMenuProps = Readonly<{
  disabled: boolean
  onModeSelected: (selection: MatchModeSelection) => void
}>

export default function MatchModeMenu({
  disabled,
  onModeSelected,
}: MatchModeMenuProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])

  return (
    <section aria-labelledby="game-modes-title" className="mx-auto max-w-6xl">
      <div className="mb-4 max-w-3xl">
        <h1
          className="font-display text-mapachito-white text-3xl leading-tight font-black tracking-tight text-balance xl:text-5xl"
          id="game-modes-title"
          ref={heading}
          tabIndex={-1}
        >
          {MATCH_SETUP_COPY.menuTitle}
        </h1>
        <p className="text-mapachito-white mt-2 text-base leading-relaxed">
          {MATCH_SETUP_COPY.menuDescription}
        </p>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {MATCH_MODE_CHOICES.map(({ mode, variant, title, description }) => {
          const titleId = `mode-${variant}-${mode}`
          return (
            <MapachessButton
              aria-describedby={`${titleId}-description`}
              aria-labelledby={titleId}
              className="min-h-24 p-4 text-left xl:p-6"
              disabled={disabled}
              key={titleId}
              onClick={() => onModeSelected({ mode, variant })}
              variant={mode === "story" ? "secondary" : "primary"}
            >
              <span className="flex items-start justify-between gap-4">
                <span
                  className="font-display text-xl leading-tight font-black xl:text-2xl"
                  id={titleId}
                >
                  {title}
                </span>
                <span aria-hidden="true" className="text-3xl">
                  →
                </span>
              </span>
              <span
                className="mt-2 block text-base leading-snug font-medium"
                id={`${titleId}-description`}
              >
                {description}
              </span>
            </MapachessButton>
          )
        })}
      </div>
    </section>
  )
}
