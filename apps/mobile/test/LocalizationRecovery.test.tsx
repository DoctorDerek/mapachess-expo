import { describe, expect, it, jest } from "@jest/globals"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { useState } from "react"
import { Pressable, Text, View } from "react-native"
import { CATALOG_LOADERS } from "@mapachess/localization/catalog"
import createCatalogReader from "@mapachess/localization/catalog-reader"
import type { CandidateLocale } from "@mapachess/localization/locale"

const english = CATALOG_LOADERS.en()

describe("shared catalogs in the native renderer", () => {
  it("renders Mexican Spanish actions and numbers and changes language without losing local state", async () => {
    const reader = createCatalogReader(CATALOG_LOADERS)
    function NativeLocaleConsumer() {
      const [locale, setLocale] = useState<CandidateLocale>("es-419")
      const [starts, setStarts] = useState(0)
      const copy = reader.load(locale)
      return (
        <View>
          <Text>{copy.introduction.heading}</Text>
          <Text>{copy.gameplay.awardedXp(1234)}</Text>
          <Text>
            {copy.profile.rating(copy.setup.variants.standard, 445.21)}
          </Text>
          <Text>{starts}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setStarts(starts + 1)}
          >
            <Text>{copy.introduction.start}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setLocale("en")}>
            <Text>{copy.introduction.language}</Text>
          </Pressable>
        </View>
      )
    }
    const rendered = await render(<NativeLocaleConsumer />)
    expect(screen.getByText("Ajedrez con Mejores pistas.")).toBeOnTheScreen()
    expect(screen.getByText("+1,234 XP")).toBeOnTheScreen()
    expect(screen.getByText("Ajedrez estándar · 445 Elo")).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("button", { name: "Comenzar" }))
    expect(screen.getByText("1")).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("button", { name: "Idioma" }))
    expect(screen.getByText("1")).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("button", { name: "Start" }))
    expect(screen.getByText("2")).toBeOnTheScreen()
    expect(reader.health().issues).toEqual([])
    await rendered.unmount()
  })

  it("recovers a missing Spanish action without replacing healthy Spanish text", async () => {
    const spanish = CATALOG_LOADERS["es-419"]()
    const reader = createCatalogReader({
      ...CATALOG_LOADERS,
      "es-419": () => ({
        ...spanish,
        introduction: { ...spanish.introduction, start: null },
      }),
    })
    const copy = reader.load("es-419")
    const onStart = jest.fn()
    const rendered = await render(
      <View>
        <Text>{copy.introduction.heading}</Text>
        <Text>{copy.introduction.language}</Text>
        <Pressable accessibilityRole="button" onPress={onStart}>
          <Text>{copy.introduction.start}</Text>
        </Pressable>
      </View>,
    )
    expect(screen.getByText("Ajedrez con Mejores pistas.")).toBeOnTheScreen()
    expect(screen.getByText("Idioma")).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("button", { name: "Start" }))
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(reader.health().issues).toEqual([
      {
        locale: "es-419",
        path: "introduction.start",
        reason: "missing",
        source: "selected",
        recovery: "english",
      },
    ])
    await rendered.unmount()
  })

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
