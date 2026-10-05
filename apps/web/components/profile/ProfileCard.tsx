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

export function ProfileArtwork({
  input,
  exportPreview = false,
  fitStage = false,
}: Readonly<{
  input: CardInput
  exportPreview?: boolean
  fitStage?: boolean
}>) {
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
    let cancelled = false,
      handle = 0,
      last = -1
    setFailure(false)
    void loadCardArtwork(input.appearance, input.content.animal)
      .then((artwork) => {
        if (cancelled) return
        const tick = (time: number): void => {
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
          if (!document.hidden) handle = requestAnimationFrame(tick)
        }
        const resume = (): void => {
          cancelAnimationFrame(handle)
          if (!document.hidden) handle = requestAnimationFrame(tick)
        }
        document.addEventListener("visibilitychange", resume)
        handle = requestAnimationFrame(tick)
        cleanup = () => document.removeEventListener("visibilitychange", resume)
      })
      .catch(() => {
        if (!cancelled) setFailure(true)
      })
    let cleanup = (): void => {}
    return () => {
      cancelled = true
      cancelAnimationFrame(handle)
      cleanup()
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
          "block [image-rendering:pixelated]",
          fitStage
            ? "absolute inset-0 h-full w-full object-contain"
            : "h-auto w-full",
        )}
      />
      {failure ? (
        <div role="alert" className="p-3 text-base">
          <p>Profile artwork could not load.</p>
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="mt-2 underline"
          >
            Retry artwork
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
  const facts = useMemo(() => cardFacts(data), [data])
  const input = useMemo<CardInput>(
    () => ({ appearance, facts, content: INITIAL_CARD_CONTENT, format: "GIF" }),
    [appearance, facts],
  )
  return (
    <section
      aria-label={`Your profile card: Level ${facts.level}, Standard Elo ${facts.standard}, Chess960 Elo ${facts.chess960}`}
      className="[container-type:inline-size] shadow-[0.375rem_0.375rem_0_#009dae]"
    >
      <div className="grid min-h-[max(15rem,56cqw)] grid-cols-[minmax(0,2fr)_minmax(0,3fr)] overflow-hidden text-[#1e1e1e]">
        <dl className="flex flex-col justify-evenly gap-4 bg-[#ffe652] p-[max(0.75rem,3cqw)]">
          {[
            ["Level", facts.level],
            ["Standard Elo", facts.standard],
            ["Chess960 Elo", facts.chess960],
          ].map(([label, value]) => (
            <div
              key={label}
              className={cx(
                "flex min-w-0",
                label === "Level"
                  ? "flex-wrap items-baseline gap-x-1"
                  : "flex-col-reverse",
              )}
            >
              <dt className="text-[max(1rem,3.6cqw)] leading-tight font-bold">
                {label}
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
