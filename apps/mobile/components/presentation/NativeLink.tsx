import { useState } from "react"
import { Linking, View } from "react-native"
import captureError, {
  type ErrorDiagnostic,
} from "@mapachess/diagnostics/error-diagnostic"
import { useNativeLocale } from "../profile/NativeLocaleProvider"
import NativeButton from "./NativeButton"
import NativeText from "./NativeText"

export default function NativeLink({
  url,
  label,
}: Readonly<{ url: string; label: string }>) {
  const [failure, setFailure] = useState<ErrorDiagnostic | null>(null)
  const { copy } = useNativeLocale()
  const open = (): void => {
    void Linking.openURL(url).then(
      () => setFailure(null),
      (error: unknown) => setFailure(captureError(error)),
    )
  }
  return (
    <View className="gap-1">
      <NativeButton variant="secondary" accessibilityRole="link" onPress={open}>
        {label}
      </NativeButton>
      {failure !== null ? (
        <NativeText accessibilityRole="alert">{url}</NativeText>
      ) : null}
      {failure !== null ? (
        <NativeButton variant="secondary" onPress={open}>
          {copy.interface.recoverableView.tryAgain}
        </NativeButton>
      ) : null}
    </View>
  )
}
