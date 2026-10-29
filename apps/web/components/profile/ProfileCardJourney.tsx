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
import { usePlayerInputScope } from "../input/PlayerInputProvider"
import RecoverableView from "../presentation/RecoverableView"
import ScrollActions from "../presentation/ScrollActions"
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
  const root = useRef<HTMLElement>(null)
  const open = dressing || preview
  usePlayerInputScope({
    root,
    enabled: open && !blocked,
    handle: (action) => {
      if (action !== "cancel") return false
      navigation.back()
      return true
    },
  })
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
  const recoveryActions = (
    <ProfileAction
      onClick={navigation.back}
      disabled={busy}
      className="bg-mapachito-violet"
    >
      {messages.back}
    </ProfileAction>
  )
  const heading = (
    <header className="mb-4">
      <h1
        id="personal-card-title"
        ref={title}
        tabIndex={-1}
        className="text-xl leading-tight font-black outline-none"
      >
        {preview ? copy.setup.shareProfile : copy.setup.customizeProfile}
      </h1>
    </header>
  )
  return (
    <section
      ref={root}
      hidden={blocked}
      inert={blocked}
      aria-labelledby={
        snapshot.matches("confirmingDiscard")
          ? "unsaved-card-title"
          : "personal-card-title"
      }
      className="text-mapachito-white bg-mapachito-charcoal fixed inset-0 z-40 overflow-hidden px-2 pt-[max(16px,env(safe-area-inset-top))] pb-[max(8px,env(safe-area-inset-bottom))] [--spacing:4px] xl:px-12"
    >
      <div className="max-w-mapachess mx-auto grid h-full min-h-0 grid-rows-[minmax(0,1fr)]">
        {snapshot.matches("confirmingDiscard") ? (
          <div
            role="alertdialog"
            aria-labelledby="unsaved-card-title"
            className="mx-auto h-full min-h-0 w-full max-w-xl"
          >
            <ScrollActions
              actions={
                <div className="flex flex-wrap-reverse gap-3 [&>button]:min-w-0 [&>button]:flex-1 [&>button]:basis-32">
                  <ProfileAction
                    className="bg-mapachito-violet"
                    onClick={() =>
                      editor.send({ type: "CARD.RETURN_REQUESTED" })
                    }
                  >
                    {messages.keepEditing}
                  </ProfileAction>
                  <ProfileAction
                    className="bg-mapachito-green"
                    onClick={() => editor.send({ type: "CARD.SAVE_REQUESTED" })}
                  >
                    {messages.saveAppearance}
                  </ProfileAction>
                </div>
              }
            >
              <h2 id="unsaved-card-title" className="text-2xl font-bold">
                {messages.keepYourAppearanceChanges}
              </h2>
              <ProfileAction
                className="bg-mapachito-raspberry mt-6"
                onClick={() => {
                  editor.send({ type: "CARD.DISCARD_REQUESTED" })
                  navigation.back()
                }}
              >
                {messages.discardChanges}
              </ProfileAction>
            </ScrollActions>
          </div>
        ) : null}
        {preview ? (
          <div className="h-full min-h-0">
            <RecoverableView
              fillHeight
              title={messages.theProfileCardPreviewCouldNotBe}
              description={messages.yourAppearanceChangesAreStillHereTry}
              actions={recoveryActions}
            >
              <ProfileCardPreview
                heading={heading}
                onBack={navigation.back}
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
          </div>
        ) : null}
        {dressing ? (
          <div
            className="h-full min-h-0"
            hidden={preview || snapshot.matches("confirmingDiscard")}
            inert={preview || snapshot.matches("confirmingDiscard")}
          >
            <RecoverableView
              fillHeight
              title={messages.customizationCouldNotBeDisplayed}
              description={messages.yourAppearanceChangesAreStillHereTry2}
              actions={recoveryActions}
            >
              <ProfileDressingRoom
                editingCategory={overlays.includes("dressing-category")}
                onChooseCategory={() => navigation.open("dressing-category")}
                onCloseCategories={navigation.back}
                heading={preview ? null : heading}
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
                  navigation.close("dressing-room")
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
