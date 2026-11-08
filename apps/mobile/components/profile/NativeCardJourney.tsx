import cx from "classix"
import { useEffect, useState } from "react"
import { View } from "react-native"
import { createActor, type ActorRefFrom } from "xstate"
import type {
  MatchNavigationCommands,
  MatchNavigationOverlay,
} from "@mapachess/match/match-navigation"
import { STOCKFISH_OPPONENTS } from "@mapachess/match/stockfish-opponent"
import { TIME_CATEGORIES } from "@mapachess/match/time-control"
import dressingRoomChoices, {
  DRESSING_CATEGORIES,
  type DressingCategory,
  type DressingChoice,
} from "@mapachess/profile/dressing-room-choices"
import { MATCH_MEDALS } from "@mapachess/profile/match-medal"
import {
  eligiblePlayerAnimals,
  type PlayerAppearance,
} from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import profileCardEditorMachine, {
  isProfileCardEditorDirty,
} from "@mapachess/profile/profile-card-editor-machine"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import type { ProfileActor } from "@mapachess/profile/profile-runtime"
import useActorSnapshot from "@/lib/useActorSnapshot"
import NativeAnimal from "../presentation/NativeAnimal"
import NativeButton from "../presentation/NativeButton"
import NativeMedal from "../presentation/NativeMedal"
import NativePanel from "../presentation/NativePanel"
import NativeText from "../presentation/NativeText"
import NativeCardShare from "./NativeCardShare"
import { useNativeLocale } from "./NativeLocaleProvider"
import NativePlayerArtwork from "./NativePlayerArtwork"
import NativeProfileCard from "./NativeProfileCard"

