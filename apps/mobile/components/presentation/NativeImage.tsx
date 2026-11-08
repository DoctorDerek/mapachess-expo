import { Image, View, type ImageProps } from "react-native"
import { SvgXml } from "react-native-svg"
import assets from "@/lib/presentation/nativeAssetManifest"

export default function NativeImage({
  sourceId,
  onError,
  ...props
}: Omit<ImageProps, "source" | "onError"> &
  Readonly<{ sourceId: string; onError?: () => void }>) {
  const vector = assets.svg[sourceId]
  if (vector !== undefined)
    return (
      <View
        className={props.className}
        accessible={props.accessible}
        accessibilityLabel={props.accessibilityLabel}
      >
        <SvgXml xml={vector} width="100%" height="100%" onError={onError} />
      </View>
    )
  const source = assets.images[sourceId]
  return source === undefined ? null : (
    <Image {...props} source={source} resizeMode="contain" onError={onError} />
  )
}
