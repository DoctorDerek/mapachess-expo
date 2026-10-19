import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import { AUTO_HINT_MODES } from "@mapachess/match/auto-hint-mode"
import createCatalogReader from "../../../../packages/localization/src/catalogReader.js"
import AutoHintModeChoices from "./AutoHintModeChoices"
import AutoHintsHelp from "./AutoHintsHelp"
import { useMapachessCopy } from "./MapachessLocaleProvider"

vi.mock("./MapachessLocaleProvider", () => ({
  useMapachessCopy: vi.fn(() => loadCatalog("en")),
}))

afterEach(() => vi.mocked(useMapachessCopy).mockReset())

describe("Auto-Hints explanations", () => {
  it.each(["en", "es-419"] as const)(
    "reuses all canonical mode descriptions without introducing preference controls in %s",
    (locale) => {
      const copy = loadCatalog(locale)
      vi.mocked(useMapachessCopy).mockReturnValue(copy)
      const onClose = vi.fn()
      const markup = renderToStaticMarkup(<AutoHintsHelp onClose={onClose} />)
      for (const mode of AUTO_HINT_MODES) {
        expect(markup).toContain(copy.setup.autoHints[mode].label)
        expect(markup).toContain(copy.setup.autoHints[mode].description)
        expect(markup).toContain(copy.setup.autoHints[mode].medal)
      }
      expect(markup).toContain(copy.setup.hintMedalExplanation)
      expect(markup).toContain(copy.shared.settingsControls.back)
      expect(markup).not.toContain("<input")
      expect(onClose).not.toHaveBeenCalled()
    },
  )

  it("keeps setup descriptions inline and Settings descriptions behind an accessible help action", () => {
    const onChange = vi.fn()
    const props = {
      autoHintMode: "no-auto-hints" as const,
      disabled: false,
      onAutoHintModeChanged: onChange,
    }
    const setup = renderToStaticMarkup(<AutoHintModeChoices {...props} />)
    const settings = renderToStaticMarkup(
      <AutoHintModeChoices {...props} onExplain={vi.fn()} />,
    )
    const copy = loadCatalog("en")
    for (const mode of AUTO_HINT_MODES) {
      expect(setup).toContain(copy.setup.autoHints[mode].description)
      expect(settings).not.toContain(copy.setup.autoHints[mode].description)
      expect(settings).toContain(copy.setup.autoHints[mode].medal)
    }
    expect(settings).toContain('aria-label="Explain Auto-Hints"')
    expect(settings).not.toMatch(/aria-describedby="[^"]*-description/)
    expect(onChange).not.toHaveBeenCalled()
  })

  it("retains a return action when both catalogs are unavailable", () => {
    const reader = createCatalogReader({ en: () => null, "es-419": () => null })
    vi.mocked(useMapachessCopy).mockReturnValue(reader.load("es-419"))
    const markup = renderToStaticMarkup(<AutoHintsHelp onClose={vi.fn()} />)
    expect(markup).toContain(">Back to Settings</button>")
    expect(markup).not.toContain('disabled=""')
    expect(
      reader.health().issues.some(({ recovery }) => recovery === "emergency"),
    ).toBe(true)
  })
})