function ReadyCardJourney({
  editor,
  actor,
  data,
  overlays,
  navigation,
}: Readonly<{
  editor: ActorRefFrom<typeof profileCardEditorMachine>
  actor: ProfileActor
  data: MapachessPlayerData
  overlays: readonly MatchNavigationOverlay[]
  navigation: MatchNavigationCommands
}>) {
  const { copy } = useNativeLocale()
  const snapshot = useActorSnapshot(editor)
  const profile = useActorSnapshot(actor)
  const [category, setCategory] = useState<DressingCategory>("Clothes")
  const dressing = overlays.includes("dressing-room")
  const choosing = overlays.includes("dressing-category")
  const { draft, draftRatingContext } = snapshot.context
  const busy = snapshot.matches("saving") || !profile.matches("ready")
  const dirty = isProfileCardEditorDirty(snapshot.context)
  const choices = dressingRoomChoices(category, draft, copy.profile.dressing)
  const change = (appearance: PlayerAppearance): void =>
    editor.send({ type: "CARD.APPEARANCE_CHANGED", appearance })
  const cancel = (): void => {
    editor.send({ type: "CARD.DISCARD_REQUESTED" })
    navigation.close("dressing-room")
  }
  const leave = (): void => {
    if (busy) return
    if (dirty) editor.send({ type: "CARD.LEAVE_REQUESTED" })
    else cancel()
  }
  if (overlays.at(-1) === "profile-card")
    return (
      <NativeCardShare
        data={data}
        appearance={dressing ? draft : data.appearance}
        ratingContext={
          dressing ? draftRatingContext : data.settings.cardRatingContext
        }
        onBack={navigation.back}
      />
    )
  if (snapshot.matches("confirmingDiscard")) {
    const messages = copy.interface.profileCardJourney
    return (
      <NativePanel
        title={messages.keepYourAppearanceChanges}
        onBack={() => editor.send({ type: "CARD.RETURN_REQUESTED" })}
        actions={
          <>
            <View className="flex-row flex-wrap gap-2">
              <NativeButton
                variant="secondary"
                className="min-w-28 flex-1"
                onPress={() => editor.send({ type: "CARD.RETURN_REQUESTED" })}
              >
                {messages.keepEditing}
              </NativeButton>
              <NativeButton
                className="min-w-28 flex-1"
                onPress={() => editor.send({ type: "CARD.SAVE_REQUESTED" })}
              >
                {messages.saveAppearance}
              </NativeButton>
            </View>
            <NativeButton variant="destructive" onPress={cancel}>
              {messages.discardChanges}
            </NativeButton>
          </>
        }
      >
        <NativeProfileCard
          data={data}
          appearance={draft}
          ratingContext={draftRatingContext}
        />
      </NativePanel>
    )
  }
  const choice = (entry: DressingChoice) => (
    <NativeButton
      key={entry.label}
      disabled={busy}
      variant="secondary"
      className="min-w-28 flex-1 basis-28"
      accessibilityState={{ selected: entry.selected }}
      onPress={() => change(entry.appearance)}
    >
      <View className="bg-profile-card-cyan h-28 w-full overflow-hidden rounded-lg">
        <NativePlayerArtwork appearance={entry.appearance} animal={false} />
      </View>
      <NativeText className="text-center">{entry.label}</NativeText>
    </NativeButton>
  )
  const allowed = eligiblePlayerAnimals(data.storyProgress)
  return (
    <NativePanel
      title={copy.setup.customizeProfile}
      onBack={choosing ? navigation.back : leave}
      actions={
        <>
          {snapshot.matches("failed") ? (
            <>
              <NativeText accessibilityRole="alert">
                {
                  copy.interface.profileDressingRoom
                    .appearanceCouldNotBeSavedLocallyYour
                }
              </NativeText>
              <NativeButton
                onPress={() => {
                  editor.send({ type: "CARD.RETRY_REQUESTED" })
                  actor.send({ type: "PROFILE.PERSISTENCE_RETRY_REQUESTED" })
                }}
              >
                {copy.interface.webGame.retry}
              </NativeButton>
            </>
          ) : null}
          {choosing ? (
            <NativeButton variant="secondary" onPress={navigation.back}>
              {copy.interface.profileDressingRoom.backToCategories}
            </NativeButton>
          ) : null}
          <View className="flex-row gap-2">
            <NativeButton
              className="flex-1"
              variant="secondary"
              disabled={busy}
              onPress={cancel}
            >
              {copy.setup.cancel}
            </NativeButton>
            <NativeButton
              className="flex-1"
              disabled={busy || !dirty}
              onPress={() => editor.send({ type: "CARD.SAVE_REQUESTED" })}
            >
              {copy.interface.profileCardJourney.saveAppearance}
            </NativeButton>
          </View>
        </>
      }
    >
      <View className="gap-4 xl:flex-row">
        <View
          className={cx("min-w-0 flex-1 gap-3 xl:flex", choosing && "hidden")}
        >
          <NativeProfileCard
            data={data}
            appearance={draft}
            ratingContext={draftRatingContext}
          />
          <NativeText className="font-native">
            {copy.profile.cardRatings}
          </NativeText>
          <NativeText>{copy.profile.cardTimeCategory}</NativeText>
          <View className="flex-row flex-wrap gap-2">
            {TIME_CATEGORIES.map((value) => (
              <NativeButton
                key={value}
                variant="secondary"
                className="min-w-28 flex-1"
                disabled={busy}
                accessibilityState={{
                  selected: value === draftRatingContext.category,
                }}
                onPress={() =>
                  editor.send({
                    type: "CARD.RATING_CONTEXT_CHANGED",
                    ratingContext: { ...draftRatingContext, category: value },
                  })
                }
              >
                {copy.gameplay.clock.category[value]}
              </NativeButton>
            ))}
          </View>
          <NativeText>{copy.profile.cardAssistance}</NativeText>
          <View className="flex-row flex-wrap gap-2">
            {MATCH_MEDALS.map((value) => (
              <NativeButton
                key={value}
                variant="secondary"
                className="min-w-24 flex-1"
                disabled={busy}
                accessibilityState={{
                  selected: value === draftRatingContext.assistance,
                }}
                onPress={() =>
                  editor.send({
                    type: "CARD.RATING_CONTEXT_CHANGED",
                    ratingContext: { ...draftRatingContext, assistance: value },
                  })
                }
              >
                <NativeMedal medal={value} />
                <NativeText>{copy.shared.story.medals[value]}</NativeText>
              </NativeButton>
            ))}
          </View>
          <NativeButton
            variant="secondary"
            disabled={busy}
            onPress={() => navigation.open("profile-card")}
          >
            {copy.setup.shareProfile}
          </NativeButton>
        </View>
        <View className="min-w-0 flex-1 gap-3">
          <View
            className={cx(
              "flex-row flex-wrap gap-2 xl:flex",
              choosing && "hidden",
            )}
          >
            {DRESSING_CATEGORIES.map((value) => {
              const preview =
                dressingRoomChoices(
                  value,
                  draft,
                  copy.profile.dressing,
                ).styles.find((entry) => entry.selected)?.appearance ?? draft
              return (
                <NativeButton
                  key={value}
                  className="min-w-28 flex-1 basis-28"
                  variant="secondary"
                  disabled={busy}
                  onPress={() => {
                    setCategory(value)
                    if (!choosing) navigation.open("dressing-category")
                  }}
                >
                  <View className="bg-profile-card-cyan h-28 w-full overflow-hidden rounded-lg">
                    {value === "Animal" ? (
                      <NativeAnimal animal={draft.animal} />
                    ) : (
                      <NativePlayerArtwork
                        appearance={preview}
                        animal={false}
                      />
                    )}
                  </View>
                  <NativeText>
                    {copy.profile.dressing.categories[value]}
                  </NativeText>
                </NativeButton>
              )
            })}
          </View>
          <View className={cx("gap-3 xl:flex", !choosing && "hidden")}>
            <NativeText
              accessibilityRole="header"
              className="font-native text-xl"
            >
              {copy.profile.dressing.categories[category]}
            </NativeText>
            <View className="bg-profile-card-cyan h-36 w-full">
              <NativePlayerArtwork appearance={draft} />
            </View>
            {choices.colors.length > 0 ? (
              <>
                <NativeText>
                  {copy.interface.profileDressingRoom.color}
                </NativeText>
                <View className="flex-row flex-wrap gap-2">
                  {choices.colors.map(choice)}
                </View>
              </>
            ) : null}
            {category === "Animal" ? (
              <View className="flex-row flex-wrap gap-2">
                {STOCKFISH_OPPONENTS.map(({ id }) => (
                  <NativeButton
                    key={id}
                    className="min-w-28 flex-1 basis-28"
                    variant="secondary"
                    disabled={busy || !allowed.includes(id)}
                    accessibilityState={{ selected: id === draft.animal }}
                    onPress={() => change({ ...draft, animal: id })}
                  >
                    <View className="h-24 w-full">
                      <NativeAnimal animal={id} />
                    </View>
                    <NativeText className="text-center">
                      {copy.animals.names[id]}
                    </NativeText>
                    {allowed.includes(id) ? null : (
                      <NativeText className="text-center text-sm">
                        {copy.interface.playerAnimalChoices.locked}
                      </NativeText>
                    )}
                  </NativeButton>
                ))}
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {choices.styles.map(choice)}
              </View>
            )}
          </View>
        </View>
      </View>
    </NativePanel>
  )
}

