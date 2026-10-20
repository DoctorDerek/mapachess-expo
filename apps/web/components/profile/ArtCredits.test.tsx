import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import localizeArtCredits from "@mapachess/match-presentation/art-credits"
import createCatalogReader from "../../../../packages/localization/src/catalogReader.js"
import ArtCredits from "./ArtCredits"
import { useMapachessCopy } from "./MapachessLocaleProvider"

vi.mock("./MapachessLocaleProvider", () => ({
  useMapachessCopy: vi.fn(() => loadCatalog("en")),
}))

afterEach(() => vi.mocked(useMapachessCopy).mockReset())

describe("Credits uses the selected language without changing attribution", () => {
  it.each(["en", "es-419"] as const)(
    "renders localized metadata, original names and safe source links in %s",
    (locale) => {
      const copy = loadCatalog(locale)
      vi.mocked(useMapachessCopy).mockReturnValue(copy)
      const markup = renderToStaticMarkup(<ArtCredits onClose={vi.fn()} />)
      expect(markup.match(/<h3\b/g)).toHaveLength(15)
      expect(markup).toContain(copy.shared.creditControls.title)
      expect(markup).toContain(copy.shared.settingsControls.back)
      expect(markup).not.toContain("<details")
      expect(markup).not.toContain("<summary")
      for (const credit of localizeArtCredits(copy)) {
        expect(markup).toContain(`${credit.title} · ${credit.creator}`)
        expect(markup).toContain(credit.contribution)
        expect(markup).toContain(credit.license)
        expect(markup).toContain(`href="${credit.licenseUrl}"`)
        for (const source of credit.sources) {
          expect(markup).toContain(
            `href="${source.url}" target="_blank" rel="noopener noreferrer"`,
          )
          expect(markup).toContain(source.label)
          expect(markup).toContain(
            `· ${credit.title} · ${copy.shared.creditControls.externalLink}`,
          )
        }
      }
    },
  )

  it("still renders attribution links and an enabled return action when both catalogs are missing", () => {
    const reader = createCatalogReader({ en: () => null, "es-419": () => null })
    vi.mocked(useMapachessCopy).mockReturnValue(reader.load("es-419"))
    const onClose = vi.fn()
    const markup = renderToStaticMarkup(<ArtCredits onClose={onClose} />)
    expect(markup.match(/<h3\b/g)).toHaveLength(15)
    expect(markup).toContain("CC BY 4.0")
    expect(markup).toContain(
      'href="https://game-icons.net/1x1/skoll/chess-queen.html"',
    )
    expect(markup).toContain(">Back to Settings</button>")
    expect(markup).not.toContain('disabled=""')
    expect(onClose).not.toHaveBeenCalled()
    expect(
      reader.health().issues.some(({ recovery }) => recovery === "emergency"),
    ).toBe(true)
  })
})
