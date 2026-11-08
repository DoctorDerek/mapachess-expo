import { Suspense, useState } from "react"
import { View } from "react-native"
import type { ProfileActor } from "@mapachess/profile/profile-runtime"
import useNativeFirstArrival, {
  DeferredNativeArrivalAnimation,
} from "@/lib/presentation/useNativeFirstArrival"
import NativeButton from "../presentation/NativeButton"
import NativeImage from "../presentation/NativeImage"
import NativeLink from "../presentation/NativeLink"
import { NativeScrollActions } from "../presentation/NativePanel"
import NativeText from "../presentation/NativeText"
import NativeLanguageChoices from "./NativeLanguageChoices"
import { useNativeLocale } from "./NativeLocaleProvider"

export default function NativeIntroduction({
  actor,
  pending,
}: Readonly<{ actor: ProfileActor; pending: boolean }>) {
  const { copy, locale } = useNativeLocale()
  const introduction = copy.introduction
  const [painted, setPainted] = useState(false)
  const animation = useNativeFirstArrival(painted)
  return (
    <View
      className="bg-mapachito-white flex-1"
      onLayout={() => setPainted(true)}
    >
      <NativeScrollActions
        actions={
          <>
            <NativeLanguageChoices
              light
              disabled={pending}
              onChange={(language) =>
                actor.send({ type: "PROFILE.LOCALE_CHANGED", locale: language })
              }
            />
            <NativeButton
              disabled={pending}
              onPress={() =>
                actor.send({ type: "PROFILE.INTRODUCTION_COMPLETED", locale })
              }
            >
              {pending ? introduction.starting : introduction.start}
            </NativeButton>
          </>
        }
      >
        <NativeText
          accessibilityRole="header"
          className="font-native text-mapachito-deep-cyan text-center text-5xl"
        >
          {introduction.title}
        </NativeText>
        <View className="bg-mapachito-deep-cyan h-1" />
        <NativeText className="font-native text-mapachito-charcoal text-2xl">
          {introduction.heading}
        </NativeText>
        {introduction.paragraphs.map(({ lead, body }, index) => (
          <NativeText key={index} className="text-mapachito-charcoal text-lg">
            <NativeText className="font-native text-mapachito-charcoal text-lg">
              {lead}{" "}
            </NativeText>
            {body}
          </NativeText>
        ))}
        <View className="bg-mapachito-deep-cyan h-1" />
        <View className="min-h-40 items-center justify-center bg-black p-4">
          <NativeImage
            sourceId="/first-arrival/ice-cream.png"
            className="absolute inset-0 h-full w-full opacity-45"
          />
          {animation.visible ? (
            <Suspense fallback={null}>
              <DeferredNativeArrivalAnimation
                onUnavailable={animation.cancel}
              />
            </Suspense>
          ) : null}
          <NativeText className="font-native text-center text-xl">
            {introduction.credit}
          </NativeText>
          <NativeText className="font-native text-center text-xl">
            {introduction.author}
          </NativeText>
          <NativeLink
            url="https://DoctorDerek.com"
            label={introduction.website}
          />
        </View>
      </NativeScrollActions>
    </View>
  )
}
