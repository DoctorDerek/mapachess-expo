import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import createCatalogReader from "../../../../packages/localization/src/catalogReader.js"
import english from "../../../../packages/localization/src/en.js"
import RecoverableView from "../presentation/RecoverableView"
import Introduction from "./Introduction"
import ProfileRecoveryPanel from "./ProfileRecoveryPanel"

vi.mock("@mapachess/localization/catalog", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@mapachess/localization/catalog")>()
  return { ...actual, default: vi.fn(actual.default) }
})

afterEach(() => vi.mocked(loadCatalog).mockReset())

describe("web recovery surfaces with a corrupt catalog", () => {
  it("renders first-arrival Start and Language even with the entire English catalog missing", () => {
    const reader = createCatalogReader({ en: () => null })
    vi.mocked(loadCatalog).mockImplementation(reader.load)
    const onStart = vi.fn()
    const markup = renderToStaticMarkup(
      <Introduction
        locale="en"
        pending={false}
        blocked={false}
        onLocaleChanged={vi.fn()}
        onStart={onStart}
      />,
    )
    expect(markup).toContain("Mapachess")
    expect(markup).toContain(">Language</span>")
    expect(markup).toContain(">Start</span>")
    expect(markup).toContain('value="en" selected=""')
    expect(markup).not.toContain('disabled=""')
    expect(onStart).not.toHaveBeenCalled()
    expect(reader.health().issues[0]).toMatchObject({
      path: "$",
      recovery: "emergency",
    })
  })

  it("renders actual view and data recovery controls without resetting data or invoking callbacks", () => {
    const reader = createCatalogReader({
      en: () => ({ ...english, interface: null }),
    })
    vi.mocked(loadCatalog).mockImplementation(reader.load)
    const boundary = new RecoverableView({
      title: "Display failed",
      description: "Data retained",
      children: "Board",
    })
    boundary.state = RecoverableView.getDerivedStateFromError(
      new Error("Render fixture"),
    )
    expect(renderToStaticMarkup(boundary.render())).toContain(
      ">Try again</button>",
    )
    const onReset = vi.fn()
    const markup = renderToStaticMarkup(
      <ProfileRecoveryPanel
        downloadFailed={false}
        hasLastKnownGood={true}
        importIssue={null}
        onBackupRead={vi.fn()}
        onExportUnreadable={vi.fn()}
        onResetConfirmed={onReset}
        onRestoreLastKnownGood={vi.fn()}
        onTryAgain={vi.fn()}
      />,
    )
    expect(markup).toContain("Export unreadable data")
    expect(markup).toContain("Restore last known-good save")
    expect(markup).toContain("Review full local reset")
    expect(onReset).not.toHaveBeenCalled()
    expect(reader.health().issues.length).toBeGreaterThan(0)
    expect(
      reader
        .health()
        .issues.every(
          ({ path, recovery }) =>
            path.startsWith("interface.") && recovery === "emergency",
        ),
    ).toBe(true)
  })
})
