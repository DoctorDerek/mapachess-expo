import cx from "classix"
import { useState } from "react"
import { Image, View, type ImageStyle } from "react-native"
import {
  coachPortraitFrame,
  NEUTRAL_COACH_PORTRAIT_LABEL,
  type CoachCollectionId,
  type CoachPortraitLabel,
} from "@mapachess/match-presentation/coach-portrait"
import { coachPortraitSource } from "@mapachess/match-presentation/presentation-assets"
import useNativeArtworkReadiness from "@/lib/presentation/useNativeArtworkReadiness"
import NativeText from "../presentation/NativeText"
import { useNativeLocale } from "./NativeLocaleProvider"

type CoachPose = Readonly<{
  sourceId: string
  collection: CoachCollectionId
  label: CoachPortraitLabel
}>

function coachPose(
  collection: CoachCollectionId,
  label: CoachPortraitLabel,
): CoachPose | null {
  const sourceId = coachPortraitSource(label, collection)
  return sourceId === null ? null : { sourceId, collection, label }
}

function portraitCrop(pose: CoachPose): ImageStyle {
  const { x, y, size, sourceSize } = coachPortraitFrame(
    pose.collection,
    pose.label,
  )
  const sheetPercent = (100 * sourceSize) / size
  return {
    width: `${sheetPercent}%`,
    height: `${sheetPercent}%`,
    left: `${(-100 * x) / size}%`,
    top: `${(-100 * y) / size}%`,
  }
}

export default function NativeCoachPortrait({
  collection,
  label,
}: Readonly<{ collection: CoachCollectionId; label: CoachPortraitLabel }>) {
  const { copy } = useNativeLocale()
  const [retained, setRetained] = useState<CoachPose | null>(null)
  const requested = coachPose(collection, label)
  const neutral = coachPose(collection, NEUTRAL_COACH_PORTRAIT_LABEL)
  const artwork = useNativeArtworkReadiness(
    [requested, neutral, retained].flatMap((pose) =>
      pose === null ? [] : [pose.sourceId],
    ),
  )
  const ready = (pose: CoachPose | null) =>
    pose !== null && artwork.status(pose.sourceId) === "ready"
  const visible = ready(requested)
    ? requested
    : ready(retained)
      ? retained
      : ready(neutral)
        ? neutral
        : null
  if (
    visible !== null &&
    (visible.sourceId !== retained?.sourceId ||
      visible.collection !== retained.collection ||
      visible.label !== retained.label)
  )
    setRetained(visible)
  const visibleCollection = visible?.collection ?? collection
  const visibleLabel = visible?.label ?? NEUTRAL_COACH_PORTRAIT_LABEL
  return (
    <View
      accessibilityLabel={
        copy.presentation.coach(
          copy.profile.coachCollections[visibleCollection],
        ) +
        ": " +
        copy.shared.coachPortraitNames[visibleLabel]
      }
      className="bg-mapachito-violet relative size-14 items-center justify-center overflow-hidden rounded-lg"
    >
      {artwork.layers.map(({ request }) => {
        const shown = visible?.sourceId === request.sourceId ? visible : null
        return (
          <Image
            key={request.sourceId}
            accessible={false}
            className={cx("absolute", shown === null && "size-px opacity-0")}
            fadeDuration={0}
            onLoad={() => artwork.settle(request, "ready")}
            onError={() => artwork.settle(request, "failed")}
            resizeMethod="scale"
            resizeMode="stretch"
            source={request.source}
            style={shown === null ? undefined : portraitCrop(shown)}
          />
        )
      })}
      {visible === null ? (
        <NativeText className="text-mapachito-white font-native text-2xl">
          {copy.profile.coachCollections[collection].slice(0, 1)}
        </NativeText>
      ) : null}
    </View>
  )
}