export default function NativeCardJourney({
  actor,
  data,
  overlays,
  navigation,
}: Readonly<{
  actor: ProfileActor
  data: MapachessPlayerData
  overlays: readonly MatchNavigationOverlay[]
  navigation: MatchNavigationCommands
}>) {
  const [editor, setEditor] = useState<ActorRefFrom<
    typeof profileCardEditorMachine
  > | null>(null)
  useEffect(() => {
    const opened = createActor(profileCardEditorMachine, {
      input: {
        appearance: data.appearance,
        ratingContext: data.settings.cardRatingContext,
        save: (appearance, cardRatingContext) =>
          actor.send({
            type: "PROFILE.APPEARANCE_SAVE_REQUESTED",
            appearance,
            cardRatingContext,
          }),
      },
    }).start()
    const subscription = actor.subscribe((snapshot) => {
      const accepted = selectCurrentPlayerData(snapshot)
      if (accepted !== null)
        opened.send({
          type: "CARD.PROFILE_ACCEPTED",
          appearance: accepted.appearance,
          ratingContext: accepted.settings.cardRatingContext,
        })
      if (snapshot.matches("persistenceFailure"))
        opened.send({ type: "CARD.SAVE_FAILED" })
    })
    setEditor(opened)
    return () => {
      subscription.unsubscribe()
      opened.stop()
    }
  }, [actor])
  return editor === null ? null : (
    <ReadyCardJourney
      editor={editor}
      actor={actor}
      data={data}
      overlays={overlays}
      navigation={navigation}
    />
  )
}
