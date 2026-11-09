import { jest } from "@jest/globals"
import type { ReactNode } from "react"

jest.mock("react-native-reanimated", () => {
  const animation = jest.requireActual<
    typeof import("react-native-reanimated")
  >("react-native-reanimated/mock")
  const { useState } = jest.requireActual<typeof import("react")>("react")
  const createMockValue = animation.useSharedValue
  return {
    ...animation,
    useSharedValue: function useStableSharedValue<Value>(initial: Value) {
      const [value] = useState(() => createMockValue(initial))
      return value
    },
  }
})
jest.mock("react-native-worklets", () =>
  jest.requireActual<typeof import("react-native-worklets")>(
    "react-native-worklets/src/mock",
  ),
)

jest.mock("uniwind", () => {
  const fs = jest.requireActual<typeof import("node:fs")>("node:fs")
  const path = jest.requireActual<typeof import("node:path")>("node:path")
  const root = path.resolve(
    __dirname,
    "../../../packages/match-presentation/styles",
  )
  const css =
    fs.readFileSync(path.join(root, "mapachessTheme.css"), "utf8") +
    fs.readFileSync(path.join(root, "chessBoardTheme.css"), "utf8")
  const tokens = new Map(
    [...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [
      match[1],
      match[2],
    ]),
  )
  const variable = (name: string) => {
    if (name === "--spacing-battle-fallback") return 72
    if (name === "--spacing-battle-recoil-limit") return 10
    return tokens.get(name)
  }
  return {
    ScopedVariables: ({ children }: { children: ReactNode }) => children,
    withUniwind: (component: unknown) => component,
    useResolveClassNames: (classes: string) =>
      classes === "w-16" ? { width: 64 } : {},
    useCSSVariable: (name: string | readonly string[]) =>
      typeof name === "string" ? variable(name) : name.map(variable),
  }
})
jest.mock("expo-localization", () => ({
  useLocales: () => [{ languageTag: "en-US" }],
}))
jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => {
    const { createHash } =
      jest.requireActual<typeof import("node:crypto")>("node:crypto")
    return createHash("sha256").update(value).digest("hex")
  }),
  digest: jest.fn(),
  getRandomValues: jest.fn(),
}))
