import { useLocales } from "expo-localization"
import { createContext, useContext, useMemo, type ReactNode } from "react"
import loadCatalog, {
  type MapachessCatalog,
} from "@mapachess/localization/catalog"
import resolveLocale, {
  DEFAULT_LOCALE,
  type ShippedLocale,
} from "@mapachess/localization/locale"
import {
  selectCurrentPlayerData,
  selectPendingPlayerData,
} from "@mapachess/profile/profile-machine"
import type { ProfileActor } from "@mapachess/profile/profile-runtime"
import useActorSnapshot from "@/lib/useActorSnapshot"

const LocaleContext = createContext<
  Readonly<{ locale: ShippedLocale; copy: MapachessCatalog }>
>({ locale: DEFAULT_LOCALE, copy: loadCatalog(DEFAULT_LOCALE) })
export const useNativeLocale = () => useContext(LocaleContext)

export default function NativeLocaleProvider({
  actor,
  children,
}: Readonly<{ actor: ProfileActor; children: ReactNode }>) {
  const snapshot = useActorSnapshot(actor)
  const locales = useLocales()
  const selection =
    (selectPendingPlayerData(snapshot) ?? selectCurrentPlayerData(snapshot))
      ?.settings.locale ?? null
  const locale = resolveLocale({
    selection,
    preferences: locales.map(({ languageTag }) => languageTag),
  })
  const value = useMemo(() => ({ locale, copy: loadCatalog(locale) }), [locale])
  return <LocaleContext value={value}>{children}</LocaleContext>
}
