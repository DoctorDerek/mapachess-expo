"use client"

import { useActorRef, useSelector } from "@xstate/react"
import cx from "classix"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import type { PlayerAppearance } from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import type { CardRatingContext } from "@mapachess/profile/rating-context"
import {
  cardFacts,
  INITIAL_CARD_CONTENT,
  type CardContent,
} from "../../lib/presentation/profileCardArtwork"
import { saveProfileCardFile } from "../../lib/presentation/profileCardExport"
import profileCardExportMachine from "../../lib/presentation/profileCardExportMachine"
import ScrollActions from "../presentation/ScrollActions"
import { useMapachessCopy, useMapachessLocale } from "./MapachessLocaleProvider"
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
  ratingContext,
  unsaved,
  onBack,
  heading,
}: Readonly<{
  data: MapachessPlayerData
  appearance: PlayerAppearance
  ratingContext: CardRatingContext
  unsaved: boolean
  heading?: ReactNode
  onBack: () => void
}>) {
  const copy = useMapachessCopy()
  const locale = useMapachessLocale()
  const messages = copy.interface.profileCardPreview

  const [format, setFormat] = useState<"GIF" | "PNG">("GIF")
  const [content, setContent] = useState<CardContent>(INITIAL_CARD_CONTENT)
  const [message, setMessage] = useState<
    "shared" | "shareFailed" | "downloadRequested" | "downloadFailed" | null
  >(null)
  const [sharing, setSharing] = useState(false)
  const input = useMemo(
    () => ({
      appearance,
      facts: cardFacts(data, ratingContext),
      content,
      format,
      locale,
    }),
    [appearance, data, ratingContext, content, format, locale],
  )
  const actor = useActorRef(profileCardExportMachine, { input })
  const snapshot = useSelector(actor, (current) => current)
  useEffect(() => {
    setMessage(null)
    actor.send({ type: "CARD.PREVIEW_CHANGED", input })
  }, [actor, input])
  const file = snapshot.matches("ready") ? snapshot.context.file : null
  const shareAvailable = canShareProfileCard(file)
  const share = async (): Promise<void> => {
    if (file === null || !shareAvailable || sharing) return
    setSharing(true)
    setMessage(null)
    try {
      await navigator.share({ files: [file] })
      setMessage("shared")
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setMessage("shareFailed")
    } finally {
      setSharing(false)
    }
  }
  return (
    <ScrollActions
      className="mx-auto w-full max-w-5xl"
      actions={
        <>
          <div
            role="group"
            aria-label={messages.imageFormat}
            className="mb-3 grid grid-cols-2 items-stretch gap-3"
          >
            {(["GIF", "PNG"] as const).map((choice) => (
              <ProfileAction
                key={choice}
                aria-pressed={format === choice}
                aria-label={copy.profile.cardFormats[choice]}
                onClick={() => setFormat(choice)}
                disabled={sharing}
                className={cx(
                  "bg-mapachito-blue shadow-mapachess-raised shadow-mapachito-deep-cyan min-h-11! min-w-0 px-2! py-2! text-base!",
                  format === choice &&
                    "ring-offset-mapachito-charcoal ring-2 ring-white ring-offset-4",
                )}
              >
                {choice}
              </ProfileAction>
            ))}
          </div>
          <div className="flex flex-wrap-reverse gap-1 [&>button]:min-h-11 [&>button]:min-w-min [&>button]:flex-1 [&>button]:basis-0">
            <ProfileAction
              onClick={onBack}
              disabled={sharing}
              className="bg-mapachito-charcoal shadow-mapachess-raised shadow-mapachito-violet px-0.5! py-2! text-base!"
            >
              {copy.interface.profileCardJourney.back}
            </ProfileAction>
            {snapshot.matches("failed") ? (
              <ProfileAction
                onClick={() => actor.send({ type: "CARD.RETRY_REQUESTED" })}
                className="bg-mapachito-violet px-0.5! py-2! text-base!"
              >
                {copy.profile.retryFormat(format)}
              </ProfileAction>
            ) : (
              <ProfileAction
                onClick={() => {
                  if (file !== null) {
                    try {
                      saveProfileCardFile(file)
                      setMessage("downloadRequested")
                    } catch {
                      setMessage("downloadFailed")
                    }
                  }
                }}
                disabled={file === null || sharing}
                className="bg-mapachito-green shadow-mapachess-raised shadow-mapachito-deep-cyan px-0.5! py-2! text-base!"
              >
                {copy.profile.saveFormat(format)}
              </ProfileAction>
            )}
            {shareAvailable ? (
              <ProfileAction
                onClick={() => void share()}
                disabled={sharing}
                className="bg-mapachito-violet shadow-mapachess-raised shadow-mapachito-raspberry px-0.5! py-2! text-base!"
              >
                {copy.profile.shareFormat(format)}
              </ProfileAction>
            ) : null}
          </div>
        </>
      }
    >
      {heading}
      <div
        role="img"
        aria-label={copy.profile.cardPreview(format)}
        className="shadow-mapachess-raised shadow-profile-card-blue overflow-hidden"
      >
        <ProfileArtwork input={input} exportPreview />
      </div>
      <p className="mt-2 text-base">{copy.profile.cardFormats[format]}</p>
      <fieldset className="my-5 flex flex-wrap gap-x-6 gap-y-2">
        <legend className="sr-only">{messages.includeInYourProfileCard}</legend>
        {(
          [
            ["level", copy.profile.level],
            [
              "standard",
              copy.gameplay.clock.rating(
                copy.profile.ratingLabel.standard,
                copy.gameplay.clock.category[ratingContext.category],
                copy.shared.story.medals[ratingContext.assistance],
              ),
            ],
            [
              "chess960",
              copy.gameplay.clock.rating(
                copy.profile.ratingLabel.chess960,
                copy.gameplay.clock.category[ratingContext.category],
                copy.shared.story.medals[ratingContext.assistance],
              ),
            ],
            ["animal", copy.profile.animalCompanion],
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
              className="accent-profile-card-cyan size-5"
            />
            {label}
          </label>
        ))}
      </fieldset>
      <p role="status" className="my-3 text-base">
        {snapshot.matches("preparing")
          ? copy.profile.preparingFormat(format)
          : (message === "downloadRequested"
              ? copy.profile.downloadRequested(format)
              : message === null
                ? null
                : copy.profile[message]) ||
            (!shareAvailable && file !== null ? copy.profile.saveToShare : "")}
      </p>
      {snapshot.matches("failed") ? (
        <div role="alert" className="mb-3">
          <p>{messages.imagePreparationFailedYourAppearancePreviewChoices}</p>
        </div>
      ) : null}

      {unsaved ? (
        <p className="my-3 text-base">
          {messages.previewingUnsavedAppearanceImageExportDoesNot}
        </p>
      ) : null}
    </ScrollActions>
  )
}
