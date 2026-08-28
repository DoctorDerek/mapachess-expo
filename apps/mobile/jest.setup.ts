import { jest } from "@jest/globals"

jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<
      typeof import("react-native-safe-area-context/jest/mock")
    >("react-native-safe-area-context/jest/mock").default,
)
