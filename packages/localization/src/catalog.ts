import english from "./en.js"
import type { ShippedLocale } from "./locale.js"

export type IntroductionCopy = Readonly<{
  title: string
  region: string
  heading: string
  paragraphs: readonly Readonly<{ lead: string; body: string }>[]
  language: string
  start: string
  starting: string
  credit: string
  author: string
  website: string
  websiteNewTab: string
}>

export type MapachessCatalog = Readonly<{ introduction: IntroductionCopy }>

export const CATALOG_LOADERS = Object.freeze({
  en: (): MapachessCatalog => english,
}) satisfies Readonly<Record<ShippedLocale, () => MapachessCatalog>>

export default function loadCatalog(locale: ShippedLocale): MapachessCatalog {
  return CATALOG_LOADERS[locale]()
}
