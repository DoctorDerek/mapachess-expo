import { fileURLToPath } from "node:url"
import { ESLint } from "eslint"
import { describe, expect, it } from "vitest"

const eslint = new ESLint({ cwd: fileURLToPath(new URL(".", import.meta.url)) })

describe("repository ESLint coverage", () => {
  it.each([
    "apps/web/components/presentation/MapachessWordmark.tsx",
    "apps/mobile/app/index.tsx",
    "packages/hints/src/betterHints.ts",
    "packages/hints/test/betterHints.test.ts",
    "e2e/settings-navigation.spec.ts",
    "scripts/create-presentation-asset-archive.ts",
    "playwright.config.ts",
    "scripts/lint-probe.mts",
    "scripts/lint-probe.cts",
    "packages/stockfish/src/engineValidation.ts",
    "apps/web/lib/gameplay/openWebMatchRuntime.ts",
    "apps/web/lib/gameplay/webMatchSession.ts",
    "apps/web/lib/stockfish/webWorkerUciTransport.test.ts",
  ])(
    "detects TypeScript findings in %s without ignoring the file",
    async (filePath) => {
      const results = await eslint.lintText("export const value: any = 1", {
        filePath,
      })

      expect(results).toHaveLength(1)
      expect(results[0]?.fatalErrorCount).toBe(0)
      expect(results[0]?.messages).toEqual([
        expect.objectContaining({
          ruleId: "@typescript-eslint/no-explicit-any",
          severity: 1,
        }),
      ])
    },
  )

  it("accepts typed JSX with props used by the rendered output", async () => {
    const results = await eslint.lintText(
      "type Props = Readonly<{ label: string }>; export default function Control({ label }: Props) { return <button>{label}</button> }",
      { filePath: "apps/web/components/presentation/MapachessWordmark.tsx" },
    )

    expect(results).toHaveLength(1)
    expect(results[0]?.messages).toEqual([])
  })

  it("keeps core correctness rules active for TypeScript", async () => {
    const results = await eslint.lintText(
      "export function value(): number { debugger; return 1 }",
      { filePath: "packages/hints/src/betterHints.ts" },
    )

    expect(results[0]?.messages).toEqual([
      expect.objectContaining({ ruleId: "no-debugger", severity: 1 }),
    ])
  })

  it("allows explicit unused callback arguments and omitted object fields", async () => {
    const results = await eslint.lintText(
      "export function migrate(value: { retained: number; removed: number }, _context: unknown) { const { removed, ...remaining } = value; return remaining }",
      { filePath: "packages/profile/src/playerAppearance.ts" },
    )

    expect(results[0]?.messages).toEqual([])
  })

  it.each([
    "const unused = 1; export const retained = 2",
    "const _unused = 1; export const retained = 2",
    "import { unused } from './fixture'; export const retained = 2",
    "export function value(unused: number) { return 2 }",
    "export function value(_used: number) { return _used }",
  ])(
    "still reports unused code or misleading argument names: %s",
    async (source) => {
      const results = await eslint.lintText(source, {
        filePath: "packages/profile/src/playerAppearance.ts",
      })

      expect(results[0]?.messages).toEqual([
        expect.objectContaining({
          ruleId: "@typescript-eslint/no-unused-vars",
          severity: 1,
        }),
      ])
    },
  )

  it("preserves callbacks that can read cleanup before assignment", async () => {
    const results = await eslint.lintText(
      "export function start(register: (done: () => void) => () => void) { let cleanup: (() => void) | undefined; const done = () => cleanup?.(); cleanup = register(done); return cleanup }",
      { filePath: "apps/web/lib/presentation/lint-probe.ts" },
    )

    expect(results[0]?.messages).toEqual([])
    const findings = await eslint.lintText(
      "export function value() { let result = 1; return result }",
      { filePath: "apps/web/lib/presentation/lint-probe.ts" },
    )
    expect(findings[0]?.messages).toEqual([
      expect.objectContaining({ ruleId: "prefer-const", severity: 1 }),
    ])
  })

  it("retains JavaScript rules and the native Metro environment", async () => {
    const findings = await eslint.lintText("missingValue()", {
      filePath: "scripts/lint-probe.mjs",
    })
    expect(findings[0]?.messages).toEqual([
      expect.objectContaining({ ruleId: "no-undef", severity: 1 }),
    ])
    const metro = await eslint.lintText(
      "module.exports = require(__dirname + '/config')",
      { filePath: "apps/mobile/metro.config.js" },
    )
    expect(metro[0]?.messages).toEqual([])
  })

  it("allows intentional control-character rejection in the canonical validator", async () => {
    const results = await eslint.lintText(
      String.raw`export const controlCharacters = /[\u0000-\u001f\u007f]/`,
      { filePath: "packages/stockfish/src/engineValidation.ts" },
    )

    expect(results[0]?.messages).toEqual([])
  })

  it.each([
    "packages/stockfish/src/buildIdentity.ts",
    "packages/calibration/src/calibrationPlan.ts",
    "packages/calibration/src/opponentPolicy.ts",
  ])(
    "still reports a duplicate control-character regex in %s",
    async (filePath) => {
      const results = await eslint.lintText(
        String.raw`export const controlCharacters = /[\u0000-\u001f\u007f]/`,
        { filePath },
      )

      expect(results[0]?.messages).toEqual([
        expect.objectContaining({ ruleId: "no-control-regex", severity: 1 }),
      ])
    },
  )

  it.each([
    "apps/web/lib/gameplay/openWebMatchRuntime.ts",
    "apps/web/lib/gameplay/webMatchSession.ts",
  ])(
    "allows aggregate failures in their owning module %s",
    async (filePath) => {
      const results = await eslint.lintText(
        "export function close() { try { throw new Error('open') } catch (error) { throw new AggregateError([error, new Error('close')], 'Both failed') } }",
        { filePath },
      )

      expect(results[0]?.messages).toEqual([])
    },
  )

  it("still reports a lost error cause outside the aggregate-failure owners", async () => {
    const results = await eslint.lintText(
      "export function close() { try { throw new Error('open') } catch (error) { throw new Error(String(error)) } }",
      { filePath: "apps/web/lib/gameplay/lint-probe.ts" },
    )

    expect(results[0]?.messages).toEqual([
      expect.objectContaining({ ruleId: "preserve-caught-error", severity: 1 }),
    ])
  })

  it("allows capturing the constructed Worker only in its factory test", async () => {
    const source =
      "export let constructedWorker: CapturedWorker | undefined; export class CapturedWorker { constructor() { constructedWorker = this } }"
    const allowed = await eslint.lintText(source, {
      filePath: "apps/web/lib/stockfish/webWorkerUciTransport.test.ts",
    })
    const findings = await eslint.lintText(source, {
      filePath: "apps/web/lib/stockfish/lint-probe.ts",
    })

    expect(allowed[0]?.messages).toEqual([])
    expect(findings[0]?.messages).toEqual([
      expect.objectContaining({
        ruleId: "@typescript-eslint/no-this-alias",
        severity: 1,
      }),
    ])
  })

  it("still reports ordinary this aliases in the Worker factory test", async () => {
    const results = await eslint.lintText(
      "export class CapturedWorker { getSelf() { const worker = this; return worker } }",
      { filePath: "apps/web/lib/stockfish/webWorkerUciTransport.test.ts" },
    )

    expect(results[0]?.messages).toEqual([
      expect.objectContaining({
        ruleId: "@typescript-eslint/no-this-alias",
        severity: 1,
      }),
    ])
  })

  it.each([
    "node_modules/fixture/index.ts",
    "apps/web/.next/types/routes.ts",
    "packages/hints/dist/betterHints.d.ts",
    "coverage/lint-probe.ts",
    "vendor/lint-probe.ts",
    "gdd.lint-probe-scratch.ts",
    "apps/web/next-env.d.ts",
  ])("keeps generated and private files excluded: %s", async (filePath) => {
    await expect(eslint.isPathIgnored(filePath)).resolves.toBe(true)
  })
})
