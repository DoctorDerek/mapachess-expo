"use client"

import { useActorRef, useSelector } from "@xstate/react"
import { useEffect, useRef } from "react"
import type { ActorRefFrom } from "xstate"
import type {
  MatchNavigationCommands,
  MatchNavigationOverlay,
} from "@mapachess/match/match-navigation"
import profileMachine, {
  selectCurrentPlayerData,
} from "@mapachess/profile/profile-machine"
import profileCardEditorMachine, {
  isProfileCardEditorDirty,
} from "../../lib/presentation/profileCardEditorMachine"
import RecoverableView from "../presentation/RecoverableView"
import { useMapachessCopy } from "./MapachessLocaleProvider"
import ProfileAction from "./ProfileAction"
import ProfileCardPreview from "./ProfileCardPreview"
import ProfileDressingRoom from "./ProfileDressingRoom"

export default function ProfileCardJourney({
  profileActor,
  overlays,
  navigation,
  blocked,
}: Readonly<{
  profileActor: ActorRefFrom<typeof profileMachine>
  overlays: readonly MatchNavigationOverlay[]
  navigation: MatchNavigationCommands
  blocked: boolean
}>) {
  const copy = useMapachessCopy()
  const messages = copy.interface.profileCardJourney

  const profile = useSelector(profileActor, (current) => current)
  const data = selectCurrentPlayerData(profile)
  if (data === null)
    throw new Error("The profile-card journey requires accepted player data.")
  const editor = useActorRef(profileCardEditorMachine, {
    input: {
      appearance: data.appearance,
      ratingContext: data.settings.cardRatingContext,
      save: (appearance, cardRatingContext) =>
        profileActor.send({
          type: "PROFILE.APPEARANCE_SAVE_REQUESTED",
          appearance,
          cardRatingContext,
        }),
    },
  })
  const snapshot = useSelector(editor, (current) => current)
  const dressing = overlays.includes("dressing-room")
  const preview = overlays.at(-1) === "profile-card"
  const wasDressing = useRef(false)
  const title = useRef<HTMLHeadingElement>(null)
  const open = dressing || preview
  const dirty = isProfileCardEditorDirty(snapshot.context)
  useEffect(() => {
    editor.send({
      type: "CARD.PROFILE_ACCEPTED",
      appearance: data.appearance,
      ratingContext: data.settings.cardRatingContext,
    })
  }, [editor, data.appearance, data.settings.cardRatingContext, profile])
  useEffect(() => {
    if (profile.matches("persistenceFailure"))
      editor.send({ type: "CARD.SAVE_FAILED" })
  }, [editor, profile])
  useEffect(() => {
    if (
      wasDressing.current &&
      !dressing &&
      !preview &&
      isProfileCardEditorDirty(editor.getSnapshot().context)
    ) {
      editor.send({ type: "CARD.LEAVE_REQUESTED" })
      navigation.open("dressing-room")
    }
    wasDressing.current = dressing
  }, [dressing, preview, editor, navigation.open])
  useEffect(() => {
    if (open) title.current?.focus({ preventScroll: true })
  }, [open, preview])
  if (!open) return null
  const busy = snapshot.matches("saving") || !profile.matches("ready")
  return (
    <section
      hidden={blocked}
      inert={blocked}
      aria-labelledby="personal-card-title"
      className="text-mapachito-white bg-mapachito-charcoal fixed inset-0 z-40 overflow-y-auto px-[clamp(1rem,4vw,3rem)] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]"
    >
      <div className="max-w-mapachess mx-auto">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <ProfileAction
            onClick={navigation.back}
            disabled={busy}
            className="bg-mapachito-violet shadow-mapachess-raised shadow-mapachito-raspberry"
          >
            <span aria-hidden="true">←</span> {messages.back}
          </ProfileAction>
          <h1
            id="personal-card-title"
            ref={title}
            tabIndex={-1}
            className="text-2xl font-black outline-none"
          >
            {preview ? copy.setup.shareProfile : copy.setup.customizeProfile}
          </h1>
        </header>
        {snapshot.matches("confirmingDiscard") ? (
          <div
            role="alertdialog"
            aria-labelledby="unsaved-card-title"
            className="mx-auto max-w-xl p-5"
          >
            <h2 id="unsaved-card-title" className="text-2xl font-bold">
              {messages.keepYourAppearanceChanges}
            </h2>
            <div className="mt-5 flex flex-wrap gap-3">
              <ProfileAction
                className="bg-mapachito-violet"
                onClick={() => editor.send({ type: "CARD.RETURN_REQUESTED" })}
              >
                {messages.keepEditing}
              </ProfileAction>
              <ProfileAction
                className="bg-mapachito-green"
                onClick={() => editor.send({ type: "CARD.SAVE_REQUESTED" })}
              >
                {messages.saveAppearance}
              </ProfileAction>
              <ProfileAction
                className="bg-mapachito-raspberry"
                onClick={() => {
                  editor.send({ type: "CARD.DISCARD_REQUESTED" })
                  navigation.back()
                }}
              >
                {messages.discardChanges}
              </ProfileAction>
            </div>
          </div>
        ) : null}
        {preview ? (
          <RecoverableView
            title={messages.theProfileCardPreviewCouldNotBe}
            description={messages.yourAppearanceChangesAreStillHereTry}
          >
            <ProfileCardPreview
              data={data}
              appearance={dressing ? snapshot.context.draft : data.appearance}
              ratingContext={
                dressing
                  ? snapshot.context.draftRatingContext
                  : data.settings.cardRatingContext
              }
              unsaved={dressing && dirty}
            />
          </RecoverableView>
        ) : null}
        {dressing ? (
          <div
            hidden={preview || snapshot.matches("confirmingDiscard")}
            inert={preview || snapshot.matches("confirmingDiscard")}
          >
            <RecoverableView
              title={messages.customizationCouldNotBeDisplayed}
              description={messages.yourAppearanceChangesAreStillHereTry2}
            >
              <ProfileDressingRoom
                active={
                  !preview && !snapshot.matches("confirmingDiscard") && !blocked
                }
                data={data}
                draft={snapshot.context.draft}
                ratingContext={snapshot.context.draftRatingContext}
                onRatingContextChanged={(ratingContext) =>
                  editor.send({
                    type: "CARD.RATING_CONTEXT_CHANGED",
                    ratingContext,
                  })
                }
                dirty={dirty}
                busy={busy}
                failed={snapshot.matches("failed")}
                onChange={(appearance) =>
                  editor.send({ type: "CARD.APPEARANCE_CHANGED", appearance })
                }
                onSave={() => editor.send({ type: "CARD.SAVE_REQUESTED" })}
                onCancel={() => {
                  editor.send({ type: "CARD.DISCARD_REQUESTED" })
                  navigation.back()
                }}
                onShare={() => navigation.open("profile-card")}
                onRetry={() => {
                  editor.send({ type: "CARD.RETRY_REQUESTED" })
                  profileActor.send({
                    type: "PROFILE.PERSISTENCE_RETRY_REQUESTED",
                  })
                }}
              />
            </RecoverableView>
          </div>
        ) : null}
      </div>
    </section>
  )
}
