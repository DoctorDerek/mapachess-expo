import { jest } from "@jest/globals"

jest.mock("react-native-reanimated", () =>
  jest.requireActual<typeof import("react-native-reanimated")>(
    "react-native-reanimated/mock",
  ),
)
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
  return {
    withUniwind: (component: unknown) => component,
    useCSSVariable: (name: string | readonly string[]) =>
      typeof name === "string"
        ? tokens.get(name)
        : name.map((token) => tokens.get(token)),
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
