import { View } from "react-native"
import {
  LOCALE_LABELS,
  SHIPPED_LOCALES,
  type ShippedLocale,
} from "@mapachess/localization/locale"
import NativeButton from "../presentation/NativeButton"
import NativeText from "../presentation/NativeText"
import { useNativeLocale } from "./NativeLocaleProvider"

export default function NativeLanguageChoices({
  disabled = false,
  light = false,
  onChange,
}: Readonly<{
  disabled?: boolean
  light?: boolean
  onChange: (locale: ShippedLocale) => void
}>) {
  const { locale, copy } = useNativeLocale()
  return (
    <View className="gap-2">
      <NativeText className={light ? "text-mapachito-charcoal" : undefined}>
        {copy.introduction.language}
      </NativeText>
      <View className="flex-row flex-wrap gap-2">
        {SHIPPED_LOCALES.map((choice) => (
          <NativeButton
            key={choice}
            className="min-w-0 flex-1"
            variant={choice === locale ? "primary" : "secondary"}
            disabled={disabled}
            accessibilityState={{ selected: choice === locale }}
            onPress={() => onChange(choice)}
          >
            {LOCALE_LABELS[choice]}
          </NativeButton>
        ))}
      </View>
    </View>
  )
}
