"use client"

import { useSelector } from "@xstate/react"
import { createContext, useContext, useEffect, type ReactNode } from "react"
import type { ActorRefFrom } from "xstate"
import loadCatalog, {
  type MapachessCatalog,
} from "@mapachess/localization/catalog"
import resolveLocale, {
  DEFAULT_LOCALE,
  type ShippedLocale,
} from "@mapachess/localization/locale"
import profileMachine, {
  selectCurrentPlayerData,
  selectPendingPlayerData,
} from "@mapachess/profile/profile-machine"

const LocaleContext = createContext<ShippedLocale>(DEFAULT_LOCALE)

export const useMapachessLocale = (): ShippedLocale => useContext(LocaleContext)

export const useMapachessCopy = (): MapachessCatalog =>
  loadCatalog(useMapachessLocale())

export default function MapachessLocaleProvider({
  actor,
  children,
}: Readonly<{
  actor: ActorRefFrom<typeof profileMachine>
  children: ReactNode
}>) {
  const selection = useSelector(
    actor,
    (snapshot) =>
      (selectPendingPlayerData(snapshot) ?? selectCurrentPlayerData(snapshot))
        ?.settings.locale ?? null,
  )
  const locale = resolveLocale({
    selection,
    preferences: globalThis.navigator?.languages ?? [],
  })
  useEffect(() => {
    const previousLanguage = document.documentElement.lang
    document.documentElement.lang = locale
    return () => {
      document.documentElement.lang = previousLanguage
    }
  }, [locale])
  return <LocaleContext value={locale}>{children}</LocaleContext>
}
