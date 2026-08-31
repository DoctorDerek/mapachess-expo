const path = require("node:path")

const mobilePackageRoot = path.dirname(require.resolve("./package.json"))
const chessopsCommonJsEntry = require.resolve("chessops/chess", {
  paths: [path.resolve(mobilePackageRoot, "../../packages/match")],
})
const badrapResultCommonJsEntry = require.resolve("@badrap/result", {
  paths: [path.dirname(chessopsCommonJsEntry)],
})

module.exports = {
  preset: "jest-expo",
  clearMocks: true,
  restoreMocks: true,
  testMatch: ["<rootDir>/test/**/*.test.ts", "<rootDir>/test/**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg))",
  ],
  moduleNameMapper: {
    "^@badrap/result$": badrapResultCommonJsEntry,
    "^@/(.*)$": "<rootDir>/$1",
  },
  collectCoverageFrom: [
    "<rootDir>/app/index.tsx",
    "<rootDir>/lib/profile/**/*.ts",
  ],
  coverageDirectory: "<rootDir>/../../coverage/native",
  coverageReporters: ["lcov", "text"],
}
