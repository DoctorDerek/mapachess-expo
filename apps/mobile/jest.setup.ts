import { afterEach, expect, jest } from "@jest/globals"
import { getCatalogHealth } from "@mapachess/localization/catalog"

afterEach(() => {
  expect(getCatalogHealth()).toEqual({ issues: [], limitReached: false })
})

jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<
      typeof import("react-native-safe-area-context/jest/mock")
    >("react-native-safe-area-context/jest/mock").default,
)
