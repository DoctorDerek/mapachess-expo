import Svg, { Image } from "react-native-svg"
import assets from "@/lib/presentation/nativeAssetManifest"

export default function NativeSpriteFrame({
  sourceId,
  frameWidth,
  frameHeight,
  frameCount,
  frame = 0,
  mirror = false,
}: Readonly<{
  sourceId: string
  frameWidth: number
  frameHeight: number
  frameCount: number
  frame?: number
  mirror?: boolean
}>) {
  const source = assets.images[sourceId]
  if (source === undefined) return null
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${String(frameWidth)} ${String(frameHeight)}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <Image
        href={source}
        x={-frame * frameWidth}
        y={0}
        width={frameWidth * frameCount}
        height={frameHeight}
        transform={
          mirror ? `translate(${String(frameWidth)},0) scale(-1,1)` : undefined
        }
      />
    </Svg>
  )
}
