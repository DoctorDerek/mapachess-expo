const path = require("node:path")
const expoPreset = require("jest-expo/jest-preset")

const mobilePackageRoot = path.dirname(require.resolve("./package.json"))
const chessopsCommonJsEntry = require.resolve("chessops/chess", {
  paths: [path.resolve(mobilePackageRoot, "../../packages/match")],
})
const badrapResultCommonJsEntry = require.resolve("@badrap/result", {
  paths: [path.dirname(chessopsCommonJsEntry)],
})
const sourcePattern = "\\.[jt]sx?$"
const [sourceTransformer, sourceOptions] = expoPreset.transform[sourcePattern]

module.exports = {
  preset: "jest-expo",
  clearMocks: true,
  restoreMocks: true,
  testMatch: ["<rootDir>/test/**/*.test.ts", "<rootDir>/test/**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transform: {
    ...expoPreset.transform,
    [sourcePattern]: [
      sourceTransformer,
      {
        ...sourceOptions,
        plugins: [
          ...(sourceOptions.plugins ?? []),
          require.resolve("babel-plugin-dynamic-import-node"),
        ],
      },
    ],
  },
  transformIgnorePatterns: [
    "node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg))",
  ],
  moduleNameMapper: {
    "^@badrap/result$": badrapResultCommonJsEntry,
    "^@/(.*)$": "<rootDir>/$1",
  },
  collectCoverageFrom: [
    "<rootDir>/app/index.tsx",
    "<rootDir>/components/**/*.tsx",
    "<rootDir>/lib/**/*.ts",
    "!<rootDir>/lib/**/*.d.ts",
    "!<rootDir>/lib/presentation/nativeAssetManifest.js",
    "!<rootDir>/lib/presentation/nativeAnimationManifest.js",
  ],
  coverageDirectory: "<rootDir>/../../coverage/native",
  coverageReporters: [
    ["lcov", { projectRoot: path.resolve(mobilePackageRoot, "../..") }],
    "text",
  ],
}
