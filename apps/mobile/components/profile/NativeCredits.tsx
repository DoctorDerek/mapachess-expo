import { View } from "react-native"
import localizeArtCredits from "@mapachess/match-presentation/art-credits"
import NativeButton from "../presentation/NativeButton"
import NativeLink from "../presentation/NativeLink"
import NativePanel from "../presentation/NativePanel"
import NativeText from "../presentation/NativeText"
import { useNativeLocale } from "./NativeLocaleProvider"

export default function NativeCredits({
  onBack,
}: Readonly<{ onBack: () => void }>) {
  const { copy } = useNativeLocale()
  return (
    <NativePanel
      title={copy.shared.creditControls.title}
      onBack={onBack}
      actions={
        <NativeButton variant="secondary" onPress={onBack}>
          {copy.shared.settingsControls.back}
        </NativeButton>
      }
    >
      {localizeArtCredits(copy).map((credit) => (
        <View
          key={credit.id}
          className="bg-mapachito-surface gap-2 rounded-xl p-4"
        >
          <NativeText className="font-native text-xl">
            {credit.title}
          </NativeText>
          <NativeText>{credit.creator}</NativeText>
          <NativeText>{credit.contribution}</NativeText>
          <NativeText>{credit.license}</NativeText>
          {credit.modifications === null ? null : (
            <NativeText>{credit.modifications}</NativeText>
          )}
          <NativeLink url={credit.licenseUrl} label={credit.license} />
          {credit.sources.map((source) => (
            <NativeLink
              key={source.url}
              url={source.url}
              label={source.label}
            />
          ))}
        </View>
      ))}
    </NativePanel>
  )
}
