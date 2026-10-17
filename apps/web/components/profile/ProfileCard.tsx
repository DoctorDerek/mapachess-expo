"use client"

import cx from "classix"
import { useEffect, useMemo, useRef, useState } from "react"
import type { PlayerAppearance } from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import {
  cardFacts,
  drawCardCharacters,
  drawProfileCard,
  INITIAL_CARD_CONTENT,
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
import { useMapachessCopy, useMapachessLocale } from "./MapachessLocaleProvider"

export function ProfileArtwork({
  input,
  exportPreview = false,
  fitStage = false,
}: Readonly<{
  input: CardInput
  exportPreview?: boolean
  fitStage?: boolean
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
    void loadCardArtwork(input.appearance, input.content.animal)
      .then((artwork) => {
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
              if (exportPreview) drawProfileCard(context, artwork, input, frame)
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
          "pointer-events-none block [image-rendering:pixelated]",
          fitStage
            ? "absolute inset-0 h-full w-full object-contain"
            : "h-auto w-full",
        )}
      />
      {failure ? (
        <div role="alert" className="p-3 text-base">
          <p>{messages.profileArtworkCouldNotLoad}</p>
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="mt-2 underline"
          >
            {messages.retryArtwork}
          </button>
        </div>
      ) : null}
    </>
  )
}

export default function ProfileCard({
  data,
  appearance = data.appearance,
}: Readonly<{ data: MapachessPlayerData; appearance?: PlayerAppearance }>) {
  const copy = useMapachessCopy()
  const locale = useMapachessLocale()
  const facts = useMemo(() => cardFacts(data), [data])
  const input = useMemo<CardInput>(
    () => ({
      appearance,
      facts,
      content: INITIAL_CARD_CONTENT,
      format: "GIF",
      locale,
    }),
    [appearance, facts, locale],
  )
  return (
    <section
      aria-label={copy.profile.cardDescription(
        facts.level,
        facts.standard,
        facts.chess960,
      )}
      className="[container-type:inline-size] shadow-[0.375rem_0.375rem_0_#009dae]"
    >
      <div className="grid min-h-[max(15rem,56cqw)] grid-cols-[minmax(0,2fr)_minmax(0,3fr)] overflow-hidden text-[#1e1e1e]">
        <dl className="flex flex-col justify-evenly gap-4 bg-[#ffe652] p-[max(0.75rem,3cqw)]">
          {[
            ["level", copy.profile.level, facts.level],
            ["standard", copy.profile.ratingLabel.standard, facts.standard],
            ["chess960", copy.profile.ratingLabel.chess960, facts.chess960],
          ].map(([kind, label, value]) => (
            <div
              key={kind}
              className={cx(
                "flex min-w-0",
                kind === "level"
                  ? "flex-wrap items-baseline gap-x-1"
                  : "flex-col-reverse",
              )}
            >
              <dt className="text-[max(1rem,3.6cqw)] leading-tight font-bold">
                {label}
                {kind === "level" ? null : (
                  <span className="block text-base">
                    {copy.gameplay.clock.category.untimed}
                  </span>
                )}
              </dt>
              <dd className="font-display mt-1 text-[max(1.75rem,7cqw)] leading-none break-all">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="relative bg-[#71dfe7] bg-[radial-gradient(ellipse_at_50%_70%,#c2fff9_0_66%,transparent_66%)]">
          <ProfileArtwork input={input} fitStage />
        </div>
      </div>
    </section>
  )
}
