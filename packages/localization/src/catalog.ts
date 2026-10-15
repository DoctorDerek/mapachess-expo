import createCatalogReader from "./catalogReader.js"
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

type CatalogText<Value> = Value extends string
  ? string
  : Value extends (...parameters: infer Parameters) => infer Result
    ? (...parameters: Parameters) => Result
    : Value extends object
      ? { readonly [Key in keyof Value]: CatalogText<Value[Key]> }
      : Value

export type MapachessCatalog = CatalogText<typeof english>

export const CATALOG_LOADERS = Object.freeze({
  en: (): MapachessCatalog => english,
}) satisfies Readonly<Record<ShippedLocale, () => MapachessCatalog>>

const catalogs = createCatalogReader(CATALOG_LOADERS)

export const getCatalogHealth = catalogs.health

export default function loadCatalog(locale: ShippedLocale): MapachessCatalog {
  return catalogs.load(locale)
}
