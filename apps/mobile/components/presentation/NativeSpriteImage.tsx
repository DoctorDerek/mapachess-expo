import Animated, {
  useAnimatedProps,
  type SharedValue,
} from "react-native-reanimated"
import { Image } from "react-native-svg"
import assets from "@/lib/presentation/nativeAssetManifest"

const AnimatedImage = Animated.createAnimatedComponent(Image)

export default function NativeSpriteImage({
  sourceId,
  frameWidth,
  frameHeight,
  frameCount,
  frame,
  onAssetLoaded,
}: Readonly<{
  sourceId: string
  frameWidth: number
  frameHeight: number
  frameCount: number
  frame: number | SharedValue<number>
  onAssetLoaded?: (sourceId: string) => void
}>) {
  const source = assets.images[sourceId]
  const animatedProps = useAnimatedProps(() => ({
    x:
      -(
        Math.floor(typeof frame === "number" ? frame : frame.value) % frameCount
      ) * frameWidth,
  }))
  if (source === undefined) return null
  const props = {
    href: source,
    y: 0,
    width: frameWidth * frameCount,
    height: frameHeight,
    onLoad: () => onAssetLoaded?.(sourceId),
  }
  return typeof frame === "number" ? (
    <Image {...props} x={-(frame % frameCount) * frameWidth} />
  ) : (
    <AnimatedImage {...props} animatedProps={animatedProps} />
  )
}
