import { View } from "react-native"
import Svg, { Image } from "react-native-svg"
import {
  coachPortraitFrame,
  type CoachCollectionId,
  type CoachPortraitLabel,
} from "@mapachess/match-presentation/coach-portrait"
import { coachPortraitSource } from "@mapachess/match-presentation/presentation-assets"
import assets from "@/lib/presentation/nativeAssetManifest"
import { useNativeLocale } from "./NativeLocaleProvider"

export default function NativeCoachPortrait({
  collection,
  label,
}: Readonly<{ collection: CoachCollectionId; label: CoachPortraitLabel }>) {
  const { copy } = useNativeLocale()
  const id = coachPortraitSource(label, collection)
  const source = id === null ? undefined : assets.images[id]
  const frame = coachPortraitFrame(collection, label)
  return (
    <View
      accessibilityLabel={
        copy.presentation.coach(copy.profile.coachCollections[collection]) +
        ": " +
        copy.shared.coachPortraitNames[label]
      }
      className="bg-mapachito-violet size-14 overflow-hidden rounded-lg"
    >
      {source === undefined ? null : (
        <Svg
          width="100%"
          height="100%"
          viewBox={`${String(frame.x)} ${String(frame.y)} ${String(frame.size)} ${String(frame.size)}`}
        >
          <Image
            href={source}
            width={frame.sourceSize}
            height={frame.sourceSize}
          />
        </Svg>
      )}
    </View>
  )
}
