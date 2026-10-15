import type { MapachessCatalog } from "./catalog.js"
import createCatalogIssues, { type CatalogHealth } from "./catalogIssues.js"
import emergencyCatalog from "./emergencyCatalog.js"
import { DEFAULT_LOCALE, type CandidateLocale } from "./locale.js"
import {
  isMessageRows,
  isMessageText,
  messageMatches,
  readMember,
  readMessage,
  type MessageRead,
} from "./messageRecovery.js"

export type CatalogSources = Readonly<
  Partial<Record<CandidateLocale, () => unknown>>
>

export type CatalogReader = Readonly<{
  load: (locale: CandidateLocale) => MapachessCatalog
  health: () => CatalogHealth
}>

function matchesCatalog(value: unknown): value is MapachessCatalog {
  return messageMatches(emergencyCatalog, value)
}

export default function createCatalogReader(
  sources: CatalogSources,
): CatalogReader {
  const diagnostics = createCatalogIssues()
  const catalogs = new Map<CandidateLocale, MapachessCatalog>()
  const originals = new Map<CandidateLocale, MessageRead>()

  function original(locale: CandidateLocale): MessageRead {
    const cached = originals.get(locale)
    if (cached !== undefined) return cached
    const result = readMessage(() => {
      const loader = sources[locale]
      return typeof loader === "function" ? loader() : undefined
    })
    originals.set(locale, result)
    return result
  }

  function load(locale: CandidateLocale): MapachessCatalog {
    const cached = catalogs.get(locale)
    if (cached !== undefined) return cached
    const selected = original(locale)
    const english = original(DEFAULT_LOCALE)
    const sameSource =
      selected === english ||
      (selected.ok && english.ok && selected.value === english.value)

    function choose(
      path: string,
      primary: MessageRead,
      secondary: MessageRead,
      accepts: (value: unknown) => boolean,
      emergency: unknown,
    ): unknown {
      const accepted = (result: MessageRead): boolean => {
        if (!result.ok) return false
        const check = readMessage(() => accepts(result.value))
        return check.ok && check.value === true
      }
      if (primary.ok && accepted(primary)) return primary.value
      const useEnglish = !sameSource && secondary.ok && accepted(secondary)
      diagnostics.record({
        locale,
        path,
        source: "selected",
        reason: primary.ok ? "invalid" : primary.reason,
        recovery: useEnglish ? "english" : "emergency",
      })
      if (useEnglish && secondary.ok) return secondary.value
      if (!sameSource)
        diagnostics.record({
          locale,
          path,
          source: "english",
          reason: secondary.ok ? "invalid" : secondary.reason,
          recovery: "emergency",
        })
      return emergency
    }

    function repair(
      contract: unknown,
      primary: MessageRead,
      secondary: MessageRead,
      path: string,
    ): unknown {
      if (typeof contract === "string") {
        return choose(
          path,
          primary,
          secondary,
          (value) => isMessageText(value, contract === ""),
          contract,
        )
      }
      if (typeof contract === "function") {
        choose(
          path,
          primary,
          secondary,
          (value) => typeof value === "function",
          contract,
        )
        return (...parameters: unknown[]): unknown => {
          const emergency: unknown = Reflect.apply(
            contract,
            undefined,
            parameters,
          )
          const invoke = (source: MessageRead): MessageRead => {
            if (!source.ok) return source
            const formatter = source.value
            if (typeof formatter !== "function")
              return { ok: false, reason: "invalid" }
            return readMessage(() => {
              const result: unknown = Reflect.apply(
                formatter,
                undefined,
                parameters,
              )
              return Array.isArray(emergency) && isMessageRows(result)
                ? Object.freeze(result.map((row) => Object.freeze([...row])))
                : result
            })
          }
          const first = invoke(primary)
          // Invariant: only try English after the selected formatter actually fails.
          const accepts = Array.isArray(emergency)
            ? isMessageRows
            : isMessageText
          const valid = first.ok && readMessage(() => accepts(first.value))
          const second =
            valid && valid.ok && valid.value === true
              ? first
              : sameSource ||
                  (primary.ok &&
                    secondary.ok &&
                    primary.value === secondary.value)
                ? first
                : invoke(secondary)
          return choose(path, first, second, accepts, emergency)
        }
      }
      if (Array.isArray(contract)) {
        return Object.freeze(
          contract.map((child: unknown, index) =>
            repair(
              child,
              readMember(primary, String(index)),
              readMember(secondary, String(index)),
              `${path}.${index}`,
            ),
          ),
        )
      }
      if (typeof contract === "object" && contract !== null) {
        return Object.freeze(
          Object.fromEntries(
            Object.entries(contract).map(([key, child]: [string, unknown]) => [
              key,
              repair(
                child,
                readMember(primary, key),
                readMember(secondary, key),
                path === "$" ? key : `${path}.${key}`,
              ),
            ]),
          ),
        )
      }
      return contract
    }

    for (const [source, result] of [
      ["selected", selected],
      ["english", english],
    ] as const) {
      if (source === "english" && sameSource) continue
      if (!result.ok)
        diagnostics.record({
          locale,
          path: "$",
          source,
          reason: result.reason,
          recovery:
            source === "selected" && !sameSource && english.ok
              ? "english"
              : "emergency",
        })
    }
    const repaired = repair(emergencyCatalog, selected, english, "$")
    let catalog = emergencyCatalog
    if (matchesCatalog(repaired)) catalog = repaired
    else
      diagnostics.record({
        locale,
        path: "$",
        source: "selected",
        reason: "invalid",
        recovery: "emergency",
      })
    catalogs.set(locale, catalog)
    return catalog
  }

  return Object.freeze({ load, health: diagnostics.snapshot })
}
