"use client"

import cx from "classix"
import { useEffect, useRef, useState } from "react"
import type {
  ProfileCardElements,
  ProfileCardGroupProps,
  ProfileCardTextProps,
} from "@mapachess/application-ui/home-elements"
import SharedProfileCard from "@mapachess/application-ui/profile-card"
import type { PlayerAppearance } from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import type { CardRatingContext } from "@mapachess/profile/rating-context"
import {
  drawCardCharacters,
  drawProfileCard,
  loadCardArtwork,
  type CardInput,
} from "../../lib/presentation/profileCardArtwork"
import {
  CARD_IDLE_FRAME_MILLISECONDS,
  PROFILE_ARTWORK_HEIGHT,
  PROFILE_ARTWORK_WIDTH,
  PROFILE_CARD_HEIGHT,
  PROFILE_CARD_WIDTH,
} from "../../lib/presentation/profileCardFormat"
import loadProfileCardFont from "../../lib/presentation/profileCardTypography"
import MedalSymbol from "../presentation/MedalSymbol"
import { useMapachessCopy, useMapachessLocale } from "./MapachessLocaleProvider"

export function ProfileArtwork({
  input,
  exportPreview = false,
  fitStage = false,
  allowRetry = true,
}: Readonly<{
  input: CardInput
  exportPreview?: boolean
  fitStage?: boolean
  allowRetry?: boolean
}>) {
  const messages = useMapachessCopy().interface.profileCard

  const canvas = useRef<HTMLCanvasElement>(null)
  const [failure, setFailure] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const element = canvas.current
    if (element === null) return
    const context = element.getContext("2d")
    if (context === null) {
      setFailure(true)
      return
    }
    const motion = matchMedia("(prefers-reduced-motion: reduce)")
    let cancelled = false
    let handle: number | undefined
    let last = -1
    let cleanup: (() => void) | undefined
    setFailure(false)
    void Promise.all([
      loadCardArtwork(input, exportPreview),
      exportPreview ? loadProfileCardFont() : undefined,
    ])
      .then(([artwork, fontFamily]) => {
        if (cancelled) return
        const tick = (time: number): void => {
          handle = undefined
          if (cancelled) return
          try {
            const frame =
              input.format === "GIF" && !motion.matches
                ? Math.floor(time / CARD_IDLE_FRAME_MILLISECONDS)
                : 0
            if (frame !== last) {
              last = frame
              context.clearRect(0, 0, element.width, element.height)
              if (exportPreview)
                drawProfileCard(context, artwork, input, frame, fontFamily)
              else
                drawCardCharacters(
                  context,
                  artwork,
                  frame,
                  element.width,
                  element.height,
                )
            }
            if (input.format === "GIF" && !motion.matches && !document.hidden)
              handle = requestAnimationFrame(tick)
          } catch {
            cleanup?.()
            setFailure(true)
          }
        }
        const resume = (): void => {
          if (handle !== undefined) cancelAnimationFrame(handle)
          handle = undefined
          if (!document.hidden) tick(performance.now())
        }
        if (input.format === "GIF") {
          document.addEventListener("visibilitychange", resume)
          motion.addEventListener("change", resume)
          cleanup = () => {
            document.removeEventListener("visibilitychange", resume)
            motion.removeEventListener("change", resume)
          }
        }
        tick(performance.now())
      })
      .catch(() => {
        if (!cancelled) setFailure(true)
      })
    return () => {
      cancelled = true
      if (handle !== undefined) cancelAnimationFrame(handle)
      cleanup?.()
    }
  }, [input, exportPreview, retry])
  return (
    <>
      <canvas
        ref={canvas}
        width={exportPreview ? PROFILE_CARD_WIDTH : PROFILE_ARTWORK_WIDTH}
        height={exportPreview ? PROFILE_CARD_HEIGHT : PROFILE_ARTWORK_HEIGHT}
        aria-hidden="true"
        className={cx(
          "pointer-events-none block",
          !exportPreview && "[image-rendering:pixelated]",
          fitStage
            ? "absolute inset-0 h-full w-full object-contain"
            : "h-auto w-full",
        )}
      />
      {failure ? (
        <span role="alert" className="block p-3 text-base">
          <span className="block">{messages.profileArtworkCouldNotLoad}</span>
          {allowRetry ? (
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
              className="mt-2 underline"
            >
              {messages.retryArtwork}
            </button>
          ) : null}
        </span>
      ) : null}
    </>
  )
}

export default function ProfileCard({
  data,
  appearance = data.appearance,
  ratingContext = data.settings.cardRatingContext,
}: Readonly<{
  data: MapachessPlayerData
  appearance?: PlayerAppearance
  ratingContext?: CardRatingContext
}>) {
  const copy = useMapachessCopy()
  const locale = useMapachessLocale()
  return (
    <SharedProfileCard
      data={data}
      appearance={appearance}
      ratingContext={ratingContext}
      copy={copy}
      locale={locale}
      elements={webProfileCardElements}
    />
  )
}

function CardGroup({
  region,
  description,
  className,
  children,
  rating,
}: ProfileCardGroupProps) {
  const classes = cx(
    className,
    region === "card" && "[container-type:inline-size]",
    region === "body" && "min-h-[max(15rem,56cqw)]",
    region === "facts" && "p-[max(0.75rem,3cqw)]",
    region === "label" && rating && "basis-[11ch]",
    region === "artwork" &&
      "from-profile-card-mint bg-radial-[ellipse_at_50%_70%] from-66% to-transparent to-66%",
  )
  if (region === "card")
    return (
      <section aria-label={description} className={classes}>
        {children}
      </section>
    )
  if (region === "facts") return <dl className={classes}>{children}</dl>
  if (region === "label") return <dt className={classes}>{children}</dt>
  if (region === "context") return <span className={classes}>{children}</span>
  return <div className={classes}>{children}</div>
}

function CardText({ children, className, kind }: ProfileCardTextProps) {
  const classes = cx(
    className,
    kind === "label" && "text-[max(1rem,3.6cqw)]",
    kind === "value" && "text-[max(1rem,9cqw)]",
  )
  return kind === "value" ? (
    <dd className={classes}>{children}</dd>
  ) : (
    <span className={classes}>{children}</span>
  )
}

function CardArtwork({ input }: Readonly<{ input: CardInput }>) {
  return <ProfileArtwork input={input} fitStage />
}

export const webProfileCardElements: ProfileCardElements = {
  Group: CardGroup,
  Text: CardText,
  Artwork: CardArtwork,
  Medal: MedalSymbol,
}
