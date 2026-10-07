"use client"

import { useActorRef, useSelector } from "@xstate/react"
import cx from "classix"
import { useEffect, useMemo, useState } from "react"
import type { PlayerAppearance } from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import {
  cardFacts,
  INITIAL_CARD_CONTENT,
  type CardContent,
} from "../../lib/presentation/profileCardArtwork"
import { saveProfileCardFile } from "../../lib/presentation/profileCardExport"
import profileCardExportMachine from "../../lib/presentation/profileCardExportMachine"
import ProfileAction from "./ProfileAction"
import { ProfileArtwork } from "./ProfileCard"

const canShareProfileCard = (file: File | null): boolean => {
  try {
    return (
      file !== null &&
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      typeof navigator.share === "function" &&
      navigator.canShare({ files: [file] })
    )
  } catch {
    return false
  }
}

export default function ProfileCardPreview({
  data,
  appearance,
  unsaved,
}: Readonly<{
  data: MapachessPlayerData
  appearance: PlayerAppearance
  unsaved: boolean
}>) {
  const [format, setFormat] = useState<"GIF" | "PNG">("GIF")
  const [content, setContent] = useState<CardContent>(INITIAL_CARD_CONTENT)
  const [message, setMessage] = useState("")
  const [sharing, setSharing] = useState(false)
  const input = useMemo(
    () => ({ appearance, facts: cardFacts(data), content, format }),
    [appearance, data, content, format],
  )
  const actor = useActorRef(profileCardExportMachine, { input })
  const snapshot = useSelector(actor, (current) => current)
  useEffect(() => {
    setMessage("")
    actor.send({ type: "CARD.PREVIEW_CHANGED", input })
  }, [actor, input])
  const file = snapshot.matches("ready") ? snapshot.context.file : null
  const shareAvailable = canShareProfileCard(file)
  const share = async (): Promise<void> => {
    if (file === null || !shareAvailable || sharing) return
    setSharing(true)
    setMessage("")
    try {
      await navigator.share({ files: [file] })
      setMessage("Shared.")
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setMessage("Sharing did not complete. You can retry or save the file.")
    } finally {
      setSharing(false)
    }
  }
  return (
    <div className="mx-auto max-w-5xl">
      <div
        role="group"
        aria-label="Image format"
        className="mb-5 flex flex-wrap gap-3"
      >
        {(["GIF", "PNG"] as const).map((choice) => (
          <ProfileAction
            key={choice}
            aria-pressed={format === choice}
            onClick={() => setFormat(choice)}
            disabled={sharing}
            className={cx(
              "bg-mapachito-blue shadow-[0.375rem_0.375rem_0_#008b8b]",
              format === choice &&
                "ring-2 ring-white ring-offset-4 ring-offset-[#1e1e1e]",
            )}
          >
            {choice === "GIF" ? "GIF · Animated" : "PNG · Still"}
          </ProfileAction>
        ))}
      </div>
      <div
        role="img"
        aria-label={`Profile card ${format} preview`}
        className="overflow-hidden shadow-[0.375rem_0.375rem_0_#009dae]"
      >
        <ProfileArtwork input={input} exportPreview />
      </div>
      <fieldset className="my-5 flex flex-wrap gap-x-6 gap-y-2">
        <legend className="sr-only">Include in your profile card</legend>
        {(
          [
            ["level", "Level"],
            ["standard", "Standard Elo"],
            ["chess960", "Chess960 Elo"],
            ["animal", "Animal companion"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex min-h-11 cursor-pointer items-center gap-2 text-base"
          >
            <input
              type="checkbox"
              checked={content[key]}
              disabled={sharing}
              onChange={(event) =>
                setContent({ ...content, [key]: event.target.checked })
              }
              className="size-5 accent-[#71dfe7]"
            />
            {label}
          </label>
        ))}
      </fieldset>
      {unsaved ? (
        <p className="my-3 text-base">
          Previewing unsaved appearance. Image export does not save your edits.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <ProfileAction
          onClick={() => {
            if (file !== null) {
              try {
                saveProfileCardFile(file)
                setMessage(`${format} download requested.`)
              } catch {
                setMessage(
                  "The download could not start. Your card is still ready; try saving again.",
                )
              }
            }
          }}
          disabled={file === null || sharing}
          className="bg-mapachito-green shadow-[0.375rem_0.375rem_0_#008b8b]"
        >
          <span aria-hidden="true">↓</span> Save {format}
        </ProfileAction>
        <ProfileAction
          onClick={() => void share()}
          disabled={!shareAvailable || sharing}
          className="bg-mapachito-violet shadow-[0.375rem_0.375rem_0_#9c0052]"
        >
          <span aria-hidden="true">↗</span> Share {format}
        </ProfileAction>
      </div>
      <p role="status" className="mt-4 min-h-6 text-base">
        {snapshot.matches("preparing")
          ? `Preparing ${format}…`
          : message ||
            (!shareAvailable && file !== null
              ? "Save the file to share it with your preferred app."
              : "")}
      </p>
      {snapshot.matches("failed") ? (
        <div role="alert">
          <p>
            Image preparation failed. Your appearance, preview choices, and game
            are unchanged.
          </p>
          <ProfileAction
            onClick={() => actor.send({ type: "CARD.RETRY_REQUESTED" })}
            className="bg-mapachito-violet mt-3"
          >
            Retry {format}
          </ProfileAction>
        </div>
      ) : null}
    </div>
  )
}
