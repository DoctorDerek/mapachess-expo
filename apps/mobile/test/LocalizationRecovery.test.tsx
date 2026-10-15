import { describe, expect, it, jest } from "@jest/globals"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { useState } from "react"
import { Pressable, Text, View } from "react-native"
import { CATALOG_LOADERS } from "@mapachess/localization/catalog"
import createCatalogReader from "@mapachess/localization/catalog-reader"
import type { CandidateLocale } from "@mapachess/localization/locale"

const english = CATALOG_LOADERS.en()

describe("shared catalogs in the native renderer", () => {
  it("retains usable Start and Language actions through corruption and a language change", async () => {
    const broken = {
      ...english,
      introduction: {
        ...english.introduction,
        start: null,
        language: undefined,
      },
    }
    const reader = createCatalogReader({
      en: () => broken,
      "es-419": () => broken,
    })
    const onStart = jest.fn()
    function NativeRecoveryConsumer() {
      const [locale, setLocale] = useState<CandidateLocale>("es-419")
      const copy = reader.load(locale)
      return (
        <View>
          <Text>{copy.introduction.title}</Text>
          <Pressable accessibilityRole="button" onPress={onStart}>
            <Text>{copy.introduction.start}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setLocale("en")}>
            <Text>{copy.introduction.language}</Text>
          </Pressable>
          <Text>{locale}</Text>
        </View>
      )
    }
    const rendered = await render(<NativeRecoveryConsumer />)
    expect(screen.getByRole("button", { name: "Start" })).toBeOnTheScreen()
    expect(screen.getByText("es-419")).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("button", { name: "Start" }))
    expect(onStart).toHaveBeenCalledTimes(1)
    await fireEvent.press(screen.getByRole("button", { name: "Language" }))
    expect(screen.getByText("en")).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("button", { name: "Start" }))
    expect(onStart).toHaveBeenCalledTimes(2)
    expect(
      reader.health().issues.filter(({ locale }) => locale === "en"),
    ).toEqual([
      {
        locale: "en",
        path: "introduction.language",
        reason: "missing",
        source: "selected",
        recovery: "emergency",
      },
      {
        locale: "en",
        path: "introduction.start",
        reason: "missing",
        source: "selected",
        recovery: "emergency",
      },
    ])
    await rendered.unmount()
  })
})
