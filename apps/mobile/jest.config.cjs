module.exports = {
  preset: "jest-expo",
  clearMocks: true,
  restoreMocks: true,
  testMatch: ["<rootDir>/test/**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg))",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  collectCoverageFrom: ["<rootDir>/app/index.tsx"],
  coverageDirectory: "<rootDir>/../../coverage/native",
  coverageReporters: ["lcov", "text"],
}
